using System;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.IO;
using Newtonsoft.Json;

namespace FgGrillPos.Services
{
    public class SyncService
    {
        private readonly DatabaseService _db;
        private readonly HttpClient _http;
        private readonly string _apiBaseUrl = "https://api.hirall.com"; // Configure as needed
        private CancellationTokenSource _cts;
        private bool _isOnline = false;

        public event Action<bool> OnlineStatusChanged;
        public bool IsOnline => _isOnline;

        public SyncService(DatabaseService db)
        {
            _db = db;
            _http = new HttpClient();
            _http.Timeout = TimeSpan.FromSeconds(30);
            StartBackgroundSync();
        }

        private void StartBackgroundSync()
        {
            _cts = new CancellationTokenSource();
            Task.Run(async () =>
            {
                while (!_cts.Token.IsCancellationRequested)
                {
                    await CheckConnectivity();
                    if (_isOnline)
                    {
                        await ProcessSyncQueue();
                    }
                    await Task.Delay(30000, _cts.Token); // Check every 30s
                }
            }, _cts.Token);
        }

        private async Task CheckConnectivity()
        {
            try
            {
                // Simple connectivity check
                using (var request = new HttpRequestMessage(HttpMethod.Head, _apiBaseUrl))
                {
                    var response = await _http.SendAsync(request);
                    bool newStatus = response.IsSuccessStatusCode;
                    
                    if (newStatus != _isOnline)
                    {
                        _isOnline = newStatus;
                        Log($"Online status changed: {_isOnline}");
                        OnlineStatusChanged?.Invoke(_isOnline);
                    }
                }
            }
            catch
            {
                if (_isOnline)
                {
                    _isOnline = false;
                    Log("Online status changed: False (Check failed)");
                    OnlineStatusChanged?.Invoke(false);
                }
            }
        }

        public async Task TriggerSync()
        {
            await CheckConnectivity();
            if (_isOnline)
            {
                await ProcessSyncQueue();
            }
        }

        private async Task ProcessSyncQueue()
        {
            var pendingItems = await _db.GetPendingSyncItemsAsync();
            var count = pendingItems.Count();
            if (count == 0) return;

            Log($"Processing sync queue: {count} items pending...");

            foreach (var item in pendingItems)
            {
                try
                {
                    var method = new HttpMethod((string)item.method);
                    var request = new HttpRequestMessage(method, _apiBaseUrl + "/api" + (string)item.endpoint);

                    if (!string.IsNullOrEmpty((string)item.token))
                    {
                        request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", (string)item.token);
                    }

                    if (!string.IsNullOrEmpty((string)item.body))
                    {
                        request.Content = new StringContent((string)item.body, Encoding.UTF8, "application/json");
                    }

                    Log($"Syncing {(string)item.action} to {(string)item.endpoint}...");
                    var response = await _http.SendAsync(request);

                    if (response.IsSuccessStatusCode)
                    {
                        Log($"Sync SUCCESS: {(string)item.action}");
                        _db.UpdateSyncStatus((long)item.id, "synced", null);
                    }
                    else
                    {
                        var error = await response.Content.ReadAsStringAsync();
                        Log($"Sync FAILED: {(string)item.action} - HTTP {(int)response.StatusCode}: {error}");
                        _db.UpdateSyncStatus((long)item.id, "error", $"HTTP {(int)response.StatusCode}");
                    }
                }
                catch (Exception ex)
                {
                    Log($"Sync CRASH: {(string)item.action} - {ex.Message}");
                    _db.UpdateSyncStatus((long)item.id, "error", ex.Message);
                }
            }
        }

        private void Log(string message)
        {
            try
            {
                var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var logPath = Path.Combine(appData, "FgGrillPos", "migration.log");
                System.IO.File.AppendAllText(logPath, $"[{DateTime.UtcNow:yyyy-MM-dd HH:mm:ss}] [SYNC] {message}\r\n");
            }
            catch { }
        }
    }
}
