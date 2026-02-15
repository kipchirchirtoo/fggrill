using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace FgGrillPos.Services
{
    public class SupabaseService
    {
        private readonly HttpClient _http;
        private readonly string _baseUrl;
        private readonly string _anonKey;

        public SupabaseService(string projectId, string anonKey)
        {
            _baseUrl = $"https://{projectId}.supabase.co/rest/v1";
            _anonKey = anonKey;
            _http = new HttpClient();
            _http.DefaultRequestHeaders.Add("apikey", _anonKey);
            _http.DefaultRequestHeaders.Add("Authorization", $"Bearer {_anonKey}");
        }

        public async Task<List<Dictionary<string, object>>> FetchTableAsync(string table, string select = "*")
        {
            var url = $"{_baseUrl}/{table}?select={select}";
            var response = await _http.GetStringAsync(url);
            return JsonConvert.DeserializeObject<List<Dictionary<string, object>>>(response);
        }
    }
}
