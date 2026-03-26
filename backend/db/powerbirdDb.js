const sql = require('mssql');
const localDb = require('./localDb');

let pool = null;

function getConfig() {
  return {
    server: localDb.getSetting('db_host'),
    port: parseInt(localDb.getSetting('db_port') || '1433'),
    database: localDb.getSetting('db_name'),
    user: localDb.getSetting('db_user'),
    password: localDb.getSetting('db_password'),
    options: {
      encrypt: localDb.getSetting('db_encrypt') === 'true',
      trustServerCertificate: localDb.getSetting('db_trust_cert') === 'true',
      readOnly: true,
    },
    connectionTimeout: 15000, charset: 'UTF-8',
    requestTimeout: 30000,
  };
}

async function getPool() {
  if (pool && pool.connected) return pool;
  const config = getConfig();
  if (!config.server) throw new Error('Datenbankverbindung nicht konfiguriert');
  pool = await sql.connect(config);
  return pool;
}

async function testConnection(config) {
  const testPool = await sql.connect({
    ...config,
    options: {
      encrypt: config.encrypt || false,
      trustServerCertificate: config.trustServerCertificate !== false,
      readOnly: true,
    },
    connectionTimeout: 10000,
  });
  await testPool.close();
  return true;
}

async function query(queryStr, params = {}) {
  const p = await getPool();
  const request = p.request();
  Object.entries(params).forEach(([key, val]) => {
    request.input(key, val);
  });
  return request.query(queryStr);
}

async function closePool() {
  if (pool) {
    await pool.close();
    pool = null;
  }
}

module.exports = { getPool, testConnection, query, closePool };
