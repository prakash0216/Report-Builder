import dbClient from "./duckDb.js"; // adjust path as needed

// ============================================
// DASHBOARD & VIEWS HIERARCHY TABLES
// ============================================

// Dashboards table - root level container
const dashboardsTable = `
CREATE TABLE IF NOT EXISTS dashboards (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('dashboards_seq'),
  name VARCHAR NOT NULL UNIQUE,
  slug VARCHAR NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'dashboard',
  color TEXT DEFAULT '#667eea',
  data_source TEXT,
  time_period_start TEXT,
  time_period_end TEXT,
  library_type VARCHAR DEFAULT 'Core libraries',
  icon_type VARCHAR DEFAULT 'text' CHECK (icon_type IN ('text', 'upload')),
  icon_text VARCHAR(5),
  icon_color VARCHAR DEFAULT '#3B82F6',
  icon_image_url TEXT,
  admin_portal_id TEXT,
  embed_type VARCHAR DEFAULT '' CHECK (embed_type IN ('', 'iframe', 'tableau')),
  embed_link TEXT,
  trigger_calculation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// Views table - belongs to a dashboard
const viewsTable = `
CREATE TABLE IF NOT EXISTS views (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('views_seq'),
  dashboard_id INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'view_module',
  is_default BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  admin_portal_id TEXT,
  embed_type VARCHAR DEFAULT '',
  embed_link TEXT,
  trigger_calculation TEXT,
  icon_type VARCHAR DEFAULT 'text',
  icon_text VARCHAR(5),
  icon_color VARCHAR DEFAULT '#667eea',
  icon_image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dashboard_id, slug)
);
`;

async function createDashboardsTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS dashboards_seq START 1;`);
    await dbClient.run(dashboardsTable);
    console.log("✅ Table 'dashboards' created successfully.");
    
    // Migration: Add new columns if they don't exist
    try {
      await dbClient.run(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS data_source TEXT`);
      await dbClient.run(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS library_type VARCHAR DEFAULT 'Core libraries'`);
      await dbClient.run(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS icon_type VARCHAR DEFAULT 'text'`);
      await dbClient.run(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS icon_text VARCHAR(5)`);
      await dbClient.run(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS icon_color VARCHAR DEFAULT '#3B82F6'`);
      await dbClient.run(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS icon_image_url TEXT`);
      await dbClient.run(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS admin_portal_id TEXT`);
      await dbClient.run(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS embed_type VARCHAR DEFAULT ''`);
      await dbClient.run(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS embed_link TEXT`);
      await dbClient.run(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS trigger_calculation TEXT`);
      await dbClient.run(`ALTER TABLE dashboards ADD COLUMN IF NOT EXISTS tableau_synced_at TIMESTAMP`);
      console.log("✅ Migration: Added new columns to dashboards table");
    } catch (migrationErr) {
      console.log("ℹ️ Dashboard columns migration skipped (may already exist)");
    }
    
  } catch (err) {
    console.error("❌ Error creating table 'dashboards':", err.message);
  }
}

async function createViewsTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS views_seq START 1;`);
    await dbClient.run(viewsTable);
    console.log("✅ Table 'views' created successfully.");
    
    // Migration: Add new columns if they don't exist
    try {
      await dbClient.run(`ALTER TABLE views ADD COLUMN IF NOT EXISTS admin_portal_id TEXT`);
      await dbClient.run(`ALTER TABLE views ADD COLUMN IF NOT EXISTS embed_type VARCHAR DEFAULT ''`);
      await dbClient.run(`ALTER TABLE views ADD COLUMN IF NOT EXISTS embed_link TEXT`);
      await dbClient.run(`ALTER TABLE views ADD COLUMN IF NOT EXISTS trigger_calculation TEXT`);
      await dbClient.run(`ALTER TABLE views ADD COLUMN IF NOT EXISTS icon_type VARCHAR DEFAULT 'text'`);
      await dbClient.run(`ALTER TABLE views ADD COLUMN IF NOT EXISTS icon_text VARCHAR(5)`);
      await dbClient.run(`ALTER TABLE views ADD COLUMN IF NOT EXISTS icon_color VARCHAR DEFAULT '#667eea'`);
      await dbClient.run(`ALTER TABLE views ADD COLUMN IF NOT EXISTS icon_image_url TEXT`);
      console.log("✅ Migration: Added new columns to views table");
    } catch (migrationErr) {
      console.log("ℹ️ Views columns migration skipped (may already exist)");
    }
  } catch (err) {
    console.error("❌ Error creating table 'views':", err.message);
  }
}

// ============================================
// COMMON RESOURCES (scoped to dashboard)
// ============================================

async function createSnowFlakeConnnection() {
    const createSnowFlakeTable = `
    CREATE TABLE IF NOT EXISTS snow_flake_connections (
    id INTEGER PRIMARY KEY DEFAULT NEXTVAL('snowflake_conn_id_seq'),
    dashboard_id INTEGER REFERENCES dashboards(id),
    connectionName TEXT NOT NULL,
    account TEXT NOT NULL,
    username TEXT NOT NULL,
    authenticator TEXT NOT NULL,
    privateKey BLOB,
    privateKeyFileName TEXT,
    warehouse TEXT NOT NULL,
    database TEXT NOT NULL,
    schema TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type = 'snowflake')
    );
    `;
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS snowflake_conn_id_seq START 1;`);
    await dbClient.run(createSnowFlakeTable);
    
    // Add privateKeyFileName column if it doesn't exist (for existing databases)
    try {
      await dbClient.run(`ALTER TABLE snow_flake_connections ADD COLUMN IF NOT EXISTS privateKeyFileName TEXT;`);
    } catch (alterErr) {
      // Column might already exist, ignore error
      console.log("Note: privateKeyFileName column already exists or could not be added");
    }
    
    console.log("✅ Table 'snow_flake_connections' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table:", err.message);
  }
}

