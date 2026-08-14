import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Flag to track if database is available
let dbAvailable = false;

// Check if we should skip PostgreSQL
const SKIP_PG = process.env.SKIP_POSTGRES === 'true';

// Mock pool for when PostgreSQL is unavailable
const mockQuery = async (): Promise<QueryResult<any>> => {
  return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
};

// Configure PostgreSQL connection pool (only if not skipped)
let pool: Pool | null = null;

if (!SKIP_PG && process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10, // Strict pool cap for Supabase pooler
    idleTimeoutMillis: 5000, // Return idle connections to Supavisor quickly
    connectionTimeoutMillis: 10000,
    maxUses: 1000, // Recycle connections periodically to prevent stale state
  });

  // Automatically enforce strict query and session timeouts on every checked-out connection
  pool.on('connect', (client) => {
    client.query(`
      SET statement_timeout = '30000';
      SET idle_in_transaction_session_timeout = '20000';
      SET lock_timeout = '10000';
    `).catch((err) => {
      console.warn('Could not set connection timeouts:', err.message);
    });
  });

  // Handle pool errors gracefully
  pool.on('error', (err) => {
    console.error('Database pool error:', err.message);
    dbAvailable = false;
  });

  // Test database connection (non-blocking)
  pool.connect()
    .then(client => {
      console.log('Database connection established');
      dbAvailable = true;
      client.release();
    })
    .catch(err => {
      console.warn('Database connection failed - some features may be unavailable:', err.message);
      dbAvailable = false;
    });
}

// Export query function for use in routes
export default {
  query: async (text: string, params?: any[]): Promise<QueryResult<any>> => {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timed out after 30s')), 30000);
    });

    try {
      const queryPromise = pool.query(text, params);
      const result = await Promise.race([queryPromise, timeoutPromise]) as QueryResult<any>;

      dbAvailable = true;
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Database query failed:', errorMessage);

      if (errorMessage.includes('timeout') || errorMessage.includes('connection') || errorMessage.includes('terminated')) {
        dbAvailable = false;
      }

      throw error;
    }
  },
  getClient: async () => {
    if (!pool) {
      throw new Error('Database not available');
    }
    const client = await pool.connect();
    
    // Safety tracker: warn if client is checked out and not released within 25 seconds
    const stack = new Error().stack;
    const leakTimer = setTimeout(() => {
      console.warn('⚠️ [DB LEAK WARNING] A database client has been checked out for > 25s without release. Caller stack:\n', stack);
    }, 25000);

    const originalRelease = client.release.bind(client);
    client.release = (err?: Error | boolean) => {
      clearTimeout(leakTimer);
      return originalRelease(err as any);
    };

    return client;
  },
  isAvailable: () => dbAvailable
};
