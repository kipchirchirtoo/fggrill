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
    max: 10, // Reduced from 20 to be more conservative with pooler
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000, // Increased from 5000 to be more tolerant of pooler startup
    maxUses: 7500, // Close connections after some use
  });

  // Handle pool errors gracefully
  pool.on('error', (err) => {
    console.error(']: Database pool error:', err.message);
    dbAvailable = false;
  });

  // Test database connection (non-blocking)
  pool.connect()
    .then(client => {
      console.log(']: Database connection established');
      dbAvailable = true;
      client.release();
    })
    .catch(err => {
      console.warn(']: Database connection failed - some features may be unavailable:', err.message);
      dbAvailable = false;
      // Don't exit - allow server to run without database
    });
} else {
  // console.warn(']: PostgreSQL disabled or DATABASE_URL not set - using mock database');
}

// Export query function for use in routes
export default {
  query: async (text: string, params?: any[]): Promise<QueryResult<any>> => {
    if (!pool) {
      throw new Error('Database pool not initialized');
    }

    // We try to query even if dbAvailable is false, as it might have recovered.
    // The 8s timeout below will prevent long hangs.
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timed out')), 8000);
    });

    try {
      const queryPromise = pool.query(text, params);
      const result = await Promise.race([queryPromise, timeoutPromise]) as QueryResult<any>;

      // If successful, ensure dbAvailable is true
      dbAvailable = true;
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Database query failed:', errorMessage);

      // If it's a connection/timeout error, mark DB as unavailable
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
    return pool.connect();
  },
  isAvailable: () => dbAvailable
};
