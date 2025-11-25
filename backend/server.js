import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import csvParser from 'csv-parser';
import iconv from 'iconv-lite';
import dbClient from './db/duckDb.js';
import multer from 'multer';
import snowflake from 'snowflake-sdk';
import crypto from 'crypto';
import bodyParser from 'body-parser';
import parquet from 'parquetjs'
// import redis from 'redis';
// Removed compression - using direct object references for ultra-low latency


const app = express();
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
const PORT = process.env.PORT || 3002;

// ============================================
// ULTRA-FAST CACHE CONFIGURATION
// ============================================
// For VERY LOW LATENCY: Using native Map for O(1) lookups
// No compression, no cloning, direct object references
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 259200; // 3 days default
const MAX_CACHE_SIZE = 500; // Maximum number of cached queries

// Ultra-fast in-memory cache using native Map
// Map provides O(1) lookup time - fastest possible
const fastCache = new Map(); // key -> { data, expiresAt, accessCount, lastAccessed }

// Cache key hash cache to avoid recalculating
const keyHashCache = new Map(); // queryObject string -> hash

// LRU eviction tracking
let cacheAccessOrder = []; // Array of keys in access order

console.log(`⚡ Ultra-fast cache initialized (native Map, no compression, direct object references)`);

// ============================================
// CACHE KEY GENERATION
// ============================================
/**
 * Generate a unique cache key from dataSourceName and queryObject
 * OPTIMIZED: Caches hash calculations for faster key generation
 */
function generateCacheKey(dataSourceName, queryObject) {
  // Normalize queryObject to ensure consistent keys
  const normalized = {
    dataSourceName,
    columns: queryObject.columns ? [...queryObject.columns].sort() : null,
    filters: queryObject.filters ? JSON.stringify(queryObject.filters, Object.keys(queryObject.filters).sort()) : null,
    customWhere: queryObject.customWhere || null,
    groupBy: queryObject.groupBy ? [...queryObject.groupBy].sort() : null,
    orderBy: queryObject.orderBy ? [...queryObject.orderBy].sort() : null,
  };
  
  // Check hash cache first (avoid recalculating)
  const keyString = JSON.stringify(normalized);
  if (keyHashCache.has(keyString)) {
    return `query:${dataSourceName}:${keyHashCache.get(keyString)}`;
  }
  
  // Create hash from normalized object
  const hash = crypto.createHash('md5').update(keyString).digest('hex');
  keyHashCache.set(keyString, hash);
  
  // Limit hash cache size
  if (keyHashCache.size > 1000) {
    const firstKey = keyHashCache.keys().next().value;
    keyHashCache.delete(firstKey);
  }
  
  return `query:${dataSourceName}:${hash}`;
}

/**
 * Clean expired cache entries (runs periodically)
 */
function cleanExpiredCache() {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, value] of fastCache.entries()) {
    if (value.expiresAt < now) {
      fastCache.delete(key);
      const index = cacheAccessOrder.indexOf(key);
      if (index > -1) cacheAccessOrder.splice(index, 1);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
  }
}

// Clean expired entries every 5 minutes
setInterval(cleanExpiredCache, 5 * 60 * 1000);

/**
 * Evict least recently used entry if cache is full
 */
function evictLRU() {
  if (fastCache.size < MAX_CACHE_SIZE) return;
  
  // Remove least recently used (first in access order)
  if (cacheAccessOrder.length > 0) {
    const lruKey = cacheAccessOrder.shift();
    fastCache.delete(lruKey);
    console.log(`🗑️  Evicted LRU cache entry: ${lruKey.substring(0, 50)}...`);
  }
}

// const {getDatafromDuckDB}=require('./services/snowflakeConnector')

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFolder = path.join(__dirname, 'csv');

const storage = multer.memoryStorage();
const upload=multer({
  storage:storage,
  fileFilter: (req,file,cb)=>{
    // console.log('File received:',file);
    const allowedExtensions=['.der','.pem','.key'];
    const fileExtension=path.extname(file.originalname).toLowerCase();
    if(allowedExtensions.includes(fileExtension)){
      cb(null,true);
    }
    else{
      cb(new Error('Only .der, .pem, .key files are allowed'));
    }
  },
})


// const allowedFunctions={
//   parseCsvByName,
//   getDatafromDuckDB
// }

const csvFiles = {
  DynamicMarketShare: 'DynamicMarketShare.csv',
  ShareBars: 'ShareBars.csv',
  ShareTrend: 'ShareTrend.csv',
  ShareBarsNew: 'ShareBarsNew.csv'
};

const csvHeaders = {
  DynamicMarketShare: ['Company', 'Metric Selector', 'Channel', 'Metric Selector Share', 'Metric Selector Share along Distribution By'],
  ShareBars: ['Company', 'NBRx Share', 'Paid TRx Share', 'Written TRx Share','Projected TRx Share'],
  ShareTrend: [
    'Company','Metric Selector','JUL-23','Aug-23','Sep-23','Oct-23','Nov-23','Dec-23',
    'Jan-24','Feb-24','Mar-24','Apr-24','May-24','Jun-24','Jul-24','Aug-24','Sep-24',
    'Oct-24','Nov-24','Dec-24','Jan-25','Feb-25','Mar-25','Apr-25','May-25','Jun-25'
  ],
  ShareBarsNew: ['Company', 'NBRx Share', 'Paid TRx Share', 'Written TRx Share','Projected TRx Share'],
};

// function detectFunction(logic){
//   if(logic.includes('parseCsvByName')){
//     return allowedFunctions.parseCsvByName;
//   }else if(logic.includes('getDatafromDuckDB')){
//     return allowedFunctions.getDatafromDuckDB;
//   }else{
//     throw new Error('No allowed function detected in logic');
//   }
// }

// function dsConnect(filePath, headers) {
//   return new Promise((resolve, reject) => {
//     const results = [];
//     fs.createReadStream(filePath)
//       .pipe(iconv.decodeStream('utf16le'))
//       .pipe(csvParser({
//         separator: '\t',
//         skipEmptyLines: true,
//         skipLines: 1,
//         headers: headers,
//         mapHeaders: ({ header }) => header.trim()
//       }))
//       .on('data', (data) => results.push(data))
//       .on('end', () => resolve(results))
//       .on('error', (err) => reject(err));
//   });
// }


async function parseCsvByName(csvName) {
    if (!csvFiles[csvName]) {
      throw new Error(`CSV "${csvName}" not found`);
    }
    const filePath = path.join(csvFolder, csvFiles[csvName]);
    const headers = csvHeaders[csvName];
    return dsConnect(filePath, headers);
  }

// (async()=>{
//     try{
//         await redisClient.connect();
//         console.log('✅ Connected to Redis');
//     }catch(err){
//         console.error('❌ Redis connection failed:', err);
//     }
// })();

// async function checkRedisConnection() {
//     try {
//       await redisClient.ping();
//       return true;
//     } catch (err) {
//       console.error(err);
//       return false;
//     }
//   }

//   app.get('/check-redis', async (req, res) => {
//     const isConnected = await checkRedisConnection();
//     res.json({ connected: isConnected });
//   }); 

// Generic API for SQL-like table names
// app.post('/api/query', async (req, res) => {
//   const { sql } = req.body;

//   if (!sql || typeof sql !== 'string') {
//     return res.status(400).json({ success: false, error: 'SQL string required' });
//   }

//   // Extract table name from query
//   const match = sql.match(/from\s+(\w+)/i);
//   if (!match) {
//     return res.status(400).json({ success: false, error: 'Invalid SQL format' });
//   }
//   const tableName = match[1];

//   if (!csvFiles[tableName]) {
//     return res.status(404).json({ success: false, error: `Unknown table: ${tableName}` });
//   }

//   try {
//     const filePath = path.join(csvFolder, csvFiles[tableName]);
//     if (!fs.existsSync(filePath)) {
//       return res.status(404).json({ success: false, error: 'File not found' });
//     }

