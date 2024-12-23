import { Worker } from 'worker_threads';
import { performance } from 'perf_hooks';
import path from 'path';
import { MongoClient } from 'mongodb';

const url = 'mongodb://localhost:27017';
const dbName = 'pos_apoorthi_mart_1'; // change the dbName

const client = new MongoClient(url);
await client.connect();
const db = client.db(dbName);
const collection = db.collection('items');

// add the logic to check if 1. it has image key 2. if the array is empty
const records = await collection.find({
  $and: [
    { images: { $exists: true } },
    { images: { $size: 0 } }
  ]
}).toArray(); 

const items = records.map(({name, _id}) => { return {name, _id: String(_id)} });

// const items = [{name:'maggi atta noodles', _id: 'ad3211aa'}]
// console.log(items.length);
// process.exit(0)
// const items = ["maggi noodles"];
const numWorkers = 4;
const batchSize = Math.ceil(items.length / numWorkers);
console.log(batchSize); // Batch size
const batches = Array.from({ length: numWorkers }, (_, i) =>
  items.slice(i * batchSize, (i + 1) * batchSize)
);
console.log(batches);

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
