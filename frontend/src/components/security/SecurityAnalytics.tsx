'use client';

import { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Shield, 
  Globe,
  Activity,
  Clock,
  MapPin
} from 'lucide-react';

interface SecurityLog {
  id: string;
  created_at: string;
  email: string;
  status: string;
  ip_address: string;
  geo_country?: string;
  geo_city?: string;
  is_suspicious?: boolean;
  threat_score?: number;
  is_vpn?: boolean;
  is_proxy?: boolean;
}

interface SecurityAnalyticsProps {
  logs: SecurityLog[];
}

export function SecurityAnalytics({ logs }: SecurityAnalyticsProps) {
  const analytics = useMemo(() => {
    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7d = now - 7 * 24 * 60 * 60 * 1000;

    // Filter logs by time period
    const logs24h = logs.filter(l => new Date(l.created_at).getTime() > last24h);
    const logs7d = logs.filter(l => new Date(l.created_at).getTime() > last7d);

    // Calculate metrics
    const totalLogins = logs24h.length;
    const failedLogins = logs24h.filter(l => l.status === 'failed').length;
    const suspiciousActivity = logs24h.filter(l => l.is_suspicious).length;
    const vpnDetected = logs24h.filter(l => l.is_vpn).length;
    const proxyDetected = logs24h.filter(l => l.is_proxy).length;

    // Calculate trends (compare last 24h vs previous 24h)
    const previous24h = logs.filter(l => {
      const time = new Date(l.created_at).getTime();
      return time > last24h - 24 * 60 * 60 * 1000 && time <= last24h;
    });
    
    const loginTrend = previous24h.length > 0 
      ? ((totalLogins - previous24h.length) / previous24h.length) * 100 
      : 0;

    // Top countries
    const countryCount = logs24h.reduce((acc, log) => {
      const country = log.geo_country || 'Unknown';
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topCountries = Object.entries(countryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([country, count]) => ({ country, count }));

    // Hourly activity (last 24 hours)
    const hourlyActivity = Array.from({ length: 24 }, (_, i) => {
      const hourStart = now - (23 - i) * 60 * 60 * 1000;
      const hourEnd = hourStart + 60 * 60 * 1000;
      
      const logins = logs.filter(l => {
        const time = new Date(l.created_at).getTime();
        return time >= hourStart && time < hourEnd;
      }).length;

      return {
        hour: new Date(hourStart).getHours(),
        logins
      };
    });

    // Peak activity hour
    const peakHour = hourlyActivity.reduce((max, curr) => 
      curr.logins > max.logins ? curr : max
    );

    // Average threat score
    const threatScores = logs24h
      .map(l => l.threat_score || 0)
      .filter(s => s > 0);
    const avgThreatScore = threatScores.length > 0
      ? threatScores.reduce((a, b) => a + b, 0) / threatScores.length
      : 0;

    return {
      totalLogins,
      failedLogins,
      suspiciousActivity,
      vpnDetected,
      proxyDetected,
      loginTrend,
      topCountries,
      hourlyActivity,
      peakHour,
      avgThreatScore,
      failureRate: totalLogins > 0 ? (failedLogins / totalLogins) * 100 : 0
    };
  }, [logs]);

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Logins */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-blue-700">Total Logins (24h)</div>
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-900">{analytics.totalLogins}</div>
          <div className="flex items-center mt-2 text-sm">
            {analytics.loginTrend >= 0 ? (
              <>
                <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                <span className="text-green-600">+{analytics.loginTrend.toFixed(1)}%</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-4 h-4 text-red-600 mr-1" />
                <span className="text-red-600">{analytics.loginTrend.toFixed(1)}%</span>
              </>
            )}
            <span className="text-gray-600 ml-1">vs yesterday</span>
          </div>
        </div>

        {/* Failed Logins */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-lg border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-red-700">Failed Logins</div>
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="text-3xl font-bold text-red-900">{analytics.failedLogins}</div>
          <div className="mt-2 text-sm text-red-700">
            {analytics.failureRate.toFixed(1)}% failure rate
          </div>
        </div>

        {/* Suspicious Activity */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-orange-700">Suspicious Activity</div>
            <Shield className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-3xl font-bold text-orange-900">{analytics.suspiciousActivity}</div>
          <div className="mt-2 text-sm text-orange-700">
            {analytics.vpnDetected} VPN, {analytics.proxyDetected} Proxy
          </div>
        </div>

        {/* Avg Threat Score */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-purple-700">Avg Threat Score</div>
            <Activity className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-purple-900">
            {analytics.avgThreatScore.toFixed(0)}/100
          </div>
          <div className="mt-2 text-sm text-purple-700">
            {analytics.avgThreatScore < 30 ? 'Low risk' : 
             analytics.avgThreatScore < 60 ? 'Medium risk' : 'High risk'}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Activity Chart */}
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Activity Timeline (24h)</h3>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-2">
            {analytics.hourlyActivity.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="text-xs text-gray-500 w-12">
                  {item.hour.toString().padStart(2, '0')}:00
                </div>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                  <div 
                    className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ 
                      width: `${(item.logins / Math.max(...analytics.hourlyActivity.map(h => h.logins))) * 100}%` 
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                    {item.logins > 0 && item.logins}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Peak activity: {analytics.peakHour.hour}:00 ({analytics.peakHour.logins} logins)
          </div>
        </div>

        {/* Top Countries */}
        <div className="bg-white p-6 rounded-lg border">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Top Countries (24h)</h3>
            <Globe className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {analytics.topCountries.length > 0 ? (
              analytics.topCountries.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">{item.country}</span>
                    </div>
                    <div className="mt-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-blue-500 h-full rounded-full"
                        style={{ 
                          width: `${(item.count / analytics.topCountries[0].count) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                  <div className="text-lg font-bold text-gray-700">{item.count}</div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Globe className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