async function createDataSourceRegistry(){

  const createDataSourceRegistryTable=`
  CREATE TABLE IF NOT EXISTS data_source_registry (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('ds_registry_seq'),
  ds_name VARCHAR NOT NULL,
  connection_id INTEGER,
  csv_connector_id INTEGER,
  type VARCHAR NOT NULL,
  query TEXT NOT NULL,
  parquet_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_refreshed TIMESTAMP,
  last_modified TIMESTAMP,
  refresh_interval_days INTEGER,
  FOREIGN KEY (connection_id) REFERENCES snow_flake_connections(id),
  FOREIGN KEY (csv_connector_id) REFERENCES csv_connectors(id)
);
`;
  try{
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS ds_registry_seq START 1;`);
    await dbClient.run(createDataSourceRegistryTable);
    
    // Fix typo in existing databases: rename las_modified to last_modified
    try {
      await dbClient.run(`ALTER TABLE data_source_registry RENAME COLUMN las_modified TO last_modified;`);
    } catch (alterErr) {
      // Column might already be correctly named or doesn't exist, ignore error
    }
    
    // Migration: Add csv_connector_id if it doesn't exist
    try {
      await dbClient.run(`ALTER TABLE data_source_registry ADD COLUMN IF NOT EXISTS csv_connector_id INTEGER`);
      console.log("✅ Migration: Added csv_connector_id to data_source_registry");
    } catch (alterErr) {
      console.log("ℹ️ csv_connector_id column migration skipped (may already exist)");
    }
    
    // Migration: Remove NOT NULL constraint from connection_id for CSV connector support
    // DuckDB doesn't support ALTER COLUMN to drop NOT NULL, so we recreate the table
    try {
      // Check if connection_id has NOT NULL constraint by trying to insert NULL
      // If it fails, we need to migrate the table
      const testResult = await dbClient.query(`
        SELECT sql FROM sqlite_master WHERE type='table' AND name='data_source_registry'
      `).catch(() => []);
      
      // Alternative approach: try to update a dummy check
      // We'll handle this at runtime in the INSERT statement instead
      console.log("ℹ️ Note: If you see NOT NULL constraint errors on connection_id, delete the database file and restart");
    } catch (migrationErr) {
      console.log("ℹ️ connection_id constraint check skipped");
    }
    
    console.log("✅ Table 'data_source_registry' created successfully.");
  }catch(err){
    console.error("❌ Error creating table:", err.message);
  }
}

// CSV Connectors table - stores uploaded CSV files as DuckDB tables
const csvConnectorsTable = `
CREATE TABLE IF NOT EXISTS csv_connectors (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('csv_connectors_seq'),
  dashboard_id INTEGER,
  connector_name TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  duckdb_table_name TEXT NOT NULL,
  columns_json TEXT,
  row_count INTEGER,
  file_size_bytes INTEGER,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

async function createCsvConnectorsTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS csv_connectors_seq START 1;`);
    await dbClient.run(csvConnectorsTable);
    console.log("✅ Table 'csv_connectors' created successfully.");
    
    // Migration: Add dashboard_id if it doesn't exist
    try {
      await dbClient.run(`ALTER TABLE csv_connectors ADD COLUMN IF NOT EXISTS dashboard_id INTEGER`);
      console.log("✅ Migration: Added dashboard_id to csv_connectors");
    } catch (alterErr) {
      console.log("ℹ️ csv_connectors dashboard_id column migration skipped");
    }
  } catch (err) {
    console.error("❌ Error creating table 'csv_connectors':", err.message);
  }
}

// createDataSourceRegistry();

// createSnowFlakeConnnection();

// const dummyBlob = Buffer.from("dummy_private_key_data");

// async function insertDummyConnections() {
//     const insertSnowflakeConnection = `
//     INSERT INTO snow_flake_connections (
//         connectionName,
//         account,
//         username,
//         authenticator,
//         privateKey,
//         warehouse,
//         database,
//         schema,
//         type
//     ) VALUES (1, 2, 3, 4, 5, 6, 7, 8, 9);
//     `;

    
//     const dummyConnections = [
//     ["Sales Analytics", "sales_account", "sales_user", "snowflake", dummyBlob, "sales_wh", "sales_db", "analytics", "snowflake"],
//     ["Marketing Insights", "mkt_account", "mkt_user", "snowflake", dummyBlob, "mkt_wh", "mkt_db", "insights", "snowflake"],
//     ["Finance Reports", "fin_account", "fin_user", "snowflake", dummyBlob, "fin_wh", "fin_db", "reports", "snowflake"],
//     ["HR Dashboard", "hr_account", "hr_user", "snowflake", dummyBlob, "hr_wh", "hr_db", "dashboard", "snowflake"],
//     ["Product Metrics", "prod_account", "prod_user", "snowflake", dummyBlob, "prod_wh", "prod_db", "metrics", "snowflake"]
//     ];
  

//   try {
//     for (const params of dummyConnections) {
//       await dbClient.run(insertSnowflakeConnection, params);
//     }
//     console.log("✅ Dummy records inserted successfully.");
//   } catch (err) {
//     console.error("❌ Error inserting dummy records:", err.message);
//   }
// }
async function insertDummyConnections(){
    const insert_query=`insert into snow_flake_connections
    (connectionName,account,username,authenticator,privateKey,warehouse,database,schema,type)
    values ('sales_analyticss','sales_account','sales_user','snowflake',X'64656d6f5f707269766174655f6b65795f64617461','sales_wh','sales_db','analytics','snowflake'),`
    try{
        await dbClient.run(insert_query);
        console.log("✅ Dummy records inserted successfully.");
    }   catch(err){
        console.error("❌ Error inserting dummy records:", err.message);
    }
}

// insertDummyConnections();

// Parameters table definition (scoped to dashboard - common resource)
const parametersTable=`
CREATE TABLE IF NOT EXISTS parameters (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('parameters_seq'),
  dashboard_id INTEGER,
  name VARCHAR NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP
);
`

async function createParametersTable(){
  try{
    // Ensure sequence exists first
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS parameters_seq START 1;`);
    await dbClient.run(parametersTable);
    console.log("✅ Table 'parameters' created successfully.");
    
    // Migration: Add dashboard_id if it doesn't exist
    try {
      await dbClient.run(`ALTER TABLE parameters ADD COLUMN IF NOT EXISTS dashboard_id INTEGER`);
      console.log("✅ Migration: Added dashboard_id to parameters");
    } catch (e) {
      console.log("ℹ️ Parameters dashboard_id column migration skipped");
    }
  }catch(err){
    console.error("❌ Error creating table 'parameters':", err.message);
  }
}

// Calculations table definition (scoped to dashboard - common resource)
const calculationsTable=`
CREATE TABLE IF NOT EXISTS calculations(
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('calculations_seq'),
  dashboard_id INTEGER,
  variable_name VARCHAR NOT NULL,
  logic TEXT NOT NULL,
  execution_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_executed TIMESTAMP
);
`

async function createCalculationsTable(){
  try{
    // Ensure sequence exists first
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS calculations_seq START 1;`);
    await dbClient.run(calculationsTable);
    console.log("✅ Table 'calculations' created successfully.");
    
    // Migration: Add dashboard_id and execution_order if they don't exist
    try {
      await dbClient.run(`ALTER TABLE calculations ADD COLUMN IF NOT EXISTS dashboard_id INTEGER`);
      await dbClient.run(`ALTER TABLE calculations ADD COLUMN IF NOT EXISTS execution_order INTEGER DEFAULT 0`);
      console.log("✅ Migration: Added dashboard_id to calculations");
    } catch (e) {
      console.log("ℹ️ Calculations dashboard_id column migration skipped");
    }
  }catch(err){
    console.error("❌ Error creating table 'calculations':", err.message);
  }
}

// Predefined Functions table definition (scoped to dashboard - common resource)
// These are reusable functions that can be called from any calculation
const predefinedFunctionsTable = `
CREATE TABLE IF NOT EXISTS predefined_functions (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('predefined_functions_seq'),
  dashboard_id INTEGER,
  function_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  parameters_json TEXT,
  body TEXT NOT NULL,
  return_type TEXT DEFAULT 'any',
  category TEXT DEFAULT 'Custom',
  example TEXT,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(dashboard_id, function_id)
);
`;

async function createPredefinedFunctionsTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS predefined_functions_seq START 1;`);
    await dbClient.run(predefinedFunctionsTable);
    // Migration: add example column if it doesn't exist
    try {
      await dbClient.run(`ALTER TABLE predefined_functions ADD COLUMN IF NOT EXISTS example TEXT`);
      console.log("✅ Migration: Added example column to predefined_functions");
    } catch (e) {
      console.log("ℹ️ predefined_functions example column migration skipped");
    }
    console.log("✅ Table 'predefined_functions' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'predefined_functions':", err.message);
  }
}

// Filters table definition (scoped to dashboard - common resource)
const filtersTable=`
CREATE TABLE IF NOT EXISTS filters (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('filters_seq'),
  dashboard_id INTEGER,
  variable_name TEXT NOT NULL,
  category TEXT NOT NULL,
  param_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  selection_type TEXT NOT NULL CHECK (selection_type IN ('single','multi')),
  ds_name TEXT,
  label_index INTEGER,
  value_index INTEGER,
  label_key TEXT,
  value_key TEXT,
  available_options_json TEXT NOT NULL,
  default_values_json TEXT NOT NULL,
  last_modified TIMESTAMP,
  UNIQUE(dashboard_id, variable_name)
);
`

async function createFiltersTable(){
  try{
    // Ensure sequence exists first
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS filters_seq START 1;`);
    await dbClient.run(filtersTable);
    console.log("✅ Table 'filters' created successfully.");
    
    // Migration: Add dashboard_id if it doesn't exist
    try {
      await dbClient.run(`ALTER TABLE filters ADD COLUMN IF NOT EXISTS dashboard_id INTEGER`);
      console.log("✅ Migration: Added dashboard_id to filters");
    } catch (e) {
      console.log("ℹ️ Filters dashboard_id column migration skipped");
    }
  }catch(err){
    console.error("❌ Error creating table 'filters':", err.message);
  }
}

