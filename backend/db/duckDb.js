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

// ============================================
// CONFIGURATION FOR FAST + SAFE OPERATIONS
// ============================================
// WAL_SIZE: Larger = fewer checkpoints = faster writes
// CHECKPOINT_INTERVAL: How often to checkpoint (in minutes)
// Set to 0 to disable periodic checkpointing (rely on WAL size only)
const WAL_SIZE_MB = 64;           // Checkpoint when WAL reaches 64MB
const CHECKPOINT_INTERVAL_MIN = 5; // Also checkpoint every 5 minutes (safety net)

class DuckDBClient {
  constructor() {
    this.connection = null;
    this.db = null;
    this.ready = this.init();
    this.checkpointTimer = null;
  }

  async init() {
    const dbDir = path.resolve(__dirname, './data');
    const dbPath = path.join(dbDir, DB_NAME);
    this.dbPath = dbPath;

    try {
      await fs.mkdir(dbDir, { recursive: true });
      console.log(`Directory ensured: ${dbDir}`);
    } catch (err) {
      console.error(`Failed to create directory: ${dbDir}`, err);
      throw err;
    }

    await this.openConnection(dbPath);
  }

  async openConnection(dbPath) {
    try {
      this.db = await DuckDBInstance.create(dbPath, {
        threads: Math.min(8, os.cpus().length),
      });
      this.connection = await this.db.connect();
      
      // Performance + Safety optimizations
      await this.connection.run(`
        SET memory_limit='16GB';
        SET threads=${Math.min(8, os.cpus().length)};
        SET preserve_insertion_order=false;
        SET enable_object_cache=true;
        SET enable_progress_bar=false;
        SET wal_autocheckpoint='${WAL_SIZE_MB}MB';
      `);
      
      // Start periodic checkpoint timer (safety net for IIS)
      if (CHECKPOINT_INTERVAL_MIN > 0) {
        this.startPeriodicCheckpoint();
      }
      
      console.log(`✅ DuckDB initialized at ${dbPath}`);
      console.log(`   WAL auto-checkpoint: ${WAL_SIZE_MB}MB`);
      console.log(`   Periodic checkpoint: every ${CHECKPOINT_INTERVAL_MIN} minutes`);
    } catch (err) {
      console.error('❌ Failed to initialize DuckDB:', err);
      throw err;
    }
  }

  // Periodic checkpoint as safety net (not blocking writes)
  startPeriodicCheckpoint() {
    const intervalMs = CHECKPOINT_INTERVAL_MIN * 60 * 1000;
    
    this.checkpointTimer = setInterval(async () => {
      try {
        await this.connection.run('CHECKPOINT');
        console.log(`✅ Periodic checkpoint completed`);
      } catch (err) {
        // Ignore errors - this is just a safety net
      }
    }, intervalMs);
    
    // Don't prevent Node from exiting
    if (this.checkpointTimer.unref) {
      this.checkpointTimer.unref();
    }
  }

  async close() {
    try {
      // Stop periodic checkpoint
      if (this.checkpointTimer) {
        clearInterval(this.checkpointTimer);
        this.checkpointTimer = null;
      }
      
      if (this.connection) {
        // Final checkpoint on graceful shutdown
        try {
          await this.connection.run('CHECKPOINT');
          console.log('✅ Final checkpoint on shutdown');
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

  async query(sql, params = []) {
    await this.ready;
    const reader = await this.connection.runAndReadAll(sql, params);
    return reader.getRowObjectsJson();
  }

  async queryParquet(sql, params = []) {
    await this.ready;
    const reader = await this.connection.runAndReadAll(sql, params);
    return reader.getRowObjectsJson();
  }

  async run(sql, params = []) {
    await this.ready;
    await this.connection.run(sql, ...params);
  }

  // Manual checkpoint if needed
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
