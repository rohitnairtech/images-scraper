const { Worker } = require("worker_threads");
const { performance } = require("perf_hooks");
const path = require("path");
import { MongoClient } from 'mongodb';

const url = 'mongodb://localhost:27017';
const dbName = 'pos_rapsap_1';

const client = new MongoClient(url);
await client.connect();
const db = client.db(dbName);
const collection = db.collection('categories');

const records = await collection.find({}).toArray();

const items = records.map(({name})=>name);
const numWorkers = 4;
const batchSize = Math.ceil(items.length / numWorkers); // Batch size
const batches = Array.from({ length: numWorkers }, (_, i) =>
  items.slice(i * batchSize, (i + 1) * batchSize)
);


async function createWorker(batch) {
  return new Promise((resolve, reject) => {
    const workerPath = path.resolve(__dirname, "worker.js");
    const worker = new Worker(workerPath, { workerData: { batch } });

    worker.on("message", resolve); // Collect results
    worker.on("error", reject);   // Handle errors
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker stopped with exit code ${code}`));
      }
    });
  });
}

// Function to add delay
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Main function to process all batches
async function processAllBatches() {
  const start = performance.now();
  const promises = batches.map((batch, index) =>
    sleep(index * 2000)
      .then(() => createWorker(batch)) // Start the worker after delay
  );

  const results = await Promise.all(promises);
  const end = performance.now(); 
  console.log(`Total time: ${((end - start) / 1000) / 60} minutes`);
  await client.close();
  return results.flat(); // Combine all results into a single array
}

processAllBatches()
  .then((urls) => {
    console.log("All URLs fetched:", urls);
  })
  .catch((err) => {
    console.error("Error occurred:", err);
  });
