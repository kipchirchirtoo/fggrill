'use client';

import { useState, useEffect } from 'react';
import { Shield, Zap, AlertTriangle, CheckCircle, TrendingUp, Activity, Clock, Target } from 'lucide-react';

interface APIEndpoint {
  path: string;
  method: string;
  requests_24h: number;
  avg_response_time: number;
  error_rate: number;
  rate_limit: number;
  blocked_requests: number;
  last_attack?: string;
}

export function APISecurityMonitor() {
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([]);
  const [stats, setStats] = useState({
    total_requests: 0,
    blocked_requests: 0,
    avg_response_time: 0,
    active_rate_limits: 0
  });

  useEffect(() => {
    fetchAPIStats();
  }, []);

  const fetchAPIStats = () => {
    // Mock data - replace with actual API
    const mockEndpoints: APIEndpoint[] = [
      {
        path: '/api/auth/login',
        method: 'POST',
        requests_24h: 1247,
        avg_response_time: 145,
        error_rate: 2.3,
        rate_limit: 20,
        blocked_requests: 34,
        last_attack: new Date(Date.now() - 7200000).toISOString()
      },
      {
        path: '/api/payment/create',
        method: 'POST',
        requests_24h: 892,
        avg_response_time: 234,
        error_rate: 0.5,
        rate_limit: 30,
        blocked_requests: 12
      },
      {
        path: '/api/accounting/invoices',
        method: 'GET',
        requests_24h: 3421,
        avg_response_time: 89,
        error_rate: 0.2,
        rate_limit: 100,
        blocked_requests: 5
      },
      {
        path: '/api/procurement/purchase-orders',
        method: 'POST',
        requests_24h: 567,
        avg_response_time: 178,
        error_rate: 1.1,
        rate_limit: 30,
        blocked_requests: 8
      }
    ];

    setEndpoints(mockEndpoints);
    setStats({
      total_requests: mockEndpoints.reduce((sum, e) => sum + e.requests_24h, 0),
      blocked_requests: mockEndpoints.reduce((sum, e) => sum + e.blocked_requests, 0),
      avg_response_time: Math.round(mockEndpoints.reduce((sum, e) => sum + e.avg_response_time, 0) / mockEndpoints.length),
      active_rate_limits: mockEndpoints.length
    });
  };

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
              {endpoints.map((endpoint, index) => (
                <tr key={index} className="hover:bg-stone-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <span className={`inline-block px-2 py-1 text-xs font-mono font-semibold rounded ${
                        endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                        endpoint.method === 'GET' ? 'bg-green-100 text-green-700' :
                        endpoint.method === 'PUT' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {endpoint.method}
                      </span>
                      <span className="ml-2 font-mono text-sm text-stone-900">{endpoint.path}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-900 font-medium">
                    {endpoint.requests_24h.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-medium ${
                      endpoint.avg_response_time < 100 ? 'text-green-600' :
                      endpoint.avg_response_time < 200 ? 'text-blue-600' :
                      endpoint.avg_response_time < 300 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {endpoint.avg_response_time}ms
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-medium ${
                      endpoint.error_rate < 1 ? 'text-green-600' :
                      endpoint.error_rate < 3 ? 'text-amber-600' :
                      'text-red-600'
                    }`}>
                      {endpoint.error_rate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-stone-900">
                    {endpoint.rate_limit} req/min
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {endpoint.blocked_requests > 0 ? (
                      <span className="text-red-600 font-medium">{endpoint.blocked_requests}</span>
                    ) : (
                      <span className="text-stone-400">0</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {endpoint.last_attack ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        Recent attack
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                        <CheckCircle className="h-3 w-3" />
                        Healthy
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rate Limit Configuration */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-6">
        <h4 className="text-sm font-semibold text-stone-900 mb-4 uppercase tracking-wider">
          Rate Limit Configuration
        </h4>
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