// Create sequences for auto-increment IDs
const createSequences = `
CREATE SEQUENCE IF NOT EXISTS chart_configs_seq START 1;
CREATE SEQUENCE IF NOT EXISTS layouts_seq START 1;
CREATE SEQUENCE IF NOT EXISTS chart_visibility_seq START 1;
CREATE SEQUENCE IF NOT EXISTS card_dimension_conditions_seq START 1;
CREATE SEQUENCE IF NOT EXISTS filter_panel_state_seq START 1;
CREATE SEQUENCE IF NOT EXISTS card_filter_panel_state_seq START 1;
CREATE SEQUENCE IF NOT EXISTS tooltip_configs_seq START 1;
CREATE SEQUENCE IF NOT EXISTS onclick_configs_seq START 1;
`;

// Chart configs table (scoped to view - view-specific resource)
const chartConfigsTable=`
CREATE TABLE IF NOT EXISTS chart_configs (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('chart_configs_seq'),
  view_id INTEGER,
  chart_id TEXT NOT NULL,
  template TEXT,
  type TEXT NOT NULL CHECK (type IN ('chart','table','tableChart','html')),
  processed_config_json TEXT,
  html_content TEXT,
  table_data_source TEXT,
  table_settings_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(view_id, chart_id)
);
`

// Layouts table (scoped to view - view-specific resource)
const layoutsTable=`
CREATE TABLE IF NOT EXISTS layouts (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('layouts_seq'),
  view_id INTEGER,
  breakpoint TEXT NOT NULL CHECK (breakpoint IN ('lg','md','sm','xs','xxs')),
  chart_id TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  w INTEGER NOT NULL,
  h INTEGER NOT NULL,
  min_w INTEGER,
  max_w INTEGER,
  min_h INTEGER,
  max_h INTEGER,
  static BOOLEAN,
  is_draggable BOOLEAN,
  is_resizable BOOLEAN,
  is_bounded BOOLEAN,
  resize_handles TEXT,
  moved BOOLEAN,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(view_id, breakpoint, chart_id)
);
`

