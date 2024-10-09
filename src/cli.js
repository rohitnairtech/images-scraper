#!/usr/bin/env node
const { program } = require('commander');
const { downloadImages, listImageUrls } = require('./index');

program
  .version('1.0.0')
  .description('Image Downloader based on search queries')
  .argument('<queries>', 'Search queries (comma-separated)')
  .option('-a, --action <type>', 'Action to perform: download or list', 'download')
  .option('-l, --limit <number>', 'Limit of images to process', 5)
  .option('-d, --directory <directory>', 'Directory to save images', 'downloads')
  .action(async (queries, options) => {
    const queryArray = queries.trim().split(',');
    console.log(`Action: ${options.action}. Queries: ${queryArray.join(', ')}`);

    if (options.action === 'download') {
      await downloadImages(queryArray, options.limit, options.directory);
      console.log("Downloaded files to" + options.directory);
    } else if (options.action === 'list') {
      const imageUrls = await listImageUrls(queryArray, options.limit);
      imageUrls.forEach((url) => console.log(url));
    } else {
      console.error('Invalid action specified. Use "download" or "list".');
    }
  });

program.parse(process.argv);
