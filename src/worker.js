const { parentPort, workerData } = require("worker_threads");
const Scraper = require('./index');

const { promises: fs } = require("fs");
const axios = require("axios")
const sharp = require("sharp");


const convertPngToWebp = async (imageBuffer, outputPath) => {
  try {
    // Convert image buffer to WebP File
    await sharp(imageBuffer)
      .webp({ quality: 80 }) // Adjust quality if needed (0-100)
      .toFile(outputPath);

    console.log(`Converted buffer to ${outputPath}`);
  } catch (error) {
    console.error("Error converting image:", error.message);
  }
};

const checkAndCreateFolder = async (path) => {
  try {
    await fs.access(path);
  } catch (e) {
    if (e.code === "ENOENT") {
      await fs.mkdir(path, { recursive: true }),
        console.info(
          `${path} have been created.`,
        );
    } else {
      console.error(`An error occurred: ${e.message}`);
    }
  }
}

async function processSubBatch(subBatch){
  console.log(subBatch);
  const batchResult = await Scraper.listImageUrls(subBatch, 1);
  for (const itemName of Object.keys(batchResult)) {
    for (const url of batchResult[itemName]) {
      try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        await convertPngToWebp(response.data, `${process.cwd()}/userImages/${itemName}.webp`);
      } catch (downloadError) {
        console.error(
          `${itemName} Failed to download image: ${url}`,
          downloadError.message,
        );
      }
    }
  }
  return batchResult;
}

async function processBatch(batch) {
  const batchSize = 10; // change this if you want to process more at a time per instance
  const numberOfBatch = Math.ceil(batch.length/batchSize);
  console.log("numberOfBatch ", numberOfBatch);
  if(numberOfBatch > 1){
    const subBatches = Array.from({ length: numberOfBatch }, (_, i) =>
      batch.slice(i * batchSize, (i + 1) * batchSize)
    );
    console.log("subBatches", subBatches);
    const subBatchLastIndex = subBatches.length - 1;
    if(subBatches[subBatchLastIndex].length < 10){
      subBatches[subBatchLastIndex - 1].push(...subBatches[subBatchLastIndex]);
      subBatches.pop();
    }
    console.log("subBatches", subBatches);
    const batchResult = [];
    for(let x = 0; x < subBatches.length; x++){
      const result = await processSubBatch(subBatches[x]);
      batchResult.push(result);
    }
    return batchResult;
  }
  
  // slice the data, loop across each subBatchs

  const batchResult = await processSubBatch(batch);
  // download the image logic here

  /**
   * Loop across batchResult
   * Use axios to get the image as buffer
   * Pass the buffer to sharp -> convert to webp and save on disk -> inside 'userImages' folder
   * Will do the DB operations later 
   */

  /**
   * We will be checking how many items are there in the batch, we will break the batches based on how many hundreds its has
   * ex: batch with 300 data will be converted to 3 batches
   * So that at no item extra data will be held in the node instances
   */
  return batchResult;
}

processBatch(workerData.batch)
  .then((results) => parentPort.postMessage(results))
  // .catch((err) => console.log(err));
  .catch((err) => parentPort.postMessage({ error: err.message }));
