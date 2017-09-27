var slug = require('slug');

/**
 * A metalsmith plugin to create dedicated pages for tags in posts or pages.
 *
 * @return {Function}
 */
function plugin(opts) {

  // Check if opts is an object or an array. If it's an object lets standardize to an array
  if (!Array.isArray(opts) && typeof opts === 'object') {
    opts = [opts];
  }

  return function(files, metalsmith, done) {

    // Loop through our opts and do the things
    opts.forEach(function(opt) {

      /**
       * Holds a mapping of tag names to an array of files with that tag.
       * @type {Object}
       */
      var tagList = {};

      opt = opt || {};
      opt.path = opt.path || 'tags/:tag/index.html';
      opt.pathPage = opt.pathPage || 'tags/:tag/:num/index.html';
      opt.layout = opt.layout || 'partials/tag.hbt';
      opt.handle = opt.handle || 'tags';
      opt.metadataKey = opt.metadataKey || 'tags';
      opt.sortBy = opt.sortBy || 'title';
      opt.reverse = opt.reverse || false;
      opt.perPage  = opt.perPage || 0;
      opt.skipMetadata = opt.skipMetadata || false;
      opt.slug = opt.slug || {mode: 'rfc3986'};

      /**
       * Get a safe tag
       * @param {string} a tag name
       * @return {string} safe tag
       */
      function safeTag(tag) {
        if (typeof opt.slug === 'function') {
          return opt.slug(tag);
        }

        return slug(tag, opt.slug);
      }

      /**
       * Sort tags by property given in opts.sortBy.
       * @param {Object} a Post object.
       * @param {Object} b Post object.
       * @return {number} sort value.
       */
      function sortBy(a, b) {
        a = a[opt.sortBy];
        b = b[opt.sortBy];
        if (!a && !b) {
          return 0;
        }
        if (!a) {
          return -1;
        }
        if (!b) {
          return 1;
        }
        if (b > a) {
          return -1;
        }
        if (a > b) {
          return 1;
        }
        return 0;
      }

      function getFilePath(path, opt) {
        return path
          .replace(/:num/g, opt.num)
          .replace(/:tag/g, safeTag(opt.tag));
      }

      // Find all tags and their associated files.
      // Using a for-loop so we don't incur the cost of creating a large array
      // of file names that we use to loop over the files object.
      for (var fileName in files) {
        var data = files[fileName];
        if (!data) {
          continue;
        }

        var tagsData = data[opt.handle];

        // If we have tag data for this file then turn it into an array of
        // individual tags where each tag has been sanitized.
        if (tagsData) {
          // Convert data into array.
          if (typeof tagsData === 'string') {
            tagsData = tagsData.split(',');
          }

          // Re-initialize tag array.
          data[opt.handle] = [];

          tagsData.forEach(function(rawTag) {
            // Trim leading + trailing white space from tag.
            var tag = String(rawTag).trim();


            // Save url safe formatted and display versions of tag data
            data[opt.handle].push({ name: tag, slug: safeTag(tag)});

            // Add each tag to our overall tagList and initialize array if it
            // doesn't exist.
            if (!tagList[tag]) {
              tagList[tag] = [];
            }

            // Store a reference to where the file data exists to reduce our
            // overhead.
            tagList[tag].push(fileName);
          });
        }
      }

      // Add to metalsmith.metadata for access outside of the tag files.
      if (!opt.skipMetadata) {
        var metadata = metalsmith.metadata();
        metadata[opt.metadataKey] = metadata[opt.metadataKey] || {};
      }

      for (var tag in tagList) {
        // Map the array of tagList names back to the actual data object.
        // Sort tags via opts.sortBy property value.
        var posts = tagList[tag].map(function(fileName) {
          return files[fileName];
        }).sort(sortBy);

        // Reverse posts if desired.
        if (opt.reverse) {
          posts.reverse();
        }

        if (!opt.skipMetadata) {
          metadata[opt.metadataKey][tag] = posts;
          metadata[opt.metadataKey][tag].urlSafe = safeTag(tag);
        }

        // If we set opts.perPage to 0 then we don't want to paginate and as such
        // we should have all posts shown on one page.
        var postsPerPage = opt.perPage === 0 ? posts.length : opt.perPage;
        var numPages = Math.ceil(posts.length / postsPerPage);
        var pages = [];

        for (var i = 0; i < numPages; i++) {
          var pageFiles = posts.slice(i * postsPerPage, (i + 1) * postsPerPage);

          // Generate a new file based on the filename with correct metadata.
          var page = {
            layout: opt.layout,
            // TODO: remove this property when metalsmith-templates usage
            // declines.
            template: opt.template,
            contents: '',
            tag: tag,
            pagination: {
              num: i + 1,
              pages: pages,
              tag: tag,
              files: pageFiles
            }
          };

          // Render the non-first pages differently to the rest, when set.
          if (i > 0 && opt.pathPage) {
            page.path = getFilePath(opt.pathPage, page.pagination);
          } else {
            page.path = getFilePath(opt.path, page.pagination);
          }

          // Add new page to files object.
          files[page.path] = page;

          // Update next/prev references.
          var previousPage = pages[i - 1];
          if (previousPage) {
            page.pagination.previous = previousPage;
            previousPage.pagination.next = page;
          }

          pages.push(page);
        }
      }

      // update metadata
      if (!opt.skipMetadata) {
        metalsmith.metadata(metadata);
      }

      /* clearing this after each pass avoids
       * double counting when using metalsmith-watch
       */
      tagList = {};

    });

    done();

  };

}

/**
 * Expose `plugin`.
 */
module.exports = plugin;
