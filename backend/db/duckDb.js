import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DuckDBClient {
  constructor() {
    this.connection = null;
    this.ready = this.init(); // auto-init on import
  }

  async init() {
    // Define the desired path for the database file
    const dbDir = path.resolve(__dirname, './data');
    const dbPath = path.join(dbDir, 'chartBuilder.db');

    // Ensure the directory exists
    try {
      await fs.mkdir(dbDir, { recursive: true });
      console.log(`Directory ensured: ${dbDir}`);
    } catch (err) {
      console.error(`Failed to create directory: ${dbDir}`, err);
      throw err;
    }

    // Create and connect to the DuckDB database
    const db = await DuckDBInstance.create(dbPath);
    this.connection = await db.connect();
    console.log(`DuckDB initialized at ${dbPath}`);
  }

  async query(sql, params = []) {
    await this.ready;
    // const stmt = await this.connection.prepare(sql);
    const reader = await this.connection.runAndReadAll(sql, params);
    const result = reader.getRowObjectsJson();
    return result;
  }

  async run(sql, params = []) {
    await this.ready;
    const stmt = await this.connection.prepare(sql);
    await stmt.run(...params);
  }

  async stream(sql, params = []) {
    await this.ready;
    // Return the connection's stream method
    return this.connection.run(sql, ...params);
  }
}

const dbClient = new DuckDBClient();
export default dbClient;




// duckdb.js
// import { DuckDBInstance } from '@duckdb/node-api';

// class DuckDBClient {
//   constructor() {
//     this.connection = null;
//   }

//   async init() {
//     if (!this.connection) {
//       const db = await DuckDBInstance.create('chartBuilder.db');
//       this.connection = await db.connect();
//       console.log('DuckDB connection established');
//     }
//   }

//   getConnection() {
//     if (!this.connection) {
//       throw new Error('DuckDB not initialized. Call init() first.');
//     }
//     return this.connection;
//   }
// }

// // Export a single instance
// const duckDBClient = new DuckDBClient();
// export default duckDBClient;