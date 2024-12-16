const { parentPort, workerData } = require("worker_threads");
const Scraper = require('./index');

async function processBatch(batch) {
  const batchResult = await Scraper.listImageUrls(batch, 2);
  // download the image logic here

  /**
   * Loop across batchResult
   * Use axios to get the image as buffer
   * Pass the buffer to sharp -> convert to webp and save on disk -> inside 'userImages' folder
   * Will do the DB operations later 
   */
  return batchResult;
}

processBatch(workerData.batch)
  .then((results) => parentPort.postMessage(results))
  .catch((err) => parentPort.postMessage({ error: err.message }));
