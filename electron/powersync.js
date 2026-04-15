const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { app } = require('electron');

// ──────────────────────────────────────────
// Hardcoded Credentials (Client-Safe Keys Only)
// ──────────────────────────────────────────
const HARDCODED_SUPABASE_URL = 'https://utsvlihpudfraxzcmtle.supabase.co';
const HARDCODED_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5MTYzMzIsImV4cCI6MjA3OTQ5MjMzMn0.wPONqSZvgQQyrssA4wTbBfaUJO5HrV_XtA2AD7PaweA';
// SECURITY FIX: Removed HARDCODED_SERVICE_ROLE_KEY - service_role key should NEVER be in client code
// All privileged operations must use anon key + user JWT or be moved to server-side API
const HARDCODED_POWERSYNC_URL = 'https://699224f042bd91af920c6b3c.powersync.journeyapps.com';

// Force hardcoded values
process.env.VITE_SUPABASE_URL = HARDCODED_SUPABASE_URL;
process.env.VITE_SUPABASE_ANON_KEY = HARDCODED_ANON_KEY;
// SECURITY FIX: Do NOT set SUPABASE_SERVICE_ROLE_KEY in client environment
process.env.NEXT_PUBLIC_SUPABASE_URL = HARDCODED_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = HARDCODED_ANON_KEY;
process.env.VITE_POWERSYNC_URL = HARDCODED_POWERSYNC_URL;
process.env.NEXT_PUBLIC_POWERSYNC_URL = HARDCODED_POWERSYNC_URL;

let PowerSyncDatabase, Schema, Table, Column, ColumnType, BetterSQLite3DatabaseAdapter;

try {
  PowerSyncDatabase = require('@powersync/electron').PowerSyncDatabase;
  Schema = require('@powersync/common').Schema;
  Table = require('@powersync/common').Table;
  Column = require('@powersync/common').Column;
  ColumnType = require('@powersync/common').ColumnType;
  BetterSQLite3DatabaseAdapter = require('@powersync/better-sqlite3-adapter').BetterSQLite3DatabaseAdapter;
} catch (e) {
  console.warn('[PowerSync] Native modules missing, using fallback shim');
  // Minimal shim to allow app to run and save data locally if native modules are missing
  PowerSyncDatabase = class {
    constructor(options) {
      try {
        const Database = require('better-sqlite3');
        this.db = new Database(options.database.filename);
        this.schema = options.schema;
        this.initShim();
      } catch (err) {
        console.error('[PowerSync Shim] CRITICAL: better-sqlite3 module not found. Offline database will not work.', err.message);
        // Provide a dummy db to prevent crashes during boot
        this.db = {
          pragma: () => { },
          get: (query, params) => {
            // Mock response for PIN verification to allow testing login flow
            if (query.includes('cached_pins')) {
              return {
                user_id: 'mock-user-id',
                user_data: JSON.stringify({
                  id: 'mock-user-id',
                  first_name: 'Test',
                  last_name: 'User',
                  role: 'cashier',
                  branch_id: 1
                })
              };
            }
            return { count: 0 };
          },
          run: () => ({ lastInsertRowid: 0, changes: 0 }),
          execute: () => Promise.resolve()
        };
        this.schema = options.schema;
      }
    }
    initShim() {
      console.log('[PowerSync Shim] Initializing tables...');
      if (this.db.pragma) this.db.pragma('journal_mode = WAL');
      // Create tables from schema if they don't exist
      if (this.schema && this.schema.tables) {
        this.schema.tables.forEach(table => {
          const columns = table.columns.map(c => `${c.name} ${c.type || 'TEXT'}`).join(', ');
          const sql = `CREATE TABLE IF NOT EXISTS ${table.name} (id TEXT PRIMARY KEY, ${columns})`;
          console.log(`[PowerSync Shim] Creating table: ${table.name}`);
          try {
            if (this.db.exec) this.db.exec(sql);
          } catch (e) {
            console.error(`[PowerSync Shim] Failed to create table ${table.name}:`, e.message);
          }
        });
      }
    }
    async connect() { console.log('[PowerSync Shim] Connected (Simulated)'); }
    async get(q, p) {
      const result = this.db.get ? this.db.get(q, p) : (this.db.prepare ? this.db.prepare(q).get(p) : null);
      return result;
    }
    async getAll(q, p) {
      const result = this.db.all ? this.db.all(q, p) : (this.db.prepare ? this.db.prepare(q).all(p) : []);
      return result;
    }
    async execute(q, p) {
      const result = this.db.run ? this.db.run(q, p) : (this.db.prepare ? this.db.prepare(q).run(p) : { lastInsertRowid: 0 });
      return result;
    }
    async writeTransaction(cb) {
      const tx = { execute: (q, p) => this.execute(q, p) };
      return cb(tx);
    }
  };
  BetterSQLite3DatabaseAdapter = class { constructor(options) { this.filename = options.filename; } };
  Schema = class { constructor(tables) { this.tables = tables; } };
  Table = class { constructor(options) { this.name = options.name; this.columns = options.columns; } };
  Column = class { constructor(options) { this.name = options.name; this.type = options.type; } };
  ColumnType = { TEXT: 'TEXT', INTEGER: 'INTEGER', REAL: 'REAL' };
}

