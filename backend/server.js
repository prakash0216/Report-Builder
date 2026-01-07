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

const app = express();
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
const PORT = process.env.PORT || 3002;

// ============================================
// ULTRA-FAST CACHE CONFIGURATION
// ============================================
const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 259200; // 3 days default
const MAX_CACHE_SIZE = 500; // Maximum number of cached queries

const fastCache = new Map();
const keyHashCache = new Map();
let cacheAccessOrder = [];

console.log(`⚡ Ultra-fast cache initialized (native Map, no compression, direct object references)`);

// ============================================
// CACHE KEY GENERATION
// ============================================
function generateCacheKey(dataSourceName, queryObject) {
  const normalized = {
    dataSourceName,
    columns: queryObject.columns ? [...queryObject.columns].sort() : null,
    filters: queryObject.filters ? JSON.stringify(queryObject.filters, Object.keys(queryObject.filters).sort()) : null,
    customWhere: queryObject.customWhere || null,
    groupBy: queryObject.groupBy ? [...queryObject.groupBy].sort() : null,
    orderBy: queryObject.orderBy ? [...queryObject.orderBy].sort() : null,
    limit: queryObject.limit || null,  // 🔥 CRITICAL: Include limit in cache key (for topN parameter)
  };
  
  const keyString = JSON.stringify(normalized);
  if (keyHashCache.has(keyString)) {
    return `query:${dataSourceName}:${keyHashCache.get(keyString)}`;
  }
  
  const hash = crypto.createHash('md5').update(keyString).digest('hex');
  keyHashCache.set(keyString, hash);
  
  if (keyHashCache.size > 1000) {
    const firstKey = keyHashCache.keys().next().value;
    keyHashCache.delete(firstKey);
  }
  
  return `query:${dataSourceName}:${hash}`;
}

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

setInterval(cleanExpiredCache, 5 * 60 * 1000);

function evictLRU() {
  if (fastCache.size < MAX_CACHE_SIZE) return;
  
  if (cacheAccessOrder.length > 0) {
    const lruKey = cacheAccessOrder.shift();
    fastCache.delete(lruKey);
    console.log(`🗑️  Evicted LRU cache entry: ${lruKey.substring(0, 50)}...`);
  }
}

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

async function parseCsvByName(csvName) {
    if (!csvFiles[csvName]) {
      throw new Error(`CSV "${csvName}" not found`);
    }
    const filePath = path.join(csvFolder, csvFiles[csvName]);
    const headers = csvHeaders[csvName];
    return dsConnect(filePath, headers);
  }

// ============================================
// PARAMETER ENDPOINTS (NEW)
// ============================================

/**
 * Get all parameter names
 * GET /api/parameters/names
 */
