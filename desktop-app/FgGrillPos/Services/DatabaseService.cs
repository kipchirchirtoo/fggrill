using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Data.Sqlite;
using Dapper;
using Newtonsoft.Json;

namespace FgGrillPos.Services
{
    public class DatabaseService
    {
        private string _dbPath;
        private string _connectionString;

        public DatabaseService()
        {
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var appDir = Path.Combine(appData, "FgGrillPos");
            if (!Directory.Exists(appDir))
            {
                Directory.CreateDirectory(appDir);
            }
            _dbPath = Path.Combine(appDir, "pos.db");
            _connectionString = $"Data Source={_dbPath}";
            
            InitializeDatabase();
        }

        private void InitializeDatabase()
        {
            using (var conn = new SqliteConnection(_connectionString))
            {
                conn.Open();
                
                // cached_pins
                conn.Execute(@"
                    CREATE TABLE IF NOT EXISTS cached_pins (
                        pin TEXT PRIMARY KEY,
                        user_id TEXT NOT NULL,
                        user_data TEXT NOT NULL,
                        branch_id INTEGER,
                        cached_at TEXT NOT NULL
                    );");

                // menu_items
                conn.Execute(@"
                    CREATE TABLE IF NOT EXISTS menu_items (
                        id TEXT PRIMARY KEY,
                        branch_id INTEGER,
                        name TEXT NOT NULL,
                        category TEXT,
                        price REAL NOT NULL,
                        data TEXT NOT NULL,
                        cached_at TEXT NOT NULL
                    );");

                // categories
                conn.Execute(@"
                    CREATE TABLE IF NOT EXISTS categories (
                        id TEXT PRIMARY KEY,
                        branch_id INTEGER,
                        name TEXT NOT NULL,
                        data TEXT NOT NULL,
                        cached_at TEXT NOT NULL
                    );");

                // restaurant_tables
                conn.Execute(@"
                    CREATE TABLE IF NOT EXISTS restaurant_tables (
                        id TEXT PRIMARY KEY,
                        branch_id INTEGER,
                        name TEXT NOT NULL,
                        data TEXT NOT NULL,
                        cached_at TEXT NOT NULL
                    );");

                // offline_orders
                conn.Execute(@"
                    CREATE TABLE IF NOT EXISTS offline_orders (
                        id TEXT PRIMARY KEY,
                        branch_id INTEGER,
                        order_data TEXT NOT NULL,
                        status TEXT DEFAULT 'pending',
                        created_at TEXT NOT NULL,
                        synced_at TEXT
                    );");

                // sync_queue
                conn.Execute(@"
                    CREATE TABLE IF NOT EXISTS sync_queue (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        action TEXT NOT NULL,
                        endpoint TEXT NOT NULL,
                        method TEXT DEFAULT 'POST',
                        token TEXT,
                        body TEXT,
                        branch_id INTEGER,
                        status TEXT DEFAULT 'pending',
                        attempts INTEGER DEFAULT 0,
                        max_attempts INTEGER DEFAULT 10,
                        created_at TEXT NOT NULL,
                        last_attempt TEXT,
                        error TEXT
                    );");

                // branches
                conn.Execute(@"
                    CREATE TABLE IF NOT EXISTS branches (
                        id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL,
                        code TEXT,
                        location TEXT,
                        data TEXT,
                        updated_at TEXT NOT NULL
                    );");

                // users
                conn.Execute(@"
                    CREATE TABLE IF NOT EXISTS users (
                        id TEXT PRIMARY KEY,
                        email TEXT,
                        first_name TEXT,
                        last_name TEXT,
                        role TEXT,
                        branch_id INTEGER,
                        pos_pin TEXT,
                        password_hash TEXT,
                        data TEXT,
                        updated_at TEXT NOT NULL
                    );");

                // cache_meta
                conn.Execute(@"
                    CREATE TABLE IF NOT EXISTS cache_meta (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );");
            }
        }

        public async Task<IEnumerable<dynamic>> GetAsync(string table, object query = null)
        {
            using (var conn = new SqliteConnection(_connectionString))
            {
                if (query == null)
                {
                    return await conn.QueryAsync($"SELECT * FROM {table}");
                }

                // Handle JObject or Dictionary for dynamic queries
                Dictionary<string, object> queryDict = new Dictionary<string, object>();
                if (query is Newtonsoft.Json.Linq.JObject jObject)
                {
                    queryDict = jObject.ToObject<Dictionary<string, object>>() ?? new Dictionary<string, object>();
                }
                else if (query is IDictionary<string, object> dict)
                {
                    foreach (var kvp in dict) queryDict[kvp.Key] = kvp.Value;
                }
                else if (query != null)
                {
                    // Fallback to reflection for POCOs
                    var properties = query.GetType().GetProperties();
                    queryDict = properties.ToDictionary(p => p.Name, p => p.GetValue(query) ?? (object)DBNull.Value);
                }

                if (queryDict.Count == 0)
                {
                    return await conn.QueryAsync($"SELECT * FROM {table}");
                }

                var whereClauses = queryDict.Keys.Select(k => $"{k} = @{k}");
                var sql = $"SELECT * FROM {table} WHERE {string.Join(" AND ", whereClauses)}";

                return await conn.QueryAsync(sql, queryDict);
            }
        }

        public async Task<bool> UpsertAsync(string table, Dictionary<string, object> data)
        {
            using (var conn = new SqliteConnection(_connectionString))
            {
                var keys = data.Keys.ToList();
                var columns = string.Join(", ", keys);
                var parameters = string.Join(", ", keys.Select(k => "@" + k));
                var updates = string.Join(", ", keys.Select(k => $"{k} = excluded.{k}"));
                
                // Assuming first key is primary for conflict resolution, or explicit ID
                var conflictTarget = keys.Contains("id") ? "id" : keys.FirstOrDefault(); // simplified
                if (table == "cached_pins") conflictTarget = "pin";
                if (table == "cache_meta") conflictTarget = "key";
                if (table == "users") conflictTarget = "id";
                if (table == "branches") conflictTarget = "id";

                var sql = $@"
                    INSERT INTO {table} ({columns}) VALUES ({parameters})
                    ON CONFLICT({conflictTarget}) DO UPDATE SET {updates}";
                
                await conn.ExecuteAsync(sql, data);
                return true;
            }
        }

        public async Task BulkUpsertAsync(string table, IEnumerable<Dictionary<string, object>> dataList)
        {
            if (dataList == null || !dataList.Any()) return;

            using (var conn = new SqliteConnection(_connectionString))
            {
                conn.Open();
                using (var transaction = conn.BeginTransaction())
                {
                    var first = dataList.First();
                    var keys = first.Keys.ToList();
                    var columns = string.Join(", ", keys);
                    var parameters = string.Join(", ", keys.Select(k => "@" + k));
                    var updates = string.Join(", ", keys.Select(k => $"{k} = excluded.{k}"));
                    
                    var conflictTarget = keys.Contains("id") ? "id" : keys.FirstOrDefault();
                    if (table == "cached_pins") conflictTarget = "pin";
                    if (table == "cache_meta") conflictTarget = "key";
                    if (table == "users") conflictTarget = "id";
                    if (table == "branches") conflictTarget = "id";

                    var sql = $@"
                        INSERT INTO {table} ({columns}) VALUES ({parameters})
                        ON CONFLICT({conflictTarget}) DO UPDATE SET {updates}";

                    foreach (var data in dataList)
                    {
                        await conn.ExecuteAsync(sql, data, transaction);
                    }
                    transaction.Commit();
                }
            }
        }

        // Specific methods mirroring Electron IPC

        public void CachePin(string pin, string userId, object userData, int branchId)
        {
            if (string.IsNullOrEmpty(pin)) return;
            var normalizedPin = pin.Trim();

            using (var conn = new SqliteConnection(_connectionString))
            {
                var sql = @"
                    INSERT INTO cached_pins (pin, user_id, user_data, branch_id, cached_at)
                    VALUES (@normalizedPin, @userId, @userData, @branchId, @cachedAt)
                    ON CONFLICT(pin) DO UPDATE SET 
                        user_id = excluded.user_id,
                        user_data = excluded.user_data,
                        branch_id = excluded.branch_id,
                        cached_at = excluded.cached_at";
                
                conn.Execute(sql, new {
                    normalizedPin,
                    userId,
                    userData = JsonConvert.SerializeObject(userData),
                    branchId,
                    cachedAt = DateTime.UtcNow.ToString("o")
                });
            }
        }

        private void Log(string message)
        {
            try
            {
                var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var logPath = Path.Combine(appData, "FgGrillPos", "migration.log");
                File.AppendAllText(logPath, $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] [DB] {message}\r\n");
            }
            catch { }
        }

        public dynamic VerifyPin(string pin)
        {
            if (string.IsNullOrEmpty(pin)) return null;
            
            var normalizedPin = pin.Trim();
            Log($"Verifying PIN: [{normalizedPin}] (Length: {normalizedPin.Length})");

            using (var conn = new SqliteConnection(_connectionString))
            {
                var row = conn.QueryFirstOrDefault("SELECT user_data FROM cached_pins WHERE pin = @normalizedPin", new { normalizedPin });
                if (row != null)
                {
                    Log($"Found user for PIN: {normalizedPin}");
                    return JsonConvert.DeserializeObject(row.user_data);
                }
                Log($"No user found for PIN: {normalizedPin}");
                return null;
            }
        }

        public void CacheMenuItems(int branchId, IEnumerable<dynamic> items)
        {
            using (var conn = new SqliteConnection(_connectionString))
            {
                conn.Open();
                using (var transaction = conn.BeginTransaction())
                {
                    var sql = @"
                        INSERT INTO menu_items (id, branch_id, name, category, price, data, cached_at)
                        VALUES (@id, @branchId, @name, @category, @price, @data, @cachedAt)
                        ON CONFLICT(id) DO UPDATE SET
                            name = excluded.name,
                            category = excluded.category,
                            price = excluded.price,
                            data = excluded.data,
                            cached_at = excluded.cached_at";

                    foreach (var item in items)
                    {
                        // Handle dynamic object property access properly
                        // Assuming 'item' is a JObject or similar from Newtonsoft or IDictionary
                        // We will rely on polished Dapper usage or mapping
                        // simplified for now assuming item has properties
                       
                        // For simplicity in this generated code, we assume 'item' can be mapped
                        // In reality we might need to parse JSON first
                        
                        // We will store the entire object as JSON in 'data'
                        string json = JsonConvert.SerializeObject(item);
                        
                        conn.Execute(sql, new {
                            id = (string)item.id,
                            branchId,
                            name = (string)(item.name ?? item.table_number ?? item.id),
                            category = (string)item.category ?? (string)item.category_id ?? "",
                            price = (double)(item.price ?? 0),
                            data = json,
                            cachedAt = DateTime.UtcNow.ToString("o")
                        }, transaction);
                    }
                    transaction.Commit();
                }
            }
        }

         public IEnumerable<string> GetCachedMenuItems(int branchId)
        {
            using (var conn = new SqliteConnection(_connectionString))
            {
                return conn.Query<string>("SELECT data FROM menu_items WHERE branch_id = @branchId", new { branchId });
            }
        }

        public void QueueSync(string action, string endpoint, string method, object body, int branchId, string token)
        {
            using (var conn = new SqliteConnection(_connectionString))
            {
                var sql = @"
                    INSERT INTO sync_queue (action, endpoint, method, body, branch_id, token, created_at)
                    VALUES (@action, @endpoint, @method, @body, @branchId, @token, @createdAt)";
                
                conn.Execute(sql, new {
                    action,
                    endpoint,
                    method = method ?? "POST",
                    body = body != null ? JsonConvert.SerializeObject(body) : null,
                    branchId,
                    token,
                    createdAt = DateTime.UtcNow.ToString("o")
                });
            }
        }

        public async Task<IEnumerable<dynamic>> GetPendingSyncItemsAsync()
        {
            using (var conn = new SqliteConnection(_connectionString))
            {
                return await conn.QueryAsync(@"
                    SELECT * FROM sync_queue 
                    WHERE status = 'pending' AND attempts < max_attempts 
                    ORDER BY created_at ASC LIMIT 20");
            }
        }

        public void UpdateSyncStatus(long id, string status, string error = null)
        {
             using (var conn = new SqliteConnection(_connectionString))
            {
                if (status == "synced")
                {
                    conn.Execute("UPDATE sync_queue SET status = 'synced', last_attempt = @time WHERE id = @id", 
                        new { time = DateTime.UtcNow.ToString("o"), id });
                }
                else
                {
                    conn.Execute(@"
                        UPDATE sync_queue 
                        SET attempts = attempts + 1, last_attempt = @time, error = @error 
                        WHERE id = @id",
                        new { time = DateTime.UtcNow.ToString("o"), error, id });
                }
            }
        }

        public dynamic GetSyncStatusCounts()
        {
            using (var conn = new SqliteConnection(_connectionString))
            {
                var pending = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM sync_queue WHERE status = 'pending'");
                var synced = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM sync_queue WHERE status = 'synced'");
                var failed = conn.ExecuteScalar<int>("SELECT COUNT(*) FROM sync_queue WHERE status = 'failed' OR attempts >= max_attempts");
                return new { pending, synced, failed };
            }
        }
    }
}
