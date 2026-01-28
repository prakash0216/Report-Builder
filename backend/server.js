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
 * Supports optional dashboardId query param for dashboard-scoped filtering
 */
app.get('/api/parameters/names', async (req, res) => {
  try {
    const { dashboardId } = req.query;
    
    let query = 'SELECT name FROM parameters';
    if (dashboardId) {
      query += ` WHERE dashboard_id = ${parseInt(dashboardId)}`;
    }
    query += ' ORDER BY created_at DESC';
    
    const result = await dbClient.query(query);
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
 * Supports optional dashboardId in body for dashboard-scoped parameters
 */
app.post('/api/parameters/:name', async (req, res) => {
  const { name } = req.params;
  const { value, dashboardId } = req.body;
  
  if (value === undefined) {
    return res.status(400).json({ success: false, error: 'Value is required' });
  }

  try {
    // Check if parameter exists (scoped by dashboardId if provided)
    let existingQuery = `SELECT id FROM parameters WHERE name='${name}'`;
    if (dashboardId) {
      existingQuery += ` AND dashboard_id=${parseInt(dashboardId)}`;
    }
    const existing = await dbClient.query(existingQuery);
    
    if (existing.length > 0) {
      // Update existing parameter
      const updateQuery = `UPDATE parameters SET value='${String(value).replace(/'/g, "''")}', last_modified=CURRENT_TIMESTAMP WHERE name='${name}'${dashboardId ? ` AND dashboard_id=${parseInt(dashboardId)}` : ''}`;
      await dbClient.run(updateQuery);
      console.log(`✅ Updated parameter: ${name} (dashboardId: ${dashboardId || 'global'})`);
    } else {
      // Insert new parameter with dashboard_id
      const insertQuery = `INSERT INTO parameters (name, value, dashboard_id, created_at, last_modified) VALUES ('${name}', '${String(value).replace(/'/g, "''")}', ${dashboardId ? parseInt(dashboardId) : 'NULL'}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
      await dbClient.run(insertQuery);
      console.log(`✅ Created parameter: ${name} (dashboardId: ${dashboardId || 'global'})`);
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
 * Supports optional dashboardId query param for dashboard-scoped filtering
 */
app.get('/api/calculations', async (req, res) => {
  try {
    const { dashboardId } = req.query;
    
    let query = 'SELECT * FROM calculations';
    if (dashboardId) {
      query += ` WHERE dashboard_id = ${parseInt(dashboardId)}`;
    }
    query += ' ORDER BY execution_order ASC, created_at ASC';
    
    const result = await dbClient.query(query);
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
 * Supports optional dashboardId in body for dashboard-scoped calculations
 */
app.post('/api/calculations', async (req, res) => {
  const { variableName, logic, dashboardId } = req.body;
  
  if (!variableName || !logic) {
    return res.status(400).json({ success: false, error: 'variableName and logic are required' });
  }

  try {
    // Check if variable name already exists (scoped by dashboardId if provided)
    let existingQuery = `SELECT id FROM calculations WHERE variable_name='${variableName.replace(/'/g, "''")}'`;
    if (dashboardId) {
      existingQuery += ` AND dashboard_id=${parseInt(dashboardId)}`;
    }
    const existing = await dbClient.query(existingQuery);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, error: 'Calculation with this variable name already exists' });
    }

    const insertQuery = `INSERT INTO calculations (variable_name, logic, dashboard_id, created_at) 
      VALUES ('${variableName.replace(/'/g, "''")}', '${logic.replace(/'/g, "''")}', ${dashboardId ? parseInt(dashboardId) : 'NULL'}, CURRENT_TIMESTAMP)`;
    await dbClient.run(insertQuery);
    console.log(`✅ Calculation added: ${variableName} (dashboardId: ${dashboardId || 'global'})`);
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
// PREDEFINED FUNCTIONS ENDPOINTS
// ============================================

/**
 * Get all predefined functions
 * GET /api/predefined-functions
 * Supports optional dashboardId query param for dashboard-scoped filtering
 * If global=true, returns only global functions (dashboard_id IS NULL)
 */
app.get('/api/predefined-functions', async (req, res) => {
  try {
    const { dashboardId, global: isGlobal } = req.query;
    
    let query = 'SELECT * FROM predefined_functions';
    if (isGlobal === 'true') {
      query += ' WHERE dashboard_id IS NULL';
    } else if (dashboardId) {
      // Return both global and dashboard-specific functions
      query += ` WHERE dashboard_id IS NULL OR dashboard_id = ${parseInt(dashboardId)}`;
    }
    query += ' ORDER BY category ASC, name ASC';
    
    const result = await dbClient.query(query);
    
    // Parse JSON fields
    const functions = result.map(row => ({
      id: row.function_id,
      dbId: row.id,
      name: row.name,
      description: row.description || '',
      parameters: row.parameters_json ? JSON.parse(row.parameters_json) : [],
      body: row.body,
      returnType: row.return_type || 'any',
      category: row.category || 'Custom',
      example: row.example || '',
      isEnabled: row.is_enabled !== false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    res.json({ success: true, functions });
  } catch (err) {
    console.error('❌ Error fetching predefined functions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get predefined functions for a specific dashboard
 * GET /api/dashboards/:dashboardId/predefined-functions
 */
app.get('/api/dashboards/:dashboardId/predefined-functions', async (req, res) => {
  const { dashboardId } = req.params;
  
  try {
    // Resolve dashboard ID if it's a slug
    const isNumeric = /^\d+$/.test(dashboardId);
    let actualDashboardId = dashboardId;
    
    if (!isNumeric) {
      const dashboardResult = await dbClient.query(
        `SELECT id FROM dashboards WHERE slug = '${dashboardId.replace(/'/g, "''")}'`
      );
      if (dashboardResult.length === 0) {
        return res.status(404).json({ success: false, error: 'Dashboard not found' });
      }
      actualDashboardId = dashboardResult[0].id;
    }
    
    const query = `SELECT * FROM predefined_functions WHERE dashboard_id = ${actualDashboardId} ORDER BY category ASC, name ASC`;
    const result = await dbClient.query(query);
    
    // Parse JSON fields
    const functions = result.map(row => ({
      id: row.function_id,
      dbId: row.id,
      name: row.name,
      description: row.description || '',
      parameters: row.parameters_json ? JSON.parse(row.parameters_json) : [],
      body: row.body,
      returnType: row.return_type || 'any',
      category: row.category || 'Custom',
      example: row.example || '',
      isEnabled: row.is_enabled !== false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    res.json({ success: true, functions });
  } catch (err) {
    console.error('❌ Error fetching predefined functions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Add new predefined function
 * POST /api/predefined-functions
 */
app.post('/api/predefined-functions', async (req, res) => {
  const { id, name, description, parameters, body, returnType, category, isEnabled, dashboardId } = req.body;
  
  if (!name || !body) {
    return res.status(400).json({ success: false, error: 'name and body are required' });
  }
  
  // Validate function name (must be valid JS identifier)
  const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  if (!validIdentifier.test(name)) {
    return res.status(400).json({ success: false, error: 'Invalid function name. Must be a valid JavaScript identifier.' });
  }

  try {
    const functionId = id || `func-${Date.now()}`;
    const escapedName = name.replace(/'/g, "''");
    const escapedDescription = (description || '').replace(/'/g, "''");
    const escapedBody = body.replace(/'/g, "''");
    const escapedReturnType = (returnType || 'any').replace(/'/g, "''");
    const escapedCategory = (category || 'Custom').replace(/'/g, "''");
    const parametersJson = JSON.stringify(parameters || []).replace(/'/g, "''");
    const enabled = isEnabled !== false ? 'true' : 'false';
    
    // Check if function name already exists for this dashboard
    let existingQuery = `SELECT id FROM predefined_functions WHERE name='${escapedName}'`;
    if (dashboardId) {
      existingQuery += ` AND dashboard_id=${parseInt(dashboardId)}`;
    }
    const existing = await dbClient.query(existingQuery);
    
    if (existing.length > 0) {
      // Update existing function
      const updateQuery = `UPDATE predefined_functions SET
        description='${escapedDescription}',
        parameters_json='${parametersJson}',
        body='${escapedBody}',
        return_type='${escapedReturnType}',
        category='${escapedCategory}',
        is_enabled=${enabled},
        updated_at=CURRENT_TIMESTAMP
        WHERE name='${escapedName}'${dashboardId ? ` AND dashboard_id=${parseInt(dashboardId)}` : ''}`;
      await dbClient.run(updateQuery);
      console.log(`✅ Predefined function updated: ${name}`);
      res.json({ success: true, message: 'Function updated successfully', id: functionId });
    } else {
      // Insert new function
      const insertQuery = `INSERT INTO predefined_functions 
        (function_id, dashboard_id, name, description, parameters_json, body, return_type, category, is_enabled, created_at, updated_at)
        VALUES 
        ('${functionId}', ${dashboardId ? parseInt(dashboardId) : 'NULL'}, '${escapedName}', '${escapedDescription}', 
         '${parametersJson}', '${escapedBody}', '${escapedReturnType}', '${escapedCategory}', ${enabled}, 
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
      await dbClient.run(insertQuery);
      console.log(`✅ Predefined function added: ${name} (dashboardId: ${dashboardId || 'global'})`);
      res.json({ success: true, message: 'Function added successfully', id: functionId });
    }
  } catch (err) {
    console.error('❌ Error adding predefined function:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Bulk save predefined functions
 * POST /api/predefined-functions/bulk
 * Used by frontend to save all functions at once
 * If global: true, saves as global functions (dashboard_id IS NULL)
 */
app.post('/api/predefined-functions/bulk', async (req, res) => {
  const { functions, dashboardId, viewId, global: isGlobal } = req.body;
  
  if (!Array.isArray(functions)) {
    return res.status(400).json({ success: false, error: 'functions array is required' });
  }

  try {
    let actualDashboardId = null;
    
    // If not global, resolve dashboard ID from viewId if needed
    if (!isGlobal) {
      actualDashboardId = dashboardId;
      if (!actualDashboardId && viewId) {
        const viewResult = await dbClient.query(`SELECT dashboard_id FROM views WHERE id = ${parseInt(viewId)}`);
        if (viewResult.length > 0) {
          actualDashboardId = viewResult[0].dashboard_id;
        }
      }
    }
    
    // Delete existing functions (global if isGlobal, otherwise dashboard-scoped)
    if (isGlobal) {
      await dbClient.run(`DELETE FROM predefined_functions WHERE dashboard_id IS NULL`);
    } else if (actualDashboardId) {
      await dbClient.run(`DELETE FROM predefined_functions WHERE dashboard_id = ${actualDashboardId}`);
    }
    
    // Insert all functions
    console.log(`📥 [Predefined Functions Bulk] Received ${functions.length} functions to save (isGlobal: ${isGlobal})`);
    let savedCount = 0;
    for (const fn of functions) {
      if (!fn.name || !fn.body) {
        console.log(`⏭️ [Predefined Functions] Skipping function without name or body:`, fn);
        continue;
      }
      
      const functionId = fn.id || `func-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const escapedName = fn.name.replace(/'/g, "''");
      const escapedDescription = (fn.description || '').replace(/'/g, "''");
      const escapedBody = fn.body.replace(/'/g, "''");
      const escapedReturnType = (fn.returnType || 'any').replace(/'/g, "''");
      const escapedCategory = (fn.category || 'Custom').replace(/'/g, "''");
      const escapedExample = (fn.example || '').replace(/'/g, "''");
      const parametersJson = JSON.stringify(fn.parameters || []).replace(/'/g, "''");
      const enabled = fn.isEnabled !== false ? 'true' : 'false';
      
      console.log(`💾 [Predefined Functions] Inserting: ${fn.name} (id: ${functionId})`);
      const insertQuery = `INSERT INTO predefined_functions 
        (function_id, dashboard_id, name, description, parameters_json, body, return_type, category, example, is_enabled, created_at, updated_at)
        VALUES 
        ('${functionId}', ${actualDashboardId ? parseInt(actualDashboardId) : 'NULL'}, '${escapedName}', '${escapedDescription}', 
         '${parametersJson}', '${escapedBody}', '${escapedReturnType}', '${escapedCategory}', '${escapedExample}', ${enabled}, 
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
      await dbClient.run(insertQuery);
      savedCount++;
    }
    
    console.log(`✅ Predefined functions bulk saved: ${savedCount}/${functions.length} functions (${isGlobal ? 'GLOBAL' : `dashboardId: ${actualDashboardId}`})`);
    res.json({ success: true, message: `${functions.length} functions saved successfully` });
  } catch (err) {
    console.error('❌ Error bulk saving predefined functions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update predefined function
 * PUT /api/predefined-functions/:id
 */
app.put('/api/predefined-functions/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, parameters, body, returnType, category, isEnabled } = req.body;
  
  if (!body) {
    return res.status(400).json({ success: false, error: 'body is required' });
  }

  try {
    // Check if function exists
    const existing = await dbClient.query(`SELECT id FROM predefined_functions WHERE function_id='${id.replace(/'/g, "''")}'`);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Function not found' });
    }

    const escapedName = name ? name.replace(/'/g, "''") : null;
    const escapedDescription = (description || '').replace(/'/g, "''");
    const escapedBody = body.replace(/'/g, "''");
    const escapedReturnType = (returnType || 'any').replace(/'/g, "''");
    const escapedCategory = (category || 'Custom').replace(/'/g, "''");
    const parametersJson = JSON.stringify(parameters || []).replace(/'/g, "''");
    const enabled = isEnabled !== false ? 'true' : 'false';

    let updateQuery = `UPDATE predefined_functions SET
      description='${escapedDescription}',
      parameters_json='${parametersJson}',
      body='${escapedBody}',
      return_type='${escapedReturnType}',
      category='${escapedCategory}',
      is_enabled=${enabled},
      updated_at=CURRENT_TIMESTAMP`;
    
    if (escapedName) {
      updateQuery += `, name='${escapedName}'`;
    }
    
    updateQuery += ` WHERE function_id='${id.replace(/'/g, "''")}'`;
    
    await dbClient.run(updateQuery);
    console.log(`✅ Predefined function updated: id=${id}`);
    res.json({ success: true, message: 'Function updated successfully' });
  } catch (err) {
    console.error('❌ Error updating predefined function:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete predefined function
 * DELETE /api/predefined-functions/:id
 */
app.delete('/api/predefined-functions/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Check if function exists
    const existing = await dbClient.query(`SELECT id FROM predefined_functions WHERE function_id='${id.replace(/'/g, "''")}'`);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Function not found' });
    }

    const deleteQuery = `DELETE FROM predefined_functions WHERE function_id='${id.replace(/'/g, "''")}'`;
    await dbClient.run(deleteQuery);
    console.log(`✅ Predefined function deleted: id=${id}`);
    res.json({ success: true, message: 'Function deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting predefined function:', err);
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
    const { dashboardId } = req.query;
    
    let query = 'SELECT * FROM filters';
    if (dashboardId) {
      query += ` WHERE dashboard_id = ${parseInt(dashboardId)}`;
    }
    query += ' ORDER BY last_modified DESC, id ASC';
    
    const result = await dbClient.query(query);
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
 * Supports optional dashboardId in body for dashboard-scoped filters
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
    defaultValues,
    dashboardId
  } = req.body;
  
  if (!variableName || !category || !paramName || !displayName || !selectionType || !availableOptions || !defaultValues) {
    return res.status(400).json({ 
      success: false, 
      error: 'variableName, category, paramName, displayName, selectionType, availableOptions, and defaultValues are required' 
    });
  }

  try {
    // Check if variable name already exists (scoped by dashboardId if provided)
    let existingQuery = `SELECT id FROM filters WHERE variable_name='${variableName.replace(/'/g, "''")}'`;
    if (dashboardId) {
      existingQuery += ` AND dashboard_id=${parseInt(dashboardId)}`;
    }
    const existing = await dbClient.query(existingQuery);
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
      dashboard_id,
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
      ${dashboardId ? parseInt(dashboardId) : 'NULL'},
      CURRENT_TIMESTAMP
    )`;
    
    await dbClient.run(insertQuery);
    console.log(`✅ Filter added: ${variableName} (dashboardId: ${dashboardId || 'global'})`);
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

app.post('/check-snowflake-connection', upload.single('privateKey'), async (req, res) => {
  const { account, username, authenticator, warehouse, database, schema } = req.body;
  const privateKeyFile = req.file;

  if (!account || !username || !authenticator || !privateKeyFile || !warehouse || !database || !schema) {
    return res.status(400).json({ 
      success: false, 
      message: 'All fields are required including the private key file' 
    });
  }

  console.log('Received connection test request:', { 
    account, 
    username, 
    authenticator, 
    warehouse, 
    database, 
    schema, 
    privateKeyFileName: privateKeyFile.originalname 
  });

  try {
    const privateKeyBuffer = privateKeyFile.buffer;
    const fileExtension = privateKeyFile.originalname.toLowerCase().split('.').pop();
    let privateKeyPem;

    // Handle different key formats
    try {
      if (fileExtension === 'pem' || fileExtension === 'key') {
        // PEM format - might already be in correct format
        const keyString = privateKeyBuffer.toString('utf8');
        if (keyString.includes('-----BEGIN')) {
          // Already in PEM format
          privateKeyPem = keyString;
        } else {
          // Try to convert from DER
          const privateKeyObject = crypto.createPrivateKey({
            key: privateKeyBuffer,
            format: 'der',
            type: 'pkcs8',
          });
          privateKeyPem = privateKeyObject.export({
            format: 'pem',
            type: 'pkcs8'
          });
        }
      } else if (fileExtension === 'der' || fileExtension === 'p8') {
        // DER format - convert to PEM
        const privateKeyObject = crypto.createPrivateKey({
          key: privateKeyBuffer,
          format: 'der',
          type: 'pkcs8',
        });
        privateKeyPem = privateKeyObject.export({
          format: 'pem',
          type: 'pkcs8'
        });
      } else {
        // Try auto-detection
        const keyString = privateKeyBuffer.toString('utf8');
        if (keyString.includes('-----BEGIN')) {
          privateKeyPem = keyString;
        } else {
          const privateKeyObject = crypto.createPrivateKey({
            key: privateKeyBuffer,
            format: 'der',
            type: 'pkcs8',
          });
          privateKeyPem = privateKeyObject.export({
            format: 'pem',
            type: 'pkcs8'
          });
        }
      }
    } catch (keyError) {
      console.error('❌ Error parsing private key:', keyError.message);
      return res.status(400).json({ 
        success: false, 
        message: `Invalid private key format: ${keyError.message}. Please ensure you're using a valid PKCS8 private key file.` 
      });
    }

    const connection = snowflake.createConnection({
      account: account,
      username: username,
      authenticator: authenticator,
      privateKey: privateKeyPem,
      warehouse: warehouse,
      database: database,
      schema: schema,
    });

    // Use Promise wrapper for better error handling
    await new Promise((resolve, reject) => {
      connection.connect((err, conn) => {
        if (err) {
          console.error('❌ Unable to connect to Snowflake:', err.message);
          reject(err);
        } else {
          console.log('✅ Successfully connected to Snowflake.');
          connection.destroy();
          resolve(conn);
        }
      });
    });

    return res.json({ success: true, message: 'Connection successful' });

  } catch (err) {
    console.error('❌ Error during Snowflake connection test:', err.message);
    
    // Provide user-friendly error messages
    let userMessage = err.message;
    if (err.message.includes('Incorrect username or password')) {
      userMessage = 'Authentication failed. Please check your username and private key.';
    } else if (err.message.includes('Account')) {
      userMessage = 'Invalid account identifier. Please verify your Snowflake account name.';
    } else if (err.message.includes('Warehouse')) {
      userMessage = 'Warehouse not found or access denied. Please check the warehouse name.';
    } else if (err.message.includes('Database')) {
      userMessage = 'Database not found or access denied. Please check the database name.';
    } else if (err.message.includes('Schema')) {
      userMessage = 'Schema not found or access denied. Please check the schema name.';
    } else if (err.message.includes('Network') || err.message.includes('ENOTFOUND')) {
      userMessage = 'Network error. Please check your internet connection and account identifier.';
    }
    
    return res.status(400).json({ 
      success: false, 
      message: userMessage,
      details: err.message 
    });
  }
});

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
  const { logic, existingVariables, existingParameters, variableName, existingFilters, dashboardId } = req.body;
  if (!logic || !variableName) {
    return res.status(400).json({ message: 'Missing logic or variableName' });
  }

  const allAvailableVariables = { ...existingVariables, ...existingParameters, ...existingFilters };

  try {
    // 🔥 Fetch predefined functions (global + dashboard-specific if provided)
    let predefinedFunctionsCode = '';
    try {
      // Load all global functions + dashboard-specific if dashboardId is provided
      let functionsQuery = 'SELECT * FROM predefined_functions WHERE is_enabled = true AND (dashboard_id IS NULL';
      if (dashboardId) {
        functionsQuery += ` OR dashboard_id = ${parseInt(dashboardId)}`;
      }
      functionsQuery += ')';
      const functions = await dbClient.query(functionsQuery);
      
      if (functions && functions.length > 0) {
        predefinedFunctionsCode = functions.map(fn => {
          const params = fn.parameters_json ? JSON.parse(fn.parameters_json) : [];
          const paramNames = params.map(p => p.name).join(', ');
          return `function ${fn.name}(${paramNames}) {\n${fn.body}\n}`;
        }).join('\n\n');
        console.log(`📦 [Calculate] Loaded ${functions.length} predefined functions (global + dashboard-specific)`);
      }
    } catch (fnErr) {
      console.warn('[Calculate] Could not load predefined functions:', fnErr.message);
      // Continue without predefined functions
    }

    // 🔥 Built-in utility functions (always available)
    const builtInFunctions = `
// Built-in: Format currency
function formatCurrency(value, symbol, decimals) {
  const sym = symbol || '$';
  const dec = decimals !== undefined ? decimals : 2;
  if (value === null || value === undefined || isNaN(value)) return sym + '0.00';
  const num = Number(value);
  const formatted = Math.abs(num).toFixed(dec).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  return num < 0 ? '-' + sym + formatted : sym + formatted;
}

// Built-in: Format percentage
function formatPercentage(value, decimals, multiply) {
  const dec = decimals !== undefined ? decimals : 1;
  const mult = multiply !== false;
  if (value === null || value === undefined || isNaN(value)) return '0%';
  const num = mult ? Number(value) * 100 : Number(value);
  return num.toFixed(dec) + '%';
}

// Built-in: Format number with commas
function formatNumber(value, decimals) {
  const dec = decimals !== undefined ? decimals : 0;
  if (value === null || value === undefined || isNaN(value)) return '0';
  const num = Number(value);
  return num.toFixed(dec).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
}

// Built-in: Calculate growth percentage
function calculateGrowth(current, previous) {
  if (previous === 0 || previous === null || previous === undefined) return 0;
  if (current === null || current === undefined) return 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// Built-in: Safe number conversion
function safeNumber(value, defaultValue) {
  const def = defaultValue !== undefined ? defaultValue : 0;
  if (value === null || value === undefined || value === '') return def;
  const num = Number(value);
  return isNaN(num) ? def : num;
}

// Built-in: Sum array values
function sumArray(arr, key) {
  if (!Array.isArray(arr)) return 0;
  if (key) {
    return arr.reduce((sum, item) => sum + (Number(item[key]) || 0), 0);
  }
  return arr.reduce((sum, val) => sum + (Number(val) || 0), 0);
}

// Built-in: Average array values
function avgArray(arr, key) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const sum = key 
    ? arr.reduce((s, item) => s + (Number(item[key]) || 0), 0)
    : arr.reduce((s, val) => s + (Number(val) || 0), 0);
  return sum / arr.length;
}

// Built-in: Filter array by key-value
function filterArray(arr, key, value) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(item => item[key] === value);
}

// Built-in: Group array by key
function groupBy(arr, key) {
  if (!Array.isArray(arr)) return {};
  return arr.reduce((groups, item) => {
    const groupKey = item[key];
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(item);
    return groups;
  }, {});
}

// Built-in: Truncate text
function truncateText(text, maxLength, suffix) {
  const max = maxLength || 50;
  const suf = suffix !== undefined ? suffix : '...';
  if (!text || typeof text !== 'string') return '';
  if (text.length <= max) return text;
  return text.substring(0, max - suf.length) + suf;
}

// Built-in: Format date
function formatDate(dateValue, format) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (isNaN(date.getTime())) return '';
  const fmt = format || 'short';
  if (fmt === 'iso') return date.toISOString().split('T')[0];
  if (fmt === 'long') return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  if (fmt === 'short') return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return date.toLocaleDateString();
}

// Built-in: Check if value is valid (not null/undefined/empty)
function isValidValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}
`;

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

    // 🔥 Combine: built-in functions + user predefined functions + variables + user logic
    const funcString = `(async function(dsConnect) {
      ${builtInFunctions}
      ${predefinedFunctionsCode}
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
 * Query params: viewId (optional) - filter by view
 */
app.get('/api/chart-configs', async (req, res) => {
  try {
    const { viewId } = req.query;
    
    console.log(`📥 [GET /api/chart-configs] viewId=${viewId}`);
    
    // Build query with optional view_id filter
    let query = 'SELECT * FROM chart_configs';
    if (viewId) {
      query += ` WHERE view_id = ${parseInt(viewId)}`;
    }
    query += ' ORDER BY COALESCE(last_modified, created_at) DESC, created_at DESC';
    
    console.log(`📥 [GET /api/chart-configs] Query: ${query}`);
    
    const configs = await dbClient.query(query);
    console.log(`📥 [GET /api/chart-configs] Found ${configs?.length || 0} configs`);
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
 * Body: { chartId, viewId, template, type, processed, htmlContent, tableDataSource, tableSettings }
 */
app.post('/api/chart-configs', async (req, res) => {
  try {
    const { chartId, viewId, template, type, processed, htmlContent, tableDataSource, tableSettings } = req.body;
    
    console.log(`📤 [POST /api/chart-configs] chartId="${chartId}", viewId=${viewId}, type="${type}"`);
    
    if (!chartId || !type) {
      return res.status(400).json({ success: false, error: 'chartId and type are required' });
    }

    const processedJson = processed ? JSON.stringify(processed) : null;
    const tableSettingsJson = tableSettings ? JSON.stringify(tableSettings) : null;
    
    // Check for existing config - if viewId provided, check within that view
    let existingQuery = `SELECT id, view_id FROM chart_configs WHERE chart_id='${chartId.replace(/'/g, "''")}'`;
    if (viewId) {
      existingQuery += ` AND view_id = ${parseInt(viewId)}`;
    }
    console.log(`📤 [POST /api/chart-configs] existingQuery: ${existingQuery}`);
    const existing = await dbClient.query(existingQuery);
    console.log(`📤 [POST /api/chart-configs] existing count: ${existing?.length || 0}`);
    
    const escapedChartId = chartId.replace(/'/g, "''");
    const escapedTemplate = (template || '').replace(/'/g, "''");
    const escapedHtmlContent = (htmlContent || '').replace(/'/g, "''");
    const escapedProcessedJson = (processedJson || '').replace(/'/g, "''");
    const escapedTableDataSource = (tableDataSource || '').replace(/'/g, "''");
    const escapedTableSettingsJson = (tableSettingsJson || '').replace(/'/g, "''");
    const viewIdValue = viewId ? parseInt(viewId) : 'NULL';
    
    if (existing.length > 0) {
      // Update
      await dbClient.run(`
        UPDATE chart_configs 
        SET template='${escapedTemplate}', type='${type}', processed_config_json='${escapedProcessedJson}', html_content='${escapedHtmlContent}', table_data_source='${escapedTableDataSource}', table_settings_json='${escapedTableSettingsJson}', view_id=${viewIdValue}, last_modified=CURRENT_TIMESTAMP
        WHERE chart_id='${escapedChartId}'${viewId ? ` AND view_id = ${parseInt(viewId)}` : ''}
      `);
    } else {
      // Insert
      await dbClient.run(`
        INSERT INTO chart_configs (chart_id, view_id, template, type, processed_config_json, html_content, table_data_source, table_settings_json, last_modified)
        VALUES ('${escapedChartId}', ${viewIdValue}, '${escapedTemplate}', '${type}', '${escapedProcessedJson}', '${escapedHtmlContent}', '${escapedTableDataSource}', '${escapedTableSettingsJson}', CURRENT_TIMESTAMP)
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
    const { viewId } = req.query;
    
    let query = 'SELECT * FROM tooltip_configs';
    if (viewId) {
      query += ` WHERE view_id = ${parseInt(viewId)}`;
    }
    query += ' ORDER BY COALESCE(last_modified, created_at) DESC';
    
    const configs = await dbClient.query(query);
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
    const { chartId, viewId, config } = req.body;
    if (!chartId || !config) {
      return res.status(400).json({ success: false, error: 'chartId and config are required' });
    }

    const viewIdValue = viewId ? parseInt(viewId) : null;
    const escapedChartId = chartId.replace(/'/g, "''");
    const escapedCardId = (config.cardId || '').replace(/'/g, "''");
    const escapedChartTemplate = (config.chartTemplate || '').replace(/'/g, "''");
    const escapedTableDataSource = (config.tableDataSource || '').replace(/'/g, "''");
    const escapedTableSettingsJson = config.tableSettings ? JSON.stringify(config.tableSettings).replace(/'/g, "''") : '';
    const escapedHtmlTemplate = (config.htmlTemplate || '').replace(/'/g, "''");
    const escapedDataMappingJson = config.dataMapping ? JSON.stringify(config.dataMapping).replace(/'/g, "''") : '[]';
    const escapedHeaderTitle = (config.headerTitle || 'Details').replace(/'/g, "''");

    // Check existing with viewId scope
    let existingQuery = `SELECT id FROM tooltip_configs WHERE chart_id='${escapedChartId}'`;
    if (viewIdValue) {
      existingQuery += ` AND view_id = ${viewIdValue}`;
    }
    const existing = await dbClient.query(existingQuery);
    
    if (existing.length > 0) {
      // Update existing
      let updateQuery = `
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
          view_id = ${viewIdValue || 'NULL'},
          last_modified = CURRENT_TIMESTAMP
        WHERE chart_id = '${escapedChartId}'`;
      if (viewIdValue) {
        updateQuery += ` AND view_id = ${viewIdValue}`;
      }
      await dbClient.run(updateQuery);
    } else {
      // Insert new
      await dbClient.run(`
        INSERT INTO tooltip_configs (
          chart_id, view_id, enabled, type, card_id, chart_template, table_data_source,
          table_settings_json, html_template, data_mapping_json, width, height,
          offset_x, offset_y, show_on_hover, hide_delay, show_header, header_title,
          created_at, last_modified
        ) VALUES (
          '${escapedChartId}',
          ${viewIdValue || 'NULL'},
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
 * Query params: viewId (optional) - filter by view
 */
app.get('/api/child-card-configs', async (req, res) => {
  try {
    const { viewId } = req.query;
    
    let query = 'SELECT * FROM child_card_configs';
    if (viewId) {
      query += ` WHERE view_id = ${parseInt(viewId)}`;
    }
    query += ' ORDER BY COALESCE(last_modified, created_at) DESC';
    
    const configs = await dbClient.query(query);
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
          cardMinHeight: row.card_min_height != null ? row.card_min_height : 800,
          gap: row.gap != null ? row.gap : 8,
          useDynamicHeight: row.use_dynamic_height === true,
          heightDataSource: row.height_data_source || '',
          showParentTitle: row.show_parent_title === true,
          parentTitleMode: row.parent_title_mode || 'simple',
          parentTitle: row.parent_title || '',
          parentTitleTemplate: row.parent_title_template || '',
          visibilityVariable: row.visibility_variable || '',
          arrangementVariable: row.arrangement_variable || '',
          childVisibilityMode: row.child_visibility_mode || 'all',
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
 * Body: { parentCardId, viewId (optional), config }
 */
app.post('/api/child-card-configs', async (req, res) => {
  try {
    const { parentCardId, viewId, config } = req.body;
    
    console.log(`[child-card-configs POST] Saving ${parentCardId} (viewId: ${viewId}):`, JSON.stringify({
      gap: config?.gap,
      cardMinHeight: config?.cardMinHeight,
      enableContainerScroll: config?.enableContainerScroll,
      useDynamicHeight: config?.useDynamicHeight,
    }));
    
    if (!parentCardId || !config) {
      return res.status(400).json({ success: false, error: 'parentCardId and config are required' });
    }

    const viewIdValue = viewId ? parseInt(viewId) : null;
    const escapedParentCardId = parentCardId.replace(/'/g, "''");
    const escapedContainerLayout = (config.containerLayout || 'grid').replace(/'/g, "''");
    const escapedChildCardsJson = config.childCards ? JSON.stringify(config.childCards).replace(/'/g, "''") : '[]';

    // Check for existing config - scoped to view if provided
    let existingQuery = `SELECT id FROM child_card_configs WHERE parent_card_id='${escapedParentCardId}'`;
    if (viewIdValue) {
      existingQuery += ` AND view_id = ${viewIdValue}`;
    }
    const existing = await dbClient.query(existingQuery);
    
    if (existing.length > 0) {
      // Update existing
      const escapedHeightDataSource = (config.heightDataSource || '').replace(/'/g, "''");
      const escapedParentTitle = (config.parentTitle || '').replace(/'/g, "''");
      const escapedParentTitleTemplate = (config.parentTitleTemplate || '').replace(/'/g, "''");
      const escapedVisibilityVariable = (config.visibilityVariable || '').replace(/'/g, "''");
      const escapedArrangementVariable = (config.arrangementVariable || '').replace(/'/g, "''");
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
          show_parent_title = ${config.showParentTitle === true ? 'true' : 'false'},
          parent_title_mode = '${(config.parentTitleMode || 'simple').replace(/'/g, "''")}',
          parent_title = '${escapedParentTitle}',
          parent_title_template = '${escapedParentTitleTemplate}',
          visibility_variable = '${escapedVisibilityVariable}',
          arrangement_variable = '${escapedArrangementVariable}',
          child_visibility_mode = '${(config.childVisibilityMode || 'all').replace(/'/g, "''")}',
          last_modified = CURRENT_TIMESTAMP
        WHERE parent_card_id = '${escapedParentCardId}'
      `);
    } else {
      // Insert new
      const escapedHeightDataSourceInsert = (config.heightDataSource || '').replace(/'/g, "''");
      const escapedParentTitleInsert = (config.parentTitle || '').replace(/'/g, "''");
      const escapedParentTitleTemplateInsert = (config.parentTitleTemplate || '').replace(/'/g, "''");
      const escapedVisibilityVariableInsert = (config.visibilityVariable || '').replace(/'/g, "''");
      const escapedArrangementVariableInsert = (config.arrangementVariable || '').replace(/'/g, "''");
      await dbClient.run(`
        INSERT INTO child_card_configs (
          view_id, parent_card_id, is_container, container_layout, child_cards_json,
          enable_container_scroll, card_min_height, gap, use_dynamic_height, height_data_source,
          show_parent_title, parent_title_mode, parent_title, parent_title_template,
          visibility_variable, arrangement_variable, child_visibility_mode,
          created_at, last_modified
        ) VALUES (
          ${viewIdValue || 'NULL'},
          '${escapedParentCardId}',
          ${config.isContainer ? 'true' : 'false'},
          '${escapedContainerLayout}',
          '${escapedChildCardsJson}',
          ${config.enableContainerScroll === true ? 'true' : 'false'},
          ${config.cardMinHeight != null ? config.cardMinHeight : 800},
          ${config.gap != null ? config.gap : 8},
          ${config.useDynamicHeight === true ? 'true' : 'false'},
          '${escapedHeightDataSourceInsert}',
          ${config.showParentTitle === true ? 'true' : 'false'},
          '${(config.parentTitleMode || 'simple').replace(/'/g, "''")}',
          '${escapedParentTitleInsert}',
          '${escapedParentTitleTemplateInsert}',
          '${escapedVisibilityVariableInsert}',
          '${escapedArrangementVariableInsert}',
          '${(config.childVisibilityMode || 'all').replace(/'/g, "''")}',
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
 * Query params: viewId (optional) - filter by view
 */
app.get('/api/layouts', async (req, res) => {
  try {
    const { viewId } = req.query;
    
    let query = 'SELECT * FROM layouts';
    if (viewId) {
      query += ` WHERE view_id = ${parseInt(viewId)}`;
    }
    query += ' ORDER BY breakpoint, y, x';
    
    const layouts = await dbClient.query(query);
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
 * Body: { layouts, viewId (optional) }
 */
app.post('/api/layouts', async (req, res) => {
  try {
    const { layouts, viewId } = req.body;
    if (!layouts || typeof layouts !== 'object') {
      return res.status(400).json({ success: false, error: 'layouts object is required' });
    }

    const viewIdValue = viewId ? parseInt(viewId) : null;

    // Delete existing layouts for breakpoints we're updating (scoped to view if provided)
    const breakpoints = ['lg', 'md', 'sm', 'xs', 'xxs'];
    const breakpointsToUpdate = breakpoints.filter(bp => layouts[bp] && Array.isArray(layouts[bp]) && layouts[bp].length > 0);
    
    if (breakpointsToUpdate.length > 0) {
      const breakpointList = breakpointsToUpdate.map(bp => `'${bp}'`).join(',');
      let deleteQuery = `DELETE FROM layouts WHERE breakpoint IN (${breakpointList})`;
      if (viewIdValue) {
        deleteQuery += ` AND view_id = ${viewIdValue}`;
      }
      await dbClient.run(deleteQuery);
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
              view_id, breakpoint, chart_id, x, y, w, h, min_w, max_w, min_h, max_h,
              static, is_draggable, is_resizable, is_bounded, resize_handles, moved, last_modified
            ) VALUES (${viewIdValue || 'NULL'}, '${breakpoint}', '${escapedChartId}', ${x}, ${y}, ${w}, ${h}, ${minW}, ${maxW}, ${minH}, ${maxH}, ${staticVal}, ${isDraggable}, ${isResizable}, ${isBounded}, ${resizeHandles}, ${moved}, CURRENT_TIMESTAMP)
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
    const { viewId } = req.query;
    
    let query = 'SELECT * FROM chart_visibility';
    if (viewId) {
      query += ` WHERE view_id = ${parseInt(viewId)}`;
    }
    
    const visibility = await dbClient.query(query);
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
    const { visibility, viewId } = req.body;
    if (!visibility || typeof visibility !== 'object') {
      return res.status(400).json({ success: false, error: 'visibility object is required' });
    }

    const viewIdValue = viewId ? parseInt(viewId) : null;
    
    // Delete existing visibility mappings for this view
    let deleteQuery = 'DELETE FROM chart_visibility';
    if (viewIdValue) {
      deleteQuery += ` WHERE view_id = ${viewIdValue}`;
    }
    await dbClient.run(deleteQuery);

    // Insert new mappings
    for (const [chartId, variableName] of Object.entries(visibility)) {
      if (variableName) {
        const escapedChartId = chartId.replace(/'/g, "''");
        const escapedVariableName = variableName.replace(/'/g, "''");
        await dbClient.run(`
          INSERT INTO chart_visibility (chart_id, view_id, variable_name, last_modified)
          VALUES ('${escapedChartId}', ${viewIdValue || 'NULL'}, '${escapedVariableName}', CURRENT_TIMESTAMP)
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
 * 
 * Filter panel state is DASHBOARD-SCOPED - shared across all views in a dashboard
 * This ensures filters persist when navigating between views
 */
app.get('/api/filter-panel-state', async (req, res) => {
  try {
    const { dashboardId } = req.query;
    
    let query = 'SELECT * FROM filter_panel_state WHERE is_active = true';
    if (dashboardId) {
      // Use dashboard_id for scoping (stored in view_id column for compatibility)
      query += ` AND view_id = ${parseInt(dashboardId)}`;
    }
    query += ' ORDER BY COALESCE(display_order, 0), last_modified DESC';
    
    console.log(`📥 [GET /api/filter-panel-state] dashboardId=${dashboardId}, query=${query}`);
    
    const states = await dbClient.query(query);
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
    
    console.log(`📥 [GET /api/filter-panel-state] Found ${activeFilterIds.length} active filters`);
    
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
 * 
 * Filter panel state is DASHBOARD-SCOPED - shared across all views in a dashboard
 */
// Debounce/lock mechanism for filter panel state saves - per dashboard
const filterPanelSaveLocks = new Map();
const pendingFilterPanelSaves = new Map();

async function saveFilterPanelStateToDb(dashboardId, positions, activeFilterIds) {
  const scopeClause = dashboardId ? `view_id = ${dashboardId}` : 'view_id IS NULL';
  
  console.log(`💾 [saveFilterPanelStateToDb] dashboardId=${dashboardId}, activeFilters=${activeFilterIds.length}`);
  
  // Mark existing filters for THIS DASHBOARD as inactive first
  try {
    await dbClient.run(`UPDATE filter_panel_state SET is_active = false WHERE ${scopeClause}`);
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
      // First try to delete if exists FOR THIS DASHBOARD
      await dbClient.run(`DELETE FROM filter_panel_state WHERE filter_id = '${escapedFilterId}' AND ${scopeClause}`);
    } catch (delErr) {
      // Ignore delete errors
    }
    
    // Then insert with dashboard scope
    try {
      await dbClient.run(`
        INSERT INTO filter_panel_state (view_id, filter_id, x_position, y_position, is_active, display_order, last_modified)
        VALUES (${dashboardId || 'NULL'}, '${escapedFilterId}', ${Math.round(position.x)}, ${Math.round(position.y)}, true, ${i}, CURRENT_TIMESTAMP)
      `);
    } catch (insertErr) {
      console.warn(`Warning: Could not save filter state for ${filterId}:`, insertErr.message);
    }
  }
  
  console.log(`✅ [saveFilterPanelStateToDb] Saved ${activeFilterIds.length} filters for dashboard ${dashboardId}`);
}

app.post('/api/filter-panel-state', async (req, res) => {
  try {
    const { positions, activeFilterIds, dashboardId } = req.body;
    if (!positions || !activeFilterIds || !Array.isArray(activeFilterIds)) {
      return res.status(400).json({ success: false, error: 'positions object and activeFilterIds array are required' });
    }

    const lockKey = dashboardId || 'global';
    
    // If a save is in progress for this dashboard, queue this one and respond immediately
    if (filterPanelSaveLocks.get(lockKey)) {
      pendingFilterPanelSaves.set(lockKey, { dashboardId, positions, activeFilterIds });
      return res.json({ success: true, message: 'Filter panel state queued for save' });
    }

    filterPanelSaveLocks.set(lockKey, true);

    try {
      await saveFilterPanelStateToDb(dashboardId, positions, activeFilterIds);
      res.json({ success: true, message: 'Filter panel state saved successfully' });
    } finally {
      filterPanelSaveLocks.set(lockKey, false);

      // Process any pending save for this dashboard
      const pending = pendingFilterPanelSaves.get(lockKey);
      if (pending) {
        pendingFilterPanelSaves.delete(lockKey);
        // Process asynchronously
        setImmediate(async () => {
          try {
            await saveFilterPanelStateToDb(pending.dashboardId, pending.positions, pending.activeFilterIds);
            console.log(`✅ Pending filter panel state saved for dashboard ${pending.dashboardId}`);
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

  // First, mark all existing filters for this card as inactive
  try {
    await dbClient.run(
      `UPDATE card_filter_panel_state SET is_active = false WHERE card_id='${escapedCardId}'`
    );
  } catch (err) {
    console.log('Note: Could not update existing card filters (may not exist yet)');
  }

  // Use DELETE + INSERT pattern to avoid unique constraint issues
  for (let i = 0; i < uniqueActiveIds.length; i++) {
    const filterId = uniqueActiveIds[i];
    const rawPos = positions[filterId];
    const hasPosition = rawPos && typeof rawPos.x === 'number' && typeof rawPos.y === 'number';
    // If no position, store sentinel (-1) so client can render in flex mode without stacking
    const position = hasPosition ? { x: Math.round(rawPos.x), y: Math.round(rawPos.y) } : { x: -1, y: -1 };
    const escapedFilterId = filterId.replace(/'/g, "''");

    // Delete existing record first
    try {
      await dbClient.run(`
        DELETE FROM card_filter_panel_state 
        WHERE card_id = '${escapedCardId}' AND filter_id = '${escapedFilterId}'
      `);
    } catch (delErr) {
      // Ignore delete errors
    }

    // Then insert new record
    try {
      await dbClient.run(`
        INSERT INTO card_filter_panel_state (card_id, filter_id, x_position, y_position, is_active, display_order, last_modified)
        VALUES ('${escapedCardId}', '${escapedFilterId}', ${position.x}, ${position.y}, true, ${i}, CURRENT_TIMESTAMP)
      `);
    } catch (insertErr) {
      console.warn(`Warning: Could not save card filter state for card ${cardId} filter ${filterId}:`, insertErr.message);
    }
  }
  
  console.log(`✅ Saved card filter state for card ${cardId}: ${uniqueActiveIds.length} filters`);
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
    const { viewId } = req.query;
    
    let query = 'SELECT * FROM card_dimension_conditions';
    if (viewId) {
      query += ` WHERE view_id = ${parseInt(viewId)}`;
    }
    query += ' ORDER BY chart_id, priority';
    
    const conditions = await dbClient.query(query);
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
    const { chartId, viewId, conditions } = req.body;
    if (!chartId) {
      return res.status(400).json({ success: false, error: 'chartId is required' });
    }

    const viewIdValue = viewId ? parseInt(viewId) : null;
    const escapedChartId = chartId.replace(/'/g, "''");
    
    // Delete existing conditions for this chart (scoped to view if provided)
    let deleteQuery = `DELETE FROM card_dimension_conditions WHERE chart_id='${escapedChartId}'`;
    if (viewIdValue) {
      deleteQuery += ` AND view_id = ${viewIdValue}`;
    }
    await dbClient.run(deleteQuery);

    // Insert new conditions
    if (conditions && Array.isArray(conditions)) {
      for (const condition of conditions) {
        const escapedConditionId = condition.id.replace(/'/g, "''");
        const escapedVariableName = condition.variableName.replace(/'/g, "''");
        await dbClient.run(`
          INSERT INTO card_dimension_conditions (
            chart_id, view_id, condition_id, variable_name, expected_value, width, height, priority, last_modified
          ) VALUES ('${escapedChartId}', ${viewIdValue || 'NULL'}, '${escapedConditionId}', '${escapedVariableName}', ${condition.expectedValue ? 'true' : 'false'}, ${condition.width}, ${condition.height}, ${condition.priority}, CURRENT_TIMESTAMP)
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

// ============================================
// DASHBOARD & VIEW HIERARCHY API ENDPOINTS
// ============================================

// Helper function to generate URL-friendly slugs
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Helper to count chart child-cards from DB rows containing child_cards_json
function countChartsInChildCards(rows, jsonKey = 'child_cards_json') {
  let total = 0;
  for (const row of rows || []) {
    const raw = row?.[jsonKey];
    if (!raw) continue;
    try {
      const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(arr)) {
        for (const child of arr) {
          // Count items explicitly marked as charts; if type missing, count as 1
          if (!child) continue;
          if (child.type === 'chart' || child.type === undefined) total += 1;
        }
      }
    } catch (err) {
      console.warn('⚠️ Failed to parse child_cards_json for chart count:', err?.message);
    }
  }
  return total;
}

// ============================================
// DASHBOARDS CRUD
// ============================================

/**
 * Get all dashboards
 * GET /api/dashboards
 */
app.get('/api/dashboards', async (req, res) => {
  try {
    const dashboards = await dbClient.query(`
      SELECT d.*, 
             CAST((SELECT COUNT(DISTINCT v.id) FROM views v WHERE v.dashboard_id = d.id) AS INTEGER) as views_count,
             CAST((SELECT COUNT(DISTINCT cc.chart_id) FROM chart_configs cc 
              INNER JOIN views v ON cc.view_id = v.id 
              WHERE v.dashboard_id = d.id) AS INTEGER) as charts_count
      FROM dashboards d
      ORDER BY d.updated_at DESC
    `);

    // Child card charts per dashboard
    const childCardRows = await dbClient.query(`
      SELECT c.child_cards_json, v.dashboard_id
      FROM child_card_configs c
      INNER JOIN views v ON c.view_id = v.id
    `);
    const childChartsByDashboard = {};
    for (const row of childCardRows || []) {
      const dashId = row.dashboard_id;
      const count = countChartsInChildCards([row]);
      childChartsByDashboard[dashId] = (childChartsByDashboard[dashId] || 0) + count;
    }
    
    console.log('📊 [API /dashboards] raw rows:', dashboards.map(d => ({
      id: d.id,
      name: d.name,
      charts_count: d.charts_count,
      views_count: d.views_count,
      child_charts: childChartsByDashboard[d.id] || 0,
    })));

    // Convert BigInt to Number for JSON serialization
    const serializedDashboards = dashboards.map(d => {
      const childCharts = childChartsByDashboard[d.id] || 0;
      return {
        ...d,
        views_count: Number(d.views_count) || 0,
        charts_count: (Number(d.charts_count) || 0) + childCharts,
      };
    });
    
    console.log('📊 Dashboards with counts:', serializedDashboards.map(d => ({ name: d.name, charts_count: d.charts_count, views_count: d.views_count })));
    
    res.json({ success: true, dashboards: serializedDashboards });
  } catch (err) {
    console.error('❌ Error fetching dashboards:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get single dashboard by slug or ID
 * GET /api/dashboards/:identifier
 */
app.get('/api/dashboards/:identifier', async (req, res) => {
  const { identifier } = req.params;
  
  try {
    // Try by ID first, then by slug
    const isNumeric = /^\d+$/.test(identifier);
    const query = isNumeric
      ? `SELECT * FROM dashboards WHERE id = ${identifier}`
      : `SELECT * FROM dashboards WHERE slug = '${identifier.replace(/'/g, "''")}'`;
    
    const result = await dbClient.query(query);
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Dashboard not found' });
    }
    
    res.json({ success: true, dashboard: result[0] });
  } catch (err) {
    console.error('❌ Error fetching dashboard:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create new dashboard
 * POST /api/dashboards
 */
app.post('/api/dashboards', async (req, res) => {
  const { name, description, icon, color } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'Dashboard name is required' });
  }
  
  const slug = generateSlug(name);
  
  try {
    // Check if slug already exists
    const existing = await dbClient.query(`SELECT id FROM dashboards WHERE slug = '${slug}'`);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'A dashboard with this name already exists' });
    }
    
    await dbClient.run(`
      INSERT INTO dashboards (name, slug, description, icon, color, created_at, updated_at)
      VALUES (
        '${name.replace(/'/g, "''")}',
        '${slug}',
        ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'},
        '${icon || 'dashboard'}',
        '${color || '#667eea'}',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);
    
    // Get the created dashboard
    const result = await dbClient.query(`SELECT * FROM dashboards WHERE slug = '${slug}'`);
    
    console.log(`✅ Created dashboard: ${name} (${slug})`);
    res.status(201).json({ success: true, dashboard: result[0] });
  } catch (err) {
    console.error('❌ Error creating dashboard:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update dashboard
 * PUT /api/dashboards/:id
 */
app.put('/api/dashboards/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, icon, color } = req.body;
  
  try {
    const updates = [];
    if (name) {
      updates.push(`name='${name.replace(/'/g, "''")}'`);
      updates.push(`slug='${generateSlug(name)}'`);
    }
    if (description !== undefined) {
      updates.push(description ? `description='${description.replace(/'/g, "''")}'` : `description=NULL`);
    }
    if (icon) updates.push(`icon='${icon}'`);
    if (color) updates.push(`color='${color}'`);
    updates.push(`updated_at=CURRENT_TIMESTAMP`);
    
    await dbClient.run(`UPDATE dashboards SET ${updates.join(', ')} WHERE id=${id}`);
    
    const result = await dbClient.query(`SELECT * FROM dashboards WHERE id=${id}`);
    
    console.log(`✅ Updated dashboard: ${id}`);
    res.json({ success: true, dashboard: result[0] });
  } catch (err) {
    console.error('❌ Error updating dashboard:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete dashboard (cascades to views and all view-specific resources)
 * DELETE /api/dashboards/:id
 */
app.delete('/api/dashboards/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Get all views for this dashboard first
    let views = [];
    try {
      views = await dbClient.query(`SELECT id FROM views WHERE dashboard_id=${id}`);
    } catch (err) {
      console.warn(`⚠️ Could not fetch views: ${err.message}`);
    }
    
    // Delete view-specific resources for each view (cascading)
    for (const view of views) {
      await deleteViewResources(view.id);
    }
    
    // Delete views
    try {
      await dbClient.run(`DELETE FROM views WHERE dashboard_id=${id}`);
    } catch (err) {
      console.warn(`⚠️ Could not delete views: ${err.message}`);
    }
    
    // Delete dashboard-level common resources (each wrapped in try-catch)
    const commonTables = ['parameters', 'calculations', 'filters', 'data_source_registry', 'snow_flake_connections'];
    for (const table of commonTables) {
      try {
        await dbClient.run(`DELETE FROM ${table} WHERE dashboard_id=${id}`);
      } catch (err) {
        console.warn(`⚠️ Could not delete from ${table}: ${err.message}`);
      }
    }
    
    // Delete dashboard
    await dbClient.run(`DELETE FROM dashboards WHERE id=${id}`);
    
    console.log(`✅ Deleted dashboard ${id} with all associated resources`);
    res.json({ success: true, message: 'Dashboard and all associated resources deleted' });
  } catch (err) {
    console.error('❌ Error deleting dashboard:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper function to delete all view-specific resources
async function deleteViewResources(viewId) {
  // Wrap each delete in try-catch to handle missing columns gracefully
  const tables = [
    { table: 'chart_configs', column: 'view_id' },
    { table: 'layouts', column: 'view_id' },
    { table: 'chart_visibility', column: 'view_id' },
    { table: 'card_dimension_conditions', column: 'view_id' },
    { table: 'filter_panel_state', column: 'view_id' },
    { table: 'card_filter_panel_state', column: 'view_id' },
    { table: 'tooltip_configs', column: 'view_id' },
    { table: 'child_card_configs', column: 'view_id' },
    { table: 'child_card_tooltip_configs', column: 'view_id' },
  ];
  
  for (const { table, column } of tables) {
    try {
      await dbClient.run(`DELETE FROM ${table} WHERE ${column}=${viewId}`);
    } catch (err) {
      console.warn(`⚠️ Could not delete from ${table}: ${err.message}`);
    }
  }
  console.log(`✅ Deleted resources for view ${viewId}`);
}

// ============================================
// VIEWS CRUD (scoped to dashboard)
// ============================================

/**
 * Get all views for a dashboard
 * GET /api/dashboards/:dashboardId/views
 */
app.get('/api/dashboards/:dashboardId/views', async (req, res) => {
  const { dashboardId } = req.params;
  
  try {
    // Support both ID and slug
    const isNumeric = /^\d+$/.test(dashboardId);
    let actualDashboardId = dashboardId;
    
    if (!isNumeric) {
      const dashboard = await dbClient.query(`SELECT id FROM dashboards WHERE slug='${dashboardId.replace(/'/g, "''")}'`);
      if (dashboard.length === 0) {
        return res.status(404).json({ success: false, error: 'Dashboard not found' });
      }
      actualDashboardId = dashboard[0].id;
    }
    
    const views = await dbClient.query(`
      SELECT v.*,
             CAST((SELECT COUNT(DISTINCT chart_id) FROM chart_configs WHERE view_id = v.id) AS INTEGER) as charts_count
      FROM views v
      WHERE v.dashboard_id = ${actualDashboardId}
      ORDER BY v.display_order, v.created_at
    `);

    // Child card charts per view
    const childCardRows = await dbClient.query(`
      SELECT child_cards_json, view_id
      FROM child_card_configs
      WHERE view_id IN (SELECT id FROM views WHERE dashboard_id = ${actualDashboardId})
    `);
    const childChartsByView = {};
    for (const row of childCardRows || []) {
      const viewId = row.view_id;
      const count = countChartsInChildCards([row]);
      childChartsByView[viewId] = (childChartsByView[viewId] || 0) + count;
    }
    
    console.log('📊 [API /dashboards/:identifier/views] raw rows:', views.map(v => ({
      id: v.id,
      name: v.name,
      charts_count: v.charts_count,
      dashboard_id: v.dashboard_id,
      child_charts: childChartsByView[v.id] || 0,
    })));

    // Convert BigInt to Number for JSON serialization
    const serializedViews = views.map(v => {
      const childCharts = childChartsByView[v.id] || 0;
      return {
        ...v,
        charts_count: (Number(v.charts_count) || 0) + childCharts,
      };
    });
    
    console.log('📊 Views with counts:', serializedViews.map(v => ({ name: v.name, charts_count: v.charts_count })));
    
    res.json({ success: true, views: serializedViews, dashboardId: actualDashboardId });
  } catch (err) {
    console.error('❌ Error fetching views:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get single view by slug or ID
 * GET /api/dashboards/:dashboardId/views/:viewIdentifier
 */
app.get('/api/dashboards/:dashboardId/views/:viewIdentifier', async (req, res) => {
  const { dashboardId, viewIdentifier } = req.params;
  
  try {
    // Get dashboard ID
    const isDashboardNumeric = /^\d+$/.test(dashboardId);
    let actualDashboardId = dashboardId;
    
    if (!isDashboardNumeric) {
      const dashboard = await dbClient.query(`SELECT id FROM dashboards WHERE slug='${dashboardId.replace(/'/g, "''")}'`);
      if (dashboard.length === 0) {
        return res.status(404).json({ success: false, error: 'Dashboard not found' });
      }
      actualDashboardId = dashboard[0].id;
    }
    
    // Get view
    const isViewNumeric = /^\d+$/.test(viewIdentifier);
    const viewQuery = isViewNumeric
      ? `SELECT * FROM views WHERE id = ${viewIdentifier} AND dashboard_id = ${actualDashboardId}`
      : `SELECT * FROM views WHERE slug = '${viewIdentifier.replace(/'/g, "''")}' AND dashboard_id = ${actualDashboardId}`;
    
    const result = await dbClient.query(viewQuery);
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'View not found' });
    }
    
    res.json({ success: true, view: result[0] });
  } catch (err) {
    console.error('❌ Error fetching view:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Create new view
 * POST /api/dashboards/:dashboardId/views
 */
app.post('/api/dashboards/:dashboardId/views', async (req, res) => {
  const { dashboardId } = req.params;
  const { name, description, icon, is_default, display_order } = req.body;
  
  if (!name || name.trim() === '') {
    return res.status(400).json({ success: false, error: 'View name is required' });
  }
  
  try {
    // Get dashboard ID
    const isDashboardNumeric = /^\d+$/.test(dashboardId);
    let actualDashboardId = dashboardId;
    
    if (!isDashboardNumeric) {
      const dashboard = await dbClient.query(`SELECT id FROM dashboards WHERE slug='${dashboardId.replace(/'/g, "''")}'`);
      if (dashboard.length === 0) {
        return res.status(404).json({ success: false, error: 'Dashboard not found' });
      }
      actualDashboardId = dashboard[0].id;
    }
    
    const slug = generateSlug(name);
    
    // Check if slug already exists for this dashboard
    const existing = await dbClient.query(`SELECT id FROM views WHERE slug = '${slug}' AND dashboard_id = ${actualDashboardId}`);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, error: 'A view with this name already exists in this dashboard' });
    }
    
    // If this is marked as default, unset other defaults
    if (is_default) {
      await dbClient.run(`UPDATE views SET is_default = FALSE WHERE dashboard_id = ${actualDashboardId}`);
    }
    
    await dbClient.run(`
      INSERT INTO views (dashboard_id, name, slug, description, icon, is_default, display_order, created_at, updated_at)
      VALUES (
        ${actualDashboardId},
        '${name.replace(/'/g, "''")}',
        '${slug}',
        ${description ? `'${description.replace(/'/g, "''")}'` : 'NULL'},
        '${icon || 'view_module'}',
        ${is_default ? 'TRUE' : 'FALSE'},
        ${display_order || 0},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `);
    
    // Get the created view
    const result = await dbClient.query(`SELECT * FROM views WHERE slug = '${slug}' AND dashboard_id = ${actualDashboardId}`);
    
    console.log(`✅ Created view: ${name} (${slug}) in dashboard ${actualDashboardId}`);
    res.status(201).json({ success: true, view: result[0] });
  } catch (err) {
    console.error('❌ Error creating view:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Update view
 * PUT /api/dashboards/:dashboardId/views/:viewId
 */
app.put('/api/dashboards/:dashboardId/views/:viewId', async (req, res) => {
  const { dashboardId, viewId } = req.params;
  const { name, description, icon, is_default, display_order } = req.body;
  
  try {
    // Get dashboard ID
    const isDashboardNumeric = /^\d+$/.test(dashboardId);
    let actualDashboardId = dashboardId;
    
    if (!isDashboardNumeric) {
      const dashboard = await dbClient.query(`SELECT id FROM dashboards WHERE slug='${dashboardId.replace(/'/g, "''")}'`);
      if (dashboard.length === 0) {
        return res.status(404).json({ success: false, error: 'Dashboard not found' });
      }
      actualDashboardId = dashboard[0].id;
    }
    
    // If setting as default, unset other defaults
    if (is_default) {
      await dbClient.run(`UPDATE views SET is_default = FALSE WHERE dashboard_id = ${actualDashboardId}`);
    }
    
    const updates = [];
    if (name) {
      updates.push(`name='${name.replace(/'/g, "''")}'`);
      updates.push(`slug='${generateSlug(name)}'`);
    }
    if (description !== undefined) {
      updates.push(description ? `description='${description.replace(/'/g, "''")}'` : `description=NULL`);
    }
    if (icon) updates.push(`icon='${icon}'`);
    if (is_default !== undefined) updates.push(`is_default=${is_default ? 'TRUE' : 'FALSE'}`);
    if (display_order !== undefined) updates.push(`display_order=${display_order}`);
    updates.push(`updated_at=CURRENT_TIMESTAMP`);
    
    await dbClient.run(`UPDATE views SET ${updates.join(', ')} WHERE id=${viewId} AND dashboard_id=${actualDashboardId}`);
    
    const result = await dbClient.query(`SELECT * FROM views WHERE id=${viewId}`);
    
    console.log(`✅ Updated view: ${viewId}`);
    res.json({ success: true, view: result[0] });
  } catch (err) {
    console.error('❌ Error updating view:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Delete view (cascades to all view-specific resources)
 * DELETE /api/dashboards/:dashboardId/views/:viewId
 */
app.delete('/api/dashboards/:dashboardId/views/:viewId', async (req, res) => {
  const { dashboardId, viewId } = req.params;
  
  try {
    // Delete all view-specific resources
    await deleteViewResources(viewId);
    
    // Delete the view
    await dbClient.run(`DELETE FROM views WHERE id=${viewId}`);
    
    console.log(`✅ Deleted view ${viewId} with all associated resources`);
    res.json({ success: true, message: 'View and all associated resources deleted' });
  } catch (err) {
    console.error('❌ Error deleting view:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// VIEW-SCOPED RESOURCES API ENDPOINTS
// ============================================

/**
 * Get all chart configs for a view
 * GET /api/dashboards/:dashboardId/views/:viewId/chart-configs
 */
app.get('/api/dashboards/:dashboardId/views/:viewId/chart-configs', async (req, res) => {
  const { viewId } = req.params;
  
  try {
    // Support slug
    const isViewNumeric = /^\d+$/.test(viewId);
    let actualViewId = viewId;
    
    if (!isViewNumeric) {
      const view = await dbClient.query(`SELECT id FROM views WHERE slug='${viewId.replace(/'/g, "''")}'`);
      if (view.length === 0) {
        return res.status(404).json({ success: false, error: 'View not found' });
      }
      actualViewId = view[0].id;
    }
    
    const configs = await dbClient.query(`
      SELECT * FROM chart_configs WHERE view_id=${actualViewId}
    `);
    
    res.json({ success: true, configs, viewId: actualViewId });
  } catch (err) {
    console.error('❌ Error fetching chart configs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get all layouts for a view
 * GET /api/dashboards/:dashboardId/views/:viewId/layouts
 */
app.get('/api/dashboards/:dashboardId/views/:viewId/layouts', async (req, res) => {
  const { viewId } = req.params;
  
  try {
    const isViewNumeric = /^\d+$/.test(viewId);
    let actualViewId = viewId;
    
    if (!isViewNumeric) {
      const view = await dbClient.query(`SELECT id FROM views WHERE slug='${viewId.replace(/'/g, "''")}'`);
      if (view.length === 0) {
        return res.status(404).json({ success: false, error: 'View not found' });
      }
      actualViewId = view[0].id;
    }
    
    const layouts = await dbClient.query(`
      SELECT * FROM layouts WHERE view_id=${actualViewId}
    `);
    
    res.json({ success: true, layouts, viewId: actualViewId });
  } catch (err) {
    console.error('❌ Error fetching layouts:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get all child card configs for a view
 * GET /api/dashboards/:dashboardId/views/:viewId/child-card-configs
 */
app.get('/api/dashboards/:dashboardId/views/:viewId/child-card-configs', async (req, res) => {
  const { viewId } = req.params;
  
  try {
    const isViewNumeric = /^\d+$/.test(viewId);
    let actualViewId = viewId;
    
    if (!isViewNumeric) {
      const view = await dbClient.query(`SELECT id FROM views WHERE slug='${viewId.replace(/'/g, "''")}'`);
      if (view.length === 0) {
        return res.status(404).json({ success: false, error: 'View not found' });
      }
      actualViewId = view[0].id;
    }
    
    const configs = await dbClient.query(`
      SELECT * FROM child_card_configs WHERE view_id=${actualViewId}
    `);
    
    res.json({ success: true, configs, viewId: actualViewId });
  } catch (err) {
    console.error('❌ Error fetching child card configs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// DASHBOARD-SCOPED COMMON RESOURCES API ENDPOINTS
// ============================================

/**
 * Get all parameters for a dashboard
 * GET /api/dashboards/:dashboardId/parameters
 */
app.get('/api/dashboards/:dashboardId/parameters', async (req, res) => {
  const { dashboardId } = req.params;
  
  try {
    const isNumeric = /^\d+$/.test(dashboardId);
    let actualDashboardId = dashboardId;
    
    if (!isNumeric) {
      const dashboard = await dbClient.query(`SELECT id FROM dashboards WHERE slug='${dashboardId.replace(/'/g, "''")}'`);
      if (dashboard.length === 0) {
        return res.status(404).json({ success: false, error: 'Dashboard not found' });
      }
      actualDashboardId = dashboard[0].id;
    }
    
    const parameters = await dbClient.query(`
      SELECT * FROM parameters WHERE dashboard_id=${actualDashboardId}
    `);
    
    res.json({ success: true, parameters, dashboardId: actualDashboardId });
  } catch (err) {
    console.error('❌ Error fetching parameters:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get all calculations for a dashboard
 * GET /api/dashboards/:dashboardId/calculations
 */
app.get('/api/dashboards/:dashboardId/calculations', async (req, res) => {
  const { dashboardId } = req.params;
  
  try {
    const isNumeric = /^\d+$/.test(dashboardId);
    let actualDashboardId = dashboardId;
    
    if (!isNumeric) {
      const dashboard = await dbClient.query(`SELECT id FROM dashboards WHERE slug='${dashboardId.replace(/'/g, "''")}'`);
      if (dashboard.length === 0) {
        return res.status(404).json({ success: false, error: 'Dashboard not found' });
      }
      actualDashboardId = dashboard[0].id;
    }
    
    const calculations = await dbClient.query(`
      SELECT * FROM calculations WHERE dashboard_id=${actualDashboardId} ORDER BY execution_order
    `);
    
    res.json({ success: true, calculations, dashboardId: actualDashboardId });
  } catch (err) {
    console.error('❌ Error fetching calculations:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get all filters for a dashboard
 * GET /api/dashboards/:dashboardId/filters
 */
app.get('/api/dashboards/:dashboardId/filters', async (req, res) => {
  const { dashboardId } = req.params;
  
  try {
    const isNumeric = /^\d+$/.test(dashboardId);
    let actualDashboardId = dashboardId;
    
    if (!isNumeric) {
      const dashboard = await dbClient.query(`SELECT id FROM dashboards WHERE slug='${dashboardId.replace(/'/g, "''")}'`);
      if (dashboard.length === 0) {
        return res.status(404).json({ success: false, error: 'Dashboard not found' });
      }
      actualDashboardId = dashboard[0].id;
    }
    
    const filters = await dbClient.query(`
      SELECT * FROM filters WHERE dashboard_id=${actualDashboardId}
    `);
    
    res.json({ success: true, filters, dashboardId: actualDashboardId });
  } catch (err) {
    console.error('❌ Error fetching filters:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get all data sources for a dashboard
 * GET /api/dashboards/:dashboardId/data-sources
 */
app.get('/api/dashboards/:dashboardId/data-sources', async (req, res) => {
  const { dashboardId } = req.params;
  
  try {
    const isNumeric = /^\d+$/.test(dashboardId);
    let actualDashboardId = dashboardId;
    
    if (!isNumeric) {
      const dashboard = await dbClient.query(`SELECT id FROM dashboards WHERE slug='${dashboardId.replace(/'/g, "''")}'`);
      if (dashboard.length === 0) {
        return res.status(404).json({ success: false, error: 'Dashboard not found' });
      }
      actualDashboardId = dashboard[0].id;
    }
    
    const dataSources = await dbClient.query(`
      SELECT * FROM data_source_registry WHERE dashboard_id=${actualDashboardId}
    `);
    
    res.json({ success: true, dataSources, dashboardId: actualDashboardId });
  } catch (err) {
    console.error('❌ Error fetching data sources:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get all connections for a dashboard
 * GET /api/dashboards/:dashboardId/connections
 */
app.get('/api/dashboards/:dashboardId/connections', async (req, res) => {
  const { dashboardId } = req.params;
  
  try {
    const isNumeric = /^\d+$/.test(dashboardId);
    let actualDashboardId = dashboardId;
    
    if (!isNumeric) {
      const dashboard = await dbClient.query(`SELECT id FROM dashboards WHERE slug='${dashboardId.replace(/'/g, "''")}'`);
      if (dashboard.length === 0) {
        return res.status(404).json({ success: false, error: 'Dashboard not found' });
      }
      actualDashboardId = dashboard[0].id;
    }
    
    const connections = await dbClient.query(`
      SELECT * FROM snow_flake_connections WHERE dashboard_id=${actualDashboardId}
    `);
    
    res.json({ success: true, connections, dashboardId: actualDashboardId });
  } catch (err) {
    console.error('❌ Error fetching connections:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// FAVORITES API ENDPOINTS
// ============================================

/**
 * Get all favorite dashboard IDs
 * GET /api/favorites/dashboards
 */
app.get('/api/favorites/dashboards', async (req, res) => {
  try {
    const favorites = await dbClient.query(`
      SELECT entity_id FROM favorites WHERE entity_type = 'dashboard'
    `);
    const favoriteIds = favorites.map(f => f.entity_id.toString());
    res.json({ success: true, favoriteIds });
  } catch (err) {
    console.error('❌ Error fetching dashboard favorites:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Add dashboard to favorites
 * POST /api/favorites/dashboards/:id
 */
app.post('/api/favorites/dashboards/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if already favorited
    const existing = await dbClient.query(`
      SELECT id FROM favorites WHERE entity_type = 'dashboard' AND entity_id = ${id}
    `);
    
    if (existing.length > 0) {
      return res.json({ success: true, message: 'Already favorited' });
    }
    
    await dbClient.run(`
      INSERT INTO favorites (entity_type, entity_id, created_at)
      VALUES ('dashboard', ${id}, CURRENT_TIMESTAMP)
    `);
    
    console.log(`✅ Added dashboard ${id} to favorites`);
    res.json({ success: true, message: 'Added to favorites' });
  } catch (err) {
    console.error('❌ Error adding dashboard to favorites:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Remove dashboard from favorites
 * DELETE /api/favorites/dashboards/:id
 */
app.delete('/api/favorites/dashboards/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await dbClient.run(`
      DELETE FROM favorites WHERE entity_type = 'dashboard' AND entity_id = ${id}
    `);
    
    console.log(`✅ Removed dashboard ${id} from favorites`);
    res.json({ success: true, message: 'Removed from favorites' });
  } catch (err) {
    console.error('❌ Error removing dashboard from favorites:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Get all favorite view IDs for a dashboard
 * GET /api/favorites/views/:dashboardId
 */
app.get('/api/favorites/views/:dashboardId', async (req, res) => {
  const { dashboardId } = req.params;
  
  try {
    const favorites = await dbClient.query(`
      SELECT entity_id FROM favorites 
      WHERE entity_type = 'view' AND dashboard_id = ${dashboardId}
    `);
    const favoriteIds = favorites.map(f => f.entity_id.toString());
    res.json({ success: true, favoriteIds });
  } catch (err) {
    console.error('❌ Error fetching view favorites:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Add view to favorites
 * POST /api/favorites/views/:dashboardId/:viewId
 */
app.post('/api/favorites/views/:dashboardId/:viewId', async (req, res) => {
  const { dashboardId, viewId } = req.params;
  
  try {
    // Check if already favorited
    const existing = await dbClient.query(`
      SELECT id FROM favorites WHERE entity_type = 'view' AND entity_id = ${viewId}
    `);
    
    if (existing.length > 0) {
      return res.json({ success: true, message: 'Already favorited' });
    }
    
    await dbClient.run(`
      INSERT INTO favorites (entity_type, entity_id, dashboard_id, created_at)
      VALUES ('view', ${viewId}, ${dashboardId}, CURRENT_TIMESTAMP)
    `);
    
    console.log(`✅ Added view ${viewId} to favorites`);
    res.json({ success: true, message: 'Added to favorites' });
  } catch (err) {
    console.error('❌ Error adding view to favorites:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Remove view from favorites
 * DELETE /api/favorites/views/:dashboardId/:viewId
 */
app.delete('/api/favorites/views/:dashboardId/:viewId', async (req, res) => {
  const { viewId } = req.params;
  
  try {
    await dbClient.run(`
      DELETE FROM favorites WHERE entity_type = 'view' AND entity_id = ${viewId}
    `);
    
    console.log(`✅ Removed view ${viewId} from favorites`);
    res.json({ success: true, message: 'Removed from favorites' });
  } catch (err) {
    console.error('❌ Error removing view from favorites:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// MIGRATION ENDPOINT - Move existing data to new structure
// ============================================

/**
 * Migrate existing data to new dashboard/view structure
 * POST /api/migrate-to-hierarchy
 */
app.post('/api/migrate-to-hierarchy', async (req, res) => {
  const { dashboardName, viewName } = req.body;
  
  if (!dashboardName || !viewName) {
    return res.status(400).json({ 
      success: false, 
      error: 'Both dashboardName and viewName are required for migration' 
    });
  }
  
  try {
    const dashboardSlug = generateSlug(dashboardName);
    const viewSlug = generateSlug(viewName);
    
    // Check if dashboard exists
    let dashboard = await dbClient.query(`SELECT id FROM dashboards WHERE slug='${dashboardSlug}'`);
    let dashboardId;
    
    if (dashboard.length === 0) {
      // Create dashboard
      await dbClient.run(`
        INSERT INTO dashboards (name, slug, description, created_at, updated_at)
        VALUES ('${dashboardName.replace(/'/g, "''")}', '${dashboardSlug}', 'Migrated dashboard', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      dashboard = await dbClient.query(`SELECT id FROM dashboards WHERE slug='${dashboardSlug}'`);
    }
    dashboardId = dashboard[0].id;
    
    // Check if view exists
    let view = await dbClient.query(`SELECT id FROM views WHERE slug='${viewSlug}' AND dashboard_id=${dashboardId}`);
    let viewId;
    
    if (view.length === 0) {
      // Create view
      await dbClient.run(`
        INSERT INTO views (dashboard_id, name, slug, description, is_default, created_at, updated_at)
        VALUES (${dashboardId}, '${viewName.replace(/'/g, "''")}', '${viewSlug}', 'Migrated view', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      view = await dbClient.query(`SELECT id FROM views WHERE slug='${viewSlug}' AND dashboard_id=${dashboardId}`);
    }
    viewId = view[0].id;
    
    // Migrate existing data without dashboard_id/view_id
    // Common resources -> assign to dashboard
    await dbClient.run(`UPDATE parameters SET dashboard_id=${dashboardId} WHERE dashboard_id IS NULL`);
    await dbClient.run(`UPDATE calculations SET dashboard_id=${dashboardId} WHERE dashboard_id IS NULL`);
    await dbClient.run(`UPDATE filters SET dashboard_id=${dashboardId} WHERE dashboard_id IS NULL`);
    await dbClient.run(`UPDATE data_source_registry SET dashboard_id=${dashboardId} WHERE dashboard_id IS NULL`);
    await dbClient.run(`UPDATE snow_flake_connections SET dashboard_id=${dashboardId} WHERE dashboard_id IS NULL`);
    
    // View-specific resources -> assign to view
    await dbClient.run(`UPDATE chart_configs SET view_id=${viewId} WHERE view_id IS NULL`);
    await dbClient.run(`UPDATE layouts SET view_id=${viewId} WHERE view_id IS NULL`);
    await dbClient.run(`UPDATE chart_visibility SET view_id=${viewId} WHERE view_id IS NULL`);
    await dbClient.run(`UPDATE card_dimension_conditions SET view_id=${viewId} WHERE view_id IS NULL`);
    await dbClient.run(`UPDATE filter_panel_state SET view_id=${viewId} WHERE view_id IS NULL`);
    await dbClient.run(`UPDATE card_filter_panel_state SET view_id=${viewId} WHERE view_id IS NULL`);
    await dbClient.run(`UPDATE tooltip_configs SET view_id=${viewId} WHERE view_id IS NULL`);
    await dbClient.run(`UPDATE child_card_configs SET view_id=${viewId} WHERE view_id IS NULL`);
    await dbClient.run(`UPDATE child_card_tooltip_configs SET view_id=${viewId} WHERE view_id IS NULL`);
    
    console.log(`✅ Migrated existing data to dashboard '${dashboardName}' and view '${viewName}'`);
    res.json({ 
      success: true, 
      message: 'Migration completed successfully',
      dashboardId,
      viewId,
      dashboardSlug,
      viewSlug
    });
  } catch (err) {
    console.error('❌ Error during migration:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

// Simple password hashing using crypto (for enterprise, consider bcrypt)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'iqvia_analytics_salt_2024').digest('hex');
}

function generateSessionToken() {
  return crypto.randomBytes(64).toString('hex');
}

// Validate IQVIA email domain
function isValidIqviaEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@iqvia\.com$/i;
  return emailRegex.test(email);
}

/**
 * Sign Up - Create new user
 * POST /api/auth/signup
 */
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, firstName, lastName, department } = req.body;
  
  // Validate required fields
  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email, password, first name, and last name are required' 
    });
  }
  
  // Validate IQVIA email domain
  if (!isValidIqviaEmail(email)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Only @iqvia.com email addresses are allowed' 
    });
  }
  
  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({ 
      success: false, 
      error: 'Password must be at least 8 characters long' 
    });
  }
  
  try {
    // Check if user already exists
    const existingUser = await dbClient.query(
      `SELECT id FROM users WHERE email='${email.toLowerCase().replace(/'/g, "''")}'`
    );
    
    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'An account with this email already exists' 
      });
    }
    
    // Hash password and create user
    const passwordHash = hashPassword(password);
    const insertQuery = `
      INSERT INTO users (email, password_hash, first_name, last_name, department, role, is_active, created_at, updated_at)
      VALUES (
        '${email.toLowerCase().replace(/'/g, "''")}',
        '${passwordHash}',
        '${firstName.replace(/'/g, "''")}',
        '${lastName.replace(/'/g, "''")}',
        ${department ? `'${department.replace(/'/g, "''")}'` : 'NULL'},
        'analyst',
        TRUE,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
    
    await dbClient.run(insertQuery);
    
    // Get the created user
    const newUser = await dbClient.query(
      `SELECT id, email, first_name, last_name, department, role FROM users WHERE email='${email.toLowerCase().replace(/'/g, "''")}'`
    );
    
    // Generate session token
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await dbClient.run(`
      INSERT INTO user_sessions (user_id, session_token, expires_at, created_at)
      VALUES (${newUser[0].id}, '${sessionToken}', '${expiresAt.toISOString()}', CURRENT_TIMESTAMP)
    `);
    
    console.log(`✅ New user registered: ${email}`);
    
    res.json({ 
      success: true, 
      message: 'Account created successfully',
      user: {
        id: newUser[0].id,
        email: newUser[0].email,
        firstName: newUser[0].first_name,
        lastName: newUser[0].last_name,
        department: newUser[0].department,
        role: newUser[0].role
      },
      sessionToken,
      expiresAt: expiresAt.toISOString()
    });
  } catch (err) {
    console.error('❌ Error creating user:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create account' });
  }
});

/**
 * Login - Authenticate user
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email and password are required' 
    });
  }
  
  // Validate IQVIA email domain
  if (!isValidIqviaEmail(email)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Only @iqvia.com email addresses are allowed' 
    });
  }
  
  try {
    // Find user
    const users = await dbClient.query(
      `SELECT id, email, password_hash, first_name, last_name, department, role, is_active 
       FROM users WHERE email='${email.toLowerCase().replace(/'/g, "''")}'`
    );
    
    if (!users || users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }
    
    const user = users[0];
    
    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({ 
        success: false, 
        error: 'Account is deactivated. Please contact your administrator.' 
      });
    }
    
    // Verify password
    const passwordHash = hashPassword(password);
    if (passwordHash !== user.password_hash) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }
    
    // Update last login
    await dbClient.run(`UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=${user.id}`);
    
    // Generate session token
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    // Clean up old sessions for this user
    await dbClient.run(`DELETE FROM user_sessions WHERE user_id=${user.id}`);
    
    // Create new session
    await dbClient.run(`
      INSERT INTO user_sessions (user_id, session_token, expires_at, created_at)
      VALUES (${user.id}, '${sessionToken}', '${expiresAt.toISOString()}', CURRENT_TIMESTAMP)
    `);
    
    console.log(`✅ User logged in: ${email}`);
    
    res.json({ 
      success: true, 
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        department: user.department,
        role: user.role
      },
      sessionToken,
      expiresAt: expiresAt.toISOString()
    });
  } catch (err) {
    console.error('❌ Error during login:', err.message);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * Verify Session - Check if session token is valid
 * GET /api/auth/verify
 */
app.get('/api/auth/verify', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No session token provided' });
  }
  
  const sessionToken = authHeader.substring(7);
  
  try {
    const sessions = await dbClient.query(`
      SELECT s.user_id, s.expires_at, u.id, u.email, u.first_name, u.last_name, u.department, u.role, u.is_active
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token='${sessionToken.replace(/'/g, "''")}'
    `);
    
    if (!sessions || sessions.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }
    
    const session = sessions[0];
    
    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      await dbClient.run(`DELETE FROM user_sessions WHERE session_token='${sessionToken.replace(/'/g, "''")}'`);
      return res.status(401).json({ success: false, error: 'Session expired' });
    }
    
    // Check if user is still active
    if (!session.is_active) {
      return res.status(401).json({ success: false, error: 'Account is deactivated' });
    }
    
    res.json({ 
      success: true, 
      user: {
        id: session.id,
        email: session.email,
        firstName: session.first_name,
        lastName: session.last_name,
        department: session.department,
        role: session.role
      }
    });
  } catch (err) {
    console.error('❌ Error verifying session:', err.message);
    res.status(500).json({ success: false, error: 'Session verification failed' });
  }
});

/**
 * Logout - Invalidate session
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ success: true, message: 'Logged out' });
  }
  
  const sessionToken = authHeader.substring(7);
  
  try {
    await dbClient.run(`DELETE FROM user_sessions WHERE session_token='${sessionToken.replace(/'/g, "''")}'`);
    console.log('✅ User logged out');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('❌ Error during logout:', err.message);
    res.json({ success: true, message: 'Logged out' });
  }
});

/**
 * Get current user profile
 * GET /api/auth/profile
 */
app.get('/api/auth/profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const sessionToken = authHeader.substring(7);
  
  try {
    const sessions = await dbClient.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.department, u.role, u.created_at, u.last_login
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token='${sessionToken.replace(/'/g, "''")}'
      AND s.expires_at > CURRENT_TIMESTAMP
    `);
    
    if (!sessions || sessions.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session' });
    }
    
    const user = sessions[0];
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        department: user.department,
        role: user.role,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
  } catch (err) {
    console.error('❌ Error fetching profile:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
app.put('/api/auth/profile', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const sessionToken = authHeader.substring(7);
  const { firstName, lastName, department } = req.body;
  
  // Validation
  if (!firstName || !lastName) {
    return res.status(400).json({ success: false, error: 'First name and last name are required' });
  }
  
  try {
    // First verify the session and get user id
    const sessions = await dbClient.query(`
      SELECT u.id
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token='${sessionToken.replace(/'/g, "''")}'
      AND s.expires_at > CURRENT_TIMESTAMP
    `);
    
    if (!sessions || sessions.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session' });
    }
    
    const userId = sessions[0].id;
    
    // Update user profile
    await dbClient.query(`
      UPDATE users 
      SET first_name='${firstName.replace(/'/g, "''")}',
          last_name='${lastName.replace(/'/g, "''")}',
          department=${department ? `'${department.replace(/'/g, "''")}'` : 'NULL'}
      WHERE id=${userId}
    `);
    
    // Fetch updated user data
    const updatedUsers = await dbClient.query(`
      SELECT id, email, first_name, last_name, department, role, created_at, last_login
      FROM users WHERE id=${userId}
    `);
    
    if (!updatedUsers || updatedUsers.length === 0) {
      return res.status(500).json({ success: false, error: 'Failed to fetch updated profile' });
    }
    
    const user = updatedUsers[0];
    
    console.log(`✅ Profile updated for user: ${user.email}`);
    
    res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        department: user.department,
        role: user.role,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });
  } catch (err) {
    console.error('❌ Error updating profile:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

/**
 * Change user password
 * PUT /api/auth/password
 */
app.put('/api/auth/password', async (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  
  const sessionToken = authHeader.substring(7);
  const { currentPassword, newPassword } = req.body;
  
  // Validation
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Current and new passwords are required' });
  }
  
  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'New password must be at least 8 characters' });
  }
  
  try {
    // First verify the session and get user
    const sessions = await dbClient.query(`
      SELECT u.id, u.password_hash
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.session_token='${sessionToken.replace(/'/g, "''")}'
      AND s.expires_at > CURRENT_TIMESTAMP
    `);
    
    if (!sessions || sessions.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid or expired session' });
    }
    
    const userId = sessions[0].id;
    const storedHash = sessions[0].password_hash;
    
    // Verify current password
    const currentPasswordHash = hashPassword(currentPassword);
    if (currentPasswordHash !== storedHash) {
      return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    }
    
    // Hash new password and update
    const newPasswordHash = hashPassword(newPassword);
    
    await dbClient.query(`
      UPDATE users SET password_hash='${newPasswordHash}' WHERE id=${userId}
    `);
    
    console.log(`✅ Password changed for user ID: ${userId}`);
    
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('❌ Error changing password:', err.message);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

(async () => {
  try {
    await dbClient.query('SELECT 1');
    console.log('✅ DuckDB is connected');

    // Initialize all tables using the new createTables function
    const { createTables } = await import('./db/initDb.js');
    await createTables();

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