import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DuckDBClient {
  constructor() {
    this.connection = null;
    this.db = null; // Store the database instance
    this.ready = this.init(); // auto-init on import
  }

  async init() {
    // Define the desired path for the database file
    const dbDir = path.resolve(__dirname, './data');
    const dbPath = path.join(dbDir, 'chartBuilder.db');
    const walPath = path.join(dbDir, 'chartBuilder.db.wal');

    // Ensure the directory exists
    try {
      await fs.mkdir(dbDir, { recursive: true });
      console.log(`Directory ensured: ${dbDir}`);
    } catch (err) {
      console.error(`Failed to create directory: ${dbDir}`, err);
      throw err;
    }

    try {
      // Create and connect to the DuckDB database with optimized settings
      this.db = await DuckDBInstance.create(dbPath, {
        threads: Math.min(8, os.cpus().length), // Use up to 8 threads
      });
      this.connection = await this.db.connect();
      
      // Set performance optimizations for DuckDB
      await this.connection.run(`
        SET memory_limit='16GB';
        SET threads=${Math.min(8, os.cpus().length)};
        SET preserve_insertion_order=false;
        SET enable_object_cache=true;
        SET enable_progress_bar=false;
        SET checkpoint_threshold='1GB';
      `);
      
      console.log(`✅ DuckDB initialized at ${dbPath} with ${Math.min(8, os.cpus().length)} threads`);
    } catch (err) {
      // If we get a WAL file error, try to recover by removing the corrupted WAL file
      if (err.message && err.message.includes('WAL file')) {
        console.warn('⚠️ WAL file corruption detected. Attempting to recover...');
        try {
          // Close any existing connection/instance before cleanup
          if (this.connection) {
            try {
              this.connection.closeSync();
            } catch (closeErr) {
              // Ignore close errors during recovery
            }
          }
          if (this.db) {
            try {
              this.db.closeSync();
            } catch (closeErr) {
              // Ignore close errors during recovery
            }
          }
          
          // Remove the corrupted WAL file
          try {
            await fs.unlink(walPath);
            console.log('✅ Removed corrupted WAL file');
          } catch (unlinkErr) {
            // WAL file might not exist, that's okay
            if (unlinkErr.code !== 'ENOENT') {
              console.warn('⚠️ Could not remove WAL file:', unlinkErr.message);
            }
          }
          
          // Retry initialization
          this.db = await DuckDBInstance.create(dbPath, {
            threads: Math.min(8, os.cpus().length),
          });
          this.connection = await this.db.connect();
          
          // Set performance optimizations for DuckDB
          await this.connection.run(`
            SET memory_limit='16GB';
            SET threads=${Math.min(8, os.cpus().length)};
            SET preserve_insertion_order=false;
            SET enable_object_cache=true;
            SET enable_progress_bar=false;
            SET checkpoint_threshold='1GB';
          `);
          
          console.log(`✅ DuckDB initialized at ${dbPath} after WAL recovery`);
        } catch (recoveryErr) {
          console.error('❌ Failed to recover from WAL corruption:', recoveryErr.message);
          throw recoveryErr;
        }
      } else {
        throw err;
      }
    }
  }

  async close() {
    try {
      // Flush any pending writes before closing
      if (this.connection) {
        try {
          // Ensure all transactions are committed
          await this.connection.run('COMMIT');
        } catch (commitErr) {
          // Ignore commit errors (might not be in a transaction)
        }
        // Close the connection synchronously
        this.connection.closeSync();
        this.connection = null;
      }
      if (this.db) {
        // Close the database instance synchronously
        this.db.closeSync();
        this.db = null;
      }
      console.log('✅ DuckDB connection closed');
    } catch (err) {
      console.warn('⚠️ Error closing DuckDB:', err.message);
      // Reset state even if close failed
      this.connection = null;
      this.db = null;
    }
  }

  async query(sql, params = []) {
    await this.ready;
    const reader = await this.connection.runAndReadAll(sql, params);
    const result = reader.getRowObjectsJson();
    return result;
  }

  // Optimized method for reading parquet files directly to JSON
  async queryParquet(sql, params = []) {
    await this.ready;
    // Use runAndReadAll for better performance on parquet files
    const reader = await this.connection.runAndReadAll(sql, params);
    return reader.getRowObjectsJson();
  }

  async run(sql, params = []) {
    await this.ready;
    try {
      // Try using runAndReadAll which is more reliable for DML operations
      // DuckDB auto-commits, so this will persist data
      await this.connection.runAndReadAll(sql, params);
    } catch (err) {
      // Fallback to prepared statement approach if needed
      try {
        const stmt = await this.connection.prepare(sql);
        await stmt.run(...params);
      } catch (prepErr) {
        console.error('DuckDB run error:', prepErr.message);
        throw prepErr;
      }
    }
  }

  // Force a checkpoint to ensure all data is written to disk
  async checkpoint() {
    await this.ready;
    try {
      await this.connection.run('CHECKPOINT');
    } catch (err) {
      console.warn('⚠️ Checkpoint failed:', err.message);
    }
  }

  // Run with retry logic for transient errors
  async runWithRetry(sql, params = [], maxRetries = 3) {
    await this.ready;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.connection.runAndReadAll(sql, params);
        return; // Success
      } catch (err) {
        lastError = err;
        console.warn(`DuckDB run attempt ${attempt}/${maxRetries} failed:`, err.message);
        
        if (attempt < maxRetries) {
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        }
      }
    }
    
    throw lastError;
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