app.get('/api/parameters/names', async (req, res) => {
  try {
    const result = await dbClient.query('SELECT name FROM parameters ORDER BY created_at DESC');
    const paramNames = result.map(row => row.name);
    res.json({ success: true, parameterNames: paramNames });
  } catch (err) {
    console.error('❌ Error fetching parameter names:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get specific parameter value by name
 * GET /api/parameters/:name
 */
app.get('/api/parameters/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await dbClient.query(`SELECT value FROM parameters WHERE name='${name}'`);
    if (result.length === 0) {
      return res.json({ success: true, value: '' }); // Return empty string if not found
    }
    res.json({ success: true, value: result[0].value });
  } catch (err) {
    console.error('❌ Error fetching parameter:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create or update parameter
 * POST /api/parameters/:name
 */
app.post('/api/parameters/:name', async (req, res) => {
  const { name } = req.params;
  const { value } = req.body;
  
  if (value === undefined) {
    return res.status(400).json({ success: false, error: 'Value is required' });
  }

  try {
    // Check if parameter exists
    const existing = await dbClient.query(`SELECT id FROM parameters WHERE name='${name}'`);
    
    if (existing.length > 0) {
      // Update existing parameter
      const updateQuery = `UPDATE parameters SET value='${String(value).replace(/'/g, "''")}', last_modified=CURRENT_TIMESTAMP WHERE name='${name}'`;
      await dbClient.run(updateQuery);
      console.log(`✅ Updated parameter: ${name}`);
    } else {
      // Insert new parameter
      const insertQuery = `INSERT INTO parameters (name, value, created_at, last_modified) VALUES ('${name}', '${String(value).replace(/'/g, "''")}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
      await dbClient.run(insertQuery);
      console.log(`✅ Created parameter: ${name}`);
    }
    
    res.json({ success: true, message: 'Parameter saved successfully' });
  } catch (err) {
    console.error('❌ Error saving parameter:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete parameter
 * DELETE /api/parameters/:name
 */
app.delete('/api/parameters/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const deleteQuery = `DELETE FROM parameters WHERE name='${name}'`;
    await dbClient.run(deleteQuery);
    console.log(`✅ Deleted parameter: ${name}`);
    res.json({ success: true, message: 'Parameter deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting parameter:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Rename parameter
 * PUT /api/parameters/:oldName/rename
 */
app.put('/api/parameters/:oldName/rename', async (req, res) => {
  const { oldName } = req.params;
  const { newName } = req.body;
  
  if (!newName) {
    return res.status(400).json({ success: false, error: 'New name is required' });
  }

  try {
    // Check if new name already exists
    const existing = await dbClient.query(`SELECT id FROM parameters WHERE name='${newName}'`);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Parameter name already exists' });
    }
    
    const updateQuery = `UPDATE parameters SET name='${newName}', last_modified=CURRENT_TIMESTAMP WHERE name='${oldName}'`;
    await dbClient.run(updateQuery);
    console.log(`✅ Renamed parameter: ${oldName} -> ${newName}`);
    res.json({ success: true, message: 'Parameter renamed successfully' });
  } catch (err) {
    console.error('❌ Error renaming parameter:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ============================================
// DATA SOURCE METADATA ENDPOINTS (NEW)
// ============================================

/**
 * Get all data source names with connection info
 * GET /api/datasources/names
 */
app.get('/api/datasources/names', async (req, res) => {
  try {
    const result = await dbClient.query(`
      SELECT 
        dsr.ds_name,
        dsr.connection_id,
        dsr.type,
        sfc.connectionName
      FROM data_source_registry dsr
      LEFT JOIN snow_flake_connections sfc ON dsr.connection_id = sfc.id
      ORDER BY dsr.created_at DESC
    `);
    
    const dataSources = result.map(row => ({
      name: row.ds_name,
      connectionId: row.connection_id,
      connectionType: row.type,
      connectionName: row.connectionName || null
    }));
    
    res.json({ success: true, dataSources: dataSources });
  } catch (err) {
    console.error('❌ Error fetching data source names:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get specific data source query by name
 * GET /api/datasources/:name/query
 */
app.get('/api/datasources/:name/query', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await dbClient.query(`SELECT query FROM data_source_registry WHERE ds_name='${name}'`);
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Data source not found' });
    }
    res.json({ success: true, query: result[0].query });
  } catch (err) {
    console.error('❌ Error fetching data source query:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create or update data source (without executing query)
 * POST /api/datasources
 */
app.post('/api/datasources', async (req, res) => {
  const { dataSourceName, connectionId, connectionType, query } = req.body;
  
  if (!dataSourceName || !connectionId || !connectionType) {
    return res.status(400).json({ success: false, error: 'dataSourceName, connectionId, and connectionType are required' });
  }

  try {
    // Check if data source already exists
    const existing = await dbClient.query(`SELECT id FROM data_source_registry WHERE ds_name='${dataSourceName}'`);
    
    if (existing.length > 0) {
      // Update existing data source
      const updateQuery = `UPDATE data_source_registry 
        SET connection_id=${connectionId}, 
            type='${connectionType}',
            ${query ? `query='${query.replace(/'/g, "''")}',` : ''}
            last_modified=CURRENT_TIMESTAMP 
        WHERE ds_name='${dataSourceName}'`;
      await dbClient.run(updateQuery);
      console.log(`✅ Updated data source: ${dataSourceName}`);
    } else {
      // Insert new data source
      const insertQuery = `INSERT INTO data_source_registry (ds_name, connection_id, type, query, created_at, last_modified) 
        VALUES ('${dataSourceName}', ${connectionId}, '${connectionType}', '${query ? query.replace(/'/g, "''") : ''}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
      await dbClient.run(insertQuery);
      console.log(`✅ Created data source: ${dataSourceName}`);
    }
    
    res.json({ success: true, message: 'Data source saved successfully' });
  } catch (err) {
    console.error('❌ Error saving data source:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get data source details by name
 * GET /api/datasources/:name
 */
app.get('/api/datasources/:name', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await dbClient.query(`
      SELECT 
        dsr.ds_name,
        dsr.connection_id,
        dsr.type,
        dsr.query,
        sfc.connectionName
      FROM data_source_registry dsr
      LEFT JOIN snow_flake_connections sfc ON dsr.connection_id = sfc.id
      WHERE dsr.ds_name='${name}'
    `);
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Data source not found' });
    }
    
    const ds = result[0];
    res.json({ 
      success: true, 
      dataSource: {
        name: ds.ds_name,
        connectionId: ds.connection_id,
        connectionType: ds.type,
        connectionName: ds.connectionName,
        query: ds.query || ''
      }
    });
  } catch (err) {
    console.error('❌ Error fetching data source details:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update data source query
 * PUT /api/datasources/:name/query
 */
app.put('/api/datasources/:name/query', async (req, res) => {
  const { name } = req.params;
  const { query } = req.body;
  
  if (!query) {
    return res.status(400).json({ success: false, error: 'Query is required' });
  }

  try {
    const updateQuery = `UPDATE data_source_registry SET query='${query.replace(/'/g, "''")}' WHERE ds_name='${name}'`;
    await dbClient.run(updateQuery);
    
    // Clear cache for this data source
    const prefix = `query:${name}:`;
    let clearedCount = 0;
    
    for (const key of fastCache.keys()) {
      if (key.startsWith(prefix)) {
        fastCache.delete(key);
        const index = cacheAccessOrder.indexOf(key);
        if (index > -1) cacheAccessOrder.splice(index, 1);
        clearedCount++;
      }
    }
    
    console.log(`✅ Updated query for ${name}, cleared ${clearedCount} cache entries`);
    res.json({ success: true, message: 'Query updated successfully' });
  } catch (err) {
    console.error('❌ Error updating data source query:', err.message);
    res.status(500).json({ success: false, error: err.message });
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


// ============================================
// Calculations ENDPOINTS (NEW)
// ============================================

/**
 * Get all calculations
 * GET /api/calculations
 */
app.get('/api/calculations', async (req, res) => {
  try {
    const result = await dbClient.query('SELECT * FROM calculations ORDER BY created_at ASC');
    res.json({ success: true, calculations: result || [] });
  } catch (err) {
    console.error('❌ Error fetching calculations:', err.message || err);
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
});

/**
 * Get specific calculation by id
 * GET /api/calculations/:id
 */
app.get('/api/calculations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await dbClient.query(`SELECT * FROM calculations WHERE id=${id}`);
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Calculation not found' });
    }
    res.json({ success: true, calculation: result[0] });
  } catch (err) {
    console.error('❌ Error fetching calculation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Add new calculation
 * POST /api/calculations
 */
app.post('/api/calculations', async (req, res) => {
  const { variableName, logic } = req.body;
  
  if (!variableName || !logic) {
    return res.status(400).json({ success: false, error: 'variableName and logic are required' });
  }

  try {
    // Check if variable name already exists
    const existing = await dbClient.query(`SELECT id FROM calculations WHERE variable_name='${variableName.replace(/'/g, "''")}'`);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Calculation with this variable name already exists' });
    }

    const insertQuery = `INSERT INTO calculations (variable_name, logic, created_at) 
      VALUES ('${variableName.replace(/'/g, "''")}', '${logic.replace(/'/g, "''")}', CURRENT_TIMESTAMP)`;
    await dbClient.run(insertQuery);
    console.log(`✅ Calculation added: ${variableName}`);
    res.json({ success: true, message: 'Calculation added successfully' });
  } catch (err) {
    console.error('❌ Error adding calculation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update calculation
 * PUT /api/calculations/:id
 */
app.put('/api/calculations/:id', async (req, res) => {
  const { id } = req.params;
  const { variableName, logic } = req.body;
  
  if (!logic) {
    return res.status(400).json({ success: false, error: 'logic is required' });
  }

  try {
    // Check if calculation exists
    const existing = await dbClient.query(`SELECT id FROM calculations WHERE id=${id}`);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Calculation not found' });
    }

    // If variableName is being updated, check if new name already exists
    if (variableName) {
      const nameCheck = await dbClient.query(`SELECT id FROM calculations WHERE variable_name='${variableName.replace(/'/g, "''")}' AND id != ${id}`);
      if (nameCheck.length > 0) {
        return res.status(400).json({ success: false, error: 'Calculation with this variable name already exists' });
      }
    }

    let updateQuery;
    if (variableName) {
      updateQuery = `UPDATE calculations 
        SET variable_name='${variableName.replace(/'/g, "''")}', 
            logic='${logic.replace(/'/g, "''")}' 
        WHERE id=${id}`;
    } else {
      updateQuery = `UPDATE calculations 
        SET logic='${logic.replace(/'/g, "''")}' 
        WHERE id=${id}`;
    }
    
    await dbClient.run(updateQuery);
    console.log(`✅ Calculation updated: id=${id}`);
    res.json({ success: true, message: 'Calculation updated successfully' });
  } catch (err) {
    console.error('❌ Error updating calculation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update calculation last_executed timestamp
 * PUT /api/calculations/:id/execute
 */
app.put('/api/calculations/:id/execute', async (req, res) => {
  const { id } = req.params;
  
  try {
    const existing = await dbClient.query(`SELECT id FROM calculations WHERE id=${id}`);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Calculation not found' });
    }

    const updateQuery = `UPDATE calculations SET last_executed=CURRENT_TIMESTAMP WHERE id=${id}`;
    await dbClient.run(updateQuery);
    res.json({ success: true, message: 'Calculation execution timestamp updated' });
  } catch (err) {
    console.error('❌ Error updating calculation execution timestamp:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete calculation
 * DELETE /api/calculations/:id
 */
app.delete('/api/calculations/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Check if calculation exists
    const existing = await dbClient.query(`SELECT id FROM calculations WHERE id=${id}`);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Calculation not found' });
    }

    const deleteQuery = `DELETE FROM calculations WHERE id=${id}`;
    await dbClient.run(deleteQuery);
    console.log(`✅ Calculation deleted: id=${id}`);
    res.json({ success: true, message: 'Calculation deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting calculation:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// ============================================
// FILTER ENDPOINTS
// ============================================

/**
 * Get all filters
 * GET /api/filters
 */
app.get('/api/filters', async (req, res) => {
  try {
    // Note: filters table doesn't have created_at, using last_modified for ordering
    const result = await dbClient.query('SELECT * FROM filters ORDER BY last_modified DESC, id ASC');
    res.json({ success: true, filters: result });
  } catch (err) {
    console.error('❌ Error fetching filters:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get filter by variable name (variable_name is unique, so this is the primary lookup method)
 * GET /api/filters/:variableName
 */
app.get('/api/filters/:variableName', async (req, res) => {
  const { variableName } = req.params;
  try {
    const result = await dbClient.query(`SELECT * FROM filters WHERE variable_name='${variableName.replace(/'/g, "''")}'`);
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Filter not found' });
    }
    res.json({ success: true, filter: result[0] });
  } catch (err) {
    console.error('❌ Error fetching filter:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Add new filter
 * POST /api/filters
 */
app.post('/api/filters', async (req, res) => {
  const { 
    variableName, 
    category, 
    paramName, 
    displayName, 
    selectionType, 
    dsName, 
    labelIndex, 
    valueIndex, 
    labelKey, 
    valueKey, 
    availableOptions, 
    defaultValues 
  } = req.body;
  
  if (!variableName || !category || !paramName || !displayName || !selectionType || !availableOptions || !defaultValues) {
    return res.status(400).json({ 
      success: false, 
      error: 'variableName, category, paramName, displayName, selectionType, availableOptions, and defaultValues are required' 
    });
  }

  try {
    // Check if variable name already exists
    const existing = await dbClient.query(`SELECT id FROM filters WHERE variable_name='${variableName.replace(/'/g, "''")}'`);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Filter with this variable name already exists' });
    }

    const insertQuery = `INSERT INTO filters (
      variable_name, 
      category, 
      param_name, 
      display_name, 
      selection_type, 
      ds_name, 
      label_index, 
      value_index, 
      label_key, 
      value_key, 
      available_options_json, 
      default_values_json,
      last_modified
    ) VALUES (
      '${variableName.replace(/'/g, "''")}',
      '${category.replace(/'/g, "''")}',
      '${paramName.replace(/'/g, "''")}',
      '${displayName.replace(/'/g, "''")}',
      '${selectionType}',
      ${dsName ? `'${dsName.replace(/'/g, "''")}'` : 'NULL'},
      ${labelIndex !== undefined && labelIndex !== null ? labelIndex : 'NULL'},
      ${valueIndex !== undefined && valueIndex !== null ? valueIndex : 'NULL'},
      ${labelKey ? `'${labelKey.replace(/'/g, "''")}'` : 'NULL'},
      ${valueKey ? `'${valueKey.replace(/'/g, "''")}'` : 'NULL'},
      '${JSON.stringify(availableOptions).replace(/'/g, "''")}',
      '${JSON.stringify(defaultValues).replace(/'/g, "''")}',
      CURRENT_TIMESTAMP
    )`;
    
    await dbClient.run(insertQuery);
    console.log(`✅ Filter added: ${variableName}`);
    res.json({ success: true, message: 'Filter added successfully' });
  } catch (err) {
    console.error('❌ Error adding filter:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update filter by variable name
 * PUT /api/filters/:variableName
 */
app.put('/api/filters/:variableName', async (req, res) => {
  const { variableName } = req.params;
  const { 
    category, 
    paramName, 
    displayName, 
    selectionType, 
    dsName, 
    labelIndex, 
    valueIndex, 
    labelKey, 
    valueKey, 
    availableOptions, 
    defaultValues 
  } = req.body;
  
  if (!category || !paramName || !displayName || !selectionType || !availableOptions || !defaultValues) {
    return res.status(400).json({ 
      success: false, 
      error: 'category, paramName, displayName, selectionType, availableOptions, and defaultValues are required' 
    });
  }

  try {
    // Check if filter exists
    const existing = await dbClient.query(`SELECT id FROM filters WHERE variable_name='${variableName.replace(/'/g, "''")}'`);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Filter not found' });
    }

    const updateQuery = `UPDATE filters SET
      category='${category.replace(/'/g, "''")}',
      param_name='${paramName.replace(/'/g, "''")}',
      display_name='${displayName.replace(/'/g, "''")}',
      selection_type='${selectionType}',
      ds_name=${dsName ? `'${dsName.replace(/'/g, "''")}'` : 'NULL'},
      label_index=${labelIndex !== undefined && labelIndex !== null ? labelIndex : 'NULL'},
      value_index=${valueIndex !== undefined && valueIndex !== null ? valueIndex : 'NULL'},
      label_key=${labelKey ? `'${labelKey.replace(/'/g, "''")}'` : 'NULL'},
      value_key=${valueKey ? `'${valueKey.replace(/'/g, "''")}'` : 'NULL'},
      available_options_json='${JSON.stringify(availableOptions).replace(/'/g, "''")}',
      default_values_json='${JSON.stringify(defaultValues).replace(/'/g, "''")}',
      last_modified=CURRENT_TIMESTAMP
    WHERE variable_name='${variableName.replace(/'/g, "''")}'`;
    
    await dbClient.run(updateQuery);
    console.log(`✅ Filter updated: ${variableName}`);
    res.json({ success: true, message: 'Filter updated successfully' });
  } catch (err) {
    console.error('❌ Error updating filter:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete filter by variable name
 * DELETE /api/filters/:variableName
 */
app.delete('/api/filters/:variableName', async (req, res) => {
  const { variableName } = req.params;

  try {
    const existing = await dbClient.query(`SELECT id FROM filters WHERE variable_name='${variableName.replace(/'/g, "''")}'`);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Filter not found' });
    }

    const deleteQuery = `DELETE FROM filters WHERE variable_name='${variableName.replace(/'/g, "''")}'`;
    await dbClient.run(deleteQuery);
    console.log(`✅ Filter deleted: ${variableName}`);
    res.json({ success: true, message: 'Filter deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting filter:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// EXISTING ENDPOINTS (KEPT AS IS)
// ============================================

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
        connection.destroy();
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

    const privateKeyBuffer = privateKey.buffer.toString('base64');
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
          const connectionDetails = await dbClient.query(`SELECT * from snow_flake_connections where id=${connectionId}`);
          if (connectionDetails.length === 0) {
              return res.status(404).json({ success: false, error: 'Connection not found' });
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
                              const columnNames = stmt.getColumns().map(col => col.getName());
                              const tableName = 'ds_' + dataSourceName.toLowerCase();

                              const dropTableQuery = `DROP TABLE IF EXISTS ${tableName}`;
                              dbClient.run(dropTableQuery).then(() => {
                                  console.log(`✅ Existing DuckDB table ${tableName} dropped.`);
                              }).catch(dropErr => {
                                  console.error('❌ Error dropping existing DuckDB table:', dropErr.message);
                              });
                              
                              const createTableQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnNames.map(col => `${col} TEXT`).join(', ')})`;

                              dbClient.run(createTableQuery).then(() => {
                                  console.log(`✅ DuckDB table ${tableName} created with column names.`);
                                  const endTime = new Date();
                                  const timeTaken = (endTime - startTime) / 1000;
                                  console.log(`⏱️  Query executed in ${timeTaken} seconds, fetched ${rows.length} rows.`);

                                  sfConnection.destroy();
                                  res.json({ 
                                      success: true, 
                                      data: rows.slice(0,100),
                                      rowCount: rows.length, 
                                      query: query,  
                                      message: `Data source ${dataSourceName} created successfully with ${rows.length} rows` 
                                  });
                              }).catch(duckdbErr => {
                                  console.error('❌ Error creating DuckDB table:', duckdbErr.message);
                                  sfConnection.destroy();
                                  res.status(500).json({ success: false, error: duckdbErr.message });
                              });
                              
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
        const PARQUET_DIR = path.join(__dirname, './db/parquet_files');
        if (!fs.existsSync(PARQUET_DIR)) {
            fs.mkdirSync(PARQUET_DIR, { recursive: true });
        }
        
        const connectionDetails = await dbClient.query(`SELECT * from snow_flake_connections where id=${connectionId}`);
        if (connectionDetails.length === 0) {
            return res.status(404).json({ success: false, error: 'Connection not found' });
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
                            const columns = stmt.getColumns();
                            const columnNames = columns.map(col => col.getName());
                            const tableName = 'ds_' + dataSourceName.toLowerCase();
                            const parquetFilePath = path.join(PARQUET_DIR, `${tableName}.parquet`);
                            
                            if (fs.existsSync(parquetFilePath)) {
                                fs.unlinkSync(parquetFilePath);
                                console.log(`✅ Existing parquet file ${parquetFilePath} deleted.`);
                            }
                            
                            const parquetSchema = new parquet.ParquetSchema(
                                columnNames.reduce((schema, colName) => {
                                    schema[colName] = { type: 'UTF8', optional: true };
                                    return schema;
                                }, {})
                            );
                            
                            const writer = await parquet.ParquetWriter.openFile(parquetSchema, parquetFilePath);
                            
                            console.log(`✅ Parquet writer initialized for ${parquetFilePath}`);
                            
                            const stream = stmt.streamRows();
                            
                            const BATCH_SIZE = 100000;
                            let batch = [];
                            let totalRowCount = 0;
                            let previewRows = [];
                            let streamEnded = false;
                            let isWriting = false;
                            const startTime = Date.now();
                            
                            const writeBatchToParquet = async (rows) => {
                                if (rows.length === 0) return;
                                
                                try {
                                    const batchSize = rows.length;
                                    
                                    for (const row of rows) {
                                        const parquetRow = {};
                                        columnNames.forEach(col => {
                                            const val = row[col];
                                            parquetRow[col] = (val === null || typeof val === 'undefined') ? null : String(val);
                                        });
                                        await writer.appendRow(parquetRow);
                                    }
                                    
                                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
                                    const rowsPerSecond = (totalRowCount / elapsed).toFixed(0);
                                    console.log(`✅ Written batch of ${batchSize.toLocaleString()} rows | Total: ${totalRowCount.toLocaleString()} | Speed: ${rowsPerSecond} rows/sec | Time: ${elapsed}s`);
                                    
                                } catch (err) {
                                    console.error('❌ Error writing batch to Parquet:', err.message);
                                    throw err;
                                }
                            };
                            
                            stream.on('data', (row) => {
                                totalRowCount++;
                                
                                if (previewRows.length < 100) {
                                    previewRows.push(row);
                                }
                                
                                batch.push(row);
                                
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
                            
                            stream.on('error', async (streamErr) => {
                                console.error('❌ Stream error:', streamErr.message);
                                await writer.close().catch(() => {});
                                sfConnection.destroy();
                                res.status(500).json({ success: false, error: streamErr.message });
                            });
                            
                            stream.on('end', () => {
                                streamEnded = true;
                                
                                const waitAndFinish = async () => {
                                    if (isWriting) {
                                        setTimeout(waitAndFinish, 100);
                                        return;
                                    }
                                    
                                    try {
                                        await writeBatchToParquet(batch);
                                        
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
                                        
                                        const deleteQuery = `DELETE FROM data_source_registry WHERE ds_name='${dataSourceName}'`;
                                        const insertQuery = `INSERT INTO data_source_registry (ds_name,connection_id,type,query,created_at,parquet_path) VALUES ('${dataSourceName}',${connectionId},'${connectionType}','${query.replace(/'/g, "''")}',CURRENT_TIMESTAMP,'${parquetFilePath}')`;
                                        
                                        await dbClient.run(deleteQuery);
                                        await dbClient.run(insertQuery);
                                        console.log(`✅ Data source ${dataSourceName} registered in data_source_registry.`);
                                        
                                        // ============================================
                                        // SIMPLIFIED: Create base table from parquet
                                        // ============================================
                                        try {
                                          console.log(`🔨 Creating base table for ${dataSourceName}...`);
                                          
                                          // Delete existing base table and materialized views if refreshing
                                          const existing = await dbClient.query(`
                                            SELECT refresh_interval_days, last_refreshed FROM data_source_registry 
                                            WHERE ds_name='${dataSourceName.replace(/'/g, "''")}'
                                          `).catch(() => []);
                                          
                                          if (existing.length > 0) {
                                            // Delete base table
                                            const tableName = `ds_${dataSourceName}`;
                                            try {
                                              await dbClient.run(`DROP TABLE IF EXISTS ${tableName}`);
                                              console.log(`✅ Deleted existing base table: ${tableName}`);
                                            } catch (err) {
                                              console.warn(`⚠️ Could not delete base table:`, err.message);
                                            }
                                            
                                            // Delete all materialized views
                                            await deleteMaterializedViews(dataSourceName, dbClient);
                                            
                                            // Clear cache for this data source
                                            clearCacheForDataSource(dataSourceName);
                                          }
                                          
                                          // Create base table
                                          await createBaseTable(dataSourceName, parquetFilePath, dbClient);
                                          
                                          // Update last_refreshed timestamp
                                          await dbClient.run(`
                                            UPDATE data_source_registry 
                                            SET last_refreshed=CURRENT_TIMESTAMP 
                                            WHERE ds_name='${dataSourceName.replace(/'/g, "''")}'
                                          `);
                                          
                                          console.log(`✅ Base table creation complete for ${dataSourceName}`);
                                        } catch (optErr) {
                                          console.warn('⚠️ Base table creation failed (non-critical):', optErr.message);
                                        }
                                        
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
    if (!filterData) {
      continue;
    }

    if (typeof filterData === 'object' && filterData.values !== undefined && filterData.isAll !== undefined) {
      if (filterData.isAll === true) {
        console.log(`⏭️  Skipping ${filterName} - All selected`);
        continue;
      }

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
    else if (Array.isArray(filterData)) {
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
  // console.log(`📝 Filter-based WHERE clause: ${whereClause || '(none - all data)'}`);
  
  return whereClause;
}

// ============================================
// SIMPLIFIED BASE TABLE & MATERIALIZED VIEW FUNCTIONS
// ============================================

/**
 * Generate hash for a query (used for materialized views)
 */
function generateQueryHash(queryObject) {
  const normalized = {
    columns: queryObject.columns ? [...queryObject.columns].sort() : null,
    filters: queryObject.filters ? JSON.stringify(queryObject.filters, Object.keys(queryObject.filters).sort()) : null,
    customWhere: queryObject.customWhere || null,
    groupBy: queryObject.groupBy ? [...queryObject.groupBy].sort() : null,
    orderBy: queryObject.orderBy ? [...queryObject.orderBy].sort() : null,
    limit: queryObject.limit || null,
  };
  
  const keyString = JSON.stringify(normalized);
  return crypto.createHash('md5').update(keyString).digest('hex');
}

/**
 * Create base table from parquet file (simple approach)
 */
async function createBaseTable(dataSourceName, parquetPath, dbClient) {
  const tableName = `ds_${dataSourceName}`;
  
  // Step 1: Check if table exists in DuckDB
  try {
    const tableInfo = await dbClient.query(`PRAGMA table_info('${tableName}')`);
    if (tableInfo && tableInfo.length > 0) {
      console.log(`✅ Base table ${tableName} already exists`);
      return tableName;
    }
  } catch (err) {
    // Table doesn't exist, continue
  }
  
  // Step 2: Create table from parquet file with quoted column names
  try {
    console.log(`🔨 Creating base table ${tableName} from parquet file...`);
    
    // First, get column names from parquet file
    const sampleQuery = `SELECT * FROM read_parquet('${parquetPath.replace(/\\/g, '/')}') LIMIT 1`;
    const sample = await dbClient.query(sampleQuery);
    
    if (sample.length === 0) {
      throw new Error('Parquet file is empty or cannot be read');
    }
    
    // Get column names (preserve exact casing and spaces)
    const columnNames = Object.keys(sample[0]);
    const quotedColumns = columnNames.map(col => `"${col}"`).join(', ');
    
    // Create table with quoted column names to preserve casing
    const createQuery = `CREATE TABLE ${tableName} AS SELECT ${quotedColumns} FROM read_parquet('${parquetPath.replace(/\\/g, '/')}')`;
    
    const startTime = Date.now();
    await dbClient.run(createQuery);
    const time = ((Date.now() - startTime) / 1000).toFixed(2);
    
    const rowCount = await dbClient.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
    console.log(`✅ Base table ${tableName} created in ${time}s (${rowCount[0].cnt.toLocaleString()} rows)`);
    
    return tableName;
  } catch (err) {
    console.error(`❌ Error creating base table ${tableName}:`, err.message);
    throw err;
  }
}

/**
 * Get materialized view for a query (if exists)
 */
async function getMaterializedView(dataSourceName, queryHash, dbClient) {
  try {
    const existing = await dbClient.query(`
      SELECT view_name FROM materialized_views 
      WHERE query_hash='${queryHash}' AND data_source_name='${dataSourceName}'
    `);
    if (existing.length > 0) {
      // Verify the table still exists
      try {
        await dbClient.query(`SELECT 1 FROM ${existing[0].view_name} LIMIT 1`);
        return existing[0].view_name;
      } catch (err) {
        // Table doesn't exist, remove from metadata
        await dbClient.run(`
          DELETE FROM materialized_views 
          WHERE query_hash='${queryHash}' AND data_source_name='${dataSourceName}'
        `);
        return null;
      }
    }
    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Create materialized view (table) for a query
 */
async function createMaterializedView(dataSourceName, queryObject, baseTableName, dbClient) {
  const queryHash = generateQueryHash(queryObject);
  
  // Check if already exists
  const existing = await getMaterializedView(dataSourceName, queryHash, dbClient);
  if (existing) {
    return existing;
  }
  
  const viewName = `mv_${dataSourceName}_${queryHash.substring(0, 8)}`;
  
  // Build query
  const {columns, filters, customWhere, groupBy, orderBy, limit} = queryObject;
  const filterWhereClause = buildWhereClause(filters);
  
  let whereClause = '';
  if (filterWhereClause && customWhere) {
    whereClause = `${filterWhereClause} AND ${customWhere}`;
  } else if (filterWhereClause) {
    whereClause = filterWhereClause;
  } else if (customWhere) {
    whereClause = customWhere;
  }
  
  const selectCols = columns && columns.length > 0 ? columns.join(', ') : '*';
  const groupByClause = groupBy && groupBy.length > 0 ? ` GROUP BY ${groupBy.join(', ')}` : '';
  const orderByClause = orderBy && orderBy.length > 0 ? ` ORDER BY ${orderBy.join(', ')}` : '';
  const limitClause = limit ? ` LIMIT ${limit}` : '';
  const whereClauseSQL = whereClause ? ` WHERE ${whereClause}` : '';
  
  // Create TABLE to materialize the results
  try {
    await dbClient.run(`DROP TABLE IF EXISTS ${viewName}`);
  } catch (dropErr) {
    // Ignore
  }
  
  const createViewQuery = `CREATE TABLE ${viewName} AS 
    SELECT ${selectCols} FROM ${baseTableName}${whereClauseSQL}${groupByClause}${orderByClause}${limitClause}`;
  
  try {
    console.log(`🔨 Creating materialized view: ${viewName}`);
    const startTime = Date.now();
    await dbClient.run(createViewQuery);
    const time = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Materialized view created in ${time}s`);
    
    // Store metadata
    await dbClient.run(`
      INSERT INTO materialized_views (data_source_name, view_name, query_hash, query_object_json, base_table_name, created_at, last_refreshed)
      VALUES ('${dataSourceName}', '${viewName}', '${queryHash}', 
              '${JSON.stringify(queryObject).replace(/'/g, "''")}', 
              '${baseTableName}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);
    
    return viewName;
  } catch (err) {
    console.error(`❌ Error creating materialized view:`, err.message);
    throw err;
  }
}

/**
 * Delete all materialized views for a data source
 */
async function deleteMaterializedViews(dataSourceName, dbClient) {
  try {
    const views = await dbClient.query(`
      SELECT view_name FROM materialized_views WHERE data_source_name='${dataSourceName}'
    `);
    
    for (const view of views) {
      try {
        await dbClient.run(`DROP TABLE IF EXISTS ${view.view_name}`);
        console.log(`✅ Deleted materialized view: ${view.view_name}`);
      } catch (err) {
        console.warn(`⚠️ Could not delete view ${view.view_name}:`, err.message);
      }
    }
    
    await dbClient.run(`DELETE FROM materialized_views WHERE data_source_name='${dataSourceName}'`);
    console.log(`✅ Deleted ${views.length} materialized views for ${dataSourceName}`);
  } catch (err) {
    console.warn(`⚠️ Error deleting materialized views:`, err.message);
  }
}

/**
 * Clear cache entries for a specific data source
 */
function clearCacheForDataSource(dataSourceName) {
  let cleared = 0;
  const keysToDelete = [];
  
  for (const [key, value] of fastCache.entries()) {
    if (key.startsWith(`query:${dataSourceName}:`)) {
      keysToDelete.push(key);
    }
  }
  
  for (const key of keysToDelete) {
    fastCache.delete(key);
    const index = cacheAccessOrder.indexOf(key);
    if (index > -1) cacheAccessOrder.splice(index, 1);
    cleared++;
  }
  
  if (cleared > 0) {
    console.log(`🧹 Cleared ${cleared} cache entries for ${dataSourceName}`);
  }
}

async function _getDataBasedOnDataSourceName(dataSourceName, queryObject) {
  const {columns, filters, customWhere, groupBy, orderBy, limit} = queryObject;
  // console.log('📦 Query Object:', queryObject);
  
  console.log(`🔄 Loading data from: ${dataSourceName}`);
  
  const connectionType = await dbClient.query(`SELECT type FROM data_source_registry WHERE ds_name='${dataSourceName}'`);
  if (connectionType.length === 0) {
    throw new Error(`Data source ${dataSourceName} not found in registry`);
  }
  
  const type = connectionType[0].type;
  console.log(`📊 Data source type: ${type}`);

  const filterWhereClause = buildWhereClause(filters);
  
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
  
  // console.log(`🔍 Final WHERE clause: ${whereClause || '(none - fetching all data)'}`);

  if (type === 'Live') {
    const startTime = Date.now();
    console.log('❄️  Loading from Snowflake Live');
    
    const connectionDetails = await dbClient.query(
      `SELECT connection_id, query FROM data_source_registry WHERE ds_name='${dataSourceName}'`
    );
    if (connectionDetails.length === 0) {
      throw new Error(`Connection details for ${dataSourceName} not found`);
    }
    const connId = connectionDetails[0].connection_id;
    const baseQuery = connectionDetails[0].query;
    
    const connDetails = await dbClient.query(`SELECT * FROM snow_flake_connections WHERE id=${connId}`);
    if (connDetails.length === 0) {
      throw new Error(`Snowflake connection with id ${connId} not found`);
    }
    const conn = connDetails[0];

    return new Promise((resolve, reject) => {
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
          return reject(new Error('Unable to connect to Snowflake: ' + err.message));
        }
        
        console.log('✅ Successfully connected to Snowflake');
        console.log('🔄 Streaming data from Snowflake...');
        
        let data = [];
        let rowsProcessed = 0;
        const sanitizedQuery = baseQuery.trim().replace(/;$/, '');

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
        
        const statement = connection.execute({        
          sqlText: customQuery,
          streamResult: true,
          complete: (err, stmt, rows) => {
            if (err) {
              sfConnection.destroy();
              console.error('❌ Failed to execute Snowflake query:', err.message);
              return reject(new Error('Failed to execute query: ' + err.message));
            }
          }
        });
        
        const stream = statement.streamRows();
        
        stream.on('error', (err) => {
          sfConnection.destroy();
          console.error('❌ Snowflake stream error:', err.message);
          reject(new Error('Stream error: ' + err.message));
        });
        
        stream.on('data', (row) => {
          data.push(row);
          rowsProcessed++;
          
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

  if (type === 'Extract') {
    const startTime = Date.now();
    console.log('🦆 Loading from DuckDB Extract');
    
    const dsDetails = await dbClient.query(
      `SELECT parquet_path FROM data_source_registry WHERE ds_name='${dataSourceName}'`
    );
    if (dsDetails.length === 0) {
      throw new Error(`Data source details for ${dataSourceName} not found`);
    }
    
    const parquetPath = dsDetails[0].parquet_path;
    console.log('📁 Parquet path:', parquetPath);
    
    const { existsSync } = await import('fs');
    if (!parquetPath || !existsSync(parquetPath)) {
      throw new Error(`Parquet file for data source ${dataSourceName} not found at path: ${parquetPath}`);
    }
    
    // ============================================
    // SIMPLIFIED: Check materialized view first, then base table
    // ============================================
    
    // STEP 1: Check if materialized view exists for this exact query
    const queryHash = generateQueryHash(queryObject);
    const materializedViewName = await getMaterializedView(dataSourceName, queryHash, dbClient);
    if (materializedViewName) {
      console.log(`⚡ FAST PATH: Using materialized view: ${materializedViewName}`);
      try {
        const viewResult = await dbClient.query(`SELECT * FROM ${materializedViewName}`);
        const viewTime = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Materialized view query completed in ${viewTime}s (${viewResult.length.toLocaleString()} rows)`);
        return viewResult;
      } catch (err) {
        console.warn(`⚠️ Materialized view query failed, falling back:`, err.message);
      }
    }
    
    // STEP 2: Ensure base table exists (2-step verification)
    let tableName;
    try {
      // Step 2a: Check if table exists in DuckDB
      tableName = `ds_${dataSourceName}`;
      const tableInfo = await dbClient.query(`PRAGMA table_info('${tableName}')`).catch(() => []);
      
      if (tableInfo.length === 0) {
        // Step 2b: Table doesn't exist, create it
        console.log(`🔨 Base table ${tableName} not found, creating from parquet file...`);
        tableName = await createBaseTable(dataSourceName, parquetPath, dbClient);
      } else {
        console.log(`✅ Base table ${tableName} exists`);
      }
    } catch (err) {
      console.warn('⚠️ Could not create base table, using direct parquet read:', err.message);
      tableName = null;
    }
    
    // STEP 3: Execute query on base table (or parquet if table doesn't exist)
    const sourceTable = tableName || `read_parquet('${parquetPath.replace(/\\/g, '\\\\')}')`;
    
    console.log(`📊 Executing query on ${tableName ? 'base table' : 'parquet file'}`);
    
    // Build query
    const selectCols = columns && columns.length > 0 ? columns.join(', ') : '*';
    const groupByClause = groupBy && groupBy.length > 0 ? ` GROUP BY ${groupBy.join(', ')}` : '';
    const orderByClause = orderBy && orderBy.length > 0 ? ` ORDER BY ${orderBy.join(', ')}` : '';
    const limitClause = limit ? ` LIMIT ${limit}` : '';
    const whereClauseSQL = whereClause ? ` WHERE ${whereClause}` : '';
    
    const customQuery = `SELECT ${selectCols} FROM ${sourceTable}${whereClauseSQL}${groupByClause}${orderByClause}${limitClause}`;
    
    // console.log('📝 Executing DuckDB Query:', customQuery);
    
    const queryStartTime = Date.now();
    const data = await dbClient.query(customQuery);
    const queryTime = ((Date.now() - queryStartTime) / 1000).toFixed(2);
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Query completed in ${queryTime}s (${data.length.toLocaleString()} rows) | Total: ${totalTime}s`);
    
    // STEP 4: Create materialized view for future queries (if base table exists)
    if (tableName) {
      try {
        await createMaterializedView(dataSourceName, queryObject, tableName, dbClient);
        console.log(`✅ Created materialized view for future queries`);
      } catch (mvErr) {
        console.warn(`⚠️ Could not create materialized view:`, mvErr.message);
      }
    }
    
    return data;
  }

  else {
    throw new Error(`Unsupported connection type: ${type}`);
  }
}

async function getDataBasedOnDataSourceName(dataSourceName, queryObject) {
  const cacheKey = generateCacheKey(dataSourceName, queryObject);
  // console.log(`🔑 Cache key generated: ${cacheKey.substring(0, 80)}... (limit: ${queryObject.limit || 'none'})`);
  
  const cached = fastCache.get(cacheKey);
  
  if (cached) {
    if (cached.expiresAt > Date.now()) {
      console.log(`✅ Cache HIT for ${dataSourceName} (limit: ${queryObject.limit || 'none'})`);
      const index = cacheAccessOrder.indexOf(cacheKey);
      if (index > -1) cacheAccessOrder.splice(index, 1);
      cacheAccessOrder.push(cacheKey);
      
      cached.accessCount++;
      cached.lastAccessed = Date.now();
      
      const rowCount = Array.isArray(cached.data) ? cached.data.length : 0;
      console.log(`⚡⚡ INSTANT CACHE HIT for ${dataSourceName} (${rowCount.toLocaleString()} rows, accessed ${cached.accessCount}x)`);
      return cached.data;
    } else {
      fastCache.delete(cacheKey);
      const index = cacheAccessOrder.indexOf(cacheKey);
      if (index > -1) cacheAccessOrder.splice(index, 1);
    }
  }
  
  console.log(`💾 CACHE MISS for ${dataSourceName} (limit: ${queryObject.limit || 'none'}) - Executing query...`);
  const queryStartTime = Date.now();
  
  try {
    const data = await _getDataBasedOnDataSourceName(dataSourceName, queryObject);
    const queryElapsed = ((Date.now() - queryStartTime) / 1000).toFixed(2);
    
    evictLRU();
    
    fastCache.set(cacheKey, {
      data: data,
      expiresAt: Date.now() + (CACHE_TTL * 1000),
      accessCount: 1,
      lastAccessed: Date.now()
    });
    
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
      
      if (value && typeof value === 'object' && value.values !== undefined && value.isAll !== undefined) {
        const arrayStr = JSON.stringify(value.values);
        serialized = `(function() {
          const arr = ${arrayStr};
          arr.isAll = ${value.isAll};
          arr.total = ${value.total};
          arr.columnName = ${JSON.stringify(value.columnName)};
          return arr;
        })()`;
      } 
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
    const result=await dbClient.query(`
      SELECT 
        dsr.ds_name,
        dsr.connection_id,
        dsr.type,
        sfc.connectionName
      FROM data_source_registry dsr
      LEFT JOIN snow_flake_connections sfc ON dsr.connection_id = sfc.id
    `);
    const dsNames=result.map(row=>row.ds_name);
    // Keep backward compatibility with data_source_names
    res.json({
      success:true,
      data_source_names:dsNames,
      dataSources: result.map(row => ({
        name: row.ds_name,
        connectionId: row.connection_id,
        connectionType: row.type,
        connectionName: row.connectionName || null
      }))
    });
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
        query = query.trim().replace(/;+$/, '');
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

        query = query.trim().replace(/;+$/, '');
        
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

app.get('/cache/stats', (req, res) => {
  try {
    let totalRows = 0;
    let estimatedSize = 0;
    let totalAccessCount = 0;
    
    for (const [key, value] of fastCache.entries()) {
      if (value.data && Array.isArray(value.data)) {
        totalRows += value.data.length;
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

// ============================================
// CHART ID GENERATION ENDPOINT
// ============================================

/**
 * Get next available chart ID
 * GET /api/next-chart-id
 */
app.get('/api/next-chart-id', async (req, res) => {
  try {
    // Get max chart_id from all tables that use chart_id
    // DuckDB uses ~ for regex matching
    const queries = [
      "SELECT chart_id FROM layouts WHERE chart_id ~ '^[0-9]+$'",
      "SELECT chart_id FROM chart_configs WHERE chart_id ~ '^[0-9]+$'",
      "SELECT chart_id FROM chart_visibility WHERE chart_id ~ '^[0-9]+$'",
      "SELECT chart_id FROM card_dimension_conditions WHERE chart_id ~ '^[0-9]+$'"
    ];
    
    let maxId = 0;
    
    for (const query of queries) {
      try {
        const results = await dbClient.query(query);
        if (results && Array.isArray(results)) {
          results.forEach(row => {
            const id = parseInt(row.chart_id);
            if (!isNaN(id) && id > maxId) {
              maxId = id;
            }
          });
        }
      } catch (err) {
        // If regex doesn't work, try without filter (get all and filter in JS)
        try {
          const tableName = query.match(/FROM (\w+)/)?.[1];
          if (tableName) {
            const altQuery = `SELECT chart_id FROM ${tableName}`;
            const altResults = await dbClient.query(altQuery);
            if (altResults && Array.isArray(altResults)) {
              altResults.forEach(row => {
                const id = parseInt(row.chart_id);
                if (!isNaN(id) && id > maxId) {
                  maxId = id;
                }
              });
            }
          }
        } catch (altErr) {
          console.warn('Warning checking chart_id in table:', err.message);
        }
      }
    }
    
    const nextId = maxId + 1;
    res.json({ success: true, nextChartId: nextId });
  } catch (err) {
    console.error('Error getting next chart ID:', err.message || err);
    // Fallback to 1 if there's an error
    res.json({ success: true, nextChartId: 1 });
  }
});

// ============================================
// CHART CONFIG ENDPOINTS
// ============================================

/**
 * Get all chart configs
 * GET /api/chart-configs
 */
app.get('/api/chart-configs', async (req, res) => {
  try {
    const configs = await dbClient.query('SELECT * FROM chart_configs ORDER BY COALESCE(last_modified, created_at) DESC, created_at DESC');
    const result = {};
    if (configs && Array.isArray(configs)) {
      configs.forEach(row => {
        result[row.chart_id] = {
          template: row.template,
          type: row.type,
          processed: row.processed_config_json ? JSON.parse(row.processed_config_json) : null,
          htmlContent: row.html_content || '',
          tableDataSource: row.table_data_source || '',
          tableSettings: row.table_settings_json ? JSON.parse(row.table_settings_json) : null,
        };
      });
    }
    res.json({ success: true, configs: result });
  } catch (err) {
    console.error('Error fetching chart configs:', err.message || err);
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
});

/**
 * Get a specific chart config
 * GET /api/chart-configs/:chartId
 */
app.get('/api/chart-configs/:chartId', async (req, res) => {
  try {
    const { chartId } = req.params;
    const configs = await dbClient.query(`SELECT * FROM chart_configs WHERE chart_id='${chartId.replace(/'/g, "''")}'`);
    if (configs.length === 0) {
      return res.status(404).json({ success: false, error: 'Chart config not found' });
    }
    const row = configs[0];
    res.json({
      success: true,
      config: {
        template: row.template,
        type: row.type,
        processed: row.processed_config_json ? JSON.parse(row.processed_config_json) : null,
        htmlContent: row.html_content || '',
        tableDataSource: row.table_data_source || '',
        tableSettings: row.table_settings_json ? JSON.parse(row.table_settings_json) : null,
      }
    });
  } catch (err) {
    console.error('Error fetching chart config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create or update a chart config
 * POST /api/chart-configs
 */
app.post('/api/chart-configs', async (req, res) => {
  try {
    const { chartId, template, type, processed, htmlContent, tableDataSource, tableSettings } = req.body;
    if (!chartId || !type) {
      return res.status(400).json({ success: false, error: 'chartId and type are required' });
    }

    const processedJson = processed ? JSON.stringify(processed) : null;
    const tableSettingsJson = tableSettings ? JSON.stringify(tableSettings) : null;
    const existing = await dbClient.query(`SELECT id FROM chart_configs WHERE chart_id='${chartId.replace(/'/g, "''")}'`);
    
    const escapedChartId = chartId.replace(/'/g, "''");
    const escapedTemplate = (template || '').replace(/'/g, "''");
    const escapedHtmlContent = (htmlContent || '').replace(/'/g, "''");
    const escapedProcessedJson = (processedJson || '').replace(/'/g, "''");
    const escapedTableDataSource = (tableDataSource || '').replace(/'/g, "''");
    const escapedTableSettingsJson = (tableSettingsJson || '').replace(/'/g, "''");
    
    if (existing.length > 0) {
      // Update
      await dbClient.run(`
        UPDATE chart_configs 
        SET template='${escapedTemplate}', type='${type}', processed_config_json='${escapedProcessedJson}', html_content='${escapedHtmlContent}', table_data_source='${escapedTableDataSource}', table_settings_json='${escapedTableSettingsJson}', last_modified=CURRENT_TIMESTAMP
        WHERE chart_id='${escapedChartId}'
      `);
    } else {
      // Insert
      await dbClient.run(`
        INSERT INTO chart_configs (chart_id, template, type, processed_config_json, html_content, table_data_source, table_settings_json, last_modified)
        VALUES ('${escapedChartId}', '${escapedTemplate}', '${type}', '${escapedProcessedJson}', '${escapedHtmlContent}', '${escapedTableDataSource}', '${escapedTableSettingsJson}', CURRENT_TIMESTAMP)
      `);
    }

    res.json({ success: true, message: 'Chart config saved successfully' });
  } catch (err) {
    console.error('Error saving chart config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete a chart config
 * DELETE /api/chart-configs/:chartId
 */
app.delete('/api/chart-configs/:chartId', async (req, res) => {
  try {
    const { chartId } = req.params;
    await dbClient.run(`DELETE FROM chart_configs WHERE chart_id='${chartId.replace(/'/g, "''")}'`);
    res.json({ success: true, message: 'Chart config deleted successfully' });
  } catch (err) {
    console.error('Error deleting chart config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete a chart completely from all tables
 * DELETE /api/charts/:chartId
 * This deletes the chart from chart_configs, layouts, chart_visibility, card_dimension_conditions, and tooltip_configs
 */
app.delete('/api/charts/:chartId', async (req, res) => {
  try {
    const { chartId } = req.params;
    const escapedChartId = chartId.replace(/'/g, "''");
    
    // Delete from all tables that reference chart_id
    await dbClient.run(`DELETE FROM chart_configs WHERE chart_id='${escapedChartId}'`);
    await dbClient.run(`DELETE FROM layouts WHERE chart_id='${escapedChartId}'`);
    await dbClient.run(`DELETE FROM chart_visibility WHERE chart_id='${escapedChartId}'`);
    await dbClient.run(`DELETE FROM card_dimension_conditions WHERE chart_id='${escapedChartId}'`);
    await dbClient.run(`DELETE FROM tooltip_configs WHERE chart_id='${escapedChartId}'`);
    
    console.log(`✅ Chart ${chartId} deleted from all tables`);
    res.json({ success: true, message: 'Chart deleted successfully from all tables' });
  } catch (err) {
    console.error('Error deleting chart:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// TOOLTIP CONFIG ENDPOINTS
// ============================================

/**
 * Get all tooltip configs
 * GET /api/tooltip-configs
 */
app.get('/api/tooltip-configs', async (req, res) => {
  try {
    const configs = await dbClient.query('SELECT * FROM tooltip_configs ORDER BY COALESCE(last_modified, created_at) DESC');
    const result = {};
    if (configs && Array.isArray(configs)) {
      configs.forEach(row => {
        result[row.chart_id] = {
          enabled: row.enabled,
          type: row.type,
          cardId: row.card_id || '',
          chartTemplate: row.chart_template || '',
          tableDataSource: row.table_data_source || '',
          tableSettings: row.table_settings_json ? JSON.parse(row.table_settings_json) : null,
          htmlTemplate: row.html_template || '',
          dataMapping: row.data_mapping_json ? JSON.parse(row.data_mapping_json) : [],
          width: row.width || 400,
          height: row.height || 300,
          offsetX: row.offset_x || 10,
          offsetY: row.offset_y || 10,
          showOnHover: row.show_on_hover !== false,
          hideDelay: row.hide_delay || 200,
          showHeader: row.show_header !== false,
          headerTitle: row.header_title || 'Details',
        };
      });
    }
    res.json({ success: true, configs: result });
  } catch (err) {
    console.error('Error fetching tooltip configs:', err.message || err);
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
});

/**
 * Get tooltip config for a specific chart
 * GET /api/tooltip-configs/:chartId
 */
app.get('/api/tooltip-configs/:chartId', async (req, res) => {
  try {
    const { chartId } = req.params;
    const configs = await dbClient.query(`SELECT * FROM tooltip_configs WHERE chart_id='${chartId.replace(/'/g, "''")}'`);
    if (configs.length === 0) {
      return res.json({ success: true, config: null });
    }
    const row = configs[0];
    res.json({
      success: true,
      config: {
        enabled: row.enabled,
        type: row.type,
        cardId: row.card_id || '',
        chartTemplate: row.chart_template || '',
        tableDataSource: row.table_data_source || '',
        tableSettings: row.table_settings_json ? JSON.parse(row.table_settings_json) : null,
        htmlTemplate: row.html_template || '',
        dataMapping: row.data_mapping_json ? JSON.parse(row.data_mapping_json) : [],
        width: row.width || 400,
        height: row.height || 300,
        offsetX: row.offset_x || 10,
        offsetY: row.offset_y || 10,
        showOnHover: row.show_on_hover !== false,
        hideDelay: row.hide_delay || 200,
        showHeader: row.show_header !== false,
        headerTitle: row.header_title || 'Details',
      }
    });
  } catch (err) {
    console.error('Error fetching tooltip config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Save tooltip config
 * POST /api/tooltip-configs
 */
app.post('/api/tooltip-configs', async (req, res) => {
  try {
    const { chartId, config } = req.body;
    if (!chartId || !config) {
      return res.status(400).json({ success: false, error: 'chartId and config are required' });
    }

    const escapedChartId = chartId.replace(/'/g, "''");
    const escapedCardId = (config.cardId || '').replace(/'/g, "''");
    const escapedChartTemplate = (config.chartTemplate || '').replace(/'/g, "''");
    const escapedTableDataSource = (config.tableDataSource || '').replace(/'/g, "''");
    const escapedTableSettingsJson = config.tableSettings ? JSON.stringify(config.tableSettings).replace(/'/g, "''") : '';
    const escapedHtmlTemplate = (config.htmlTemplate || '').replace(/'/g, "''");
    const escapedDataMappingJson = config.dataMapping ? JSON.stringify(config.dataMapping).replace(/'/g, "''") : '[]';
    const escapedHeaderTitle = (config.headerTitle || 'Details').replace(/'/g, "''");

    const existing = await dbClient.query(`SELECT id FROM tooltip_configs WHERE chart_id='${escapedChartId}'`);
    
    if (existing.length > 0) {
      // Update existing
      await dbClient.run(`
        UPDATE tooltip_configs SET
          enabled = ${config.enabled ? 'true' : 'false'},
          type = '${config.type || 'html'}',
          card_id = '${escapedCardId}',
          chart_template = '${escapedChartTemplate}',
          table_data_source = '${escapedTableDataSource}',
          table_settings_json = '${escapedTableSettingsJson}',
          html_template = '${escapedHtmlTemplate}',
          data_mapping_json = '${escapedDataMappingJson}',
          width = ${config.width || 400},
          height = ${config.height || 300},
          offset_x = ${config.offsetX || 10},
          offset_y = ${config.offsetY || 10},
          show_on_hover = ${config.showOnHover !== false ? 'true' : 'false'},
          hide_delay = ${config.hideDelay || 200},
          show_header = ${config.showHeader !== false ? 'true' : 'false'},
          header_title = '${escapedHeaderTitle}',
          last_modified = CURRENT_TIMESTAMP
        WHERE chart_id = '${escapedChartId}'
      `);
    } else {
      // Insert new
      await dbClient.run(`
        INSERT INTO tooltip_configs (
          chart_id, enabled, type, card_id, chart_template, table_data_source,
          table_settings_json, html_template, data_mapping_json, width, height,
          offset_x, offset_y, show_on_hover, hide_delay, show_header, header_title,
          created_at, last_modified
        ) VALUES (
          '${escapedChartId}',
          ${config.enabled ? 'true' : 'false'},
          '${config.type || 'html'}',
          '${escapedCardId}',
          '${escapedChartTemplate}',
          '${escapedTableDataSource}',
          '${escapedTableSettingsJson}',
          '${escapedHtmlTemplate}',
          '${escapedDataMappingJson}',
          ${config.width || 400},
          ${config.height || 300},
          ${config.offsetX || 10},
          ${config.offsetY || 10},
          ${config.showOnHover !== false ? 'true' : 'false'},
          ${config.hideDelay || 200},
          ${config.showHeader !== false ? 'true' : 'false'},
          '${escapedHeaderTitle}',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `);
    }
    
    console.log(`✅ Tooltip config saved for chart: ${chartId}`);
    res.json({ success: true, message: 'Tooltip config saved successfully' });
  } catch (err) {
    console.error('Error saving tooltip config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete tooltip config
 * DELETE /api/tooltip-configs/:chartId
 */
app.delete('/api/tooltip-configs/:chartId', async (req, res) => {
  try {
    const { chartId } = req.params;
    await dbClient.run(`DELETE FROM tooltip_configs WHERE chart_id='${chartId.replace(/'/g, "''")}'`);
    res.json({ success: true, message: 'Tooltip config deleted successfully' });
  } catch (err) {
    console.error('Error deleting tooltip config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// CHILD CARD CONFIG ENDPOINTS (Multi-Card Containers)
// ============================================

/**
 * Get all child card configs
 * GET /api/child-card-configs
 */
app.get('/api/child-card-configs', async (req, res) => {
  try {
    const configs = await dbClient.query('SELECT * FROM child_card_configs ORDER BY COALESCE(last_modified, created_at) DESC');
    console.log('[child-card-configs] Raw DB rows:', JSON.stringify(configs, null, 2));
    const result = {};
    
    if (configs && Array.isArray(configs)) {
      configs.forEach(row => {
        console.log(`[child-card-configs] Processing ${row.parent_card_id}: gap=${row.gap}, type=${typeof row.gap}`);
        result[row.parent_card_id] = {
          isContainer: row.is_container,
          containerLayout: row.container_layout || 'grid',
          childCards: row.child_cards_json ? JSON.parse(row.child_cards_json) : [],
          enableContainerScroll: row.enable_container_scroll === true,
          // 🔥 FIX: Use explicit null/undefined check instead of || to handle 0 values
          cardMinHeight: row.card_min_height != null ? row.card_min_height : 800,
          gap: row.gap != null ? row.gap : 8,
          // 🔥 Dynamic height settings
          useDynamicHeight: row.use_dynamic_height === true,
          heightDataSource: row.height_data_source || '',
        };
      });
    }
    
    console.log('[child-card-configs] Returning result:', JSON.stringify(result, null, 2));
    res.json({ success: true, configs: result });
  } catch (err) {
    console.error('Error fetching child card configs:', err.message || err);
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
});

/**
 * Save or update child card config
 * POST /api/child-card-configs
 */
app.post('/api/child-card-configs', async (req, res) => {
  try {
    const { parentCardId, config } = req.body;
    
    console.log(`[child-card-configs POST] Saving ${parentCardId}:`, JSON.stringify({
      gap: config?.gap,
      cardMinHeight: config?.cardMinHeight,
      enableContainerScroll: config?.enableContainerScroll,
      useDynamicHeight: config?.useDynamicHeight,
    }));
    
    if (!parentCardId || !config) {
      return res.status(400).json({ success: false, error: 'parentCardId and config are required' });
    }

    const escapedParentCardId = parentCardId.replace(/'/g, "''");
    const escapedContainerLayout = (config.containerLayout || 'grid').replace(/'/g, "''");
    const escapedChildCardsJson = config.childCards ? JSON.stringify(config.childCards).replace(/'/g, "''") : '[]';

    const existing = await dbClient.query(`SELECT id FROM child_card_configs WHERE parent_card_id='${escapedParentCardId}'`);
    
    if (existing.length > 0) {
      // Update existing
      const escapedHeightDataSource = (config.heightDataSource || '').replace(/'/g, "''");
      await dbClient.run(`
        UPDATE child_card_configs SET
          is_container = ${config.isContainer ? 'true' : 'false'},
          container_layout = '${escapedContainerLayout}',
          child_cards_json = '${escapedChildCardsJson}',
          enable_container_scroll = ${config.enableContainerScroll === true ? 'true' : 'false'},
          card_min_height = ${config.cardMinHeight != null ? config.cardMinHeight : 800},
          gap = ${config.gap != null ? config.gap : 8},
          use_dynamic_height = ${config.useDynamicHeight === true ? 'true' : 'false'},
          height_data_source = '${escapedHeightDataSource}',
          last_modified = CURRENT_TIMESTAMP
        WHERE parent_card_id = '${escapedParentCardId}'
      `);
    } else {
      // Insert new
      const escapedHeightDataSourceInsert = (config.heightDataSource || '').replace(/'/g, "''");
      await dbClient.run(`
        INSERT INTO child_card_configs (
          parent_card_id, is_container, container_layout, child_cards_json,
          enable_container_scroll, card_min_height, gap, use_dynamic_height, height_data_source,
          created_at, last_modified
        ) VALUES (
          '${escapedParentCardId}',
          ${config.isContainer ? 'true' : 'false'},
          '${escapedContainerLayout}',
          '${escapedChildCardsJson}',
          ${config.enableContainerScroll === true ? 'true' : 'false'},
          ${config.cardMinHeight != null ? config.cardMinHeight : 800},
          ${config.gap != null ? config.gap : 8},
          ${config.useDynamicHeight === true ? 'true' : 'false'},
          '${escapedHeightDataSourceInsert}',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `);
    }
    
    console.log(`✅ Child card config saved for parent: ${parentCardId}`);
    res.json({ success: true, message: 'Child card config saved successfully' });
  } catch (err) {
    console.error('Error saving child card config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete child card config
 * DELETE /api/child-card-configs/:parentCardId
 */
app.delete('/api/child-card-configs/:parentCardId', async (req, res) => {
  try {
    const { parentCardId } = req.params;
    await dbClient.run(`DELETE FROM child_card_configs WHERE parent_card_id='${parentCardId.replace(/'/g, "''")}'`);
    res.json({ success: true, message: 'Child card config deleted successfully' });
  } catch (err) {
    console.error('Error deleting child card config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// CHILD CARD TOOLTIP CONFIG ENDPOINTS
// ============================================

/**
 * Get all child card tooltip configs
 * GET /api/child-card-tooltip-configs
 */
app.get('/api/child-card-tooltip-configs', async (req, res) => {
  try {
    const configs = await dbClient.query('SELECT * FROM child_card_tooltip_configs');
    const result = {};
    
    if (configs && Array.isArray(configs)) {
      configs.forEach(row => {
        result[row.child_card_key] = {
          enabled: row.enabled === true,
          type: row.tooltip_type || 'html',
          dataExtractions: row.data_extractions_json ? JSON.parse(row.data_extractions_json) : [],
          calculationBindings: row.calculation_bindings_json ? JSON.parse(row.calculation_bindings_json) : [],
          chartTemplate: row.chart_template || '',
          tableDataSource: row.table_data_source || '',
          tableSettings: row.table_settings_json ? JSON.parse(row.table_settings_json) : undefined,
          htmlTemplate: row.html_template || '',
          width: row.width || 400,
          height: row.height || 300,
          offsetX: row.offset_x || 15,
          offsetY: row.offset_y || 15,
          hideDelay: row.hide_delay || 200,
          showHeader: row.show_header !== false,
          headerTitle: row.header_title || 'Details',
          triggerOn: row.trigger_on || 'hover',
          // 🔥 NEW: Multi-card fields
          useMultiCard: row.use_multi_card === true,
          tooltipCards: row.tooltip_cards_json ? JSON.parse(row.tooltip_cards_json) : [],
          containerLayout: row.container_layout || 'grid',
          gap: typeof row.gap === 'number' ? row.gap : 4,
        };
      });
    }
    
    res.json({ success: true, configs: result });
  } catch (err) {
    console.error('Error fetching child card tooltip configs:', err.message || err);
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
});

/**
 * Save child card tooltip configs (bulk save)
 * POST /api/child-card-tooltip-configs
 */
app.post('/api/child-card-tooltip-configs', async (req, res) => {
  try {
    const { configs } = req.body;
    
    if (!configs || typeof configs !== 'object') {
      return res.status(400).json({ success: false, error: 'configs object is required' });
    }

    // Process each config
    for (const [childCardKey, config] of Object.entries(configs)) {
      // Check if exists
      const existing = await dbClient.query(`SELECT child_card_key FROM child_card_tooltip_configs WHERE child_card_key='${childCardKey.replace(/'/g, "''")}'`);
      const now = new Date().toISOString();
      
      const data = {
        enabled: config.enabled ? 1 : 0,
        tooltipType: config.type || 'html',
        dataExtractionsJson: JSON.stringify(config.dataExtractions || []),
        calculationBindingsJson: JSON.stringify(config.calculationBindings || []),
        chartTemplate: config.chartTemplate || '',
        tableDataSource: config.tableDataSource || '',
        tableSettingsJson: config.tableSettings ? JSON.stringify(config.tableSettings) : null,
        htmlTemplate: config.htmlTemplate || '',
        width: config.width || 400,
        height: config.height || 300,
        offsetX: config.offsetX || 15,
        offsetY: config.offsetY || 15,
        hideDelay: config.hideDelay || 200,
        showHeader: config.showHeader !== false ? 1 : 0,
        headerTitle: config.headerTitle || 'Details',
        triggerOn: config.triggerOn || 'hover',
        // 🔥 NEW: Multi-card fields
        useMultiCard: config.useMultiCard ? 1 : 0,
        tooltipCardsJson: JSON.stringify(config.tooltipCards || []),
        containerLayout: config.containerLayout || 'grid',
        gap: typeof config.gap === 'number' ? config.gap : 4,
      };

      if (existing && existing.length > 0) {
        // Update
        await dbClient.run(`
          UPDATE child_card_tooltip_configs SET
            enabled = ${data.enabled},
            tooltip_type = '${data.tooltipType.replace(/'/g, "''")}',
            data_extractions_json = '${data.dataExtractionsJson.replace(/'/g, "''")}',
            calculation_bindings_json = '${data.calculationBindingsJson.replace(/'/g, "''")}',
            chart_template = '${data.chartTemplate.replace(/'/g, "''")}',
            table_data_source = '${data.tableDataSource.replace(/'/g, "''")}',
            table_settings_json = ${data.tableSettingsJson ? `'${data.tableSettingsJson.replace(/'/g, "''")}'` : 'NULL'},
            html_template = '${data.htmlTemplate.replace(/'/g, "''")}',
            width = ${data.width},
            height = ${data.height},
            offset_x = ${data.offsetX},
            offset_y = ${data.offsetY},
            hide_delay = ${data.hideDelay},
            show_header = ${data.showHeader},
            header_title = '${data.headerTitle.replace(/'/g, "''")}',
            trigger_on = '${data.triggerOn.replace(/'/g, "''")}',
            use_multi_card = ${data.useMultiCard},
            tooltip_cards_json = '${data.tooltipCardsJson.replace(/'/g, "''")}',
            container_layout = '${data.containerLayout.replace(/'/g, "''")}',
            gap = ${data.gap},
            last_modified = '${now}'
          WHERE child_card_key = '${childCardKey.replace(/'/g, "''")}'
        `);
      } else {
        // Insert
        await dbClient.run(`
          INSERT INTO child_card_tooltip_configs (
            child_card_key, enabled, tooltip_type, data_extractions_json, calculation_bindings_json,
            chart_template, table_data_source, table_settings_json, html_template,
            width, height, offset_x, offset_y, hide_delay, show_header, header_title, trigger_on,
            use_multi_card, tooltip_cards_json, container_layout, gap,
            created_at, last_modified
          ) VALUES (
            '${childCardKey.replace(/'/g, "''")}',
            ${data.enabled},
            '${data.tooltipType.replace(/'/g, "''")}',
            '${data.dataExtractionsJson.replace(/'/g, "''")}',
            '${data.calculationBindingsJson.replace(/'/g, "''")}',
            '${data.chartTemplate.replace(/'/g, "''")}',
            '${data.tableDataSource.replace(/'/g, "''")}',
            ${data.tableSettingsJson ? `'${data.tableSettingsJson.replace(/'/g, "''")}'` : 'NULL'},
            '${data.htmlTemplate.replace(/'/g, "''")}',
            ${data.width},
            ${data.height},
            ${data.offsetX},
            ${data.offsetY},
            ${data.hideDelay},
            ${data.showHeader},
            '${data.headerTitle.replace(/'/g, "''")}',
            '${data.triggerOn.replace(/'/g, "''")}',
            ${data.useMultiCard},
            '${data.tooltipCardsJson.replace(/'/g, "''")}',
            '${data.containerLayout.replace(/'/g, "''")}',
            ${data.gap},
            '${now}',
            '${now}'
          )
        `);
      }
    }

    res.json({ success: true, message: 'Child card tooltip configs saved successfully' });
  } catch (err) {
    console.error('Error saving child card tooltip configs:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete a child card tooltip config
 * DELETE /api/child-card-tooltip-configs/:childCardKey
 */
app.delete('/api/child-card-tooltip-configs/:childCardKey', async (req, res) => {
  try {
    const { childCardKey } = req.params;
    await dbClient.run(`DELETE FROM child_card_tooltip_configs WHERE child_card_key='${childCardKey.replace(/'/g, "''")}'`);
    res.json({ success: true, message: 'Child card tooltip config deleted successfully' });
  } catch (err) {
    console.error('Error deleting child card tooltip config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// LAYOUT ENDPOINTS
// ============================================

/**
 * Get all layouts
 * GET /api/layouts
 */
app.get('/api/layouts', async (req, res) => {
  try {
    const layouts = await dbClient.query('SELECT * FROM layouts ORDER BY breakpoint, y, x');
    const result = {
      lg: [],
      md: [],
      sm: [],
      xs: [],
      xxs: [],
    };
    
    layouts.forEach(row => {
      const layoutItem = {
        i: row.chart_id,
        x: row.x,
        y: row.y,
        w: row.w,
        h: row.h,
      };
      if (row.min_w !== null) layoutItem.minW = row.min_w;
      if (row.max_w !== null) layoutItem.maxW = row.max_w;
      if (row.min_h !== null) layoutItem.minH = row.min_h;
      if (row.max_h !== null) layoutItem.maxH = row.max_h;
      if (row.static !== null) layoutItem.static = row.static;
      if (row.is_draggable !== null) layoutItem.isDraggable = row.is_draggable;
      if (row.is_resizable !== null) layoutItem.isResizable = row.is_resizable;
      if (row.is_bounded !== null) layoutItem.isBounded = row.is_bounded;
      if (row.resize_handles) layoutItem.resizeHandles = JSON.parse(row.resize_handles);
      if (row.moved !== null) layoutItem.moved = row.moved;
      
      result[row.breakpoint].push(layoutItem);
    });
    
    res.json({ success: true, layouts: result });
  } catch (err) {
    console.error('Error fetching layouts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Save all layouts
 * POST /api/layouts
 */
app.post('/api/layouts', async (req, res) => {
  try {
    const { layouts } = req.body;
    if (!layouts || typeof layouts !== 'object') {
      return res.status(400).json({ success: false, error: 'layouts object is required' });
    }

    // Delete existing layouts for breakpoints we're updating
    const breakpoints = ['lg', 'md', 'sm', 'xs', 'xxs'];
    const breakpointsToUpdate = breakpoints.filter(bp => layouts[bp] && Array.isArray(layouts[bp]) && layouts[bp].length > 0);
    
    if (breakpointsToUpdate.length > 0) {
      const breakpointList = breakpointsToUpdate.map(bp => `'${bp}'`).join(',');
      await dbClient.run(`DELETE FROM layouts WHERE breakpoint IN (${breakpointList})`);
    }

    // Insert new layouts
    for (const breakpoint of breakpoints) {
      if (layouts[breakpoint] && Array.isArray(layouts[breakpoint])) {
        for (const item of layouts[breakpoint]) {
          const escapedChartId = (item.i || '').replace(/'/g, "''");
          const x = item.x || 0;
          const y = item.y || 0;
          const w = item.w || 6;
          const h = item.h || 4;
          const minW = item.minW !== undefined ? item.minW : 'NULL';
          const maxW = item.maxW !== undefined ? item.maxW : 'NULL';
          const minH = item.minH !== undefined ? item.minH : 'NULL';
          const maxH = item.maxH !== undefined ? item.maxH : 'NULL';
          const staticVal = item.static !== undefined ? (item.static ? 'true' : 'false') : 'NULL';
          const isDraggable = item.isDraggable !== undefined ? (item.isDraggable ? 'true' : 'false') : 'NULL';
          const isResizable = item.isResizable !== undefined ? (item.isResizable ? 'true' : 'false') : 'NULL';
          const isBounded = item.isBounded !== undefined ? (item.isBounded ? 'true' : 'false') : 'NULL';
          const resizeHandles = item.resizeHandles ? `'${JSON.stringify(item.resizeHandles).replace(/'/g, "''")}'` : 'NULL';
          const moved = item.moved !== undefined ? (item.moved ? 'true' : 'false') : 'NULL';
          
          await dbClient.run(`
            INSERT INTO layouts (
              breakpoint, chart_id, x, y, w, h, min_w, max_w, min_h, max_h,
              static, is_draggable, is_resizable, is_bounded, resize_handles, moved, last_modified
            ) VALUES ('${breakpoint}', '${escapedChartId}', ${x}, ${y}, ${w}, ${h}, ${minW}, ${maxW}, ${minH}, ${maxH}, ${staticVal}, ${isDraggable}, ${isResizable}, ${isBounded}, ${resizeHandles}, ${moved}, CURRENT_TIMESTAMP)
          `);
        }
      }
    }

    res.json({ success: true, message: 'Layouts saved successfully' });
  } catch (err) {
    console.error('Error saving layouts:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// CHART VISIBILITY ENDPOINTS
// ============================================

/**
 * Get all chart visibility mappings
 * GET /api/chart-visibility
 */
app.get('/api/chart-visibility', async (req, res) => {
  try {
    const visibility = await dbClient.query('SELECT * FROM chart_visibility');
    const result = {};
    if (visibility && Array.isArray(visibility)) {
      visibility.forEach(row => {
        result[row.chart_id] = row.variable_name || '';
      });
    }
    res.json({ success: true, visibility: result });
  } catch (err) {
    console.error('Error fetching chart visibility:', err.message || err);
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
});

/**
 * Save chart visibility mappings
 * POST /api/chart-visibility
 */
app.post('/api/chart-visibility', async (req, res) => {
  try {
    const { visibility } = req.body;
    if (!visibility || typeof visibility !== 'object') {
      return res.status(400).json({ success: false, error: 'visibility object is required' });
    }

    // Delete all existing visibility mappings
    await dbClient.run('DELETE FROM chart_visibility');

    // Insert new mappings
    for (const [chartId, variableName] of Object.entries(visibility)) {
      if (variableName) {
        const escapedChartId = chartId.replace(/'/g, "''");
        const escapedVariableName = variableName.replace(/'/g, "''");
        await dbClient.run(`
          INSERT INTO chart_visibility (chart_id, variable_name, last_modified)
          VALUES ('${escapedChartId}', '${escapedVariableName}', CURRENT_TIMESTAMP)
        `);
      }
    }

    res.json({ success: true, message: 'Chart visibility saved successfully' });
  } catch (err) {
    console.error('Error saving chart visibility:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update a single chart visibility
 * PUT /api/chart-visibility/:chartId
 */
app.put('/api/chart-visibility/:chartId', async (req, res) => {
  try {
    const { chartId } = req.params;
    const { variableName } = req.body;

    const existing = await dbClient.query(`SELECT id FROM chart_visibility WHERE chart_id='${chartId.replace(/'/g, "''")}'`);
    
    const escapedChartId = chartId.replace(/'/g, "''");
    if (existing.length > 0) {
      if (variableName) {
        const escapedVariableName = variableName.replace(/'/g, "''");
        await dbClient.run(`
          UPDATE chart_visibility 
          SET variable_name='${escapedVariableName}', last_modified=CURRENT_TIMESTAMP
          WHERE chart_id='${escapedChartId}'
        `);
      } else {
        await dbClient.run(`DELETE FROM chart_visibility WHERE chart_id='${escapedChartId}'`);
      }
    } else if (variableName) {
      const escapedVariableName = variableName.replace(/'/g, "''");
      await dbClient.run(`
        INSERT INTO chart_visibility (chart_id, variable_name, last_modified)
        VALUES ('${escapedChartId}', '${escapedVariableName}', CURRENT_TIMESTAMP)
      `);
    }

    res.json({ success: true, message: 'Chart visibility updated successfully' });
  } catch (err) {
    console.error('Error updating chart visibility:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// FILTER PANEL STATE ENDPOINTS
// ============================================

/**
 * Get filter panel state (positions and active filters)
 * GET /api/filter-panel-state
 */
app.get('/api/filter-panel-state', async (req, res) => {
  try {
    const states = await dbClient.query('SELECT * FROM filter_panel_state WHERE is_active = true ORDER BY COALESCE(display_order, 0), last_modified DESC');
    const positions = {};
    const activeFilterIds = [];
    
    if (states && Array.isArray(states)) {
      states.forEach((row, index) => {
        positions[row.filter_id] = {
          x: row.x_position,
          y: row.y_position,
        };
        activeFilterIds.push(row.filter_id);
      });
    }
    
    res.json({ 
      success: true, 
      positions,
      activeFilterIds 
    });
  } catch (err) {
    console.error('Error fetching filter panel state:', err.message || err);
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
});

/**
 * Save filter panel state (positions and active filters)
 * POST /api/filter-panel-state
 */
// Debounce/lock mechanism for filter panel state saves
let filterPanelSaveInProgress = false;
let pendingFilterPanelSave = null;

async function saveFilterPanelStateToDb(positions, activeFilterIds) {
  // Mark all existing filters as inactive first
  try {
    await dbClient.run('UPDATE filter_panel_state SET is_active = false');
  } catch (err) {
    // Ignore if no rows exist
    console.log('Note: Could not update existing filters (may not exist yet)');
  }

  // Process each filter - use DELETE + INSERT pattern for reliability
  for (let i = 0; i < activeFilterIds.length; i++) {
    const filterId = activeFilterIds[i];
    const position = positions[filterId] || { x: 6, y: 6 + (i * 80) };
    const escapedFilterId = filterId.replace(/'/g, "''");
    
    try {
      // First try to delete if exists
      await dbClient.run(`DELETE FROM filter_panel_state WHERE filter_id = '${escapedFilterId}'`);
    } catch (delErr) {
      // Ignore delete errors
    }
    
    // Then insert
    try {
      await dbClient.run(`
        INSERT INTO filter_panel_state (filter_id, x_position, y_position, is_active, display_order, last_modified)
        VALUES ('${escapedFilterId}', ${Math.round(position.x)}, ${Math.round(position.y)}, true, ${i}, CURRENT_TIMESTAMP)
      `);
    } catch (insertErr) {
      console.warn(`Warning: Could not save filter state for ${filterId}:`, insertErr.message);
    }
  }
}

app.post('/api/filter-panel-state', async (req, res) => {
  try {
    const { positions, activeFilterIds } = req.body;
    if (!positions || !activeFilterIds || !Array.isArray(activeFilterIds)) {
      return res.status(400).json({ success: false, error: 'positions object and activeFilterIds array are required' });
    }

    // If a save is in progress, queue this one and respond immediately
    if (filterPanelSaveInProgress) {
      pendingFilterPanelSave = { positions, activeFilterIds };
      return res.json({ success: true, message: 'Filter panel state queued for save' });
    }

    filterPanelSaveInProgress = true;

    try {
      await saveFilterPanelStateToDb(positions, activeFilterIds);
      res.json({ success: true, message: 'Filter panel state saved successfully' });
    } finally {
      filterPanelSaveInProgress = false;

      // Process any pending save
      if (pendingFilterPanelSave) {
        const pending = pendingFilterPanelSave;
        pendingFilterPanelSave = null;
        // Process asynchronously
        setImmediate(async () => {
          try {
            await saveFilterPanelStateToDb(pending.positions, pending.activeFilterIds);
            console.log('✅ Pending filter panel state saved');
          } catch (err) {
            console.error('Error processing pending filter panel save:', err.message);
          }
        });
      }
    }
  } catch (err) {
    console.error('Error saving filter panel state:', err.message);
    // Return success anyway to prevent frontend errors - data will be re-saved on next attempt
    res.json({ success: true, message: 'Filter panel state save attempted', warning: err.message });
  }
});

/**
 * Update a single filter position
 * PUT /api/filter-panel-state/:filterId/position
 */
app.put('/api/filter-panel-state/:filterId/position', async (req, res) => {
  try {
    const { filterId } = req.params;
    const { x, y } = req.body;
    
    if (x === undefined || y === undefined) {
      return res.status(400).json({ success: false, error: 'x and y positions are required' });
    }

    const escapedFilterId = filterId.replace(/'/g, "''");
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);

    try {
      const existing = await dbClient.query(`SELECT id FROM filter_panel_state WHERE filter_id='${escapedFilterId}'`);
      
      if (existing && existing.length > 0) {
        await dbClient.run(`
          UPDATE filter_panel_state 
          SET x_position=${roundedX}, y_position=${roundedY}, last_modified=CURRENT_TIMESTAMP
          WHERE filter_id='${escapedFilterId}'
        `);
      } else {
        // Delete first (in case of partial state) then insert
        try {
          await dbClient.run(`DELETE FROM filter_panel_state WHERE filter_id='${escapedFilterId}'`);
        } catch (delErr) {
          // Ignore
        }
        await dbClient.run(`
          INSERT INTO filter_panel_state (filter_id, x_position, y_position, is_active, display_order, last_modified)
          VALUES ('${escapedFilterId}', ${roundedX}, ${roundedY}, true, 0, CURRENT_TIMESTAMP)
        `);
      }
    } catch (dbErr) {
      console.warn('Filter position update warning:', dbErr.message);
      // Try simple insert as fallback
      try {
        await dbClient.run(`DELETE FROM filter_panel_state WHERE filter_id='${escapedFilterId}'`);
        await dbClient.run(`
          INSERT INTO filter_panel_state (filter_id, x_position, y_position, is_active, display_order, last_modified)
          VALUES ('${escapedFilterId}', ${roundedX}, ${roundedY}, true, 0, CURRENT_TIMESTAMP)
        `);
      } catch (fallbackErr) {
        console.warn('Fallback insert also failed:', fallbackErr.message);
      }
    }

    res.json({ success: true, message: 'Filter position updated successfully' });
  } catch (err) {
    console.error('Error updating filter position:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// CARD FILTER PANEL STATE ENDPOINTS (per card)
// ============================================

async function saveCardFilterPanelStateToDb(cardId, positions, activeFilterIds) {
  const escapedCardId = cardId.replace(/'/g, "''");

  // Deduplicate incoming ids to avoid unique constraint issues
  const uniqueActiveIds = Array.from(new Set(activeFilterIds || []));

  try {
    await dbClient.run(
      `UPDATE card_filter_panel_state SET is_active = false WHERE card_id='${escapedCardId}'`
    );
  } catch (err) {
    console.log('Note: Could not update existing card filters (may not exist yet)');
  }

  for (let i = 0; i < uniqueActiveIds.length; i++) {
    const filterId = uniqueActiveIds[i];
    const rawPos = positions[filterId];
    const hasPosition = rawPos && typeof rawPos.x === 'number' && typeof rawPos.y === 'number';
    // If no position, store sentinel (-1) so client can render in flex mode without stacking
    const position = hasPosition ? { x: Math.round(rawPos.x), y: Math.round(rawPos.y) } : { x: -1, y: -1 };
    const escapedFilterId = filterId.replace(/'/g, "''");

    try {
      await dbClient.run(`
        INSERT INTO card_filter_panel_state (card_id, filter_id, x_position, y_position, is_active, display_order, last_modified)
        VALUES ('${escapedCardId}', '${escapedFilterId}', ${position.x}, ${position.y}, true, ${i}, CURRENT_TIMESTAMP)
        ON CONFLICT (card_id, filter_id)
        DO UPDATE SET 
          x_position = EXCLUDED.x_position,
          y_position = EXCLUDED.y_position,
          is_active = EXCLUDED.is_active,
          display_order = EXCLUDED.display_order,
          last_modified = EXCLUDED.last_modified
      `);
    } catch (insertErr) {
      console.warn(`Warning: Could not save card filter state for card ${cardId} filter ${filterId}:`, insertErr.message);
    }
  }
}

app.get('/api/cards/:cardId/filter-panel-state', async (req, res) => {
  try {
    const { cardId } = req.params;
    const escapedCardId = cardId.replace(/'/g, "''");
    const states = await dbClient.query(
      `SELECT * FROM card_filter_panel_state WHERE card_id='${escapedCardId}' AND is_active = true ORDER BY COALESCE(display_order, 0), last_modified DESC`
    );

    const positions = {};
    const activeFilterIds = [];

    if (states && Array.isArray(states)) {
      states.forEach((row) => {
        positions[row.filter_id] = {
          x: row.x_position,
          y: row.y_position,
        };
        activeFilterIds.push(row.filter_id);
      });
    }

    res.json({
      success: true,
      positions,
      activeFilterIds,
    });
  } catch (err) {
    console.error('Error fetching card filter panel state:', err.message || err);
    res.status(500).json({ success: false, error: err.message || 'Unknown error' });
  }
});

app.post('/api/cards/:cardId/filter-panel-state', async (req, res) => {
  try {
    const { cardId } = req.params;
    const { positions, activeFilterIds } = req.body;
    if (!cardId) {
      return res.status(400).json({ success: false, error: 'cardId is required' });
    }
    if (!positions || !activeFilterIds || !Array.isArray(activeFilterIds)) {
      return res.status(400).json({ success: false, error: 'positions object and activeFilterIds array are required' });
    }

    await saveCardFilterPanelStateToDb(cardId, positions, activeFilterIds);
    res.json({ success: true, message: 'Card filter panel state saved successfully' });
  } catch (err) {
    console.error('Error saving card filter panel state:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// CARD DIMENSION CONDITIONS ENDPOINTS
// ============================================

/**
 * Get all card dimension conditions
 * GET /api/card-dimension-conditions
 */
app.get('/api/card-dimension-conditions', async (req, res) => {
  try {
    const conditions = await dbClient.query('SELECT * FROM card_dimension_conditions ORDER BY chart_id, priority');
    const result = {};
    conditions.forEach(row => {
      if (!result[row.chart_id]) {
        result[row.chart_id] = [];
      }
      result[row.chart_id].push({
        id: row.condition_id,
        variableName: row.variable_name,
        expectedValue: row.expected_value,
        width: row.width,
        height: row.height,
        priority: row.priority,
      });
    });
    res.json({ success: true, conditions: result });
  } catch (err) {
    console.error('Error fetching card dimension conditions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Save card dimension conditions for a chart
 * POST /api/card-dimension-conditions
 */
app.post('/api/card-dimension-conditions', async (req, res) => {
  try {
    const { chartId, conditions } = req.body;
    if (!chartId) {
      return res.status(400).json({ success: false, error: 'chartId is required' });
    }

    // Delete existing conditions for this chart
    await dbClient.run(`DELETE FROM card_dimension_conditions WHERE chart_id='${chartId.replace(/'/g, "''")}'`);

    // Insert new conditions
    if (conditions && Array.isArray(conditions)) {
      for (const condition of conditions) {
        const escapedChartId = chartId.replace(/'/g, "''");
        const escapedConditionId = condition.id.replace(/'/g, "''");
        const escapedVariableName = condition.variableName.replace(/'/g, "''");
        await dbClient.run(`
          INSERT INTO card_dimension_conditions (
            chart_id, condition_id, variable_name, expected_value, width, height, priority, last_modified
          ) VALUES ('${escapedChartId}', '${escapedConditionId}', '${escapedVariableName}', ${condition.expectedValue ? 'true' : 'false'}, ${condition.width}, ${condition.height}, ${condition.priority}, CURRENT_TIMESTAMP)
        `);
      }
    }

    res.json({ success: true, message: 'Card dimension conditions saved successfully' });
  } catch (err) {
    console.error('Error saving card dimension conditions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/table/:tableName', async (req, res) => {
  const { tableName } = req.params;
  try {
    // Sanitize table name to prevent SQL injection
    const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
    const result = await dbClient.query(`SELECT * FROM ${safeTableName}`);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('Error fetching table data:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// EXTRACT SCHEDULER API ENDPOINTS
// ============================================

/**
 * Set refresh interval for a data source
 * PUT /api/data-sources/:dsName/schedule
 */
app.put('/api/data-sources/:dsName/schedule', async (req, res) => {
  const { dsName } = req.params;
  const { refresh_interval_days } = req.body;
  
  if (refresh_interval_days !== null && refresh_interval_days !== undefined && (typeof refresh_interval_days !== 'number' || refresh_interval_days < 1)) {
    return res.status(400).json({ success: false, error: 'refresh_interval_days must be a positive number or null' });
  }
  
  try {
    const updateQuery = refresh_interval_days === null || refresh_interval_days === undefined
      ? `UPDATE data_source_registry SET refresh_interval_days=NULL WHERE ds_name='${dsName.replace(/'/g, "''")}'`
      : `UPDATE data_source_registry SET refresh_interval_days=${refresh_interval_days} WHERE ds_name='${dsName.replace(/'/g, "''")}'`;
    
    await dbClient.run(updateQuery);
    
    console.log(`✅ Updated refresh schedule for ${dsName}: ${refresh_interval_days || 'disabled'} days`);
    res.json({ 
      success: true, 
      message: `Refresh schedule updated for ${dsName}`,
      refresh_interval_days: refresh_interval_days || null
    });
  } catch (err) {
    console.error('❌ Error updating schedule:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get refresh schedule for a data source
 * GET /api/data-sources/:dsName/schedule
 */
app.get('/api/data-sources/:dsName/schedule', async (req, res) => {
  const { dsName } = req.params;
  
  try {
    const result = await dbClient.query(`
      SELECT refresh_interval_days, last_refreshed 
      FROM data_source_registry 
      WHERE ds_name='${dsName.replace(/'/g, "''")}'
    `);
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Data source not found' });
    }
    
    res.json({
      success: true,
      refresh_interval_days: result[0].refresh_interval_days,
      last_refreshed: result[0].last_refreshed
    });
  } catch (err) {
    console.error('❌ Error fetching schedule:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// EXTRACT SCHEDULER FUNCTION
// ============================================

function startExtractScheduler() {
  console.log('⏰ Extract scheduler started (checking every hour)');
  
  const checkAndRefresh = async () => {
    try {
      // Query extracts needing refresh
      const extracts = await dbClient.query(`
        SELECT ds_name, refresh_interval_days, last_refreshed, parquet_path, connection_id, type, query
        FROM data_source_registry 
        WHERE type='Extract' 
        AND refresh_interval_days IS NOT NULL
      `);
      
      const now = new Date();
      const extractsToRefresh = [];
      
      for (const extract of extracts) {
        if (!extract.last_refreshed) {
          // Never refreshed, needs refresh
          extractsToRefresh.push(extract);
        } else {
          const lastRefreshed = new Date(extract.last_refreshed);
          const daysSinceRefresh = (now - lastRefreshed) / (1000 * 60 * 60 * 24);
          
          if (daysSinceRefresh >= extract.refresh_interval_days) {
            extractsToRefresh.push(extract);
          }
        }
      }
      
      if (extractsToRefresh.length > 0) {
        console.log(`🔄 Found ${extractsToRefresh.length} extract(s) needing refresh`);
        
        for (const extract of extractsToRefresh) {
          try {
            console.log(`🔄 Cleaning up tables/views for extract: ${extract.ds_name}`);
            
            // Delete base table
            const tableName = `ds_${extract.ds_name}`;
            try {
              await dbClient.run(`DROP TABLE IF EXISTS ${tableName}`);
              console.log(`✅ Deleted base table: ${tableName}`);
            } catch (err) {
              console.warn(`⚠️ Could not delete base table:`, err.message);
            }
            
            // Delete all materialized views
            await deleteMaterializedViews(extract.ds_name, dbClient);
            
            // Clear cache for this data source
            clearCacheForDataSource(extract.ds_name);
            
            console.log(`⚠️ Extract ${extract.ds_name} needs manual refresh. Base table and materialized views have been deleted.`);
            console.log(`   Please recreate the extract via the UI to refresh the data.`);
          } catch (err) {
            console.error(`❌ Error cleaning up extract ${extract.ds_name}:`, err.message);
          }
        }
      }
    } catch (err) {
      console.error('❌ Error in extract scheduler:', err.message);
    }
  };
  
  // Run immediately on startup, then every hour
  checkAndRefresh();
  setInterval(checkAndRefresh, 60 * 60 * 1000); // Every hour
}

// ============================================
// EXTRACT SCHEDULER API ENDPOINTS
// ============================================

/**
 * Set refresh interval for a data source
 * PUT /api/data-sources/:dsName/schedule
 */
app.put('/api/data-sources/:dsName/schedule', async (req, res) => {
  const { dsName } = req.params;
  const { refresh_interval_days } = req.body;
  
  if (refresh_interval_days !== null && refresh_interval_days !== undefined && (typeof refresh_interval_days !== 'number' || refresh_interval_days < 1)) {
    return res.status(400).json({ success: false, error: 'refresh_interval_days must be a positive number or null' });
  }
  
  try {
    const updateQuery = refresh_interval_days === null || refresh_interval_days === undefined
      ? `UPDATE data_source_registry SET refresh_interval_days=NULL WHERE ds_name='${dsName.replace(/'/g, "''")}'`
      : `UPDATE data_source_registry SET refresh_interval_days=${refresh_interval_days} WHERE ds_name='${dsName.replace(/'/g, "''")}'`;
    
    await dbClient.run(updateQuery);
    
    console.log(`✅ Updated refresh schedule for ${dsName}: ${refresh_interval_days || 'disabled'} days`);
    res.json({ 
      success: true, 
      message: `Refresh schedule updated for ${dsName}`,
      refresh_interval_days: refresh_interval_days || null
    });
  } catch (err) {
    console.error('❌ Error updating schedule:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get refresh schedule for a data source
 * GET /api/data-sources/:dsName/schedule
 */
app.get('/api/data-sources/:dsName/schedule', async (req, res) => {
  const { dsName } = req.params;
  
  try {
    const result = await dbClient.query(`
      SELECT refresh_interval_days, last_refreshed 
      FROM data_source_registry 
      WHERE ds_name='${dsName.replace(/'/g, "''")}'
    `);
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Data source not found' });
    }
    
    res.json({
      success: true,
      refresh_interval_days: result[0].refresh_interval_days,
      last_refreshed: result[0].last_refreshed
    });
  } catch (err) {
    console.error('❌ Error fetching schedule:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

(async () => {
  try {
    await dbClient.query('SELECT 1');
    console.log('✅ DuckDB is connected');

     // Initialize new tables
     const { 
      createSnowFlakeConnnection,
      createDataSourceRegistry,
      createChartConfigsTable, 
      createLayoutsTable, 
      createChartVisibilityTable, 
      createCardDimensionConditionsTable,
      createFilterPanelStateTable,
      createCardFilterPanelStateTable,
      createParametersTable,
      createCalculationsTable,
      createFiltersTable,
      createTooltipConfigsTable,
      migrateChartConfigsTable,
      createChildCardConfigsTable,
      createChildCardTooltipConfigsTable
    } = await import('./db/initDb.js');
    
    // Create essential tables first (parameters, calculations, filters)
    await createParametersTable();
    await createCalculationsTable();
    await createFiltersTable();
    await createSnowFlakeConnnection();
    await createDataSourceRegistry();
    
    // Create UI-related tables
    await createChartConfigsTable();
    await migrateChartConfigsTable(); // Run migrations for new columns
    await createLayoutsTable();
    await createChartVisibilityTable();
    await createCardDimensionConditionsTable();
    await createFilterPanelStateTable();
    await createCardFilterPanelStateTable();
    await createTooltipConfigsTable();
    await createChildCardConfigsTable();
    await createChildCardTooltipConfigsTable();
    
    // Import materialized views table creation
    const { createMaterializedViewsTable } = await import('./db/initDb.js');
    await createMaterializedViewsTable();

    // Start extract scheduler
    startExtractScheduler();
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Server is running at http://localhost:${PORT}`);
    });
    
    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      
      // Stop accepting new connections
      server.close(() => {
        console.log('✅ HTTP server closed');
      });
      
      // Close DuckDB connection
      try {
        await dbClient.close();
      } catch (err) {
        console.warn('⚠️ Error closing DuckDB:', err.message);
      }
      
      // Give processes time to finish
      setTimeout(() => {
        console.log('✅ Graceful shutdown complete');
        process.exit(0);
      }, 2000);
    };
    
    // Handle shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', async (err) => {
      console.error('❌ Uncaught Exception:', err);
      try {
        await dbClient.close();
      } catch (closeErr) {
        // Ignore
      }
      process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      try {
        await dbClient.close();
      } catch (closeErr) {
        // Ignore
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('❌ Failed to connect to DuckDB:', err.message);
  }
}
)();