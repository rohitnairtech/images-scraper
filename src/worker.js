const { parentPort, workerData } = require("worker_threads");
const Scraper = require('./index');

const { promises: fs } = require("fs");
const axios = require("axios")
const sharp = require("sharp");

const { MongoClient, ObjectId } = require('mongodb');

const url = 'mongodb://localhost:27017';
const dbName = 'pos_rapsap_1'; // change the dbName
const client = new MongoClient(url);
await client.connect();
const db = client.db(dbName);
const collection = db.collection('items');

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

async function processSubBatch(subBatch) {
  console.log(subBatch);
  const lookup = {};
  const subBatchNames = subBatch.map(({ name, _id }) => {
    lookup[name.replace(/\s/g, '')] = _id;
    return name
  })
  const batchResult = await Scraper.listImageUrls(subBatchNames, 3);
  console.log(batchResult);
  for (const itemName of Object.keys(batchResult)) {
    const item_id = new ObjectId.createFromHexString(lookup[itemName]);
    const images = []
    for (const [index, url] of batchResult[itemName].entries()) {
      console.log(`Index: ${index}, URL: ${url}`);
      try {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        const fileName = `${itemName}-${index + 1}.webp`;
        await convertPngToWebp(response.data, `${process.cwd()}/userImages/${fileName}`);
        images.push(`/upload/${dbName}/images/${fileName}`)
        // file name has to be unique, for ex if three images - itemName-1, itemName-2 & itemName-3
        // write the logic to update the image in the DB 
      } catch (downloadError) {
        console.error(
          `${itemName} Failed to download image: ${url}`,
          downloadError.message,
        );
      }
    }
    if (images.length) {
      const { modifiedCount } = await collection.updateOne({ _id: item_id }, { $set: { images } });
      if (!modifiedCount) throw new Error("Failed to update item!");
      console.log(`Added ${images.length} images to ${itemName} ${item_id}`)
    } else {
      console.log(`No images found for ${itemName} ${item_id}`)
    }
  }
  return batchResult;
}

async function processBatch(batch) {
  const batchSize = 50; // change this if you want to process more at a time per instance
  const numberOfBatch = Math.ceil(batch.length / batchSize);
  console.log("numberOfBatch ", numberOfBatch);
  if (numberOfBatch > 1) {
    const subBatches = Array.from({ length: numberOfBatch }, (_, i) =>
      batch.slice(i * batchSize, (i + 1) * batchSize)
    );
    console.log("subBatches", subBatches);
    const subBatchLastIndex = subBatches.length - 1;
    if (subBatches[subBatchLastIndex].length < 10) {
      subBatches[subBatchLastIndex - 1].push(...subBatches[subBatchLastIndex]);
      subBatches.pop();
    }
    console.log("subBatches", subBatches);
    const batchResult = [];
    for (let x = 0; x < subBatches.length; x++) {
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
