import { DuckDBInstance } from '@duckdb/node-api';
import { DateTime } from 'msnodesqlv8';
import os from 'node:os';

const instance = await DuckDBInstance.create('./data/chartBuilder.db', {
  threads: String(Math.min(4, os.cpus().length)),
});
const conn = await instance.connect();

// Bound memory + spill to disk for safety (optional but recommended)
await conn.run(`
  SET memory_limit='8GB';
  SET temp_directory='/tmp/duckdb_tmp';
  SET preserve_insertion_order=false;
`);

// const startTime = Date.now();
// console.log("Starting read parquet", new Date().toISOString())
// const result = await conn.stream(`
//     SELECT * FROM read_parquet('./data/run_1760096237024.parquet')
//     ORDER BY WRITTEN_TRX LIMIT 100000
//   `);
  
//   let data = [];
//   while (true) {
//     const chunk = await result.fetchChunk();
//     if (chunk.rowCount === 0) break;
  
//     const rows = chunk.getRows();
//     for (const r of rows) {
//       data.push(r);
//     }
//   }
//   console.log("Time taken to read parquet:", (Date.now() - startTime) / 1000, "seconds");
//   console.log("Total rows read:", data.length);
console.log("Starting stream", new Date().toISOString())
const startTime=Date.now();

const outfile = `./data/run_${Date.now()}.parquet`;
await conn.run(`
  COPY (
    SELECT * FROM ADW_FACT_DNDL_UPD_LIMITED;
  )
  TO '${outfile}' (FORMAT PARQUET, COMPRESSION ZSTD)
`);
console.log("File written to", outfile)

console.log("Time taken", (Date.now()-startTime)/1000, "seconds")

// --- STREAM RESULTS ---
// const result = await conn.stream(`
//   SELECt * FROM  ds_msl_extract 
// `);

// Read one chunk at a time; each chunk fits in memory
// while (true) {
//   const chunk = await result.fetchChunk();
//   if (chunk.rowCount === 0) break;  
// //   data=data.concat(chunk)     // end of stream
//   const rows = chunk.getRows();    // or .getRows() for arrays
//   data=[...data,...rows]
// //   for (const r of rows) {
// //     data.push(r)
// //   }
// }

// const endTime=Date.now();
// console.log("Stream ended", new Date().toISOString())
// console.log(data.length)
// console.log("Time taken", (endTime-startTime)/1000, "seconds")