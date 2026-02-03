import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine environment and database name
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_NAME = process.env.DB_NAME || (NODE_ENV === 'production' ? 'chartBuilder.db' : 'chartBuilder_dev.db');

console.log(`🔧 Environment: ${NODE_ENV}`);
console.log(`🗄️  Database: ${DB_NAME}`);

class DuckDBClient {
  constructor() {
    this.connection = null;
    this.db = null; // Store the database instance
    this.ready = this.init(); // auto-init on import
  }

  async init() {
    // Define the desired path for the database file
    // Use environment-specific database name
    const dbDir = path.resolve(__dirname, './data');
    const dbPath = path.join(dbDir, DB_NAME);
    const walPath = path.join(dbDir, `${DB_NAME}.wal`);

    // Ensure the directory exists
    try {
      await fs.mkdir(dbDir, { recursive: true });
      console.log(`Directory ensured: ${dbDir}`);
    } catch (err) {
      console.error(`Failed to create directory: ${dbDir}`, err);
      throw err;
    }

    // Try to clean up stale WAL file before opening (in case previous process crashed)
    try {
      const walStats = await fs.stat(walPath);
      // If WAL file exists and is older than 5 seconds, try to remove it
      // This handles cases where previous process crashed without cleanup
      const walAge = Date.now() - walStats.mtimeMs;
      if (walAge > 5000) {
        console.log(`⚠️ Found stale WAL file (${Math.round(walAge/1000)}s old), attempting cleanup...`);
        await fs.unlink(walPath);
        console.log('✅ Removed stale WAL file');
      }
    } catch (walCheckErr) {
      // WAL file doesn't exist or can't be accessed, that's fine
      if (walCheckErr.code !== 'ENOENT') {
        console.log(`ℹ️ WAL file check: ${walCheckErr.message}`);
      }
    }

    try {
      // Create and connect to the DuckDB database with optimized settings
      this.db = await DuckDBInstance.create(dbPath, {
        threads: Math.min(8, os.cpus().length), // Use up to 8 threads
      });
      this.connection = await this.db.connect();
      
      // Set performance optimizations for DuckDB
      // Use DELETE access mode instead of WAL for better multi-process compatibility
      await this.connection.run(`
        SET memory_limit='16GB';
        SET threads=${Math.min(8, os.cpus().length)};
        SET preserve_insertion_order=false;
        SET enable_object_cache=true;
        SET enable_progress_bar=false;
        SET checkpoint_threshold='256MB';
        PRAGMA wal_autocheckpoint='256MB';
      `);
      
      // Force an immediate checkpoint to flush any pending WAL data
      try {
        await this.connection.run('CHECKPOINT');
        console.log('✅ Initial checkpoint completed');
      } catch (checkpointErr) {
        console.log('ℹ️ Initial checkpoint skipped:', checkpointErr.message);
      }
      
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

  async query(sql, params = [], maxRetries = 3) {
    await this.ready;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const reader = await this.connection.runAndReadAll(sql, params);
        const result = reader.getRowObjectsJson();
        return result;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        }
      }
    }
    
    console.error(`DuckDB query failed after ${maxRetries} attempts:`, lastError.message);
    throw lastError;
  }

  // Optimized method for reading parquet files directly to JSON
  async queryParquet(sql, params = []) {
    await this.ready;
    // Use runAndReadAll for better performance on parquet files
    const reader = await this.connection.runAndReadAll(sql, params);
    return reader.getRowObjectsJson();
  }

  async run(sql, params = [], maxRetries = 3) {
    await this.ready;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try using runAndReadAll which is more reliable for DML operations
        // DuckDB auto-commits, so this will persist data
        await this.connection.runAndReadAll(sql, params);
        return; // Success
      } catch (err) {
        lastError = err;
        
        // Fallback to prepared statement approach if needed
        try {
          const stmt = await this.connection.prepare(sql);
          await stmt.run(...params);
          return; // Success with fallback
        } catch (prepErr) {
          lastError = prepErr;
        }
        
        if (attempt < maxRetries) {
          // Wait a bit before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        }
      }
    }
    
    console.error('DuckDB run error:', lastError.message);
    throw lastError;
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

// Periodic checkpoint to prevent WAL file growth and ensure data durability
// Run every 5 minutes
setInterval(async () => {
  try {
    await dbClient.checkpoint();
    console.log('✅ Periodic checkpoint completed');
  } catch (err) {
    console.warn('⚠️ Periodic checkpoint failed:', err.message);
  }
}, 5 * 60 * 1000);

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}, performing graceful shutdown...`);
  try {
    await dbClient.checkpoint();
    await dbClient.close();
    console.log('✅ DuckDB closed gracefully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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