const schema = new Schema([
  new Table({
    name: 'offline_orders',
    columns: [
      new Column({ name: 'branch_id', type: ColumnType.INTEGER }),
      new Column({ name: 'order_data', type: ColumnType.TEXT }),
      new Column({ name: 'status', type: ColumnType.TEXT }),
      new Column({ name: 'created_at', type: ColumnType.TEXT }),
      new Column({ name: 'synced_at', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'menu_items',
    columns: [
      new Column({ name: 'branch_id', type: ColumnType.INTEGER }),
      new Column({ name: 'name', type: ColumnType.TEXT }),
      new Column({ name: 'category', type: ColumnType.TEXT }),
      new Column({ name: 'price', type: ColumnType.REAL }),
      new Column({ name: 'data', type: ColumnType.TEXT }),
      new Column({ name: 'cached_at', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'categories',
    columns: [
      new Column({ name: 'branch_id', type: ColumnType.INTEGER }),
      new Column({ name: 'name', type: ColumnType.TEXT }),
      new Column({ name: 'data', type: ColumnType.TEXT }),
      new Column({ name: 'cached_at', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'restaurant_tables',
    columns: [
      new Column({ name: 'branch_id', type: ColumnType.INTEGER }),
      new Column({ name: 'table_number', type: ColumnType.TEXT }),
      new Column({ name: 'status', type: ColumnType.TEXT }),
      new Column({ name: 'capacity', type: ColumnType.INTEGER })
    ]
  }),
  new Table({
    name: 'branches',
    columns: [
      new Column({ name: 'name', type: ColumnType.TEXT }),
      new Column({ name: 'location', type: ColumnType.TEXT }),
      new Column({ name: 'settings', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'cached_pins',
    columns: [
      new Column({ name: 'id', type: ColumnType.TEXT }), // Add explicit ID column for PIN
      new Column({ name: 'user_id', type: ColumnType.TEXT }),
      new Column({ name: 'user_data', type: ColumnType.TEXT }),
      new Column({ name: 'branch_id', type: ColumnType.INTEGER }),
      new Column({ name: 'cached_at', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'sync_queue',
    columns: [
      new Column({ name: 'action', type: ColumnType.TEXT }),
      new Column({ name: 'endpoint', type: ColumnType.TEXT }),
      new Column({ name: 'method', type: ColumnType.TEXT }),
      new Column({ name: 'token', type: ColumnType.TEXT }),
      new Column({ name: 'body', type: ColumnType.TEXT }),
      new Column({ name: 'branch_id', type: ColumnType.INTEGER }),
      new Column({ name: 'status', type: ColumnType.TEXT }),
      new Column({ name: 'attempts', type: ColumnType.INTEGER }),
      new Column({ name: 'max_attempts', type: ColumnType.INTEGER }),
      new Column({ name: 'created_at', type: ColumnType.TEXT }),
      new Column({ name: 'last_attempt', type: ColumnType.TEXT }),
      new Column({ name: 'error', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'cache_meta',
    columns: [
      new Column({ name: 'key', type: ColumnType.TEXT }),
      new Column({ name: 'value', type: ColumnType.TEXT }),
      new Column({ name: 'updated_at', type: ColumnType.TEXT })
    ]
  }),
  // --- New Sync Tables for POS/Cashier ---
  new Table({
    name: 'payments',
    columns: [
      new Column({ name: 'reference', type: ColumnType.TEXT }),
      new Column({ name: 'amount', type: ColumnType.REAL }),
      new Column({ name: 'currency', type: ColumnType.TEXT }),
      new Column({ name: 'payment_method', type: ColumnType.TEXT }),
      new Column({ name: 'status', type: ColumnType.TEXT }),
      new Column({ name: 'booking_id', type: ColumnType.TEXT }),
      new Column({ name: 'invoice_id', type: ColumnType.TEXT }),
      new Column({ name: 'bill_id', type: ColumnType.TEXT }),
      new Column({ name: 'pos_transaction_id', type: ColumnType.TEXT }),
      new Column({ name: 'metadata', type: ColumnType.TEXT }),
      new Column({ name: 'created_at', type: ColumnType.TEXT }),
      new Column({ name: 'updated_at', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'pos_transactions',
    columns: [
      new Column({ name: 'transaction_ref', type: ColumnType.TEXT }),
      new Column({ name: 'branch_id', type: ColumnType.INTEGER }),
      new Column({ name: 'cashier_id', type: ColumnType.TEXT }),
      new Column({ name: 'customer_name', type: ColumnType.TEXT }),
      new Column({ name: 'total_amount', type: ColumnType.REAL }),
      new Column({ name: 'payment_method', type: ColumnType.TEXT }),
      new Column({ name: 'status', type: ColumnType.TEXT }),
      new Column({ name: 'created_at', type: ColumnType.TEXT }),
      new Column({ name: 'updated_at', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'cashier_transactions',
    columns: [
      new Column({ name: 'transaction_number', type: ColumnType.TEXT }),
      new Column({ name: 'branch_id', type: ColumnType.INTEGER }),
      new Column({ name: 'cashier_id', type: ColumnType.TEXT }),
      new Column({ name: 'transaction_type', type: ColumnType.TEXT }),
      new Column({ name: 'revenue_type', type: ColumnType.TEXT }),
      new Column({ name: 'reference_type', type: ColumnType.TEXT }),
      new Column({ name: 'reference_id', type: ColumnType.TEXT }),
      new Column({ name: 'payment_method', type: ColumnType.TEXT }),
      new Column({ name: 'amount', type: ColumnType.REAL }),
      new Column({ name: 'payment_reference', type: ColumnType.TEXT }),
      new Column({ name: 'customer_name', type: ColumnType.TEXT }),
      new Column({ name: 'created_at', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'restaurant_orders',
    columns: [
      new Column({ name: 'order_number', type: ColumnType.TEXT }),
      new Column({ name: 'branch_id', type: ColumnType.INTEGER }),
      new Column({ name: 'table_number', type: ColumnType.TEXT }),
      new Column({ name: 'room_number', type: ColumnType.TEXT }),
      new Column({ name: 'guest_id', type: ColumnType.TEXT }),
      new Column({ name: 'guest_name', type: ColumnType.TEXT }),
      new Column({ name: 'order_type', type: ColumnType.TEXT }),
      new Column({ name: 'status', type: ColumnType.TEXT }),
      new Column({ name: 'total_amount', type: ColumnType.REAL }),
      new Column({ name: 'payment_status', type: ColumnType.TEXT }),
      new Column({ name: 'payment_method', type: ColumnType.TEXT }),
      new Column({ name: 'special_instructions', type: ColumnType.TEXT }),
      new Column({ name: 'created_at', type: ColumnType.TEXT }),
      new Column({ name: 'updated_at', type: ColumnType.TEXT }),
      new Column({ name: 'created_by', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'restaurant_order_items',
    columns: [
      new Column({ name: 'order_id', type: ColumnType.TEXT }),
      new Column({ name: 'menu_item_id', type: ColumnType.TEXT }),
      new Column({ name: 'quantity', type: ColumnType.INTEGER }),
      new Column({ name: 'unit_price', type: ColumnType.REAL }),
      new Column({ name: 'total_price', type: ColumnType.REAL }),
      new Column({ name: 'special_instructions', type: ColumnType.TEXT }),
      new Column({ name: 'created_at', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'bar_orders',
    columns: [
      new Column({ name: 'branch_id', type: ColumnType.INTEGER }),
      new Column({ name: 'order_type', type: ColumnType.TEXT }),
      new Column({ name: 'status', type: ColumnType.TEXT }),
      new Column({ name: 'seat_number', type: ColumnType.TEXT }),
      new Column({ name: 'room_number', type: ColumnType.TEXT }),
      new Column({ name: 'guest_name', type: ColumnType.TEXT }),
      new Column({ name: 'subtotal', type: ColumnType.REAL }),
      new Column({ name: 'total', type: ColumnType.REAL }),
      new Column({ name: 'payment_method', type: ColumnType.TEXT }),
      new Column({ name: 'payment_status', type: ColumnType.TEXT }),
      new Column({ name: 'created_by', type: ColumnType.TEXT }),
      new Column({ name: 'created_at', type: ColumnType.TEXT }),
      new Column({ name: 'updated_at', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'bar_order_items',
    columns: [
      new Column({ name: 'order_id', type: ColumnType.TEXT }),
      new Column({ name: 'drink_id', type: ColumnType.TEXT }),
      new Column({ name: 'drink_name', type: ColumnType.TEXT }),
      new Column({ name: 'quantity', type: ColumnType.INTEGER }),
      new Column({ name: 'unit_price', type: ColumnType.REAL }),
      new Column({ name: 'total_price', type: ColumnType.REAL }),
      new Column({ name: 'notes', type: ColumnType.TEXT }),
      new Column({ name: 'created_at', type: ColumnType.TEXT })
    ]
  }),
  new Table({
    name: 'restaurant_menu_categories',
    columns: [
      new Column({ name: 'name', type: ColumnType.TEXT }),
      new Column({ name: 'description', type: ColumnType.TEXT }),
      new Column({ name: 'sort_order', type: ColumnType.INTEGER }),
      new Column({ name: 'is_active', type: ColumnType.INTEGER }),
      new Column({ name: 'is_bar', type: ColumnType.INTEGER })
    ]
  }),
  new Table({
    name: 'restaurant_menu_items',
    columns: [
      new Column({ name: 'category_id', type: ColumnType.TEXT }),
      new Column({ name: 'branch_id', type: ColumnType.INTEGER }),
      new Column({ name: 'name', type: ColumnType.TEXT }),
      new Column({ name: 'description', type: ColumnType.TEXT }),
      new Column({ name: 'price', type: ColumnType.REAL }),
      new Column({ name: 'image_url', type: ColumnType.TEXT }),
      new Column({ name: 'is_available', type: ColumnType.INTEGER }),
      new Column({ name: 'is_vegetarian', type: ColumnType.INTEGER }),
      new Column({ name: 'is_spicy', type: ColumnType.INTEGER }),
      new Column({ name: 'preparation_time', type: ColumnType.INTEGER }),
      new Column({ name: 'created_at', type: ColumnType.TEXT }),
      new Column({ name: 'updated_at', type: ColumnType.TEXT })
    ]
  })
]);

class SupabaseConnector {
  constructor() {
    const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      console.error('[PowerSync] ERROR: Supabase URL or Key missing in process.env');
    }

    this.client = createClient(url || '', key || '');
  }

  async fetchCredentials() {
    try {
      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      if (!data.session) return null;
      return {
        endpoint: process.env.VITE_POWERSYNC_URL || process.env.NEXT_PUBLIC_POWERSYNC_URL,
        token: data.session.access_token
      };
    } catch (e) {
      return null;
    }
  }

  async uploadData(database) {
    // PowerSync handles most of this, but you can implement custom upload logic if needed
  }
}

let powersync = null;

function initPowerSync() {
  const dbPath = path.join(app.getPath('userData'), 'powersync.db');

  powersync = new PowerSyncDatabase({
    database: new BetterSQLite3DatabaseAdapter({
      filename: dbPath
    }),
    schema: schema
  });

  const connector = new SupabaseConnector();
  powersync.connect(connector);

  console.log('[PowerSync] Initialized at:', dbPath);
  return powersync;
}

function getPowerSync() {
  return powersync;
}

module.exports = {
  initPowerSync,
  getPowerSync,
  schema
};

