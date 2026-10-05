import dns from 'dns';
import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

dotenv.config();

// Flag to track if database is available
let dbAvailable = false;

// Check if we should skip PostgreSQL
const SKIP_PG = process.env.SKIP_POSTGRES === 'true';

// Mock pool for when PostgreSQL is unavailable
const mockQuery = async (): Promise<QueryResult<any>> => {
  return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
};

// Configure PostgreSQL connection pool
let pool: Pool | null = null;

function getPool(): Pool | null {
  if (pool) return pool;
  
  const connStr = process.env.DATABASE_URL || process.env.DATABASE_URL_DEV_DEMO;
  if (!connStr) return null;

  pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    max: 10, // Strict pool cap for Supabase pooler
    idleTimeoutMillis: 5000, // Return idle connections to Supavisor quickly
    connectionTimeoutMillis: 10000,
    maxUses: 1000, // Recycle connections periodically to prevent stale state
  });

  pool.on('error', (err) => {
    console.error('Database pool error:', err.message);
    dbAvailable = false;
  });

  return pool;
}

// Export query function for use in routes
export default {
  query: async (text: string, params?: any[]): Promise<QueryResult<any>> => {
    const activePool = getPool();
    if (!activePool) {
      throw new Error('Database pool not initialized - check DATABASE_URL');
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timed out after 30s')), 30000);
    });

    try {
      const queryPromise = activePool.query(text, params);
      const result = await Promise.race([queryPromise, timeoutPromise]) as QueryResult<any>;

      dbAvailable = true;
      return result;
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Self-healing: if connection was placed in read-only transaction state, reset and retry once
      if (
        errorMessage.includes('read-only transaction') ||
        errorMessage.includes('cannot execute INSERT in a read-only transaction') ||
        (error && error.code === '25006')
      ) {
        console.warn('⚠️ Detected read-only transaction error. Resetting transaction flags and retrying...');
        let recoveryClient: any = null;
        try {
          recoveryClient = await activePool.connect();
          await recoveryClient.query('ROLLBACK; SET default_transaction_read_only = off; SET transaction_read_only = off;');
          const retryResult = await recoveryClient.query(text, params);
          dbAvailable = true;
          return retryResult;
        } catch (retryErr: any) {
          console.error('Recovery query retry failed:', retryErr?.message || retryErr);
        } finally {
          if (recoveryClient) {
            try { recoveryClient.release(); } catch (_) {}
          }
        }
      }

      console.error('Database query failed:', errorMessage);

      if (errorMessage.includes('timeout') || errorMessage.includes('connection') || errorMessage.includes('terminated')) {
        dbAvailable = false;
      }

      throw error;
    }
  },
  getClient: async () => {
    const activePool = getPool();
    if (!activePool) {
      throw new Error('Database not available - check DATABASE_URL');
    }
    const client = await activePool.connect();
    
    // Safety tracker: warn if client is checked out and not released within 25 seconds
    const stack = new Error().stack;
    const leakTimer = setTimeout(() => {
      console.warn('⚠️ [DB LEAK WARNING] A database client has been checked out for > 25s without release. Caller stack:\n', stack);
    }, 25000);

    let released = false;
    const originalRelease = client.release.bind(client);
    client.release = (err?: Error | boolean) => {
      if (released) return;
      released = true;
      clearTimeout(leakTimer);
      // Guarantee rollback and reset read-only flag on release so returning client to pool is always clean
      client.query('ROLLBACK; SET default_transaction_read_only = off; SET transaction_read_only = off;')
        .catch(() => {})
        .finally(() => {
          originalRelease(err as any);
        });
    };

    return client;
  },
  isAvailable: () => dbAvailable
};