// Chart visibility table (scoped to view - view-specific resource)
const chartVisibilityTable=`
CREATE TABLE IF NOT EXISTS chart_visibility (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('chart_visibility_seq'),
  view_id INTEGER,
  chart_id TEXT NOT NULL,
  variable_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(view_id, chart_id)
);
`

// Card dimension conditions table (scoped to view - view-specific resource)
const cardDimensionConditionsTable=`
CREATE TABLE IF NOT EXISTS card_dimension_conditions (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('card_dimension_conditions_seq'),
  view_id INTEGER,
  chart_id TEXT NOT NULL,
  condition_id TEXT NOT NULL,
  variable_name TEXT NOT NULL,
  expected_value BOOLEAN NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  priority INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(view_id, chart_id, condition_id)
);
`

// Filter panel state table (scoped to view - view-specific resource)
const filterPanelStateTable=`
CREATE TABLE IF NOT EXISTS filter_panel_state (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('filter_panel_state_seq'),
  view_id INTEGER,
  filter_id TEXT NOT NULL,
  x_position INTEGER NOT NULL,
  y_position INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(view_id, filter_id)
);
`;

// Card filter panel state table (scoped to view - view-specific resource)
const cardFilterPanelStateTable=`
CREATE TABLE IF NOT EXISTS card_filter_panel_state (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('card_filter_panel_state_seq'),
  view_id INTEGER,
  card_id TEXT NOT NULL,
  filter_id TEXT NOT NULL,
  x_position INTEGER NOT NULL,
  y_position INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(view_id, card_id, filter_id)
);
`;

