'use client';

import { useState, useEffect } from 'react';
import { Shield, Zap, AlertTriangle, CheckCircle, TrendingUp, Activity, Clock, Target, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { securityAPI, APIEndpoint } from '@/lib/api';

export function APISecurityMonitor() {
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [stats, setStats] = useState({
    total_requests: 0,
    blocked_requests: 0,
    avg_response_time: 0,
    active_rate_limits: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPIStats();
  }, []);

  const fetchAPIStats = async () => {
    setLoading(true);
    try {
      const response = await securityAPI.getAPIMetrics();
      if (response.success && response.data) {
        setEndpoints(response.data.endpoints || []);
        setStats({
          total_requests: response.data.totalRequests || 0,
          blocked_requests: response.data.rateLimitViolations || 0,
          avg_response_time: response.data.endpoints?.length 
            ? Math.round(response.data.endpoints.reduce((sum, e) => sum + e.avgResponseTime, 0) / response.data.endpoints.length)
            : 0,
          active_rate_limits: response.data.endpoints?.length || 0
        });
      } else {
        throw new Error(response.error || 'Failed to fetch API metrics');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch API security metrics');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-stone-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* API Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase">Total Requests</p>
              <p className="text-2xl font-bold text-stone-900 mt-1">{stats.total_requests.toLocaleString()}</p>
              <p className="text-xs text-stone-500 mt-1">Last 24 hours</p>
            </div>
            <Activity className="h-8 w-8 text-stone-400" />
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-lg p-4 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase">Blocked</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.blocked_requests}</p>
              <p className="text-xs text-stone-500 mt-1">Rate limit violations</p>
            </div>
            <Shield className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white border border-blue-200 rounded-lg p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase">Avg Response</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.avg_response_time}ms</p>
              <p className="text-xs text-stone-500 mt-1">Across all endpoints</p>
            </div>
            <Zap className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white border border-green-200 rounded-lg p-4 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase">Rate Limiters</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.active_rate_limits}</p>
              <p className="text-xs text-stone-500 mt-1">Active protections</p>
            </div>
            <Target className="h-8 w-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Endpoint List */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50">
          <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">
            Protected API Endpoints
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Endpoint</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Requests (24h)</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Avg Response</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Error Rate</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Rate Limit</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Blocked</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-stone-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {endpoints.map((endpoint, index) => {
                // Extract method and path from endpoint string
                const endpointStr = endpoint.endpoint || '';
                const parts = endpointStr.split(' ');
                const method = parts[0] || 'GET';
                const path = parts.slice(1).join(' ') || endpointStr;
                
                return (
                  <tr key={index} className="hover:bg-stone-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <span className={`inline-block px-2 py-1 text-xs font-mono font-semibold rounded ${
                          method === 'POST' ? 'bg-blue-100 text-blue-700' :
                          method === 'GET' ? 'bg-green-100 text-green-700' :
                          method === 'PUT' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {method}
                        </span>
                        <span className="ml-2 font-mono text-sm text-stone-900">{path}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-900 font-medium">
                      {endpoint.requests?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`font-medium ${
                        endpoint.avgResponseTime < 100 ? 'text-green-600' :
                        endpoint.avgResponseTime < 200 ? 'text-blue-600' :
                        endpoint.avgResponseTime < 300 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {endpoint.avgResponseTime}ms
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`font-medium ${
                        endpoint.errors < 1 ? 'text-green-600' :
                        endpoint.errors < 3 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {endpoint.errors}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-stone-900">
                      N/A
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="text-stone-400">0</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        <CheckCircle className="h-3 w-3" />
                        Healthy
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rate Limit Configuration */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">
            Rate Limit Configuration
          </h4>
          <button 
            onClick={fetchAPIStats}
            disabled={loading}
            className="px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-stone-500 uppercase mb-2">Auth Endpoints</p>
            <p className="text-lg font-bold text-stone-900">20 req / 15 min</p>
            <p className="text-xs text-stone-600 mt-1">Per IP address</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-stone-500 uppercase mb-2">Financial Endpoints</p>
            <p className="text-lg font-bold text-stone-900">30 req / min</p>
            <p className="text-xs text-stone-600 mt-1">Per user</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-stone-500 uppercase mb-2">General API</p>
            <p className="text-lg font-bold text-stone-900">100 req / min</p>
            <p className="text-xs text-stone-600 mt-1">Per user</p>
          </div>
        </div>
      </div>
    </div>
  );
}
