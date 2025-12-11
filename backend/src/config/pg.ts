import { Pool, QueryResult } from 'pg';
import { logger } from '../utils/logger';

// Flag to track if PostgreSQL is available
let pgAvailable = false;  // Start as false - will be set to true on successful connection
let poolInitialized = false;

// Lazy pool initialization - don't create until needed
let _pool: Pool | null = null;

// Mock pool for when PostgreSQL is unavailable
const mockPool = {
  query: async (): Promise<QueryResult<any>> => {
    return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
  },
  connect: async () => {
    throw new Error('PostgreSQL is not available');
  },
  end: async () => {},
  on: () => mockPool,
  off: () => mockPool,
  once: () => mockPool,
  emit: () => false,
  totalCount: 0,
  idleCount: 0,
  waitingCount: 0
};

// Check if we should skip PostgreSQL (for development without DB)
const SKIP_PG = process.env.SKIP_POSTGRES === 'true';

// Initialize pool with error handling
const initPool = (): Pool => {
  if (_pool) return _pool;
  
  // Skip PostgreSQL if explicitly disabled
  if (SKIP_PG) {
    console.warn('PostgreSQL disabled via SKIP_POSTGRES - using mock pool');
    poolInitialized = true;
    return mockPool as unknown as Pool;
  }
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL not set - PostgreSQL features will be unavailable');
    poolInitialized = true;
    return mockPool as unknown as Pool;
  }
  
  try {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      },
      // Connection pool settings to handle Supabase connection pooler
      max: 10,                    // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,   // Close idle clients after 30 seconds
      connectionTimeoutMillis: 30000, // Increased timeout for slow connections
      allowExitOnIdle: true       // Allow the pool to close all connections when idle
    });

    // Handle pool errors gracefully - don't crash the app
    // This is critical - without this handler, pool errors will crash the process
    _pool.on('error', (err) => {
      // Log but don't crash - the pool will recover automatically
      console.error(']: Database connection error:', err);
      // Mark PostgreSQL as unavailable but don't crash
      pgAvailable = false;
    });

    // Handle connection events for debugging
    _pool.on('connect', () => {
      pgAvailable = true;
      logger.debug('New client connected to database pool');
    });

    _pool.on('remove', () => {
      logger.debug('Client removed from database pool');
    });
    
    poolInitialized = true;
    return _pool;
  } catch (error) {
    console.error('Failed to create PostgreSQL pool:', error);
    poolInitialized = true;
    return mockPool as unknown as Pool;
  }
};

// Get or create the pool
const getPool = (): Pool => {
  if (SKIP_PG || (!pgAvailable && poolInitialized)) {
    return mockPool as unknown as Pool;
  }
  return initPool();
};

// Create a proxy pool object that lazily initializes the real pool
const pool = new Proxy({} as Pool, {
  get(target, prop) {
    if (!pgAvailable) {
      const value = (mockPool as any)[prop];
      if (typeof value === 'function') {
        return value.bind(mockPool);
      }
      return value;
    }
    const realPool = getPool();
    const value = (realPool as any)[prop];
    if (typeof value === 'function') {
      return value.bind(realPool);
    }
    return value;
  }
});

// Test connection function - doesn't block startup
export const testConnection = async (): Promise<boolean> => {
  if (!pgAvailable) {
    return false;
  }
  try {
    const client = await getPool().connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('PostgreSQL database connection verified');
    return true;
  } catch (error) {
    logger.warn('PostgreSQL database connection failed - some features may be unavailable');
    pgAvailable = false;
    return false;
  }
};

// Safe query wrapper that handles connection errors gracefully
export const safeQuery = async (
  queryText: string, 
  params?: any[]
): Promise<{ rows: any[], error: Error | null }> => {
  if (!pgAvailable) {
    return { rows: [], error: new Error('PostgreSQL is not available') };
  }
  try {
    const result = await getPool().query(queryText, params);
    return { rows: result.rows, error: null };
  } catch (error) {
    logger.warn('Database query failed:', error instanceof Error ? error.message : 'Unknown error');
    return { rows: [], error: error instanceof Error ? error : new Error('Unknown error') };
  }
};

// Check if PostgreSQL is available
export const isPgAvailable = (): boolean => pgAvailable;

export { pool };
