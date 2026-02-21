/**
 * Direct SQLite Database for Offline POS
 * 
 * Simplified database implementation using better-sqlite3 directly
 * instead of PowerSync (which requires additional dependencies).
 * 
 * Handles:
 * - PIN caching for offline authentication
 * - Menu item caching
 * - Sync queue for offline orders
 * - Restaurant orders and transactions
 */

const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db = null;

/**
 * Initialize the database
 */
function initDatabase() {
    const dbPath = path.join(app.getPath('userData'), 'pos-offline.db');
    console.log('[Database] Initializing at:', dbPath);

    db = new Database(dbPath);
    
    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL');
    
    // Create tables
    createTables();
    
    console.log('[Database] Initialized successfully');
    return db;
}

/**
 * Create all required tables
 */
function createTables() {
    // Cached PINs for offline authentication
    db.exec(`
        CREATE TABLE IF NOT EXISTS cached_pins (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            user_data TEXT NOT NULL,
            branch_id INTEGER,
            cached_at TEXT NOT NULL
        )
    `);

    // Menu items cache
    db.exec(`
        CREATE TABLE IF NOT EXISTS menu_items (
            id TEXT PRIMARY KEY,
            branch_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            category TEXT,
            price REAL,
            data TEXT NOT NULL,
            cached_at TEXT NOT NULL
        )
    `);

    // Sync queue for offline operations
    db.exec(`
        CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            method TEXT NOT NULL,
            body TEXT,
            branch_id INTEGER,
            token TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 10,
            created_at TEXT NOT NULL,
            last_attempt TEXT,
            error TEXT
        )
    `);

    // Offline orders
    db.exec(`
        CREATE TABLE IF NOT EXISTS offline_orders (
            id TEXT PRIMARY KEY,
            branch_id INTEGER NOT NULL,
            order_data TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            synced_at TEXT
        )
    `);

    // Restaurant orders
    db.exec(`
        CREATE TABLE IF NOT EXISTS restaurant_orders (
            id TEXT PRIMARY KEY,
            order_number TEXT,
            branch_id INTEGER,
            table_number TEXT,
            room_number TEXT,
            guest_id TEXT,
            guest_name TEXT,
            order_type TEXT,
            status TEXT,
            total_amount REAL,
            payment_status TEXT,
            payment_method TEXT,
            special_instructions TEXT,
            waiter_id TEXT,
            waiter_name TEXT,
            created_at TEXT,
            updated_at TEXT,
            created_by TEXT
        )
    `);

    // Restaurant order items
    db.exec(`
        CREATE TABLE IF NOT EXISTS restaurant_order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            menu_item_id TEXT,
            quantity INTEGER,
            unit_price REAL,
            total_price REAL,
            special_instructions TEXT,
            created_at TEXT,
            FOREIGN KEY (order_id) REFERENCES restaurant_orders(id)
        )
    `);

    // Bar orders
    db.exec(`
        CREATE TABLE IF NOT EXISTS bar_orders (
            id TEXT PRIMARY KEY,
            branch_id INTEGER,
            order_type TEXT,
            status TEXT,
            seat_number TEXT,
            room_number TEXT,
            guest_name TEXT,
            subtotal REAL,
            total REAL,
            payment_method TEXT,
            payment_status TEXT,
            created_by TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    `);

    // Bar order items
    db.exec(`
        CREATE TABLE IF NOT EXISTS bar_order_items (
            id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            drink_id TEXT,
            drink_name TEXT,
            quantity INTEGER,
            unit_price REAL,
            total_price REAL,
            notes TEXT,
            created_at TEXT,
            FOREIGN KEY (order_id) REFERENCES bar_orders(id)
        )
    `);

    // Cashier transactions
    db.exec(`
        CREATE TABLE IF NOT EXISTS cashier_transactions (
            id TEXT PRIMARY KEY,
            transaction_number TEXT,
            branch_id INTEGER,
            cashier_id TEXT,
            transaction_type TEXT,
            revenue_type TEXT,
            reference_type TEXT,
            reference_id TEXT,
            payment_method TEXT,
            amount REAL,
            payment_reference TEXT,
            customer_name TEXT,
            created_at TEXT
        )
    `);

    // POS transactions
    db.exec(`
        CREATE TABLE IF NOT EXISTS pos_transactions (
            id TEXT PRIMARY KEY,
            transaction_ref TEXT,
            branch_id INTEGER,
            cashier_id TEXT,
            customer_name TEXT,
            total_amount REAL,
            payment_method TEXT,
            status TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    `);

    // Payments
    db.exec(`
        CREATE TABLE IF NOT EXISTS payments (
            id TEXT PRIMARY KEY,
            reference TEXT,
            amount REAL,
            currency TEXT,
            payment_method TEXT,
            status TEXT,
            booking_id TEXT,
            invoice_id TEXT,
            bill_id TEXT,
            pos_transaction_id TEXT,
            metadata TEXT,
            created_at TEXT,
            updated_at TEXT
        )
    `);

    // Restaurant menu categories
    db.exec(`
        CREATE TABLE IF NOT EXISTS restaurant_menu_categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            sort_order INTEGER,
            is_active INTEGER DEFAULT 1,
            is_bar INTEGER DEFAULT 0
        )
    `);

    // Restaurant menu items
    db.exec(`
        CREATE TABLE IF NOT EXISTS restaurant_menu_items (
            id TEXT PRIMARY KEY,
            category_id TEXT,
            branch_id INTEGER,
            name TEXT NOT NULL,
            description TEXT,
            price REAL,
            image_url TEXT,
            is_available INTEGER DEFAULT 1,
            is_vegetarian INTEGER DEFAULT 0,
            is_spicy INTEGER DEFAULT 0,
            preparation_time INTEGER,
            created_at TEXT,
            updated_at TEXT,
            FOREIGN KEY (category_id) REFERENCES restaurant_menu_categories(id)
        )
    `);

    // Branches
    db.exec(`
        CREATE TABLE IF NOT EXISTS branches (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            location TEXT,
            settings TEXT
        )
    `);

    // Restaurant tables
    db.exec(`
        CREATE TABLE IF NOT EXISTS restaurant_tables (
            id TEXT PRIMARY KEY,
            branch_id INTEGER,
            table_number TEXT,
            status TEXT,
            capacity INTEGER
        )
    `);

    // Cache metadata
    db.exec(`
        CREATE TABLE IF NOT EXISTS cache_meta (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at TEXT
        )
    `);

    console.log('[Database] All tables created/verified');
}

/**
 * Get the database instance
 */
function getDatabase() {
    return db;
}

/**
 * Execute a query and return a single row
 */
function get(query, params = []) {
    try {
        const stmt = db.prepare(query);
        return stmt.get(...params);
    } catch (error) {
        console.error('[Database] Get error:', error.message);
        throw error;
    }
}

/**
 * Execute a query and return all rows
 */
function getAll(query, params = []) {
    try {
        const stmt = db.prepare(query);
        return stmt.all(...params);
    } catch (error) {
        console.error('[Database] GetAll error:', error.message);
        throw error;
    }
}

/**
 * Execute a query (INSERT, UPDATE, DELETE)
 */
function execute(query, params = []) {
    try {
        const stmt = db.prepare(query);
        return stmt.run(...params);
    } catch (error) {
        console.error('[Database] Execute error:', error.message);
        throw error;
    }
}

/**
 * Execute a transaction
 */
function transaction(callback) {
    const txn = db.transaction(callback);
    return txn();
}

/**
 * Close the database
 */
function close() {
    if (db) {
        db.close();
        db = null;
        console.log('[Database] Closed');
    }
}

module.exports = {
    initDatabase,
    getDatabase,
    get,
    getAll,
    execute,
    transaction,
    close
};
