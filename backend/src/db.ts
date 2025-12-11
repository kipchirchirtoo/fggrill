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
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // Increased timeout
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
  console.warn(']: PostgreSQL disabled or DATABASE_URL not set - using mock database');
}

// Export query function for use in routes
export default {
  query: async (text: string, params?: any[]): Promise<QueryResult<any>> => {
    if (!pool || !dbAvailable) {
      console.error('Database not available! Pool:', !!pool, 'dbAvailable:', dbAvailable);
      throw new Error('Database connection not available');
    }
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query failed:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Query:', text);
      console.error('Params:', params);
      throw error; // Re-throw instead of returning mock data
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