// Tooltip configs table (scoped to view - view-specific resource)
const tooltipConfigsTable = `
CREATE TABLE IF NOT EXISTS tooltip_configs (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('tooltip_configs_seq'),
  view_id INTEGER,
  chart_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  type TEXT NOT NULL CHECK (type IN ('chart', 'table', 'html', 'card')),
  card_id TEXT,
  chart_template TEXT,
  table_data_source TEXT,
  table_settings_json TEXT,
  html_template TEXT,
  data_mapping_json TEXT,
  width INTEGER DEFAULT 400,
  height INTEGER DEFAULT 300,
  offset_x INTEGER DEFAULT 10,
  offset_y INTEGER DEFAULT 10,
  show_on_hover BOOLEAN DEFAULT true,
  hide_delay INTEGER DEFAULT 200,
  show_header BOOLEAN DEFAULT true,
  header_title TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(view_id, chart_id)
);
`;

async function initializeSequences() {
  try {
    // Run each sequence creation separately to handle any that might already exist
    const sequences = createSequences.split(';').filter(s => s.trim());
    for (const seq of sequences) {
      if (seq.trim()) {
        await dbClient.run(seq + ';');
      }
    }
    console.log("✅ All sequences initialized.");
  } catch (err) {
    console.error("❌ Error initializing sequences:", err.message);
  }
}

async function createChartConfigsTable() {
  try {
    // Ensure sequence exists first
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS chart_configs_seq START 1;`);
    await dbClient.run(chartConfigsTable);
    console.log("✅ Table 'chart_configs' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'chart_configs':", err.message);
  }
}

async function createLayoutsTable() {
  try {
    // Ensure sequence exists first
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS layouts_seq START 1;`);
    await dbClient.run(layoutsTable);
    console.log("✅ Table 'layouts' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'layouts':", err.message);
  }
}

async function createChartVisibilityTable() {
  try {
    // Ensure sequence exists first
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS chart_visibility_seq START 1;`);
    await dbClient.run(chartVisibilityTable);
    console.log("✅ Table 'chart_visibility' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'chart_visibility':", err.message);
  }
}

async function createCardDimensionConditionsTable() {
  try {
    // Ensure sequence exists first
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS card_dimension_conditions_seq START 1;`);
    await dbClient.run(cardDimensionConditionsTable);
    console.log("✅ Table 'card_dimension_conditions' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'card_dimension_conditions':", err.message);
  }
}

async function createFilterPanelStateTable() {
  try {
    // Ensure sequence exists first
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS filter_panel_state_seq START 1;`);
    await dbClient.run(filterPanelStateTable);
    console.log("✅ Table 'filter_panel_state' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'filter_panel_state':", err.message);
  }
}

async function createCardFilterPanelStateTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS card_filter_panel_state_seq START 1;`);
    await dbClient.run(cardFilterPanelStateTable);
    console.log("✅ Table 'card_filter_panel_state' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'card_filter_panel_state':", err.message);
  }
}

async function createTooltipConfigsTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS tooltip_configs_seq START 1;`);
    await dbClient.run(tooltipConfigsTable);
    console.log("✅ Table 'tooltip_configs' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'tooltip_configs':", err.message);
  }
}

// onClick configs table (scoped to view - view-specific resource)
const onClickConfigsTable = `
CREATE TABLE IF NOT EXISTS onclick_configs (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('onclick_configs_seq'),
  view_id INTEGER,
  chart_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  data_mapping_json TEXT,
  calculations_json TEXT,
  reset_on_click_outside BOOLEAN DEFAULT true,
  show_reset_button BOOLEAN DEFAULT true,
  highlight_clicked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(view_id, chart_id)
);
`;

async function createOnClickConfigsTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS onclick_configs_seq START 1;`);
    await dbClient.run(onClickConfigsTable);
    console.log("✅ Table 'onclick_configs' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'onclick_configs':", err.message);
  }
}

// Child Card Configs table for multi-card containers (scoped to view - view-specific resource)
const childCardConfigsTable = `
CREATE TABLE IF NOT EXISTS child_card_configs (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('child_card_configs_seq'),
  view_id INTEGER,
  parent_card_id TEXT NOT NULL,
  is_container BOOLEAN NOT NULL DEFAULT FALSE,
  container_layout TEXT DEFAULT 'grid',
  child_cards_json TEXT,
  enable_container_scroll BOOLEAN DEFAULT FALSE,
  card_min_height INTEGER DEFAULT 500,
  gap INTEGER DEFAULT 8,
  use_dynamic_height BOOLEAN DEFAULT FALSE,
  height_data_source TEXT DEFAULT '',
  show_parent_title BOOLEAN DEFAULT FALSE,
  parent_title_mode TEXT DEFAULT 'simple',
  parent_title TEXT DEFAULT '',
  parent_title_template TEXT DEFAULT '',
  visibility_variable TEXT DEFAULT '',
  arrangement_variable TEXT DEFAULT '',
  child_visibility_mode TEXT DEFAULT 'all',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(view_id, parent_card_id)
);
`