//     const data = await dsConnect(filePath, csvHeaders[tableName]);
//     res.json({ success: true, data, rowCount: data.length });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// });



// app.post('/api/calculate', async (req, res) => {
//   try {
//       const { logic, existingVariables, variableName } = req.body;
//       if (!logic || !variableName) {
//           return res.status(400).json({ message: 'Missing logic or variableName' });
//       }

//       const variables = existingVariables || {};

//       try {
//           // Create variable declarations from existingVariables
//           const variableDeclarations = Object.entries(variables)
//               .map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`)
//               .join('\n');

//           // ⚠️ FIX: Create a string that defines and returns an anonymous async function
//           // The surrounding parentheses ( ) make it a function expression that is evaluated and returned.
//           const funcString = `(async function(dsConnect) { ${variableDeclarations} { ${logic} } })`;

//           // ⚠️ FIX: Assign the returned function object to the variable 'cal'
//           // The function is now explicitly defined in the route handler's scope.
//           const cal = eval(funcString); 

//           // Assuming 'parseCsvByName' is available in this scope
//           var result = await cal(parseCsvByName);

//           res.json({ value: result, success: true });
//       } catch (err) {
//           // Note: This catch block will catch errors in the 'eval' and in the execution of 'cal'
//           return res.status(400).json({ message: 'Error evaluating logic: ' + err.message });
//       }

//   } catch (err) {
//       res.status(500).json({ message: err.message, success: false });
//   }
// });


// app.post('/api/calculate', async (req, res) => {
//   try {
//     const { logic, existingVariables, variableName } = req.body;
//     if (!logic || !variableName) {
//       return res.status(400).json({ message: 'Missing logic or variableName' });
//     }

//     const variables = existingVariables || {};

//     try {
//       // Create variable declarations from existingVariables
//       const variableDeclarations = Object.entries(variables)
//         .map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`)
//         .join('\n');

//       // ✅ Add block scope around logic to prevent let redeclaration issues
//       const funcString = "async function cal(dsConnect) { " + variableDeclarations + "{ " + logic + " } }";
//       eval(funcString); // Defines async function cal

//       // ✅ Await its execution (your exact syntax)
//       var result = await cal(parseCsvByName);

//       res.json({ value: result, success: true });
//     } catch (err) {
//       return res.status(400).json({ message: 'Error evaluating logic: ' + err.message });
//     }

//   } catch (err) {
//     res.status(500).json({ message: err.message, success: false });
//   }
// });




// (async () => {
//   try {
//     await dbClient.query('SELECT 1'); // simple test query
//     console.log('✅ SQL Server is connected');
//   } catch (err) {
//     console.error('❌ Failed to connect to SQL Server:', err.message);
//   }

//   app.listen(PORT, () => {
//     console.log(`🚀 Server is running at http://localhost:${PORT}`);
//   });
// })();

