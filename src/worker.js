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

async function processBatch(batch) {
  const batchResult = await Scraper.listImageUrls(batch, 1);
  // download the image logic here

  /**
   * Loop across batchResult
   * Use axios to get the image as buffer
   * Pass the buffer to sharp -> convert to webp and save on disk -> inside 'userImages' folder
   * Will do the DB operations later 
   */
  // console.log(Object.keys(batchResult))
  // await checkAndCreateFolder("/userImages")
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

processBatch(workerData.batch)
  .then((results) => parentPort.postMessage(results))
  // .catch((err) => console.log(err));
  .catch((err) => parentPort.postMessage({ error: err.message }));
