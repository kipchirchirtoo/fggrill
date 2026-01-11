const DB_NAME = 'fggrill_pos_db';
const DB_VERSION = 2; // Incremented for new stores

const STORES = {
    TRANSACTIONS: 'offline_transactions',
    PRODUCTS: 'products',
    CUSTOMERS: 'customers',
    USERS: 'users'
};

export interface OfflineTransaction {
    id: string;
    items: any[];
    total_amount: number;
    customer_name?: string;
    customer_phone?: string;
    payment_method?: string;
    created_at: string;
    synced: boolean;
}

export interface OfflineProduct {
    id: number | string;
    name: string;
    price: number;
    barcode?: string;
    sku?: string;
    category?: string;
}

export interface OfflineCustomer {
    id: number | string;
    name: string;
    phone: string;
}

const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = request.result;

            // Transactions Store
            if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
                db.createObjectStore(STORES.TRANSACTIONS, { keyPath: 'id' });
            }

            // Products Store
            if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
                const productStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
                productStore.createIndex('name', 'name', { unique: false });
                productStore.createIndex('barcode', 'barcode', { unique: true });
            }

            // Customers Store
            if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
                const customerStore = db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
                customerStore.createIndex('phone', 'phone', { unique: false });
            }

            // Users/Staff Store (for PIN auth)
            if (!db.objectStoreNames.contains(STORES.USERS)) {
                db.createObjectStore(STORES.USERS, { keyPath: 'id' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// --- DATA SYNC FUNCTIONS ---

export const cacheProducts = async (products: OfflineProduct[]) => {
    const db = await initDB();
    const tx = db.transaction(STORES.PRODUCTS, 'readwrite');
    const store = tx.objectStore(STORES.PRODUCTS);
    store.clear(); // Refresh cache
    products.forEach(p => store.put(p));
    return new Promise(resolve => {
        tx.oncomplete = () => resolve(true);
    });
};

export const cacheCustomers = async (customers: OfflineCustomer[]) => {
    const db = await initDB();
    const tx = db.transaction(STORES.CUSTOMERS, 'readwrite');
    const store = tx.objectStore(STORES.CUSTOMERS);
    store.clear();
    customers.forEach(c => store.put(c));
    return new Promise(resolve => {
        tx.oncomplete = () => resolve(true);
    });
};

// --- OFFLINE QUERY FUNCTIONS ---

export const searchProductsOffline = async (query: string): Promise<OfflineProduct[]> => {
    const db = await initDB();
    const tx = db.transaction(STORES.PRODUCTS, 'readonly');
    const store = tx.objectStore(STORES.PRODUCTS);
    const index = store.index('name');

    // Simple logic: get all and filter (for exact matches, index is better, but fuzzy needs scan)
    // For performance on large DBs, cursor logic is better, but keeping it simple for < 10k items
    return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const all = request.result as OfflineProduct[];
            const lowerQ = query.toLowerCase();
            const filtered = all.filter(p =>
                p.name.toLowerCase().includes(lowerQ) ||
                p.barcode === query ||
                p.sku === query
            );
            resolve(filtered);
        };
    });
};

// --- EXISTING TRANSACTION FUNCTIONS ---

export const saveOfflineTransaction = async (tx: OfflineTransaction) => {
    const db = await initDB();
    const transaction = db.transaction(STORES.TRANSACTIONS, 'readwrite');
    const store = transaction.objectStore(STORES.TRANSACTIONS);
    store.put(tx);
};

export const getUnsyncedTransactions = async (): Promise<OfflineTransaction[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORES.TRANSACTIONS, 'readonly');
        const store = transaction.objectStore(STORES.TRANSACTIONS);
        const request = store.getAll();
        request.onsuccess = () => {
            const txs = request.result as OfflineTransaction[];
            resolve(txs.filter(tx => !tx.synced));
        };
        request.onerror = () => reject(request.error);
    });
};

export const markTransactionSynced = async (id: string) => {
    const db = await initDB();
    const transaction = db.transaction(STORES.TRANSACTIONS, 'readwrite');
    const store = transaction.objectStore(STORES.TRANSACTIONS);
    const request = store.get(id);
    request.onsuccess = () => {
        const tx = request.result;
        if (tx) {
            tx.synced = true;
            store.put(tx);
        }
    };
};

export const deleteSyncedTransactions = async () => {
    const db = await initDB();
    const transaction = db.transaction(STORES.TRANSACTIONS, 'readwrite');
    const store = transaction.objectStore(STORES.TRANSACTIONS);
    const request = store.getAll();
    request.onsuccess = () => {
        const txs = request.result as OfflineTransaction[];
        txs.forEach(tx => {
            if (tx.synced) store.delete(tx.id);
        });
    };
};