app.get('/snowflake-connections', async (req, res) => {
  try {
    const result = await dbClient.query('SELECT * from snow_flake_connections');
    res.json({ success: true, connections: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/check-snowflake-connection',upload.single('privateKey'), async (req, res) => {
  const { account, username, authenticator, warehouse, database, schema } = req.body;
  const privateKeyFile=req.file;

  if (!account || !username || !authenticator || !privateKeyFile || !warehouse || !database || !schema) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }

  console.log('Received connection test request:', { account, username, authenticator, warehouse, database, schema, privateKeyFileName: privateKeyFile.originalname });

  try {
    const privateKey=privateKeyFile.buffer;
    const privateKeyObject = crypto.createPrivateKey({
      key: privateKey,
      format: 'der',
      type: 'pkcs8',
    });
    const privateKeyPemBuffer = privateKeyObject.export({
      format: 'pem',
      type: 'pkcs8'
  });
    const connection = snowflake.createConnection({
      account: account,
      username: username,
      authenticator: authenticator,
      privateKey: privateKeyPemBuffer, 
      warehouse: warehouse,
      database: database,
      schema: schema,
    });

    connection.connect((err, conn) => {
      if (err) {
        console.error('❌ Unable to connect to Snowflake:', err.message);
        return res.status(500).json({ success: false, error: err.message });
      } else {
        console.log('✅ Successfully connected to Snowflake.');
        connection.destroy(); // Close the connection after test
        return res.json({ success: true, message: 'Connection successful' });
      }
    });
  } catch (err) {
    console.error('❌ Error during Snowflake connection test:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}
);


app.post('/add-snowflake-connection', upload.single('privateKey'), async (req, res) => {
  const { connectionName, account, username, authenticator, warehouse, database, schema } = req.body;
  const privateKey = req.file;

  if (!connectionName || !account || !username || !authenticator || !privateKey || !warehouse || !database || !schema) { 
      return res.status(400).json({ success: false, error: 'All fields are required' });
  }
  
  try {

    const privateKeyBuffer = privateKey.buffer.toString('base64'); // Store as base64 string
    const privateKeyFileName = privateKey.originalname;

    const insertQuery = `
        INSERT INTO snow_flake_connections (
            connectionName,
            account,
            username,
            authenticator,
            privateKey,
            privateKeyFileName,
            warehouse,
            database,
            schema,
            type
        ) VALUES 
         (
            '${connectionName}',
            '${account}',
            '${username}',
            '${authenticator}',
            '${privateKeyBuffer}',  
            '${privateKeyFileName}',
            '${warehouse}',
            '${database}',
            '${schema}',
            'snowflake'
          )
    `;
    
    await dbClient.run(insertQuery );
      
    res.json({ success: true, message: 'Connection added successfully' });
  } catch (err) {
      console.error("Error adding snowflake connection:", err);
      res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/update-snowflake-connection/:id',upload.single('privateKey'), async (req, res) => {
  const { id } = req.params;
  const {connectionName,account,username,authenticator,warehouse,database,schema} = req.body;
  const privateKey = req.file;

  if (!connectionName || !account || !username || !authenticator || !privateKey || !warehouse || !database || !schema) { 
      return res.status(400).json({ success: false, error: 'All fields are required' });
  }

  try {
    const privateKeyBuffer = privateKey.buffer.toString('base64');
    const privateKeyFileName = privateKey.originalname;
      const updateQuery = `
          UPDATE snow_flake_connections
          SET 
              connectionName='${connectionName}',
              account='${account}',
              username='${username}',
              authenticator='${authenticator}',
              privateKey='${privateKeyBuffer}',
              privateKeyFileName='${privateKeyFileName}',
              warehouse='${warehouse}',
              database='${database}',
              schema='${schema}'
          WHERE id=${id}
      `;
      await dbClient.run(updateQuery);  

      res.json({success:true,message:'Connection updated successfully'});
  } catch (err) {
      console.error("Error updating snowflake connection:", err);
      res.status(500).json({success:false,error:err.message});
  }
});

app.delete('/delete-snowflake-connection/:id', async (req, res) => {
  const { id } = req.params;

  try {
      const deleteQuery = `DELETE FROM snow_flake_connections WHERE id=${id}`;
      await dbClient.run(deleteQuery);  

      res.json({success:true,message:'Connection deleted successfully'});
  } catch (err) {
      console.error("Error deleting snowflake connection:", err);
      res.status(500).json({success:false,error:err.message});
  }
});

app.post('/remove-data-source', async (req, res) => {
  const {dsName}= req.body;
  try{
    const deleteQuery = `DELETE FROM data_source_registry WHERE ds_name='${dsName}'`;
    await dbClient.run(deleteQuery);  

    // Clear cache for this data source
    const prefix = `query:${dsName}:`;
    let clearedCount = 0;
    
    for (const key of fastCache.keys()) {
      if (key.startsWith(prefix)) {
        fastCache.delete(key);
        const index = cacheAccessOrder.indexOf(key);
        if (index > -1) cacheAccessOrder.splice(index, 1);
        clearedCount++;
      }
    }
    
    if (clearedCount > 0) {
      console.log(`🗑️  Cleared ${clearedCount} cache entries for removed data source: ${dsName}`);
    }

    res.json({success:true,message:`Data source ${dsName} removed successfully`});
  }
  catch(err){
    console.error("Error removing data source:", err);
    res.status(500).json({success:false,error:err.message});
  }
});

app.get('/all-connections', async (req, res) => {
  try{
    const connections=await dbClient.query('SELECT id,connectionname from snow_flake_connections');
    res.json({success:true,connections});
  }catch(err){
    res.status(500).json({success:false,error:err.message});
  }
}
);

app.post('/execute-query', async (req, res) => {
  const { connectionId, connectionType, dataSourceName, query } = req.body;

  if (!connectionId || !connectionType || !dataSourceName || !query) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
  }

  if (connectionType === 'Live') {
      try {
          // 1. Fetch connection details from DuckDB
          const connectionDetails = await dbClient.query(`SELECT * from snow_flake_connections where id=${connectionId}`);
          if (connectionDetails.length === 0) {
              return res.status(404).json({ success: false, error: 'Connection not found' });
          }
          const conn = connectionDetails[0];

          // 2. Prepare Snowflake connection with private key
          const privateKeyBuffer = Buffer.from(conn.privateKey, 'base64');
          const privateKeyObject = crypto.createPrivateKey({
              key: privateKeyBuffer,
              format: 'der',
              type: 'pkcs8',
          });
          const privateKeyPemBuffer = privateKeyObject.export({
              format: 'pem',
              type: 'pkcs8'
          });

          const sfConnection = snowflake.createConnection({
              account: conn.account,
              username: conn.username,
              authenticator: conn.authenticator,
              privateKey: privateKeyPemBuffer,
              warehouse: conn.warehouse,
              database: conn.database,
              schema: conn.schema,
          });

          // 3. Connect to Snowflake and execute query
          sfConnection.connect((err, connection) => {
              if (err) {
                  console.error('❌ Unable to connect to Snowflake:', err.message);
                  return res.status(500).json({ success: false, error: err.message });
              } else {
                  console.log('✅ Successfully connected to Snowflake.');

                  const startTime = new Date();

                  connection.execute({
                      sqlText: query,
                      complete: (err, stmt, rows) => { 
                          if (err) {
                              console.error('❌ Failed to execute query:', err.message);
                              sfConnection.destroy();
                              return res.status(500).json({ success: false, error: err.message });
                          } else {
                              // 4. Extract column names from the query result
                              const columnNames = stmt.getColumns().map(col => col.getName());
                              const tableName = 'ds_' + dataSourceName.toLowerCase();

                              //First delete the table if exists
                              const dropTableQuery = `DROP TABLE IF EXISTS ${tableName}`;
                              dbClient.run(dropTableQuery).then(() => {
                                  console.log(`✅ Existing DuckDB table ${tableName} dropped.`);
                              }).catch(dropErr => {
                                  console.error('❌ Error dropping existing DuckDB table:', dropErr.message);
                              });
                              // 5. Create the DuckDB table with only column names and TEXT type
                              const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnNames.map(col => `${col} TEXT`).join(', ')})`;

                              dbClient.run(createTableQuery).then(() => {
                                  console.log(`✅ DuckDB table ${tableName} created with column names.`);
                                  const endTime = new Date();
                                  const timeTaken = (endTime - startTime) / 1000;
                                  console.log(`⏱️  Query executed in ${timeTaken} seconds, fetched ${rows.length} rows.`);

                                  // 6. RETURN THE QUERY RESULTS TO FRONTEND
                                  sfConnection.destroy();
                                  res.json({ 
                                      success: true, 
                                      data: rows.slice(0,100),  // ← LIMIT TO FIRST 100 ROWS
                                      rowCount: rows.length, 
                                      query: query,  
                                      message: `Data source ${dataSourceName} created successfully with ${rows.length} rows` 
                                  });
                              }).catch(duckdbErr => {
                                  console.error('❌ Error creating DuckDB table:', duckdbErr.message);
                                  sfConnection.destroy();
                                  res.status(500).json({ success: false, error: duckdbErr.message });
                              });
                              
                              // 7. Upsert metadata into data_source_registry (Fire and forget - do AFTER response)
                              const deleteQuery = `DELETE FROM data_source_registry WHERE ds_name='${dataSourceName}'`;
                              const insertQuery = `INSERT INTO data_source_registry (ds_name,connection_id,type,query,created_at) VALUES ('${dataSourceName}',${connectionId},'${connectionType}','${query.replace(/'/g,"''")}',CURRENT_TIMESTAMP)`;
                              
                              dbClient.run(deleteQuery).then(() => {
                                  return dbClient.run(insertQuery);
                              }).then(() => {
                                  console.log(`✅ Data source ${dataSourceName} registered in data_source_registry.`);
                              }).catch(err => {
                                  console.error('❌ Error registering data source:', err.message);
                              });
                          }
                      }
                  });
              }
          });
      } catch (err) {
          console.error('❌ Error processing request:', err.message);
          res.status(500).json({ success: false, error: err.message });
      }
  } else if (connectionType === 'Extract') {
    try {
        // Define parquet storage directory
        const PARQUET_DIR = path.join(__dirname, './db/parquet_files');
        if (!fs.existsSync(PARQUET_DIR)) {
            fs.mkdirSync(PARQUET_DIR, { recursive: true });
        }
        
        // 1. Fetch connection details from DuckDB
        const connectionDetails = await dbClient.query(`SELECT * from snow_flake_connections where id=${connectionId}`);
        if (connectionDetails.length === 0) {
            return res.status(404).json({ success: false, error: 'Connection not found' });
        }
        
        // 2. Prepare Snowflake connection with private key
        const conn = connectionDetails[0];
        const privateKeyBuffer = Buffer.from(conn.privateKey, 'base64');
        const privateKeyObject = crypto.createPrivateKey({
            key: privateKeyBuffer,
            format: 'der',
            type: 'pkcs8',
        });
        const privateKeyPemBuffer = privateKeyObject.export({
            format: 'pem',
            type: 'pkcs8'
        });
        
        const sfConnection = snowflake.createConnection({
            account: conn.account,
            username: conn.username,
            authenticator: conn.authenticator,
            privateKey: privateKeyPemBuffer,
            warehouse: conn.warehouse,
            database: conn.database,
            schema: conn.schema,
        });
        
        // 3. Connect to Snowflake and execute query
        sfConnection.connect((err, connection) => {
            if (err) {
                console.error('❌ Unable to connect to Snowflake:', err.message);
                return res.status(500).json({ success: false, error: err.message });
            } else {
                console.log('✅ Successfully connected to Snowflake.');
                
                connection.execute({
                    sqlText: query,
                    streamResult: true,
                    complete: async (err, stmt) => {
                        if (err) {
                            console.error('❌ Failed to execute query:', err.message);
                            sfConnection.destroy();
                            return res.status(500).json({ success: false, error: err.message });
                        }
                        
                        try {
                            // 4. Extract column information and build Parquet schema
                            const columns = stmt.getColumns();
                            const columnNames = columns.map(col => col.getName());
                            const tableName = 'ds_' + dataSourceName.toLowerCase();
                            const parquetFilePath = path.join(PARQUET_DIR, `${tableName}.parquet`);
                            
                            // Delete existing parquet file if it exists
                            if (fs.existsSync(parquetFilePath)) {
                                fs.unlinkSync(parquetFilePath);
                                console.log(`✅ Existing parquet file ${parquetFilePath} deleted.`);
                            }
                            
                            // Build Parquet schema dynamically from Snowflake column types
                            const parquetSchema = new parquet.ParquetSchema(
                                columnNames.reduce((schema, colName) => {
                                    // Default to UTF8 (string), can be enhanced with type mapping
                                    schema[colName] = { type: 'UTF8', optional: true };
                                    return schema;
                                }, {})
                            );
                            
                            // Create Parquet writer
                            const writer = await parquet.ParquetWriter.openFile(parquetSchema, parquetFilePath);
                            
                            console.log(`✅ Parquet writer initialized for ${parquetFilePath}`);
                            
                            // 5. Get the stream
                            const stream = stmt.streamRows();
                            
                            // 6. Setup streaming with optimized batching
                            const BATCH_SIZE = 100000; // Optimal for Parquet writing
                            let batch = [];
                            let totalRowCount = 0;
                            let previewRows = [];
                            let streamEnded = false;
                            let isWriting = false;
                            const startTime = Date.now();
                            
                            // Helper function to write batch to Parquet
                            const writeBatchToParquet = async (rows) => {
                                if (rows.length === 0) return;
                                
                                try {
                                    const batchSize = rows.length;
                                    
                                    // Write each row to parquet
                                    for (const row of rows) {
                                        // Transform row to match schema
                                        const parquetRow = {};
                                        columnNames.forEach(col => {
                                            const val = row[col];
                                            // Convert to string, handle nulls
                                            parquetRow[col] = (val === null || typeof val === 'undefined') ? null : String(val);
                                        });
                                        await writer.appendRow(parquetRow);
                                    }
                                    
                                    // Calculate and log progress
                                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                                    const rowsPerSecond = (totalRowCount / elapsed).toFixed(0);
                                    console.log(`✅ Written batch of ${batchSize.toLocaleString()} rows | Total: ${totalRowCount.toLocaleString()} | Speed: ${rowsPerSecond} rows/sec | Time: ${elapsed}s`);
                                    
                                } catch (err) {
                                    console.error('❌ Error writing batch to Parquet:', err.message);
                                    throw err;
                                }
                            };
                            
                            // 7. Handle streaming data
                            stream.on('data', (row) => {
                                totalRowCount++;
                                
                                // Store first 100 rows for preview
                                if (previewRows.length < 100) {
                                    previewRows.push(row);
                                }
                                
                                batch.push(row);
                                
                                // When batch is full, write it
                                if (batch.length >= BATCH_SIZE && !isWriting) {
                                    isWriting = true;
                                    const currentBatch = [...batch];
                                    batch = [];
                                    
                                    stream.pause();
                                    
                                    writeBatchToParquet(currentBatch).then(() => {
                                        console.log(`🔄 Batch write complete. Resuming stream...`);
                                        isWriting = false;
                                        
                                        if (!streamEnded) {
                                            stream.resume();
                                            console.log(`▶️  Stream resumed, continuing data load...`);
                                        }
                                    }).catch(err => {
                                        console.error('❌ Critical error writing batch:', err.message);
                                        isWriting = false;
                                        stream.destroy();
                                        writer.close().catch(() => {});
                                        sfConnection.destroy();
                                    });
                                }
                            });
                            
                            // 8. Handle stream errors
                            stream.on('error', async (streamErr) => {
                                console.error('❌ Stream error:', streamErr.message);
                                await writer.close().catch(() => {});
                                sfConnection.destroy();
                                res.status(500).json({ success: false, error: streamErr.message });
                            });
                            
                            // 9. Handle stream end
                            stream.on('end', () => {
                                streamEnded = true;
                                
                                const waitAndFinish = async () => {
                                    if (isWriting) {
                                        setTimeout(waitAndFinish, 100);
                                        return;
                                    }
                                    
                                    try {
                                        // Write remaining rows
                                        await writeBatchToParquet(batch);
                                        
                                        // Close the Parquet writer
                                        await writer.close();
                                        
                                        const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
                                        const avgSpeed = (totalRowCount / totalTime).toFixed(0);
                                        const fileSizeMB = (fs.statSync(parquetFilePath).size / (1024 * 1024)).toFixed(2);
                                        
                                        console.log(`✅ ====================================`);
                                        console.log(`✅ EXTRACTION COMPLETE!`);
                                        console.log(`✅ Total rows: ${totalRowCount.toLocaleString()}`);
                                        console.log(`✅ Total time: ${totalTime}s`);
                                        console.log(`✅ Average speed: ${avgSpeed} rows/sec`);
                                        console.log(`✅ Parquet file size: ${fileSizeMB} MB`);
                                        console.log(`✅ File location: ${parquetFilePath}`);
                                        console.log(`✅ ====================================`);
                                        
                                        sfConnection.destroy();
                                        
                                        
                                        // Send response
                                        res.json({
                                            success: true,
                                            data: previewRows,
                                            rowCount: totalRowCount,
                                            query: query,
                                            loadTime: totalTime,
                                            parquetFile: parquetFilePath,
                                            fileSizeMB: fileSizeMB,
                                            message: `Data source ${dataSourceName} created successfully with ${totalRowCount.toLocaleString()} rows in ${totalTime}s (${fileSizeMB} MB)`
                                        });
                                        
                                        // Update registry
                                        const deleteQuery = `DELETE FROM data_source_registry WHERE ds_name='${dataSourceName}'`;
                                        const insertQuery = `INSERT INTO data_source_registry (ds_name,connection_id,type,query,created_at,parquet_path) VALUES ('${dataSourceName}',${connectionId},'${connectionType}','${query.replace(/'/g, "''")}',CURRENT_TIMESTAMP,'${parquetFilePath}')`;
                                        
                                        await dbClient.run(deleteQuery);
                                        await dbClient.run(insertQuery);
                                        console.log(`✅ Data source ${dataSourceName} registered in data_source_registry.`);
                                        
                                    } catch (err) {
                                        console.error('❌ Error finalizing parquet write:', err.message);
                                        await writer.close().catch(() => {});
                                        sfConnection.destroy();
                                        res.status(500).json({ success: false, error: err.message });
                                    }
                                };
                                
                                waitAndFinish();
                            });
                            
                        } catch (err) {
                            console.error('❌ Error initializing Parquet writer:', err.message);
                            sfConnection.destroy();
                            res.status(500).json({ success: false, error: err.message });
                        }
                    }
                });
            }
        });
    } catch (err) {
        console.error('❌ Error processing request:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
} else {
      return res.status(400).json({ success: false, error: 'Unsupported connection type' });
  }
});


function buildWhereClause(filters) {
  if (!filters || typeof filters !== 'object') {
    return '';
  }

  const conditions = [];

  for (const [filterName, filterData] of Object.entries(filters)) {
    // Skip if no filter data
    if (!filterData) {
      continue;
    }

    // 🔥 NEW: Handle filter object with metadata
    if (typeof filterData === 'object' && filterData.values !== undefined && filterData.isAll !== undefined) {
      // Check if "All" is selected
      if (filterData.isAll === true) {
        console.log(`⏭️  Skipping ${filterName} - All selected`);
        continue;
      }

      // Extract values
      const values = filterData.values.map(item => {
        if (typeof item === 'object' && item.value !== undefined) {
          return item.value;
        }
        return item;
      });

      if (values.length === 0) {
        console.log(`⏭️  Skipping ${filterName} - No selections`);
        continue;
      }

      // Build IN clause
      const escapedValues = values.map(v => {
        if (v === null || v === undefined) {
          return 'NULL';
        }
        const escaped = String(v).replace(/'/g, "''");
        return `'${escaped}'`;
      });

      const columnName = filterData.columnName || filterName;
      conditions.push(`${columnName} IN (${escapedValues.join(', ')})`);
      
      console.log(`✅ Added condition for ${filterName}: ${columnName} IN (${values.length} values)`);
    }
    // 🔥 BACKWARD COMPATIBILITY: Handle array with metadata properties (from eval)
    else if (Array.isArray(filterData)) {
      // Check if "All" is selected using the metadata property
      if (filterData.isAll === true) {
        console.log(`⏭️  Skipping ${filterName} - All selected`);
        continue;
      }

      const values = filterData.map(item => {
        if (typeof item === 'object' && item.value !== undefined) {
          return item.value;
        }
        return item;
      });

      if (values.length === 0) {
        console.log(`⏭️  Skipping ${filterName} - No selections`);
        continue;
      }

      const escapedValues = values.map(v => {
        if (v === null || v === undefined) {
          return 'NULL';
        }
        const escaped = String(v).replace(/'/g, "''");
        return `'${escaped}'`;
      });

      const columnName = filterData.columnName || filterName;
      conditions.push(`${columnName} IN (${escapedValues.join(', ')})`);
      
      console.log(`✅ Added condition for ${filterName}: ${columnName} IN (${values.length} values)`);
    }
  }

  const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';
  console.log(`📝 Filter-based WHERE clause: ${whereClause || '(none - all data)'}`);
  
  return whereClause;
}

// 🔥 Internal function to get data based on data source name (without cache)
async function _getDataBasedOnDataSourceName(dataSourceName, queryObject) {
  const {columns, filters, customWhere, groupBy, orderBy, limit} = queryObject;
  console.log('📦 Query Object:', queryObject);
  
  console.log(`🔄 Loading data from: ${dataSourceName}`);
  
  // Get data source type from registry
  const connectionType = await dbClient.query(`SELECT type FROM data_source_registry WHERE ds_name='${dataSourceName}'`);
  if (connectionType.length === 0) {
    throw new Error(`Data source ${dataSourceName} not found in registry`);
  }
  
  const type = connectionType[0].type;
  console.log(`📊 Data source type: ${type}`);

  // 🔥 Build WHERE clause from filters
  const filterWhereClause = buildWhereClause(filters);
  
  // 🔥 Combine filter WHERE with custom WHERE
  let whereClause = '';
  if (filterWhereClause && customWhere) {
    whereClause = `${filterWhereClause} AND ${customWhere}`;
    console.log(`🔗 Combined WHERE: filters + custom`);
  } else if (filterWhereClause) {
    whereClause = filterWhereClause;
  } else if (customWhere) {
    whereClause = customWhere;
    console.log(`🔗 Using custom WHERE only`);
  }
  
  console.log(`🔍 Final WHERE clause: ${whereClause || '(none - fetching all data)'}`);

  // ============================================
  // LIVE CONNECTION (Snowflake)
  // ============================================
  if (type === 'Live') {
    const startTime = Date.now();
    console.log('❄️  Loading from Snowflake Live');
    
    // Get connection details
    const connectionDetails = await dbClient.query(
      `SELECT connection_id, query FROM data_source_registry WHERE ds_name='${dataSourceName}'`
    );
    if (connectionDetails.length === 0) {
      throw new Error(`Connection details for ${dataSourceName} not found`);
    }
    const connId = connectionDetails[0].connection_id;
    const baseQuery = connectionDetails[0].query;
    
    // Fetch snowflake connection credentials
    const connDetails = await dbClient.query(`SELECT * FROM snow_flake_connections WHERE id=${connId}`);
    if (connDetails.length === 0) {
      throw new Error(`Snowflake connection with id ${connId} not found`);
    }
    const conn = connDetails[0];

    // Connect to snowflake and execute query with streaming
    return new Promise((resolve, reject) => {
      // Prepare private key for authentication
      const privateKeyBuffer = Buffer.from(conn.privateKey, 'base64');
      const privateKeyObject = crypto.createPrivateKey({
        key: privateKeyBuffer,
        format: 'der',
        type: 'pkcs8',
      });
      const privateKeyPemBuffer = privateKeyObject.export({
        format: 'pem',
        type: 'pkcs8'
      });
      
      // Create Snowflake connection
      const sfConnection = snowflake.createConnection({
        account: conn.account,
        username: conn.username,
        authenticator: conn.authenticator,
        privateKey: privateKeyPemBuffer,
        warehouse: conn.warehouse,
        database: conn.database,
        schema: conn.schema,
      });
      
      // Connect and execute query
      sfConnection.connect((err, connection) => {
        if (err) {
          console.error('❌ Unable to connect to Snowflake:', err.message);
          return reject(new Error('Unable to connect to Snowflake: ' + err.message));
        }
        
        console.log('✅ Successfully connected to Snowflake');
        console.log('🔄 Streaming data from Snowflake...');
        
        let data = [];
        let rowsProcessed = 0;
        const sanitizedQuery = baseQuery.trim().replace(/;$/, '');

        // 🔥 Build custom query with all parameters
        let customQuery;
        
        if (columns || whereClause || groupBy || orderBy || limit) {
          customQuery = `SELECT ${columns && columns.length > 0 ? columns.join(', ') : '*'} FROM (${sanitizedQuery}) AS subquery` +
            (whereClause ? ` WHERE ${whereClause}` : '') +
            (groupBy && groupBy.length > 0 ? ` GROUP BY ${groupBy.join(', ')}` : '') +
            (orderBy && orderBy.length > 0 ? ` ORDER BY ${orderBy.join(', ')}` : '') +
            (limit ? ` LIMIT ${limit}` : '');
        } else {
          customQuery = sanitizedQuery;
        }
        
        console.log('📝 Executing Snowflake Query:', customQuery);
        
        // Execute with streaming enabled
        const statement = connection.execute({        
          sqlText: customQuery,
          streamResult: true, // Enable streaming for large datasets
          complete: (err, stmt, rows) => {
            if (err) {
              sfConnection.destroy();
              console.error('❌ Failed to execute Snowflake query:', err.message);
              return reject(new Error('Failed to execute query: ' + err.message));
            }
          }
        });
        
        // Create a stream from the statement
        const stream = statement.streamRows();
        
        stream.on('error', (err) => {
          sfConnection.destroy();
          console.error('❌ Snowflake stream error:', err.message);
          reject(new Error('Stream error: ' + err.message));
        });
        
        stream.on('data', (row) => {
          data.push(row);
          rowsProcessed++;
          
          // Log progress every 50k rows
          if (rowsProcessed % 50000 === 0) {
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`📊 Progress: ${rowsProcessed.toLocaleString()} rows streamed in ${elapsed}s`);
          }
        });
        
        stream.on('end', () => {
          sfConnection.destroy();
          const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(`✅ Snowflake data loaded in ${totalTime}s`);
          console.log(`✅ Loaded ${data.length.toLocaleString()} rows from Snowflake`);
          resolve(data);
        });
      });
    });
  }

  // ============================================
  // EXTRACT CONNECTION (DuckDB/Parquet)
  // ============================================
  if (type === 'Extract') {
    const startTime = Date.now();
    console.log('🦆 Loading from DuckDB Extract');
    
    // Get parquet file path
    const dsDetails = await dbClient.query(
      `SELECT parquet_path FROM data_source_registry WHERE ds_name='${dataSourceName}'`
    );
    if (dsDetails.length === 0) {
      throw new Error(`Data source details for ${dataSourceName} not found`);
    }
    
    const parquetPath = dsDetails[0].parquet_path;
    console.log('📁 Parquet path:', parquetPath);
    
    // Verify file exists
    const { existsSync } = await import('fs');
    if (!parquetPath || !existsSync(parquetPath)) {
      throw new Error(`Parquet file for data source ${dataSourceName} not found at path: ${parquetPath}`);
    }
    
    console.log('🔄 Streaming data from Parquet file:', parquetPath);
    
    // Escape backslashes for Windows paths
    const escapedPath = parquetPath.replace(/\\/g, '\\\\');
    
    // 🔥 Build custom query with all parameters
    let customQuery;
    
    if (columns || whereClause || groupBy || orderBy || limit) {
      customQuery = `SELECT ${columns && columns.length > 0 ? columns.join(', ') : '*'} FROM read_parquet('${escapedPath}')` +
        (whereClause ? ` WHERE ${whereClause}` : '') +
        (groupBy && groupBy.length > 0 ? ` GROUP BY ${groupBy.join(', ')}` : '') +
        (orderBy && orderBy.length > 0 ? ` ORDER BY ${orderBy.join(', ')}` : '') +
        (limit ? ` LIMIT ${limit}` : '');
    } else {
      customQuery = `SELECT * FROM read_parquet('${escapedPath}')`;
    }
    
    console.log('📝 Executing DuckDB Query:', customQuery);
    
    // ✅ Get column names using DESCRIBE query
    const describeQuery = `DESCRIBE (${customQuery})`;
    console.log('🔍 Getting column names:', describeQuery);
    const columnInfo = await dbClient.query(describeQuery);
    const columnNames = columnInfo.map(col => col.column_name);
    console.log('📋 Column names:', columnNames);
    
    // Execute query with streaming
    const queryResult = await dbClient.stream(customQuery);
    
    let data = [];
    let chunkCount = 0;
    let rowsProcessed = 0;
    
    // Iterate through chunks
    while (true) {
      const chunk = await queryResult.fetchChunk();
      
      // Exit when no more data
      if (chunk.rowCount === 0) {
        break;
      }
      
      chunkCount++;
      rowsProcessed += chunk.rowCount;
      
      // ✅ Convert arrays to objects using column names
      const rowArrays = chunk.getRows();
      const rows = rowArrays.map(rowArray => {
        const obj = {};
        columnNames.forEach((name, index) => {
          obj[name] = rowArray[index];
        });
        return obj;
      });
      
      data.push(...rows);
      
      // Log progress every 10 chunks or every 50k rows
      if (chunkCount % 10 === 0 || rowsProcessed % 50000 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`📊 Progress: ${rowsProcessed.toLocaleString()} rows loaded (${chunkCount} chunks) in ${elapsed}s`);
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ DuckDB data loaded in ${totalTime}s`);
    console.log(`✅ Loaded ${data.length.toLocaleString()} rows from Parquet file`);
    
    return data;
  }

  // ============================================
  // UNSUPPORTED CONNECTION TYPE
  // ============================================
  else {
    throw new Error(`Unsupported connection type: ${type}`);
  }
}

// ⚡ ULTRA-FAST CACHED WRAPPER: Zero-latency cache with native Map
async function getDataBasedOnDataSourceName(dataSourceName, queryObject) {
  // Generate cache key (with hash caching for speed)
  const cacheKey = generateCacheKey(dataSourceName, queryObject);
  
  // ⚡ INSTANT CACHE LOOKUP - O(1) Map.get() operation
  const cached = fastCache.get(cacheKey);
  
  if (cached) {
    // Check if expired
    if (cached.expiresAt > Date.now()) {
      // Update LRU tracking (move to end)
      const index = cacheAccessOrder.indexOf(cacheKey);
      if (index > -1) cacheAccessOrder.splice(index, 1);
      cacheAccessOrder.push(cacheKey);
      
      // Update access stats
      cached.accessCount++;
      cached.lastAccessed = Date.now();
      
      // Return data directly (no decompression, no parsing - instant!)
      const rowCount = Array.isArray(cached.data) ? cached.data.length : 0;
      console.log(`⚡⚡ INSTANT CACHE HIT for ${dataSourceName} (${rowCount.toLocaleString()} rows, accessed ${cached.accessCount}x)`);
      return cached.data;
    } else {
      // Expired - remove it
      fastCache.delete(cacheKey);
      const index = cacheAccessOrder.indexOf(cacheKey);
      if (index > -1) cacheAccessOrder.splice(index, 1);
    }
  }
  
  // Cache miss - execute query
  console.log(`💾 CACHE MISS for ${dataSourceName} - Executing query...`);
  const queryStartTime = Date.now();
  
  try {
    const data = await _getDataBasedOnDataSourceName(dataSourceName, queryObject);
    const queryElapsed = ((Date.now() - queryStartTime) / 1000).toFixed(2);
    
    // Evict LRU if cache is full
    evictLRU();
    
    // ⚡ STORE DIRECTLY IN MEMORY - No compression, no serialization overhead
    // Store as JavaScript object reference (fastest possible)
    fastCache.set(cacheKey, {
      data: data, // Direct object reference
      expiresAt: Date.now() + (CACHE_TTL * 1000),
      accessCount: 1,
      lastAccessed: Date.now()
    });
    
    // Update LRU tracking
    cacheAccessOrder.push(cacheKey);
    
    const rowCount = Array.isArray(data) ? data.length : 0;
    console.log(`✅ Query completed in ${queryElapsed}s - Cached ${rowCount.toLocaleString()} rows (instant access ready)`);
    
    return data;
  } catch (error) {
    console.error(`❌ Query failed for ${dataSourceName}:`, error.message);
    throw error;
  }
}

app.post('/api/calculate', async (req, res) => {
  const { logic, existingVariables, existingParameters, variableName, existingFilters } = req.body;
  if (!logic || !variableName) {
    return res.status(400).json({ message: 'Missing logic or variableName' });
  }

  const allAvailableVariables = { ...existingVariables, ...existingParameters, ...existingFilters };

  try {
    const variableDeclarations = Object.entries(allAvailableVariables)
    .map(([name, value]) => {
      let serialized;
      
      // 🔥 NEW: Special handling for filter objects with metadata
      if (value && typeof value === 'object' && value.values !== undefined && value.isAll !== undefined) {
        // This is a filter with metadata
        // Create an array with metadata properties attached
        const arrayStr = JSON.stringify(value.values);
        serialized = `(function() {
          const arr = ${arrayStr};
          arr.isAll = ${value.isAll};
          arr.total = ${value.total};
          arr.columnName = ${JSON.stringify(value.columnName)};
          return arr;
        })()`;
      } 
      // Original handling
      else if (value === undefined) {
        serialized = 'undefined';
      } else if (value === null) {
        serialized = 'null';
      } else if (typeof value === 'string' && value === '') {
        serialized = '""';
      } else {
        serialized = JSON.stringify(value);
      }
      
      return `const ${name} = ${serialized};`;
    })
    .join('\n');

    // console.log('📝 Variable declarations:', variableDeclarations);

    // This structure correctly handles 'await' inside the logic string.
    const funcString = `(async function(dsConnect) {
      ${variableDeclarations}
      return (async () => {
        ${logic}
      })();
    })`;

    const cal = eval(funcString);
    const result = await cal(getDataBasedOnDataSourceName);

    res.json({ value: result, success: true });
  } catch (err) {
    console.error(`Error in /api/calculate: ${err.message}`);
    return res.status(400).json({ message: 'Error evaluating logic: ' + err.message });
  }
});

app.get("/get-all-ds-names", async (req, res) => {
  try{
    const result=await dbClient.query('SELECT ds_name FROM data_source_registry');
    const dsNames=result.map(row=>row.ds_name);
    res.json({success:true,data_source_names:dsNames});
  }catch(err){
    console.error("Error fetching data_source names:",err);
    res.status(500).json({success:false,error:err.message});
  }
});

app.post("/rename-data-source",async(req,res)=>{
  const {oldName,newName}=req.body; 
  if(!oldName || !newName){
    return res.status(400).json({success:false,error:'Both oldName and newName are required'});
  }
  try{
    const updateQuery=`UPDATE data_source_registry SET ds_name='${newName}' WHERE ds_name='${oldName}'`;
    await dbClient.run(updateQuery);
    
    // Clear cache for the old data source name
    const prefix = `query:${oldName}:`;
    let clearedCount = 0;
    
    for (const key of fastCache.keys()) {
      if (key.startsWith(prefix)) {
        fastCache.delete(key);
        const index = cacheAccessOrder.indexOf(key);
        if (index > -1) cacheAccessOrder.splice(index, 1);
        clearedCount++;
      }
    }
    
    if (clearedCount > 0) {
      console.log(`🗑️  Cleared ${clearedCount} cache entries for renamed data source: ${oldName} -> ${newName}`);
    }
    
    return res.json({success:true,message:`Data source renamed from ${oldName} to ${newName}`});
  }catch(err){
    console.error("Error renaming data source:",err);
    res.status(500).json({success:false,error:err.message});
  }
});

app.post("/get-ds-column-names",async(req,res)=>{
  const ds_name=req.body.ds_name;
  if(!ds_name){
    return res.status(400).json({success:false,error:'ds_name is required'});
  }
  try{
    const dsDetails=await dbClient.query(`SELECT connection_id,type,query,parquet_path FROM data_source_registry WHERE ds_name='${ds_name}'`);
    if(dsDetails.length===0){
      return res.status(404).json({success:false,error:`Data source ${ds_name} not found`});
    }
    const type=dsDetails[0].type;
    let columnNames=[];
    if(type==='Live'){
      const connId=dsDetails[0].connection_id;
      let query=dsDetails[0].query;
      const connectionDetails=await dbClient.query(`SELECT * from snow_flake_connections WHERE id=${connId}`);
      if(connectionDetails.length===0){
        return res.status(404).json({success:false,error:`Connection with id ${connId} not found`});
      }
      const conn=connectionDetails[0];
      const privateKeyBuffer=Buffer.from(conn.privateKey,'base64');
      const privateKeyObject=crypto.createPrivateKey({
        key:privateKeyBuffer,
        format:'der',
        type:'pkcs8',
      });
      const privateKeyPemBuffer=privateKeyObject.export({
        format:'pem',
        type:'pkcs8'
      });
      const sfConnection=snowflake.createConnection({
        account:conn.account,
        username:conn.username,
        authenticator:conn.authenticator,
        privateKey:privateKeyPemBuffer,
        warehouse:conn.warehouse,
        database:conn.database,
        schema:conn.schema,
      });
      sfConnection.connect((err,connection)=>{
        if(err){
          console.error('❌ Unable to connect to Snowflake:',err.message);
          return res.status(500).json({success:false,error:err.message});
        }
        // Remove trailing semicolon and whitespace
        query = query.trim().replace(/;+$/, '');
        // Wrap the original query to get only schema, no data
        const schemaQuery = `SELECT * FROM (${query}) LIMIT 0`;
        connection.execute({
          sqlText:schemaQuery,
          complete:(err,stmt)=>{
            if(err){
              console.error('❌ Failed to execute query:',err.message);
              sfConnection.destroy();
              return res.status(500).json({success:false,error:err.message});
            }
            columnNames=stmt.getColumns().map(col=>col.getName());
            sfConnection.destroy();
            return res.json({success:true,column_names:columnNames});
          }
        })
      })
    }else if(type==='Extract'){
      const parquetPath=dsDetails[0].parquet_path;
      if(!parquetPath){
        return res.status(404).json({success:false,error:`Parquet path for data source ${ds_name} not found`});
      }
      const escapedPath = parquetPath.replace(/\\/g, '\\\\');
      // Use DESCRIBE to get column names without reading data
      const describeResult = await dbClient.query(`DESCRIBE SELECT * FROM read_parquet('${escapedPath}')`);
      columnNames = describeResult.map(row => row.column_name);
      return res.json({success:true,column_names:columnNames});
  }else{
      return res.status(400).json({success:false,error:`Unsupported connection type: ${type}`});
    }
  }
  catch(err){
    console.error('❌ Error in /get-ds-column-names:',err.message);
    return res.status(500).json({success:false,error:err.message});
  }
});

app.post("/get-distinct-column-values", async (req, res) => {
  const { ds_name, column_name } = req.body;
  
  if (!ds_name) {
    return res.status(400).json({ success: false, error: 'ds_name is required' });
  }
  if (!column_name) {
    return res.status(400).json({ success: false, error: 'column_name is required' });
  }

  try {
    const dsDetails = await dbClient.query(`SELECT connection_id, type, query, parquet_path FROM data_source_registry WHERE ds_name='${ds_name}'`);
    if (dsDetails.length === 0) {
      return res.status(404).json({ success: false, error: `Data source ${ds_name} not found` });
    }

    const type = dsDetails[0].type;
    let distinctValues = [];

    if (type === 'Live') {
      const connId = dsDetails[0].connection_id;
      let query = dsDetails[0].query;
      const connectionDetails = await dbClient.query(`SELECT * from snow_flake_connections WHERE id=${connId}`);
      
      if (connectionDetails.length === 0) {
        return res.status(404).json({ success: false, error: `Connection with id ${connId} not found` });
      }

      const conn = connectionDetails[0];
      const privateKeyBuffer = Buffer.from(conn.privateKey, 'base64');
      const privateKeyObject = crypto.createPrivateKey({
        key: privateKeyBuffer,
        format: 'der',
        type: 'pkcs8',
      });
      const privateKeyPemBuffer = privateKeyObject.export({
        format: 'pem',
        type: 'pkcs8'
      });

      const sfConnection = snowflake.createConnection({
        account: conn.account,
        username: conn.username,
        authenticator: conn.authenticator,
        privateKey: privateKeyPemBuffer,
        warehouse: conn.warehouse,
        database: conn.database,
        schema: conn.schema,
      });

      sfConnection.connect((err, connection) => {
        if (err) {
          console.error('❌ Unable to connect to Snowflake:', err.message);
          return res.status(500).json({ success: false, error: err.message });
        }

        // Remove trailing semicolon and whitespace
        query = query.trim().replace(/;+$/, '');
        
        // Get distinct values for the specified column
        const distinctQuery = `SELECT DISTINCT "${column_name}" FROM (${query}) WHERE "${column_name}" IS NOT NULL ORDER BY "${column_name}"`;

        connection.execute({
          sqlText: distinctQuery,
          complete: (err, stmt, rows) => {
            if (err) {
              console.error('❌ Failed to execute query:', err.message);
              sfConnection.destroy();
              return res.status(500).json({ success: false, error: err.message });
            }
            
            distinctValues = rows.map(row => row[column_name]);
            sfConnection.destroy();
            return res.json({ success: true, distinct_column_values: distinctValues,length:distinctValues.length });
          }
        });
      });

    } else if (type === 'Extract') {
      const parquetPath = dsDetails[0].parquet_path;
      if (!parquetPath) {
        return res.status(404).json({ success: false, error: `Parquet path for data source ${ds_name} not found` });
      }

      const escapedPath = parquetPath.replace(/\\/g, '\\\\');
      
      // Get distinct values from parquet file
      const distinctQuery = `SELECT DISTINCT "${column_name}" FROM read_parquet('${escapedPath}') WHERE "${column_name}" IS NOT NULL ORDER BY "${column_name}"`;
      const result = await dbClient.query(distinctQuery);
      
      distinctValues = result.map(row => row[column_name]);
      return res.json({ success: true, distinct_column_values: distinctValues,length:distinctValues.length });

    } else {
      return res.status(400).json({ success: false, error: `Unsupported connection type: ${type}` });
    }

  } catch (err) {
    console.error('❌ Error in /get-distinct-column-values:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// CACHE MANAGEMENT ENDPOINTS
// ============================================

/**
 * Get cache statistics
 * GET /cache/stats
 */
app.get('/cache/stats', (req, res) => {
  try {
    let totalRows = 0;
    let estimatedSize = 0;
    let totalAccessCount = 0;
    
    for (const [key, value] of fastCache.entries()) {
      if (value.data && Array.isArray(value.data)) {
        totalRows += value.data.length;
        // Rough estimate: each row object ~1KB
        estimatedSize += value.data.length * 1024;
      }
      totalAccessCount += value.accessCount || 0;
    }
    
    res.json({
      success: true,
      stats: {
        keys: fastCache.size,
        maxKeys: MAX_CACHE_SIZE,
        totalRows: totalRows.toLocaleString(),
        estimatedSizeMB: (estimatedSize / (1024 * 1024)).toFixed(2),
        totalAccessCount: totalAccessCount,
        avgAccessPerKey: fastCache.size > 0 ? (totalAccessCount / fastCache.size).toFixed(1) : 0,
        ttl: CACHE_TTL,
        ttlMinutes: CACHE_TTL / 60,
        type: 'Ultra-fast native Map (O(1) lookup, no compression, direct object references)'
      }
    });
  } catch (err) {
    console.error('❌ Error getting cache stats:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Clear entire cache
 * POST /cache/clear
 */
app.post('/cache/clear', (req, res) => {
  try {
    const keysBefore = fastCache.size;
    fastCache.clear();
    cacheAccessOrder = [];
    keyHashCache.clear();
    console.log(`🗑️  Cache cleared - Removed ${keysBefore} keys`);
    res.json({ 
      success: true, 
      message: `Cache cleared successfully. Removed ${keysBefore} keys.` 
    });
  } catch (err) {
    console.error('❌ Error clearing cache:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Clear cache for a specific data source
 * POST /cache/clear/:dataSourceName
 */
app.post('/cache/clear/:dataSourceName', (req, res) => {
  try {
    const { dataSourceName } = req.params;
    const prefix = `query:${dataSourceName}:`;
    let clearedCount = 0;
    
    for (const key of fastCache.keys()) {
      if (key.startsWith(prefix)) {
        fastCache.delete(key);
        const index = cacheAccessOrder.indexOf(key);
        if (index > -1) cacheAccessOrder.splice(index, 1);
        clearedCount++;
      }
    }
    
    console.log(`🗑️  Cleared ${clearedCount} cache entries for data source: ${dataSourceName}`);
    res.json({ 
      success: true, 
      message: `Cleared ${clearedCount} cache entries for data source: ${dataSourceName}` 
    });
  } catch (err) {
    console.error('❌ Error clearing cache for data source:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get cache keys (for debugging)
 * GET /cache/keys
 */
app.get('/cache/keys', (req, res) => {
  try {
    const keys = Array.from(fastCache.keys());
    res.json({ 
      success: true, 
      keys: keys,
      count: keys.length 
    });
  } catch (err) {
    console.error('❌ Error getting cache keys:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

(async()=> {
  try {
    await dbClient.query('SELECT 1'); // simple test query
    console.log('✅ DuckDB is connected');

    app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to connect to DuckDB:', err.message);
  }
}
)();

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });


































// async function dsConnect(dataSourceName) {
  //   console.log(`🔄 Loading data from: ${dataSourceName}`);
    
  //   const connectionType = await dbClient.query(
  //     `SELECT type FROM data_source_registry WHERE ds_name=?`,
  //     [dataSourceName]
  //   );
  
  //   if (connectionType.length === 0) {
  //     throw new Error(`Data source ${dataSourceName} not found in registry`);
  //   }
  
  //   const type = connectionType[0].type;
  
  //   if (type === 'Live') {
  //     return await loadFromSnowflake(dataSourceName);
  //   } else if (type === 'Extract') {
  //     return await loadFromDuckDB(dataSourceName);
  //   }
  // }
  
  // /**
  //  * Load from Snowflake with streaming
  //  */
  // async function loadFromSnowflake(dataSourceName) {
  //   const connectionDetails = await dbClient.query(
  //     `SELECT connection_id, query FROM data_source_registry WHERE ds_name=?`,
  //     [dataSourceName]
  //   );
  
  //   if (connectionDetails.length === 0) {
  //     throw new Error(`Connection details for ${dataSourceName} not found`);
  //   }
  
  //   const connId = connectionDetails[0].connection_id;
  //   const query = connectionDetails[0].query;
  
  //   const connDetails = await dbClient.query(
  //     `SELECT * FROM snow_flake_connections WHERE id=?`,
  //     [connId]
  //   );
  
  //   if (connDetails.length === 0) {
  //     throw new Error(`Snowflake connection with id ${connId} not found`);
  //   }
  
  //   const conn = connDetails[0];
  
  //   return new Promise((resolve, reject) => {
  //     let sfConnection;
      
  //     try {
  //       const privateKeyBuffer = Buffer.from(conn.privateKey, 'base64');
  //       const privateKeyObject = crypto.createPrivateKey({
  //         key: privateKeyBuffer,
  //         format: 'der',
  //         type: 'pkcs8',
  //       });
  
  //       const privateKeyPemBuffer = privateKeyObject.export({
  //         format: 'pem',
  //         type: 'pkcs8'
  //       });
  
  //       sfConnection = snowflake.createConnection({
  //         account: conn.account,
  //         username: conn.username,
  //         authenticator: conn.authenticator,
  //         privateKey: privateKeyPemBuffer,
  //         warehouse: conn.warehouse,
  //         database: conn.database,
  //         schema: conn.schema,
  //       });
  
  //       sfConnection.connect((err, connection) => {
  //         if (err) {
  //           console.error('❌ Unable to connect to Snowflake:', err.message);
  //           return reject(new Error('Unable to connect to Snowflake: ' + err.message));
  //         }
  
  //         console.log('✅ Successfully connected to Snowflake');
  
  //         connection.execute({
  //           sqlText: query,
  //           streamResult: true, // Enable streaming
  //           fetchAsString: ['Number', 'Date'], // Fix string length issues
  //           complete: (err, stmt) => {
  //             if (err) {
  //               sfConnection.destroy();
  //               console.error('❌ Failed to execute query:', err.message);
  //               return reject(new Error('Failed to execute query: ' + err.message));
  //             }
  
  //             const stream = stmt.streamRows();
  //             const allRows = []; // Collect all data
  //             let totalRows = 0;
  
  //             stream.on('data', (row) => {
  //               allRows.push(row);
  //               totalRows++;
                
  //               // Log progress every 10k rows
  //               if (totalRows % 10000 === 0) {
  //                 console.log(`📊 Loaded ${totalRows} rows from Snowflake...`);
  //               }
  //             });
  
  //             stream.on('end', () => {
  //               sfConnection.destroy();
  //               console.log(`✅ Completed loading ${totalRows} rows from Snowflake`);
  //               resolve(allRows);
  //             });
  
  //             stream.on('error', (streamErr) => {
  //               sfConnection.destroy();
  //               console.error('❌ Stream error:', streamErr.message);
  //               reject(new Error('Stream error: ' + streamErr.message));
  //             });
  //           }
  //         });
  //       });
  //     } catch (error) {
  //       if (sfConnection) sfConnection.destroy();
  //       console.error('❌ Error:', error.message);
  //       reject(new Error('Connection error: ' + error.message));
  //     }
  //   });
  // }
  
  // /**
  //  * Load from DuckDB with pagination
  //  */
  // async function loadFromDuckDB(dataSourceName) {
  //   const tableName = 'ds_' + dataSourceName.toLowerCase();
  //   const BATCH_SIZE = 50000;
  //   let offset = 0;
  //   let allData = [];
  //   let hasMore = true;
  
  //   console.log(`📊 Starting to load from DuckDB table: ${tableName}`);
  
  //   while (hasMore) {
  //     const batch = await dbClient.query(
  //       `SELECT * FROM ${tableName} LIMIT ? OFFSET ?`,
  //       [BATCH_SIZE, offset]
  //     );
  
  //     if (batch.length === 0) {
  //       hasMore = false;
  //     } else {
  //       allData.push(...batch);
  //       console.log(`📊 Loaded ${batch.length} rows (Total: ${allData.length})`);
        
  //       offset += BATCH_SIZE;
        
  //       if (batch.length < BATCH_SIZE) {
  //         hasMore = false;
  //       }
  //     }
  //   }
  
  //   console.log(`✅ Completed loading ${allData.length} rows from DuckDB`);
  //   return allData;
  // }
  
  // // ============================================
  // // API ENDPOINT
  // // ============================================
  
  // app.post('/api/calculate', async (req, res) => {
  //   const { logic, existingVariables, existingParameters, variableName } = req.body;
    
  //   if (!logic || !variableName) {
  //     return res.status(400).json({ message: 'Missing logic or variableName' });
  //   }
  
  //   const allAvailableVariables = { ...existingVariables, ...existingParameters };
  
  //   try {
  //     const variableDeclarations = Object.entries(allAvailableVariables)
  //       .map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`)
  //       .join('\n');
  
  //     const funcString = `(async function(dsConnect) {
  //       ${variableDeclarations}
  //       return (async () => {
  //         ${logic}
  //       })();
  //     })`;
  
  //     const cal = eval(funcString);
  //     const result = await cal(dsConnect);
  
  //     res.json({ value: result, success: true });
  //   } catch (err) {
  //     console.error(`Error in /api/calculate: ${err.message}`);
  //     return res.status(400).json({ 
  //       message: 'Error evaluating logic: ' + err.message,
  //       success: false 
  //     });
  //   }
  // });