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