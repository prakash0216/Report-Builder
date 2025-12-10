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
  FOREIGN KEY (connection_id) REFERENCES snow_flake_connections(id),
);
`
  try{
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
`;

const chartConfigsTable=`
CREATE TABLE IF NOT EXISTS chart_configs (
  id INTEGER PRIMARY KEY DEFAULT NEXTVAL('chart_configs_seq'),
  chart_id TEXT UNIQUE NOT NULL,
  template TEXT,
  type TEXT NOT NULL CHECK (type IN ('chart','table','tableChart','html')),
  processed_config_json TEXT,
  html_content TEXT,
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


const createTables = async () => {
  await createChartConfigsTable();
  await createLayoutsTable();
  await createChartVisibilityTable();
  await createCardDimensionConditionsTable();
  await createFilterPanelStateTable();
  await createCardFilterPanelStateTable();
}

// createTables();

export {
  createChartConfigsTable,
  createLayoutsTable,
  createChartVisibilityTable,
  createCardDimensionConditionsTable,
  createFilterPanelStateTable,
  createParametersTable,
  createCalculationsTable,
  createFiltersTable,
  createMaterializedViewsTable
};