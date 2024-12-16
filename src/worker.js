const { parentPort, workerData } = require("worker_threads");
const Scraper = require('./index');

async function processBatch(batch) {
  const batchResult = await Scraper.listImageUrls(batch, 2);
  // download the image logic here
  return batchResult;
}

processBatch(workerData.batch)
  .then((results) => parentPort.postMessage(results))
  .catch((err) => parentPort.postMessage({ error: err.message }));
