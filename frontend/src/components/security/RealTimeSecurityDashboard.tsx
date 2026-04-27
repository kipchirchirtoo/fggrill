'use client';

import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Shield, TrendingUp, Zap, Eye, Ban, CheckCircle } from 'lucide-react';

interface SecurityMetric {
  label: string;
  value: number;
  change: number;
  status: 'good' | 'warning' | 'critical';
}

export function RealTimeSecurityDashboard() {
  const [metrics, setMetrics] = useState<SecurityMetric[]>([
    { label: 'Active Sessions', value: 247, change: 12, status: 'good' },
    { label: 'Failed Logins (1h)', value: 8, change: -3, status: 'good' },
    { label: 'Blocked IPs', value: 15, change: 2, status: 'warning' },
    { label: 'API Requests/min', value: 1834, change: 156, status: 'good' },
    { label: 'RLS Violations', value: 0, change: 0, status: 'good' },
    { label: 'Suspicious Activity', value: 3, change: 1, status: 'warning' }
  ]);

  const [recentEvents, setRecentEvents] = useState([
    { time: '2 min ago', event: 'Failed login attempt from 192.168.1.100', severity: 'warning' },
    { time: '5 min ago', event: 'Rate limit exceeded on /api/auth/login', severity: 'warning' },
    { time: '8 min ago', event: 'New admin user created', severity: 'info' },
    { time: '12 min ago', event: 'VPN detected from Kenya', severity: 'info' },
    { time: '15 min ago', event: 'Successful login from new device', severity: 'info' }
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => prev.map(m => ({
        ...m,
        value: m.value + Math.floor(Math.random() * 3) - 1,
        change: Math.floor(Math.random() * 10) - 5
      })));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Real-time Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className={`bg-white border rounded-lg p-4 ${
            metric.status === 'critical' ? 'border-red-300 bg-red-50' :
            metric.status === 'warning' ? 'border-amber-300 bg-amber-50' :
            'border-stone-200'
          }`}>
            <p className="text-xs font-semibold text-stone-500 uppercase mb-1">{metric.label}</p>
            <p className="text-2xl font-bold text-stone-900">{metric.value}</p>
            <div className="flex items-center gap-1 mt-1">
              {metric.change > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingUp className="h-3 w-3 text-red-600 rotate-180" />
              )}
              <span className={`text-xs font-medium ${
                metric.change > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.abs(metric.change)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Security Events */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wider flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Real-Time Security Events
          </h3>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-stone-600">Live</span>
          </div>
        </div>

        <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
          {recentEvents.map((event, index) => (
            <div key={index} className="px-6 py-3 hover:bg-stone-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {event.severity === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                  ) : event.severity === 'critical' ? (
                    <Ban className="h-4 w-4 text-red-600 mt-0.5" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                  )}
                  <div>
                    <p className="text-sm text-stone-900">{event.event}</p>
                    <p className="text-xs text-stone-500 mt-0.5">{event.time}</p>
                  </div>
                </div>
                <button className="text-xs text-stone-600 hover:text-stone-900 font-medium">
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security Health Score */}
      <div className="bg-gradient-to-br from-stone-900 to-stone-700 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Overall Security Health</h3>
            <p className="text-sm text-stone-300 mt-1">Based on 24-hour activity</p>
          </div>
          <Shield className="h-12 w-12 text-white opacity-50" />
        </div>

        <div className="flex items-end gap-4">
          <div className="text-6xl font-bold">98</div>
          <div className="text-2xl font-semibold mb-2">/100</div>
        </div>

        <div className="mt-4 h-2 bg-stone-800 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: '98%' }}></div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-stone-300">Authentication</p>
            <p className="font-semibold">Excellent</p>
          </div>
          <div>
            <p className="text-stone-300">API Security</p>
            <p className="font-semibold">Strong</p>
          </div>
          <div>
            <p className="text-stone-300">Data Protection</p>
            <p className="font-semibold">Excellent</p>
          </div>
        </div>
      </div>
    </div>
  );
}