async function createChildCardConfigsTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS child_card_configs_seq START 1;`);
    await dbClient.run(childCardConfigsTable);
    console.log("✅ Table 'child_card_configs' created successfully.");
    
    // Migrate columns if they don't exist (for existing databases)
    try {
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS view_id INTEGER`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS enable_container_scroll BOOLEAN DEFAULT FALSE`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS card_min_height INTEGER DEFAULT 500`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS gap INTEGER DEFAULT 8`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS use_dynamic_height BOOLEAN DEFAULT FALSE`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS height_data_source TEXT DEFAULT ''`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS show_parent_title BOOLEAN DEFAULT FALSE`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS parent_title_mode TEXT DEFAULT 'simple'`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS parent_title TEXT DEFAULT ''`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS parent_title_template TEXT DEFAULT ''`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS visibility_variable TEXT DEFAULT ''`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS arrangement_variable TEXT DEFAULT ''`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS child_visibility_mode TEXT DEFAULT 'all'`);
      console.log("✅ Child card configs columns migrated successfully.");
    } catch (migrationErr) {
      console.log("ℹ️ Child card configs columns already exist or migration skipped.");
    }
  } catch (err) {
    console.error("❌ Error creating table 'child_card_configs':", err.message);
  }
}

// Child card tooltip configs table definition (scoped to view - view-specific resource)
const childCardTooltipConfigsTable = `
CREATE TABLE IF NOT EXISTS child_card_tooltip_configs (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('child_card_tooltip_configs_seq'),
  view_id INTEGER,
  child_card_key TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  tooltip_type TEXT DEFAULT 'html',
  data_extractions_json TEXT,
  calculation_bindings_json TEXT,
  chart_template TEXT,
  table_data_source TEXT,
  table_settings_json TEXT,
  html_template TEXT,
  width INTEGER DEFAULT 400,
  height INTEGER DEFAULT 300,
  offset_x INTEGER DEFAULT 15,
  offset_y INTEGER DEFAULT 15,
  hide_delay INTEGER DEFAULT 200,
  show_header BOOLEAN DEFAULT TRUE,
  header_title TEXT DEFAULT 'Details',
  trigger_on TEXT DEFAULT 'hover',
  use_multi_card BOOLEAN DEFAULT FALSE,
  tooltip_cards_json TEXT,
  container_layout TEXT DEFAULT 'grid',
  gap INTEGER DEFAULT 4,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(view_id, child_card_key)
);
`

async function createChildCardTooltipConfigsTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS child_card_tooltip_configs_seq START 1;`);
    await dbClient.run(childCardTooltipConfigsTable);
    console.log("✅ Table 'child_card_tooltip_configs' created successfully.");
    
    // Migration: Add columns if they don't exist
    try {
      await dbClient.run(`ALTER TABLE child_card_tooltip_configs ADD COLUMN IF NOT EXISTS view_id INTEGER`);
      await dbClient.run(`ALTER TABLE child_card_tooltip_configs ADD COLUMN IF NOT EXISTS use_multi_card BOOLEAN DEFAULT FALSE;`);
      await dbClient.run(`ALTER TABLE child_card_tooltip_configs ADD COLUMN IF NOT EXISTS tooltip_cards_json TEXT;`);
      await dbClient.run(`ALTER TABLE child_card_tooltip_configs ADD COLUMN IF NOT EXISTS container_layout TEXT DEFAULT 'grid';`);
      await dbClient.run(`ALTER TABLE child_card_tooltip_configs ADD COLUMN IF NOT EXISTS gap INTEGER DEFAULT 4;`);
      console.log("✅ Migration: Added columns to 'child_card_tooltip_configs'");
    } catch (migrationErr) {
      console.log("ℹ️ Child card tooltip configs columns migration skipped (may already exist)");
    }
  } catch (err) {
    console.error("❌ Error creating table 'child_card_tooltip_configs':", err.message);
  }
}

// Materialized views table definition
const materializedViewsTable = `
CREATE TABLE IF NOT EXISTS materialized_views (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('materialized_views_seq'),
  data_source_name VARCHAR NOT NULL,
  view_name VARCHAR NOT NULL UNIQUE,
  query_hash VARCHAR NOT NULL,
  query_object_json TEXT,
  base_table_name VARCHAR NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_refreshed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`

async function createMaterializedViewsTable() {
  try {
    // Ensure sequence exists first
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS materialized_views_seq START 1;`);
    await dbClient.run(materializedViewsTable);
    console.log("✅ Table 'materialized_views' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'materialized_views':", err.message);
  }
}

// ============================================
// FAVORITES TABLE
// ============================================

// Favorites table - stores user favorites for dashboards and views
const favoritesTable = `
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('favorites_seq'),
  entity_type VARCHAR NOT NULL CHECK (entity_type IN ('dashboard', 'view')),
  entity_id INTEGER NOT NULL,
  dashboard_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id)
);
`;

