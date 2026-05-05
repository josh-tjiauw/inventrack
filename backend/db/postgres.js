const { Pool } = require('pg');

let pool;

const shouldUseSsl = (connectionString) => {
  if (!connectionString) return false;
  return /sslmode=require/i.test(connectionString) || /neon\.tech|render\.com|railway\.app|supabase\.co/i.test(connectionString);
};

const getDatabaseUrl = () => {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
};

const getPool = () => {
  if (pool) return pool;

  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('DATABASE_URL or POSTGRES_URL is required for PostgreSQL routes');
  }

  pool = new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
    max: Number(process.env.PGPOOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PGPOOL_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.PGPOOL_CONNECTION_TIMEOUT_MS || 5000)
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
  });

  return pool;
};

const query = (text, params) => getPool().query(text, params);

const withTransaction = async (callback) => {
  const client = await getPool().connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const pingPostgres = async () => {
  const result = await query('SELECT NOW() AS now');
  return result.rows[0];
};

const closePool = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};

module.exports = {
  getPool,
  query,
  withTransaction,
  pingPostgres,
  closePool
};
