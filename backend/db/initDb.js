import dbClient from "./duckDb.js"; // adjust path as needed

async function createSnowFlakeConnnection() {
    const createSnowFlakeTable = `
    CREATE TABLE IF NOT EXISTS snow_flake_connections (
    id INTEGER PRIMARY KEY DEFAULT NEXTVAL('snowflake_conn_id_seq'),
    connectionName TEXT NOT NULL,
    account TEXT NOT NULL,
    username TEXT NOT NULL,
    authenticator TEXT NOT NULL,
    privateKey BLOB,
    warehouse TEXT NOT NULL,
    database TEXT NOT NULL,
    schema TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type = 'snowflake')
    );
    `;
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS snowflake_conn_id_seq START 1;`);
    await dbClient.run(createSnowFlakeTable);
    console.log("✅ Table 'connections' created successfully.");
  } catch (err) {
    console.error("❌ Error creating table:", err.message);
  }
}

async function createDataSourceRegistry(){

  const createDataSourceRegistryTable=`
  CREATE TABLE IF NOT EXISTS data_source_registry (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('ds_registry_seq'),
  ds_name VARCHAR NOT NULL,
  connection_id INTEGER NOT NULL,
  type VARCHAR NOT NULL,
  query TEXT NOT NULL,
  parquet_path TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_refreshed TIMESTAMP,
  las_modified TIMESTAMP,
  refresh_interval_days INTEGER,
  FOREIGN KEY (connection_id) REFERENCES snow_flake_connections(id)
);
`;
  try{
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS ds_registry_seq START 1;`);
    await dbClient.run(createDataSourceRegistryTable);
    console.log("✅ Table 'data_source_registry' created successfully.");
  }catch(err){
    console.error("❌ Error creating table:", err.message);
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

// Parameters table definition
const parametersTable=`
CREATE TABLE IF NOT EXISTS parameters (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('parameters_seq'),
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
  }catch(err){
    console.error("❌ Error creating table 'parameters':", err.message);
  }
}

// Calculations table definition
const calculationsTable=`
CREATE TABLE IF NOT EXISTS calculations(
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('calculations_seq'),
  variable_name VARCHAR NOT NULL,
  logic TEXT NOT NULL,
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
  }catch(err){
    console.error("❌ Error creating table 'calculations':", err.message);
  }
}

// Filters table definition
const filtersTable=`
CREATE TABLE IF NOT EXISTS filters (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('filters_seq'),
  variable_name TEXT UNIQUE NOT NULL,
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
  last_modified TIMESTAMP
);
`