async function createFavoritesTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS favorites_seq START 1;`);
    await dbClient.run(favoritesTable);
    console.log("✅ Table 'favorites' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'favorites':", err.message);
  }
}

// ============================================
// USERS TABLE (Authentication)
// ============================================

// Users table - stores user authentication data
const usersTable = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('users_seq'),
  email VARCHAR NOT NULL UNIQUE,
  password_hash VARCHAR NOT NULL,
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  department VARCHAR,
  role VARCHAR DEFAULT 'analyst',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`;

// User sessions table - stores active sessions
const userSessionsTable = `
CREATE TABLE IF NOT EXISTS user_sessions (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('user_sessions_seq'),
  user_id INTEGER NOT NULL,
  session_token VARCHAR NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
`;

async function createUsersTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS users_seq START 1;`);
    await dbClient.run(usersTable);
    console.log("✅ Table 'users' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'users':", err.message);
  }
}

async function createUserSessionsTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS user_sessions_seq START 1;`);
    await dbClient.run(userSessionsTable);
    console.log("✅ Table 'user_sessions' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table 'user_sessions':", err.message);
  }
}


// Migration function to add new columns to existing tables
async function migrateChartConfigsTable() {
  try {
    // Check if table_data_source column exists
    const columns = await dbClient.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'chart_configs'
    `);
    const columnNames = columns.map(c => c.column_name);
    
    // Add table_data_source if it doesn't exist
    if (!columnNames.includes('table_data_source')) {
      await dbClient.run(`ALTER TABLE chart_configs ADD COLUMN table_data_source TEXT`);
      console.log("✅ Added 'table_data_source' column to chart_configs");
    }
    
    // Add table_settings_json if it doesn't exist
    if (!columnNames.includes('table_settings_json')) {
      await dbClient.run(`ALTER TABLE chart_configs ADD COLUMN table_settings_json TEXT`);
      console.log("✅ Added 'table_settings_json' column to chart_configs");
    }
  } catch (err) {
    // If the query fails (e.g., table doesn't exist yet), just log and continue
    console.log("ℹ️ Migration check skipped (table may not exist yet):", err.message);
  }
}

// Migration function to add view_id to existing tables
async function migrateViewIdColumns() {
  const tables = [
    'chart_configs',
    'layouts',
    'chart_visibility',
    'card_dimension_conditions',
    'filter_panel_state',
    'card_filter_panel_state',
    'tooltip_configs',
    'onclick_configs',
    'child_card_configs',
    'child_card_tooltip_configs'
  ];
  
  for (const table of tables) {
    try {
      await dbClient.run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS view_id INTEGER`);
      console.log(`✅ Migration: Added view_id to '${table}'`);
    } catch (e) {
      console.log(`ℹ️ ${table} view_id column migration skipped`);
    }
  }
}

