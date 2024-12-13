'use strict';

const Scraper = require('./index');

(async () => {
  const resultC = await Scraper.listImageUrls(['cat', 'dog', 'zandu balm'], 5);
  console.log('Download status', resultC);
})();
