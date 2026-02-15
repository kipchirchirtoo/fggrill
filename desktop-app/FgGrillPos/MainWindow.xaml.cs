using System;
using System.IO;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using FgGrillPos.Services;
using FgGrillPos.Bridge;
using Newtonsoft.Json;

namespace FgGrillPos
{
    public partial class MainWindow : Window
    {
        private DatabaseService? _db;
        private SyncService? _sync;
        private SupabaseService? _supabase;
        private MigrationService? _migration;
        private NativeBridge? _bridge;

        public MainWindow()
        {
            try {
                Console.WriteLine("MainWindow Constructor starting...");
                InitializeComponent();
                Console.WriteLine("InitializeComponent completed.");
                InitializeAsync();
                Console.WriteLine("InitializeAsync call triggered.");
            } catch (Exception ex) {
                Console.WriteLine($"CRITICAL ERROR in Constructor: {ex}");
                MessageBox.Show($"Constructor error: {ex.Message}");
            }
        }

        private async void InitializeAsync()
        {
            try 
            {
                Console.WriteLine("InitializeAsync: Starting services...");
                _db = new DatabaseService();
                Console.WriteLine("InitializeAsync: DatabaseService created.");
                _sync = new SyncService(_db);
                Console.WriteLine("InitializeAsync: SyncService created.");

                string supabaseId = "utsvlihpudfraxzcmtle";
                string supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY";
                _supabase = new SupabaseService(supabaseId, supabaseKey);
                _migration = new MigrationService(_db, _supabase);
                Console.WriteLine("InitializeAsync: Migration and Supabase services created.");

                // Initialize WebView2
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string userDataFolder = Path.Combine(appData, "FgGrillPos", "WebView2");
                Console.WriteLine($"InitializeAsync: WebView2 UserDataFolder: {userDataFolder}");
                if (!Directory.Exists(userDataFolder)) Directory.CreateDirectory(userDataFolder);
                
                Console.WriteLine("InitializeAsync: Creating WebView2 Environment...");
                var env = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
                Console.WriteLine("InitializeAsync: WebView2 Environment created. Ensuring CoreWebView2...");
                await webView.EnsureCoreWebView2Async(env);
                Console.WriteLine("InitializeAsync: WebView2 Ready.");

                _bridge = new NativeBridge(_db, _sync, _migration, webView.CoreWebView2);
                Console.WriteLine("InitializeAsync: NativeBridge created.");

                // Setup Bridge Script
                string bridgeScript = @"
                    window.electronAPI = {
                        isElectron: true,
                        isOnline: () => Promise.resolve(navigator.onLine),
                        onOnlineStatus: (cb) => {
                            window.addEventListener('online', () => cb(true));
                            window.addEventListener('offline', () => cb(false));
                        },
                        db: {
                            get: (table, query) => window.bridge.invoke('db:get', { table, query }),
                            upsert: (table, data) => window.bridge.invoke('db:upsert', { table, data }),
                            delete: (table, query) => window.bridge.invoke('db:delete', { table, query })
                        },
                        cache: {
                            cachePin: (pin, userId, userData, branchId) => window.bridge.invoke('cache:pin', { pin, userId, user_data: userData, branch_id: branchId }),
                            verifyPin: (pin) => window.bridge.invoke('cache:verifyPin', pin),
                            cacheMenuItems: (branchId, items) => window.bridge.invoke('cache:menuItems', { branchId, items }),
                            getMenuItems: (branchId) => window.bridge.invoke('cache:getMenuItems', branchId)
                        },
                        sync: {
                            queue: (action, endpoint, method, body, branchId, token) => window.bridge.invoke('sync:queue', { status: 'pending', action, endpoint, method, body, branchId, token }),
                            status: () => window.bridge.invoke('sync:status', {}),
                            trigger: () => window.bridge.invoke('sync:trigger', {}),
                            runMigration: () => window.bridge.invoke('sync:runMigration', {})
                        },
                        invoke: (type, payload) => window.bridge.invoke(type, payload)
                    };

                    window.bridge = {
                        invoke: (type, payload) => {
                            return new Promise((resolve) => {
                                const requestId = crypto.randomUUID();
                                const handler = (event) => {
                                    if (event.data && event.data.requestId === requestId) {
                                        window.chrome.webview.removeEventListener('message', handler);
                                        resolve(event.data.result);
                                    }
                                };
                                window.chrome.webview.addEventListener('message', handler);
                                window.chrome.webview.postMessage({ type, payload, requestId });
                            });
                        }
                    };
                ";
                
                await webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(bridgeScript);
                Console.WriteLine("InitializeAsync: Bridge Script injected.");

                // Handle Messages
                webView.CoreWebView2.WebMessageReceived += async (sender, args) =>
                {
                    string json = args.WebMessageAsJson;
                    try
                    {
                        var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                        var logPath = Path.Combine(appData, "FgGrillPos", "migration.log");
                        File.AppendAllText(logPath, $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] [MSG] RECV: {json}\r\n");
                    }
                    catch { }
                    await _bridge.HandleMessageAsync(json);
                };

                // Set up Virtual Host Name to serve local files securely and avoid CORS issues
                string appDir = AppDomain.CurrentDomain.BaseDirectory;
                string wwwRoot = Path.Combine(appDir, "wwwroot");
                Console.WriteLine($"InitializeAsync: Serving from {wwwRoot}");
                
                if (!Directory.Exists(wwwRoot))
                {
                    Console.WriteLine("InitializeAsync ERROR: wwwroot folder not found!");
                    MessageBox.Show($"Warning: wwwroot folder not found at {wwwRoot}. Static assets will not load.", "Assets Missing", MessageBoxButton.OK, MessageBoxImage.Warning);
                }
                else
                {
                    // Map the "app.fggrill" virtual domain to the "wwwroot" folder
                    webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        "app.fggrill", 
                        wwwRoot, 
                        CoreWebView2HostResourceAccessKind.Allow
                    );

                    // Use a fixed log path in LocalAppData for diagnostics
                    string localAppData = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FgGrillPos");
                    System.IO.Directory.CreateDirectory(localAppData);
                    string logFile = System.IO.Path.Combine(localAppData, "routing.log");

                    // Handle extensionless URLs (e.g. /restaurant/pos -> /restaurant/pos.html)
                    webView.CoreWebView2.AddWebResourceRequestedFilter("https://app.fggrill/*", CoreWebView2WebResourceContext.All);
                    webView.CoreWebView2.WebResourceRequested += (s, e) =>
                    {
                        var uri = new Uri(e.Request.Uri);
                        if (uri.Host == "app.fggrill")
                        {
                            string path = uri.AbsolutePath;
                            
                            try { System.IO.File.AppendAllText(logFile, $"[{DateTime.Now:HH:mm:ss}] Request: {path} (Query: {uri.Query}) | WWWROOT: {wwwRoot}\n"); } catch { }

                            if (!System.IO.Path.HasExtension(path))
                            {
                                // Special case for root
                                if (path == "/" || string.IsNullOrEmpty(path))
                                {
                                    path = "/index";
                                }

                                // Remove leading and trailing slashes
                                string normalizedPath = path.Trim('/');
                                // Replace forward slashes with system separators
                                string relativePath = normalizedPath.Replace('/', System.IO.Path.DirectorySeparatorChar);
                                string filePath = System.IO.Path.Combine(wwwRoot, relativePath + ".html");
                                
                                if (System.IO.File.Exists(filePath))
                                {
                                    try
                                    {
                                        var stream = System.IO.File.OpenRead(filePath);
                                        e.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(
                                            stream, 200, "OK", "Content-Type: text/html"
                                        );
                                        try { System.IO.File.AppendAllText(logFile, $"[{DateTime.Now:HH:mm:ss}] SUCCESS: Served {filePath}\n"); } catch { }
                                    }
                                    catch (Exception ex)
                                    {
                                        try { System.IO.File.AppendAllText(logFile, $"[{DateTime.Now:HH:mm:ss}] ERROR: {ex.Message} for {filePath}\n"); } catch { }
                                    }
                                }
                                else
                                {
                                    // Try alternative: maybe it's a directory and needs /index.html
                                    string indexFilePath = System.IO.Path.Combine(wwwRoot, relativePath, "index.html");
                                    if (System.IO.File.Exists(indexFilePath))
                                    {
                                        try
                                        {
                                            var stream = System.IO.File.OpenRead(indexFilePath);
                                            e.Response = webView.CoreWebView2.Environment.CreateWebResourceResponse(
                                                stream, 200, "OK", "Content-Type: text/html"
                                            );
                                            try { System.IO.File.AppendAllText(logFile, $"[{DateTime.Now:HH:mm:ss}] SUCCESS: Served INDEX {indexFilePath}\n"); } catch { }
                                        }
                                        catch (Exception ex)
                                        {
                                            try { System.IO.File.AppendAllText(logFile, $"[{DateTime.Now:HH:mm:ss}] ERROR: {ex.Message} for {indexFilePath}\n"); } catch { }
                                        }
                                    }
                                    else
                                    {
                                        try { System.IO.File.AppendAllText(logFile, $"[{DateTime.Now:HH:mm:ss}] NOT FOUND: Tried {filePath} and {indexFilePath}\n"); } catch { }
                                    }
                                }
                            }
                        }
                    };

                    // Navigate to the virtual domain - use extensionless URLs to favor clean routing
                    if (System.IO.File.Exists(System.IO.Path.Combine(wwwRoot, "terminal.html")))
                    {
                        Console.WriteLine("InitializeAsync: Navigating to terminal");
                        webView.CoreWebView2.Navigate("https://app.fggrill/terminal");
                    }
                    else if (System.IO.File.Exists(System.IO.Path.Combine(wwwRoot, "index.html")))
                    {
                        Console.WriteLine("InitializeAsync: Navigating to /");
                        webView.CoreWebView2.Navigate("https://app.fggrill/");
                    }
                    else
                    {
                        try { System.IO.File.AppendAllText(logFile, $"[{DateTime.Now}] CRITICAL: No terminal.html or index.html found\n"); } catch { }
                        webView.CoreWebView2.Navigate("https://app.fggrill/terminal"); // Fallback
                    }
                }

                Console.WriteLine("InitializeAsync: COMPLETED SUCCESSFULLY.");
                
                // Trigger initial migration in background to ensure offline data is available
                _ = Task.Run(async () => {
                    string migrationLog = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FgGrillPos", "migration.log");
                    try {
                        System.IO.File.AppendAllText(migrationLog, $"\n[{DateTime.Now}] Starting auto-migration sequence...\n");
                        
                        // Wait a bit for network to stabilize
                        await Task.Delay(5000);
                        
                        // FORCE MIGRATION - Bypass IsOnline check to ensure it attempts at least once
                        System.IO.File.AppendAllText(migrationLog, $"[{DateTime.Now}] Attempting migration (Force Run)...\n");
                        Console.WriteLine("MainWindow: Auto-starting data migration (Force Run)...");
                        
                        await _migration.RunFullMigrationAsync();
                        
                        System.IO.File.AppendAllText(migrationLog, $"[{DateTime.Now}] Migration completed successfully.\n");
                        Console.WriteLine("MainWindow: Data migration completed.");
                    } catch (Exception ex) {
                        System.IO.File.AppendAllText(migrationLog, $"[{DateTime.Now}] Migration CRASH: {ex.Message}\n{ex.StackTrace}\n");
                        Console.WriteLine($"MainWindow: Auto-migration failed: {ex.Message}");
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"InitializeAsync CRASH: {ex}");
                string logPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "FgGrillPos", "crash.log");
                File.WriteAllText(logPath, ex.ToString());
                MessageBox.Show($"Application failed to initialize:\n\n{ex.Message}\n\nCheck logs at: {logPath}", "Initialization Error", MessageBoxButton.OK, MessageBoxImage.Error);
                Application.Current.Shutdown();
            }
        }
    }
}
