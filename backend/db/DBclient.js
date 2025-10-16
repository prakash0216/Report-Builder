// dbClient.js
const sql = require('mssql/msnodesqlv8');

const config = {
  server: '(localdb)\\MSSQLLocalDB',
  database: 'Test', // 🔁 Replace with your DB name
  driver: 'msnodesqlv8',
  options: {
    trustedConnection: true,
    trustServerCertificate: true,
  },
};

let pool;

const connect = async () => {
  if (!pool) {
    try {
      pool = await sql.connect(config);
      console.log('✅ DB connected');
    } catch (err) {
      console.error('❌ DB connection error:', err);
      throw err;
    }
  }
  return pool;
};

const query = async (sqlQuery, params = {}) => {
  const pool = await connect();
  const request = pool.request();

  // Add parameters if provided
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }

  const result = await request.query(sqlQuery);
  return result.recordset;
};

module.exports = {
  query,
};