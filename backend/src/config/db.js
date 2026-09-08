import pg from "pg";
import { config } from "./env.js";

const { Pool } = pg;

/**
 * Shared PostgreSQL connection pool instance.
 * Reusable across repository and service layers.
 */
let poolInstance = null;

/**
 * Creates or retrieves the singleton PostgreSQL connection pool.
 *
 * @returns {pg.Pool}
 */
export const getPool = () => {
  if (!poolInstance) {
    const poolConfig = {
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
      max: config.dbMaxConnections,
      idleTimeoutMillis: config.dbIdleTimeoutMillis,
      connectionTimeoutMillis: config.dbConnectionTimeoutMillis
    };

    if (config.dbSsl) {
      poolConfig.ssl = { rejectUnauthorized: false };
    }

    poolInstance = new Pool(poolConfig);

    poolInstance.on("error", (err) => {
      // Idle client encountered an error; log sanitized error without sensitive credentials
      console.error("[Database Pool] Unexpected error on idle PostgreSQL client:", err.message);
    });
  }

  return poolInstance;
};

/**
 * Singleton pool export
 */
export const pool = getPool();

/**
 * Executes a parameterized SQL query using the shared connection pool.
 *
 * @param {string} text - Parameterized SQL query string.
 * @param {Array<any>} [params] - Query parameter values.
 * @returns {Promise<pg.QueryResult>}
 */
export const query = async (text, params = []) => {
  const pool = getPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.nodeEnv === "development" && duration > 1000) {
      console.warn(`[Database] Slow query (${duration}ms):`, text.substring(0, 100));
    }
    return res;
  } catch (error) {
    console.error("[Database] Query execution error:", error.message);
    throw error;
  }
};

/**
 * Acquires a client from the pool for transactions.
 *
 * @returns {Promise<pg.PoolClient>}
 */
export const getClient = async () => {
  const pool = getPool();
  return await pool.connect();
};

/**
 * Gracefully shuts down the database connection pool.
 *
 * @returns {Promise<void>}
 */
export const closePool = async () => {
  if (poolInstance) {
    try {
      await poolInstance.end();
    } catch (err) {
      console.error("[Database] Error closing connection pool:", err.message);
    } finally {
      poolInstance = null;
    }
  }
};

/**
 * Probes database connectivity and returns a status summary.
 *
 * @returns {Promise<{ ok: boolean, host: string, port: number, database: string, error?: string }>}
 */
export const testConnection = async () => {
  try {
    const res = await query("SELECT NOW() as current_time, current_database() as db_name, version() as version;");
    return {
      ok: true,
      host: config.dbHost,
      port: config.dbPort,
      database: res.rows[0]?.db_name || config.dbName,
      serverTime: res.rows[0]?.current_time,
      version: res.rows[0]?.version
    };
  } catch (error) {
    return {
      ok: false,
      host: config.dbHost,
      port: config.dbPort,
      database: config.dbName,
      error: error.message
    };
  }
};
