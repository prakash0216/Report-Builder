import fs from 'fs';
import crypto from 'crypto';
import snowflake from 'snowflake-sdk';
import duckdb from 'duckdb';

const db = new duckdb.Database('snowflake_data.duckdb');

// Read and convert private key
const privateKeyBytes = fs.readFileSync('./pnp_private_key.der');
const privateKeyObject = crypto.createPrivateKey({
    key: privateKeyBytes,
    format: 'der',
    type: 'pkcs8',
});
const privateKeyPemBuffer = privateKeyObject.export({
    format: 'pem',
    type: 'pkcs8'
});

// Snowflake connection config
const connectionConfig = {
    account: "iqviaidporg-pandpreporting",
    username: "maasreaduser",
    authenticator: "SNOWFLAKE_JWT",
    privateKey: privateKeyPemBuffer,
    warehouse: "PNPLIBRARIES",
    database: "PNPREPORTING_LIB",
    schema: "PNPREPORTING_DATAMART",
};

// SQL queries
const QUERIES = {
    monthly: `
        SELECT
            TO_CHAR(DATE_TRUNC('month', F_MONTH_2), 'YYYY-MM') AS MONTH,
            SUM(WRITTEN_RXS_ELIGIBLE + WRITTEN_RXS_NON_ELIGIBLE) AS WRITTEN_TRX,
            SUM(NBRX_ELIGIBLE + NBRX_NON_ELIGIBLE + CBRX_ELIGIBLE + CBRX_NON_ELIGIBLE) AS PAID_TRX,
            SUM(NBRX_ELIGIBLE + NBRX_NON_ELIGIBLE) AS NBRX,
            MOP AS "Method of Payment",
            PAYER_NAME AS "Payer Name",
            BRAND_GENERIC_FLAG AS "Brand Generic Flag",
            F_MONTH_2 AS Date
        FROM MSC_ADW_RPT_MSL_REPORTING
        GROUP BY
            TO_CHAR(DATE_TRUNC('month', F_MONTH_2), 'YYYY-MM'),
            MOP,
            PAYER_NAME,
            BRAND_GENERIC_FLAG,
            F_MONTH_2
        ORDER BY 1;
    `
};


// function getColumnNames(connectionConfig, tableName, schemaName) {
//     return new Promise((resolve, reject) => {
//         const conn = snowflake.createConnection(connectionConfig);

//         conn.connect((err, conn) => {
//             if (err) {
//                 console.error(`Connection error: ${err.message}`);
//                 return reject(err);
//             }

//             const sql = `
//                 SELECT COLUMN_NAME
//                 FROM INFORMATION_SCHEMA.COLUMNS
//                 WHERE TABLE_NAME = '${tableName}'
//                   AND TABLE_SCHEMA = '${schemaName}'
//             `;

//             conn.execute({
//                 sqlText: sql,
//                 complete: (err, stmt, rows) => {
//                     conn.destroy(); // Always clean up

//                     if (err) {
//                         console.error(`Query error: ${err.message}`);
//                         return reject(err);
//                     }

//                     const columnNames = rows.map(row => row.COLUMN_NAME);
//                     console.log(`Column names for table "${tableName}":`, columnNames);
//                     resolve(columnNames);
//                 }
//             });
//         });
//     });
// }

// getColumnNames(connectionConfig, 'MSC_ADW_RPT_MSL_REPORTING', 'PNPREPORTING_DATAMART')


function storeInDuckDBBatch(name, rows) {
    return new Promise((resolve, reject) => {
        if (!rows || rows.length === 0) {
            console.warn(`No rows to insert for table "${name}".`);
            return resolve();
        }

        const conn = db.connect();
        const columns = Object.keys(rows[0]);

        // Drop and create table
        const dropTableSQL = `DROP TABLE IF EXISTS ${name};`;

        conn.run(dropTableSQL, (err) => {
            if (err) {
                console.error(`Error dropping table ${name}:`, err);
                conn.close();
                return reject(err);
            }

            const columnDefs = columns.map(col => {
                const val = rows[0][col];
                let type = 'TEXT';

                if (typeof val === 'number') {
                    type = Number.isInteger(val) ? 'BIGINT' : 'DOUBLE';
                } else if (val instanceof Date) {
                    type = 'DATE';
                }

                return `"${col}" ${type}`;
            }).join(', ');

            const createTableSQL = `CREATE TABLE ${name} (${columnDefs});`;
            console.log(`Creating table "${name}" with SQL:`, createTableSQL);

            conn.run(createTableSQL, (err) => {
                if (err) {
                    console.error(`Error creating table ${name}:`, err);
                    conn.close();
                    return reject(err);
                }

                // Build a single INSERT statement with all values
                const columnList = columns.map(col => `"${col}"`).join(', ');
                const valueRows = rows.map(row => {
                    const values = columns.map(col => {
                        const val = row[col];
                        if (val === null || val === undefined) return 'NULL';
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                        if (val instanceof Date) return `'${val.toISOString().split('T')[0]}'`; // Format as 'YYYY-MM-DD'
                        return val;
                    });
                    return `(${values.join(', ')})`;
                });

                const insertSQL = `INSERT INTO ${name} (${columnList}) VALUES ${valueRows.join(', ')}`;

                conn.run(insertSQL, (err) => {
                    if (err) {
                        console.error(`Error inserting batch data into ${name}:`, err);
                        conn.close();
                        return reject(err);
                    }

                    console.log(`Successfully inserted ${rows.length} rows into ${name}`);
                    conn.close();
                    resolve();
                });
            });
        });
    });
}


