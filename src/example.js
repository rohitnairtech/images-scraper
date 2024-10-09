'use strict';

const Scraper = require('./index');

(async () => {
  const results = await Scraper.downloadImages('cat', 10);
  console.log('Download status', results);
})();