async function createFiltersTable(){
  try{
    // Ensure sequence exists first
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS filters_seq START 1;`);
    await dbClient.run(filtersTable);
    console.log("✅ Table 'filters' created successfully.");
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
`;

const chartConfigsTable=`
CREATE TABLE IF NOT EXISTS chart_configs (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('chart_configs_seq'),
  chart_id TEXT UNIQUE NOT NULL,
  template TEXT,
  type TEXT NOT NULL CHECK (type IN ('chart','table','tableChart','html')),
  processed_config_json TEXT,
  html_content TEXT,
  table_data_source TEXT,
  table_settings_json TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP
);
`

const layoutsTable=`
CREATE TABLE IF NOT EXISTS layouts (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('layouts_seq'),
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
  UNIQUE(breakpoint, chart_id)
);
`

const chartVisibilityTable=`
CREATE TABLE IF NOT EXISTS chart_visibility (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('chart_visibility_seq'),
  chart_id TEXT UNIQUE NOT NULL,
  variable_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP
);
`

const cardDimensionConditionsTable=`
CREATE TABLE IF NOT EXISTS card_dimension_conditions (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('card_dimension_conditions_seq'),
  chart_id TEXT NOT NULL,
  condition_id TEXT NOT NULL,
  variable_name TEXT NOT NULL,
  expected_value BOOLEAN NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  priority INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(chart_id, condition_id)
);
`

const filterPanelStateTable=`
CREATE TABLE IF NOT EXISTS filter_panel_state (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('filter_panel_state_seq'),
  filter_id TEXT UNIQUE NOT NULL,
  x_position INTEGER NOT NULL,
  y_position INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP
);
`;

const cardFilterPanelStateTable=`
CREATE TABLE IF NOT EXISTS card_filter_panel_state (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('card_filter_panel_state_seq'),
  card_id TEXT NOT NULL,
  filter_id TEXT NOT NULL,
  x_position INTEGER NOT NULL,
  y_position INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP,
  UNIQUE(card_id, filter_id)
);
`;

// Tooltip configs table - stores tooltip configuration for each chart
const tooltipConfigsTable = `
CREATE TABLE IF NOT EXISTS tooltip_configs (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('tooltip_configs_seq'),
  chart_id TEXT UNIQUE NOT NULL,
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
  last_modified TIMESTAMP
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

// Child Card Configs table for multi-card containers
const childCardConfigsTable = `
CREATE TABLE IF NOT EXISTS child_card_configs (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('child_card_configs_seq'),
  parent_card_id TEXT UNIQUE NOT NULL,
  is_container BOOLEAN NOT NULL DEFAULT FALSE,
  container_layout TEXT DEFAULT 'grid',
  child_cards_json TEXT,
  enable_container_scroll BOOLEAN DEFAULT FALSE,
  card_min_height INTEGER DEFAULT 500,
  gap INTEGER DEFAULT 8,
  use_dynamic_height BOOLEAN DEFAULT FALSE,
  height_data_source TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP
);
`

async function createChildCardConfigsTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS child_card_configs_seq START 1;`);
    await dbClient.run(childCardConfigsTable);
    console.log("✅ Table 'child_card_configs' created successfully.");
    
    // Migrate columns if they don't exist (for existing databases)
    try {
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS enable_container_scroll BOOLEAN DEFAULT FALSE`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS card_min_height INTEGER DEFAULT 500`);
      // 🔥 FIX: Add gap column migration (was missing!)
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS gap INTEGER DEFAULT 8`);
      // 🔥 Dynamic height columns
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS use_dynamic_height BOOLEAN DEFAULT FALSE`);
      await dbClient.run(`ALTER TABLE child_card_configs ADD COLUMN IF NOT EXISTS height_data_source TEXT DEFAULT ''`);
      console.log("✅ Child card configs columns migrated successfully.");
    } catch (migrationErr) {
      // Columns might already exist, ignore
      console.log("ℹ️ Child card configs columns already exist or migration skipped.");
    }
  } catch (err) {
    console.error("❌ Error creating table 'child_card_configs':", err.message);
  }
}

// Child card tooltip configs table definition
const childCardTooltipConfigsTable = `
CREATE TABLE IF NOT EXISTS child_card_tooltip_configs (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('child_card_tooltip_configs_seq'),
  child_card_key TEXT UNIQUE NOT NULL,
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
  last_modified TIMESTAMP
);
`

async function createChildCardTooltipConfigsTable() {
  try {
    await dbClient.run(`CREATE SEQUENCE IF NOT EXISTS child_card_tooltip_configs_seq START 1;`);
    await dbClient.run(childCardTooltipConfigsTable);
    console.log("✅ Table 'child_card_tooltip_configs' created successfully.");
    
    // 🔥 Migration: Add new multi-card columns if they don't exist
    try {
      await dbClient.run(`ALTER TABLE child_card_tooltip_configs ADD COLUMN IF NOT EXISTS use_multi_card BOOLEAN DEFAULT FALSE;`);
      await dbClient.run(`ALTER TABLE child_card_tooltip_configs ADD COLUMN IF NOT EXISTS tooltip_cards_json TEXT;`);
      await dbClient.run(`ALTER TABLE child_card_tooltip_configs ADD COLUMN IF NOT EXISTS container_layout TEXT DEFAULT 'grid';`);
      await dbClient.run(`ALTER TABLE child_card_tooltip_configs ADD COLUMN IF NOT EXISTS gap INTEGER DEFAULT 4;`);
      console.log("✅ Migration: Added multi-card columns to 'child_card_tooltip_configs'");
    } catch (migrationErr) {
      // Columns may already exist, that's okay
      console.log("ℹ️ Multi-card columns migration skipped (may already exist)");
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

const createTables = async () => {
  await createChartConfigsTable();
  await migrateChartConfigsTable(); // Run migration after table creation
  await createLayoutsTable();
  await createChartVisibilityTable();
  await createCardDimensionConditionsTable();
  await createFilterPanelStateTable();
  await createCardFilterPanelStateTable();
  await createTooltipConfigsTable();
  await createChildCardConfigsTable();
  await createChildCardTooltipConfigsTable();
}

// createTables();

export {
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
  createMaterializedViewsTable,
  createTooltipConfigsTable,
  createChildCardConfigsTable,
  createChildCardTooltipConfigsTable,
  migrateChartConfigsTable
};