function viewDuckDBTable(tableName, limit = 10) {
    return new Promise((resolve, reject) => {
        const conn = db.connect();
        const sql = `SELECT * FROM ${tableName} LIMIT ${limit};`;

        conn.all(sql, (err, rows) => {
            conn.close();
            if (err) return reject(err);
            console.log(`\n--- Showing top ${limit} rows from "${tableName}" ---`);
            console.table(rows);
            resolve(rows);
        });
    });
}


// Run a single query
function runQuery(name, sql) {
    return new Promise((resolve, reject) => {
        const conn = snowflake.createConnection(connectionConfig);
        const start = Date.now(); // Start timer manually

        conn.connect((err, conn) => {
            if (err) return reject(`Connection error for ${name}: ${err.message}`);

            conn.execute({
                sqlText: sql,
                complete: (err, stmt, rows) => {
                    conn.destroy();
                    const elapsed = (Date.now() - start) / 1000; // Time in seconds

                    if (err) return reject(`Query error for ${name}: ${err.message}`);
                    resolve({ name, rows, elapsed });
                }
            });
        });
    });
}

// Run all queries in parallel
// Fixed version - await the storeInDuckDB calls
async function runAllQueries() {
    console.time("Total");

    try {
        const promises = Object.entries(QUERIES).map(([name, sql]) => runQuery(name, sql));
        const results = await Promise.all(promises);

        // Process results sequentially to ensure proper storage
        for (const { name, rows, elapsed } of results) {
            console.log(`\n--- ${name.toUpperCase()} ---`);
            console.table(rows.slice(0, 5));
            console.log(`Query time for "${name}": ${elapsed.toFixed(2)} seconds`);
        
            try {
                await storeInDuckDBBatch(name, rows);; // AWAIT this call
                console.log(`Stored "${name}" results in DuckDB.`);
                
                // Verify data was stored
                const verifyRows = await viewDuckDBTable(name, 3);
                console.log(`Verification: ${verifyRows.length} rows found in ${name}`);
            } catch (err) {
                console.error(`Error storing "${name}" in DuckDB:`, err);
            }
        }

    } catch (err) {
        console.error(err);
    }

    console.timeEnd("Total");
}

async function viewTables() {
    // await viewDuckDBTable('monthly', 10);
    await viewDuckDBTable('market_split', 20);
}

function viewRawTable(tableName) {
    return new Promise((resolve, reject) => {
        const conn = db.connect();
        const sql = `SELECT * FROM ${tableName} LIMIT 10;`;

        conn.all(sql, (err, rows) => {
            conn.close();
            if (err) return reject(err);
            console.log(`Raw data from "${tableName}":`);
            console.table(rows);
            resolve(rows);
        });
    });
}

// viewRawTable('monthly');
// viewRawTable('market_split');

// viewTables().catch(console.error);

async function runQueries(){
    await runAllQueries();
    // viewRawTable('market_split');
    // viewRawTable('monthly');
}
// runQueries().catch(console.error);

// viewDuckDBTable('monthly');
// runQuery('monthly', QUERIES.monthly)



// db.all("SELECT * FROM monthly", (err, rows) => {
//     if (err) {
//       console.error("Error retrieving data:", err);
//     } else {
//       console.log("Data from minthly table:", rows);
//     }
//   });

function getDataFromDuckDB(){
    console.time("QueryTime");

    db.all("SELECT * FROM monthly", (err, rows) => {
    console.timeEnd("QueryTime"); 

    if (err) {
        console.error("Error retrieving data:", err);
    } else{
        console.log("Data length from monthly table:", rows.length);
        console.log("sample data:", rows.slice(0,5) );
    }
    });
}



// getDataFromDuckDB();

// function getDataFromDuckDBConc() {
//     console.time("TotalQueryTime");

//     const queryPromises = [];

//     for (let i = 0; i < 1000; i++) {
//         queryPromises.push(
//             new Promise((resolve, reject) => {
//                 db.all("SELECT * FROM monthly", (err, rows) => {
//                     if (err) {
//                         reject(err);
//                     } else {
//                         resolve(rows.length);
//                     }
//                 });
//             })
//         );
//     }

//     Promise.all(queryPromises)
//         .then(results => {
//             console.timeEnd("TotalQueryTime");
//             console.log("All queries completed. Sample result lengths:", results.slice(0, 5));
//         })
//         .catch(error => {
//             console.error("Error during parallel queries:", error);
//         });
// }

// getDataFromDuckDBConc();

 
// function runQuery(query) {
//   return new Promise((resolve, reject) => {
//     console.log("Start time :", new Date().toISOString());
//     const con = db.connect();
//     con.all(query, (err, res) => {
//         console.log("End time :", new Date().toISOString());
//       con.close();
//       if (err) reject(err);
//       else resolve(res);
//     });

//   });
// }
 
// async function main() {
//   await runQuery("PRAGMA threads=8");
 
//   const queries = [];
//   for (let i = 0; i < 20; i++) {
//     queries.push(runQuery("SELECT * FROM monthly"));
//   }
 
//   console.time("Start 1000_parallel_queries: ",new Date().toISOString());
//   const results = await Promise.all(queries);
//   console.timeEnd("End 1000_parallel_queries:", new Date().toISOString());
 
// //   console.log("Sample result:", results[0]);
// }
 
// main().catch(err => console.error(err));

