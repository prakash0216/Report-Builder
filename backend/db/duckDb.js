import { DuckDBInstance } from '@duckdb/node-api';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Single database file for both local and production
const DB_NAME = process.env.DB_NAME || 'chartBuilder.db';

class DuckDBClient {
  constructor() {
    this.connection = null;
    this.db = null; // Store the database instance
    this.ready = this.init(); // auto-init on import
  }

  async init() {
    // Define the desired path for the database file
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

    try {
      // Create and connect to the DuckDB database with optimized settings
      this.db = await DuckDBInstance.create(dbPath, {
        threads: Math.min(8, os.cpus().length), // Use up to 8 threads
      });
      this.connection = await this.db.connect();
      
      // Set performance optimizations for DuckDB
      // Use aggressive checkpointing to ensure data persistence in IIS
      await this.connection.run(`
        SET memory_limit='16GB';
        SET threads=${Math.min(8, os.cpus().length)};
        SET preserve_insertion_order=false;
        SET enable_object_cache=true;
        SET enable_progress_bar=false;
        SET checkpoint_threshold='16MB';
        PRAGMA wal_autocheckpoint='16MB';
      `);
      
      // Force an initial checkpoint
      try {
        await this.connection.run('CHECKPOINT');
      } catch (e) {
        console.warn('Initial checkpoint warning:', e.message);
      }
      
      console.log(`✅ DuckDB initialized at ${dbPath}`);
    } catch (err) {
      console.error('❌ Failed to initialize DuckDB:', err);
      throw err;
    }
  }

  async close() {
    try {
      if (this.connection) {
        try {
          await this.connection.run('CHECKPOINT');
        } catch (e) {}
        this.connection.closeSync();
        this.connection = null;
      }
      if (this.db) {
        this.db.closeSync();
        this.db = null;
      }
      console.log('✅ DuckDB connection closed');
    } catch (err) {
      console.warn('⚠️ Error closing DuckDB:', err.message);
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
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
        }
      }
    }
    
    console.error(`DuckDB query failed:`, lastError.message);
    throw lastError;
  }

  async queryParquet(sql, params = []) {
    await this.ready;
    const reader = await this.connection.runAndReadAll(sql, params);
    return reader.getRowObjectsJson();
  }

  async run(sql, params = [], maxRetries = 3) {
    await this.ready;
    let lastError;
    
    // Detect write operations
    const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)/i.test(sql);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use runAndReadAll for better reliability
        await this.connection.runAndReadAll(sql, params);
        
        // CRITICAL FIX: Force checkpoint after every write in production
        // This ensures data moves from WAL to .db file immediately
        if (isWrite) {
          try {
            await this.connection.run('CHECKPOINT');
            console.log(`✅ Checkpoint after write: ${sql.substring(0, 50)}...`);
          } catch (ckptErr) {
            console.warn(`⚠️ Checkpoint failed after write:`, ckptErr.message);
          }
        }
        
        return; // Success
      } catch (err) {
        lastError = err;
        console.warn(`DuckDB run attempt ${attempt} failed:`, err.message);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        }
      }
    }
    
    console.error('DuckDB run error after retries:', lastError.message);
    throw lastError;
  }

  // Force a checkpoint manually
  async checkpoint() {
    await this.ready;
    try {
      await this.connection.run('CHECKPOINT');
      console.log('✅ Manual checkpoint completed');
    } catch (err) {
      console.warn('⚠️ Manual checkpoint failed:', err.message);
    }
  }

  async stream(sql, params = []) {
    await this.ready;
    return this.connection.run(sql, ...params);
  }
}

const dbClient = new DuckDBClient();
export default dbClient;
