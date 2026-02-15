using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.IO;
using Newtonsoft.Json;

namespace FgGrillPos.Services
{
    public class MigrationService
    {
        private readonly DatabaseService _db;
        private readonly SupabaseService _supabase;

        public MigrationService(DatabaseService db, SupabaseService supabase)
        {
            _db = db;
            _supabase = supabase;
        }

        public async Task RunFullMigrationAsync()
        {
            string logFile = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FgGrillPos", "migration.log");
            DateTime now = DateTime.Now;

            void Log(string message) {
                try { System.IO.File.AppendAllText(logFile, $"[{DateTime.Now}] {message}\n"); } catch {}
                Console.WriteLine($"MigrationService: {message}");
            }

            Log("Starting full migration...");

            try
            {
                // Helper to safely extract values from dynamic objects
                object GetValue(Dictionary<string, object> dict, string key, object defaultValue = null)
                {
                    if (dict == null) return defaultValue;
                    if (!dict.ContainsKey(key) || dict[key] == null) return defaultValue;
                    return dict[key];
                }

                // 1. Migrate Branches
                var branches = await _supabase.FetchTableAsync("branches");
                Log($"Fetched {branches.Count} branches from Supabase.");
                
                var branchItems = branches.Select(b => new Dictionary<string, object>
                {
                    { "id", GetValue(b, "id") },
                    { "name", GetValue(b, "name", "Unknown Branch") },
                    { "code", GetValue(b, "code") },
                    { "location", GetValue(b, "location") },
                    { "data", JsonConvert.SerializeObject(b) },
                    { "updated_at", GetValue(b, "updated_at", DateTime.UtcNow.ToString("o")) }
                });
                await _db.BulkUpsertAsync("branches", branchItems);
                Log($"Migrated {branches.Count} branches to SQLite.");

                // 2. Migrate Users (and populate cached_pins)
                var users = await _supabase.FetchTableAsync("users");
                Log($"Fetched {users.Count} users from Supabase.");

                var userItems = users.Select(u => new Dictionary<string, object>
                {
                    { "id", GetValue(u, "id") },
                    { "email", GetValue(u, "email") },
                    { "first_name", GetValue(u, "first_name") },
                    { "last_name", GetValue(u, "last_name") },
                    { "role", GetValue(u, "role") },
                    { "branch_id", GetValue(u, "branch_id") },
                    { "pos_pin", GetValue(u, "pos_pin") },
                    { "password_hash", GetValue(u, "password_hash") },
                    { "data", JsonConvert.SerializeObject(u) },
                    { "updated_at", GetValue(u, "updated_at", DateTime.UtcNow.ToString("o")) }
                });
                await _db.BulkUpsertAsync("users", userItems);
                Log($"Migrated {users.Count} users to SQLite.");

                // 3. Populate cached_pins from users with PINs
                int pinCount = 0;
                foreach (var user in users)
                {
                    var pinObj = GetValue(user, "pos_pin");
                    if (pinObj != null)
                    {
                        string pin = pinObj.ToString().Trim();
                        // Log first few PINs for debugging (masked)
                        if (pinCount < 3) Log($"Caching PIN for user {GetValue(user, "id")}: {pin.Substring(0, Math.Min(2, pin.Length))}**");
                        
                        string userId = GetValue(user, "id").ToString();
                        object branchIdObj = GetValue(user, "branch_id", 0);
                        int branchId = 0;
                        try { branchId = Convert.ToInt32(branchIdObj); } catch { }
                        
                        _db.CachePin(pin, userId, user, branchId);
                        pinCount++;
                    }
                }
                Log($"Populated cached_pins with {pinCount} entries.");

                // 4. Migrate Restaurant Categories
                var resCategories = await _supabase.FetchTableAsync("restaurant_menu_categories");
                Log($"Fetched {resCategories.Count} restaurant categories.");
                var resCategoryItems = resCategories.Select(c => new Dictionary<string, object>
                {
                    { "id", GetValue(c, "id") },
                    { "branch_id", GetValue(c, "branch_id") },
                    { "name", GetValue(c, "name", "Uncategorized") },
                    { "data", JsonConvert.SerializeObject(c) },
                    { "cached_at", DateTime.UtcNow.ToString("o") }
                });
                await _db.BulkUpsertAsync("categories", resCategoryItems);
                Log($"Migrated {resCategories.Count} restaurant categories.");

                // 4b. Migrate Bar Categories
                try {
                    var barCategories = await _supabase.FetchTableAsync("bar_drink_categories");
                    Log($"Fetched {barCategories.Count} bar categories.");
                    var barCategoryItems = barCategories.Select(c => new Dictionary<string, object>
                    {
                        { "id", GetValue(c, "id") },
                        { "branch_id", GetValue(c, "branch_id") },
                        { "name", GetValue(c, "name", "Uncategorized") },
                        { "data", JsonConvert.SerializeObject(c) },
                        { "cached_at", DateTime.UtcNow.ToString("o") }
                    });
                    await _db.BulkUpsertAsync("categories", barCategoryItems);
                    Log($"Migrated {barCategories.Count} bar categories.");
                } catch (Exception ex) { Log($"Skip Bar Categories: {ex.Message}"); }

                // 5. Migrate Restaurant Menu Items
                var resMenuItems = await _supabase.FetchTableAsync("restaurant_menu_items");
                Log($"Fetched {resMenuItems.Count} restaurant menu items.");
                var resMenuItemList = resMenuItems.Select(m => new Dictionary<string, object>
                {
                    { "id", GetValue(m, "id") },
                    { "branch_id", GetValue(m, "branch_id") },
                    { "name", GetValue(m, "name", "Unknown Item") },
                    { "category", GetValue(m, "category_id") },
                    { "price", Convert.ToDouble(GetValue(m, "price", 0.0)) },
                    { "data", JsonConvert.SerializeObject(m) },
                    { "cached_at", DateTime.UtcNow.ToString("o") }
                });
                await _db.BulkUpsertAsync("menu_items", resMenuItemList);
                Log($"Migrated {resMenuItems.Count} restaurant menu items.");

                // 5b. Migrate Bar Drinks
                try {
                    var barDrinks = await _supabase.FetchTableAsync("bar_drinks");
                    Log($"Fetched {barDrinks.Count} bar drinks.");
                    var barDrinkList = barDrinks.Select(m => new Dictionary<string, object>
                    {
                        { "id", GetValue(m, "id") },
                        { "branch_id", GetValue(m, "branch_id") },
                        { "name", GetValue(m, "name", "Unknown Item") },
                        { "category", GetValue(m, "category_id") },
                        { "price", Convert.ToDouble(GetValue(m, "price", 0.0)) },
                        { "data", JsonConvert.SerializeObject(m) },
                        { "cached_at", DateTime.UtcNow.ToString("o") }
                    });
                    await _db.BulkUpsertAsync("menu_items", barDrinkList);
                    Log($"Migrated {barDrinks.Count} bar drinks.");
                } catch (Exception ex) { Log($"Skip Bar Drinks: {ex.Message}"); }

                // 6. Migrate Restaurant Tables
                var tables = await _supabase.FetchTableAsync("restaurant_tables");
                Log($"Fetched {tables.Count} restaurant tables.");
                var tableItems = tables.Select(t => new Dictionary<string, object>
                {
                    { "id", GetValue(t, "id") },
                    { "branch_id", GetValue(t, "branch_id") },
                    { "name", GetValue(t, "table_number", GetValue(t, "id")) },
                    { "data", JsonConvert.SerializeObject(t) },
                    { "cached_at", DateTime.UtcNow.ToString("o") }
                });
                await _db.BulkUpsertAsync("restaurant_tables", tableItems);
                Log($"Migrated {tables.Count} restaurant tables.");

                // 7. Mirror Recent Pending Orders (Recent 50 per category)
                try {
                    Log("Mirroring recent active orders...");
                    var resOrders = await _supabase.FetchTableAsync("restaurant_orders");
                    // Filter for active ones if possible, or just take last 50
                    var recentRes = resOrders.Where(o => GetValue(o, "status")?.ToString() == "pending" || GetValue(o, "status")?.ToString() == "kitchen_ready").Take(50);
                    
                    var orderItems = recentRes.Select(o => new Dictionary<string, object>
                    {
                        { "id", GetValue(o, "id") },
                        { "branch_id", GetValue(o, "branch_id") },
                        { "order_data", JsonConvert.SerializeObject(o) },
                        { "status", GetValue(o, "status", "pending") },
                        { "created_at", GetValue(o, "created_at", DateTime.UtcNow.ToString("o")) },
                        { "synced_at", DateTime.UtcNow.ToString("o") } // Mark as synced since it came from server
                    });
                    await _db.BulkUpsertAsync("offline_orders", orderItems);
                    Log($"Mirrored {recentRes.Count()} active restaurant orders.");

                    var barOrders = await _supabase.FetchTableAsync("bar_orders");
                    var recentBar = barOrders.Where(o => GetValue(o, "status")?.ToString() == "pending" || GetValue(o, "status")?.ToString() == "kitchen_ready").Take(50);
                    var barOrderItems = recentBar.Select(o => new Dictionary<string, object>
                    {
                        { "id", GetValue(o, "id") },
                        { "branch_id", GetValue(o, "branch_id") },
                        { "order_data", JsonConvert.SerializeObject(o) },
                        { "status", GetValue(o, "status", "pending") },
                        { "created_at", GetValue(o, "created_at", DateTime.UtcNow.ToString("o")) },
                        { "synced_at", DateTime.UtcNow.ToString("o") }
                    });
                    await _db.BulkUpsertAsync("offline_orders", barOrderItems);
                    Log($"Mirrored {recentBar.Count()} active bar orders.");
                } catch (Exception ex) { Log($"Skip Orders Mirror: {ex.Message}"); }

                Log("Migration completed successfully.");
            }
            catch (Exception ex)
            {
                Log($"Migration failed: {ex.Message}");
                throw;
            }
        }
    }
}