// Migration function to add dashboard_id to existing tables
async function migrateDashboardIdColumns() {
  const tables = ['parameters', 'calculations', 'filters', 'snow_flake_connections', 'data_source_registry'];
  
  for (const table of tables) {
    try {
      await dbClient.run(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS dashboard_id INTEGER`);
      console.log(`✅ Migration: Added dashboard_id to '${table}'`);
    } catch (e) {
      console.log(`ℹ️ ${table} dashboard_id column migration skipped`);
    }
  }
}

// Seed MSL Extract data source if parquet file exists but registry entry doesn't
async function seedMslExtractDataSource() {
  const path = await import('path');
  const fs = await import('fs');
  const { fileURLToPath } = await import('url');
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  const dataSourceName = 'msl_extract';
  const parquetPath = path.join(__dirname, 'parquet_files', `ds_${dataSourceName}.parquet`);
  
  // Check if parquet file exists
  if (!fs.existsSync(parquetPath)) {
    console.log(`ℹ️ MSL Extract parquet file not found at ${parquetPath}, skipping seed.`);
    return;
  }
  
  try {
    // Check if data source already exists
    const existing = await dbClient.query(`SELECT * FROM data_source_registry WHERE ds_name='${dataSourceName}'`);
    if (existing.length > 0) {
      console.log(`ℹ️ Data source '${dataSourceName}' already exists, skipping seed.`);
      return;
    }
    
    // Find any existing snowflake connection to use
    let connections = await dbClient.query(`SELECT id FROM snow_flake_connections WHERE connectionName='snowflake1' LIMIT 1`);
    
    // If snowflake1 not found, try to get any connection
    if (connections.length === 0) {
      connections = await dbClient.query(`SELECT id FROM snow_flake_connections LIMIT 1`);
    }
    
    if (connections.length === 0) {
      console.log(`⚠️ No Snowflake connections found. Skipping MSL extract seed - you'll need to create a connection first.`);
      return;
    }
    
    const connectionId = connections[0].id;
    console.log(`ℹ️ Using connection_id=${connectionId} for MSL extract seed.`);
    
    const query = `SELECT
                    SUM(NBRX_ELIGIBLE) + SUM(NBRX_NON_ELIGIBLE) AS "Paid NBRx",
                    SUM(NBRX_ELIGIBLE) + SUM(CBRX_ELIGIBLE) AS "Paid TRX",
                    SUM(WRITTEN_RXS_ELIGIBLE) + SUM(WRITTEN_RXS_NON_ELIGIBLE) AS "Written TRX",
                    SUM(PROJECTED_TRX) AS "Projected TRX", 
                    PRODUCT_GROUP,
                    MOP,
                    F_MONTH_2,
                    PAYER_NAME,
                    MOLECULE_NAME,
                    MARKET,
                    BRAND_GENERIC_FLAG,
                    SPECIALTY_PROD_IND,
                    MAAS_PRI_SPCL_GRP,
                    DIAG_LVL4_DESC
                FROM MSC_ADW_RPT_MSL_REPORTING_2B
                WHERE F_MONTH_2 > '2025-01-01'
                GROUP BY PRODUCT_GROUP, MOP, F_MONTH_2, PAYER_NAME, MOLECULE_NAME, MARKET,
                        BRAND_GENERIC_FLAG, SPECIALTY_PROD_IND, MAAS_PRI_SPCL_GRP, DIAG_LVL4_DESC`;
    
    const escapedQuery = query.replace(/'/g, "''");
    const escapedParquetPath = parquetPath.replace(/\\/g, '\\\\');
    
    const insertQuery = `INSERT INTO data_source_registry (ds_name, connection_id, type, query, parquet_path, created_at, last_modified) 
      VALUES ('${dataSourceName}', ${connectionId}, 'Extract', '${escapedQuery}', '${escapedParquetPath}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
    
    await dbClient.run(insertQuery);
    console.log(`✅ Seeded data source '${dataSourceName}' with existing parquet file.`);
    
    // Also create the base table from parquet if it doesn't exist
    const tableName = `ds_${dataSourceName}`;
    try {
      const tableExists = await dbClient.query(`SELECT * FROM information_schema.tables WHERE table_name='${tableName}'`);
      if (tableExists.length === 0) {
        console.log(`🔨 Creating base table ${tableName} from parquet file...`);
        const normalizedPath = parquetPath.replace(/\\/g, '/');
        await dbClient.run(`CREATE TABLE IF NOT EXISTS ${tableName} AS SELECT * FROM read_parquet('${normalizedPath}')`);
        console.log(`✅ Base table ${tableName} created successfully.`);
      } else {
        console.log(`ℹ️ Base table ${tableName} already exists.`);
      }
    } catch (tableErr) {
      console.log(`⚠️ Could not create base table ${tableName}: ${tableErr.message}`);
    }
    
  } catch (err) {
    console.error(`❌ Error seeding MSL extract data source: ${err.message}`);
  }
}

const createTables = async () => {
  // Create hierarchy tables first
  await createDashboardsTable();
  await createViewsTable();
  
  // Create common resource tables (scoped to dashboard)
  await createSnowFlakeConnnection();
  await createCsvConnectorsTable();  // CSV connectors before data_source_registry (for FK reference)
  await createDataSourceRegistry();
  await createParametersTable();
  await createCalculationsTable();
  await createPredefinedFunctionsTable();
  await createFiltersTable();
  
  // Create view-specific tables
  await createChartConfigsTable();
  await migrateChartConfigsTable();
  await createLayoutsTable();
  await createChartVisibilityTable();
  await createCardDimensionConditionsTable();
  await createFilterPanelStateTable();
  await createCardFilterPanelStateTable();
  await createTooltipConfigsTable();
  await createOnClickConfigsTable();
  await createChildCardConfigsTable();
  await createChildCardTooltipConfigsTable();
  await createMaterializedViewsTable();
  
  // Create favorites table
  await createFavoritesTable();
  
  // Create authentication tables
  await createUsersTable();
  await createUserSessionsTable();
  
  // Run migrations
  await migrateViewIdColumns();
  await migrateDashboardIdColumns();
  
    // Seed data sources with existing parquet files
    await seedMslExtractDataSource();
  
  console.log("✅ All tables created and migrations completed.");
}

// createTables();

export {
  // Hierarchy tables
  createDashboardsTable,
  createViewsTable,
  // Common resource tables
  createSnowFlakeConnnection,
  createCsvConnectorsTable,
  createDataSourceRegistry,
  createParametersTable,
  createCalculationsTable,
  createPredefinedFunctionsTable,
  createFiltersTable,
  // View-specific tables
  createChartConfigsTable,
  createLayoutsTable,
  createChartVisibilityTable,
  createCardDimensionConditionsTable,
  createFilterPanelStateTable,
  createCardFilterPanelStateTable,
  createTooltipConfigsTable,
  createOnClickConfigsTable,
  createChildCardConfigsTable,
  createChildCardTooltipConfigsTable,
  createMaterializedViewsTable,
  // Favorites table
  createFavoritesTable,
  // Authentication tables
  createUsersTable,
  createUserSessionsTable,
  // Migrations
  migrateChartConfigsTable,
  migrateViewIdColumns,
  migrateDashboardIdColumns,
    // Data seeding
    seedMslExtractDataSource,
    // All tables
    createTables
};
