'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { adminLogsAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
  Shield,
  AlertTriangle,
  Globe,
  Lock,
  Activity,
  Users,
  MapPin,
  Server,
  Eye,
  Ban,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Filter,
  Download,
  RefreshCw,
  Search,
  ChevronDown
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SecurityMap } from '@/components/security/SecurityMap';
import { IPLookup } from '@/components/security/IPLookup';
import { SecurityAnalytics } from '@/components/security/SecurityAnalytics';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportSecurityReport';

interface SecurityLog {
  id: string;
  created_at: string;
  email: string;
  status: string;
  ip_address: string;
  user_agent: string;
  device_info: any;
  geo_country?: string;
  geo_city?: string;
  geo_latitude?: number;
  geo_longitude?: number;
  is_proxy?: boolean;
  is_vpn?: boolean;
  threat_score?: number;
  is_suspicious?: boolean;
  threat_reason?: string;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface SecurityStats {
  loginsToday: number;
  failedLoginsToday: number;
  securityAlertsToday: number;
  criticalEvents24h: number;
  activityTrend: Array<{ time: string; logins: number; alerts: number }>;
}

export default function SecurityDashboardPage() {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'analytics' | 'access' | 'threats' | 'geo' | 'sessions'>('analytics');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed'>('all');
  const [filterThreat, setFilterThreat] = useState<'all' | 'suspicious' | 'clean'>('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [overviewRes, logsRes] = await Promise.all([
        adminLogsAPI.getOverview(),
        adminLogsAPI.getLogs({
          category: 'security',
          page,
          limit: 50,
          search: searchTerm || undefined
        })
      ]);

      if (overviewRes.success) {
        setStats(overviewRes.data);
      }

      if (logsRes.success) {
        setLogs(logsRes.data || []);
        setTotalCount(logsRes.count || 0);
      }
    } catch (error: any) {
      toast.error('Failed to fetch security data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [page, searchTerm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter logs based on selected filters
  const filteredLogs = logs.filter(log => {
    if (filterStatus !== 'all' && log.status !== filterStatus) return false;
    if (filterThreat === 'suspicious' && !log.is_suspicious) return false;
    if (filterThreat === 'clean' && log.is_suspicious) return false;
    return true;
  });

  // Export handler
  const handleExport = (format: 'csv' | 'json' | 'pdf') => {
    try {
      switch (format) {
        case 'csv':
          exportToCSV(filteredLogs, stats);
          toast.success('CSV report exported successfully!');
          break;
        case 'json':
          exportToJSON(filteredLogs, stats);
          toast.success('JSON report exported successfully!');
          break;
        case 'pdf':
          exportToPDF(filteredLogs, stats);
          toast.success('PDF report generated successfully!');
          break;
      }
      setShowExportMenu(false);
    } catch (error) {
      toast.error('Failed to export report');
      console.error('Export error:', error);
    }
  };

  // Calculate threat statistics
  const threatStats = {
    total: logs.length,
    suspicious: logs.filter(l => l.is_suspicious).length,
    vpn: logs.filter(l => l.is_vpn).length,
    proxy: logs.filter(l => l.is_proxy).length,
    highThreat: logs.filter(l => (l.threat_score || 0) >= 60).length
  };

  // Group logs by country for geo view
  const logsByCountry = logs.reduce((acc, log) => {
    const country = log.geo_country || 'Unknown';
    if (!acc[country]) {
      acc[country] = { count: 0, suspicious: 0, cities: new Set() };
    }
    acc[country].count++;
    if (log.is_suspicious) acc[country].suspicious++;
    if (log.geo_city) acc[country].cities.add(log.geo_city);
    return acc;
  }, {} as Record<string, { count: number; suspicious: number; cities: Set<string> }>);

  const getThreatBadge = (log: SecurityLog) => {
    const score = log.threat_score || 0;
    if (score >= 60) return <span className="px-2 py-1 text-xs rounded-full bg-stone-100 text-stone-900 font-medium">High Risk</span>;
    if (score >= 40) return <span className="px-2 py-1 text-xs rounded-full bg-stone-100 text-stone-700 font-medium">Medium Risk</span>;
    if (score >= 20) return <span className="px-2 py-1 text-xs rounded-full bg-stone-100 text-stone-600 font-medium">Low Risk</span>;
    return <span className="px-2 py-1 text-xs rounded-full bg-stone-50 text-stone-500 font-medium">Clean</span>;
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Security Center</h1>
              <p className="text-stone-500 mt-0.5">
                Comprehensive security monitoring and threat detection
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchData}
                className="btn-secondary h-10 px-3"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <div className="relative">
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="btn-primary h-10"
                >
                  <Download className="h-4 w-4" />
                  <span>Export Report</span>
                  <ChevronDown className="h-4 w-4" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-stone-100 z-50">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full px-4 py-3 text-left hover:bg-stone-50 flex items-center gap-3 border-b border-stone-100"
                    >
                      <Download className="h-4 w-4 text-stone-600" />
                      <div>
                        <div className="font-medium text-sm text-stone-900">Export as CSV</div>
                        <div className="text-xs text-stone-500">Spreadsheet format</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-4 py-3 text-left hover:bg-stone-50 flex items-center gap-3 border-b border-stone-100"
                    >
                      <Download className="h-4 w-4 text-stone-600" />
                      <div>
                        <div className="font-medium text-sm text-stone-900">Export as JSON</div>
                        <div className="text-xs text-stone-500">Structured data</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full px-4 py-3 text-left hover:bg-stone-50 flex items-center gap-3 rounded-b-lg"
                    >
                      <Download className="h-4 w-4 text-stone-600" />
                      <div>
                        <div className="font-medium text-sm text-stone-900">Export as PDF</div>
                        <div className="text-xs text-stone-500">Branded report</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Cards - Stone Theme */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Logins Today</p>
                <p className="text-2xl font-semibold text-stone-900 mt-1">{stats.loginsToday}</p>
                <div className="mt-2 flex items-center text-[11px] text-stone-500">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  <span>Active monitoring</span>
                </div>
              </div>

              <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm border-l-4 border-l-amber-500">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Failed Logins</p>
                <p className="text-2xl font-semibold text-amber-600 mt-1">{stats.failedLoginsToday}</p>
                <div className="mt-2 flex items-center text-[11px] text-stone-500">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  <span>{((stats.failedLoginsToday / (stats.loginsToday || 1)) * 100).toFixed(1)}% failure rate</span>
                </div>
              </div>

              <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Suspicious Activity</p>
                <p className="text-2xl font-semibold text-stone-900 mt-1">{threatStats.suspicious}</p>
                <div className="mt-2 flex items-center text-[11px] text-stone-500">
                  <Shield className="h-3 w-3 mr-1" />
                  <span>{threatStats.vpn} VPN, {threatStats.proxy} Proxy</span>
                </div>
              </div>

              <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Critical Events</p>
                <p className="text-2xl font-semibold text-stone-900 mt-1">{stats.criticalEvents24h}</p>
                <div className="mt-2 flex items-center text-[11px] text-stone-500">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>Last 24 hours</span>
                </div>
              </div>
            </div>
          )}

          {/* Tabs - Stone Theme */}
          <div className="bg-white rounded-lg shadow-sm border border-stone-100">
            <div className="border-b border-stone-100">
              <div className="flex gap-4 px-6">
                {[
                  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
                  { id: 'access', label: 'Access Control', icon: Lock },
                  { id: 'threats', label: 'Threat Detection', icon: AlertTriangle },
                  { id: 'geo', label: 'Geolocation', icon: Globe },
                  { id: 'sessions', label: 'Active Sessions', icon: Activity }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedTab(tab.id as any)}
                    className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors text-sm font-medium ${
                      selectedTab === tab.id
                        ? 'border-stone-900 text-stone-900'
                        : 'border-transparent text-stone-500 hover:text-stone-900'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="p-6 border-b border-stone-100 bg-stone-50/50">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[300px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search by email, IP address..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                    />
                  </div>
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="h-10 px-3 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success Only</option>
                  <option value="failed">Failed Only</option>
                </select>
                <select
                  value={filterThreat}
                  onChange={(e) => setFilterThreat(e.target.value as any)}
                  className="h-10 px-3 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                >
                  <option value="all">All Threats</option>
                  <option value="suspicious">Suspicious Only</option>
                  <option value="clean">Clean Only</option>
                </select>
              </div>
            </div>

            {/* Content based on selected tab */}
            <div className="p-6">
              {selectedTab === 'analytics' && (
                <SecurityAnalytics logs={filteredLogs} />
              )}
              {selectedTab === 'access' && (
                <AccessControlTab logs={filteredLogs} getThreatBadge={getThreatBadge} />
              )}
              {selectedTab === 'threats' && (
                <ThreatDetectionTab logs={filteredLogs} threatStats={threatStats} />
              )}
              {selectedTab === 'geo' && (
                <GeolocationTab logs={filteredLogs} logsByCountry={logsByCountry} />
              )}
              {selectedTab === 'sessions' && (
                <ActiveSessionsTab logs={filteredLogs} />
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

// Access Control Tab Component
function AccessControlTab({ logs, getThreatBadge }: { logs: SecurityLog[]; getThreatBadge: (log: SecurityLog) => JSX.Element }) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50/50 border-b border-stone-100">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Timestamp</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">User</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">IP Address</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Location</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Device</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase tracking-wider">Threat Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-stone-50/50 transition-colors">
                <td className="px-4 py-3 text-sm text-stone-900">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-stone-900">
                      {log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Unknown'}
                    </div>
                    <div className="text-stone-500 text-xs">{log.email}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-stone-900">
                  {log.ip_address}
                  {log.is_vpn && <span className="ml-2 text-xs text-stone-600">(VPN)</span>}
                  {log.is_proxy && <span className="ml-2 text-xs text-stone-600">(Proxy)</span>}
                </td>
                <td className="px-4 py-3 text-sm text-stone-900">
                  {log.geo_city && log.geo_country ? (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-stone-400" />
                      {log.geo_city}, {log.geo_country}
                    </div>
                  ) : (
                    <span className="text-stone-400">Unknown</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-stone-600">
                  {log.device_info?.browser || 'Unknown'} / {log.device_info?.os || 'Unknown'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {log.status === 'success' ? (
                    <span className="flex items-center gap-1 text-stone-600">
                      <CheckCircle className="h-4 w-4" />
                      Success
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-stone-900">
                      <XCircle className="h-4 w-4" />
                      Failed
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  {getThreatBadge(log)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Threat Detection Tab Component
function ThreatDetectionTab({ logs, threatStats }: { logs: SecurityLog[]; threatStats: any }) {
  const suspiciousLogs = logs.filter(l => l.is_suspicious);

  return (
    <div className="space-y-6">
      {/* Threat Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm border-l-4 border-l-stone-900">
          <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">High Threat</div>
          <div className="text-2xl font-semibold text-stone-900 mt-1">{threatStats.highThreat}</div>
        </div>
        <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
          <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">VPN Detected</div>
          <div className="text-2xl font-semibold text-stone-900 mt-1">{threatStats.vpn}</div>
        </div>
        <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
          <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Proxy Detected</div>
          <div className="text-2xl font-semibold text-stone-900 mt-1">{threatStats.proxy}</div>
        </div>
        <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
          <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Suspicious</div>
          <div className="text-2xl font-semibold text-stone-900 mt-1">{threatStats.suspicious}</div>
        </div>
      </div>

      {/* Suspicious Activity List */}
      <div>
        <h3 className="text-sm font-semibold text-stone-900 mb-4 uppercase tracking-wider">Suspicious Activity</h3>
        <div className="space-y-3">
          {suspiciousLogs.length === 0 ? (
            <div className="text-center py-8 text-stone-500">
              <Shield className="h-12 w-12 mx-auto mb-2 text-stone-300" />
              <p>No suspicious activity detected</p>
            </div>
          ) : (
            suspiciousLogs.map(log => (
              <div key={log.id} className="bg-stone-50 border border-stone-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-stone-900" />
                      <span className="font-semibold text-stone-900">{log.email}</span>
                      <span className="text-sm text-stone-600">
                        Threat Score: {log.threat_score}/100
                      </span>
                    </div>
                    <div className="text-sm text-stone-700 space-y-1">
                      <div>IP: {log.ip_address}</div>
                      <div>Location: {log.geo_city}, {log.geo_country}</div>
                      <div>Reason: {log.threat_reason || 'Suspicious pattern detected'}</div>
                      <div>Time: {new Date(log.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <button className="px-3 py-1 bg-stone-900 text-white text-sm rounded hover:bg-black transition-colors">
                    Block IP
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Geolocation Tab Component
function GeolocationTab({ logs, logsByCountry }: { logs: SecurityLog[]; logsByCountry: any }) {
  const [showIPLookup, setShowIPLookup] = useState(false);
  
  const countries = Object.entries(logsByCountry)
    .map(([country, data]: [string, any]) => ({
      country,
      count: data.count,
      suspicious: data.suspicious,
      cities: Array.from(data.cities)
    }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      {/* IP Lookup Tool */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <button
          onClick={() => setShowIPLookup(!showIPLookup)}
          className="flex items-center gap-2 text-sm font-semibold text-stone-700 hover:text-stone-900"
        >
          <Search className="h-4 w-4" />
          IP Address Lookup Tool
          <ChevronDown className={`h-4 w-4 transition-transform ${showIPLookup ? 'rotate-180' : ''}`} />
        </button>
        {showIPLookup && (
          <div className="mt-4">
            <IPLookup />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Country List */}
        <div>
          <h3 className="text-sm font-semibold text-stone-900 mb-4 uppercase tracking-wider">Access by Country</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {countries.length > 0 ? (
              countries.map(({ country, count, suspicious }) => (
                <div key={country} className="flex items-center justify-between p-3 bg-stone-50 border border-stone-100 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Globe className="h-5 w-5 text-stone-400" />
                    <div>
                      <div className="font-medium text-stone-900">{country}</div>
                      <div className="text-sm text-stone-500">{count} access attempts</div>
                    </div>
                  </div>
                  {suspicious > 0 && (
                    <span className="px-2 py-1 bg-stone-100 text-stone-900 text-xs rounded-full font-medium">
                      {suspicious} suspicious
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-stone-500">
                <Globe className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>No geolocation data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Map */}
        <div>
          <h3 className="text-sm font-semibold text-stone-900 mb-4 uppercase tracking-wider">Geographic Distribution</h3>
          <div className="bg-stone-900 rounded-lg h-[500px] overflow-hidden">
            <SecurityMap logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );
}

// Active Sessions Tab Component
function ActiveSessionsTab({ logs }: { logs: SecurityLog[] }) {
  // Get unique active sessions (last 24 hours, successful logins)
  const activeSessions = logs
    .filter(l => l.status === 'success')
    .filter(l => new Date(l.created_at).getTime() > Date.now() - 24 * 60 * 60 * 1000)
    .reduce((acc, log) => {
      const key = `${log.email}-${log.ip_address}`;
      if (!acc[key] || new Date(log.created_at) > new Date(acc[key].created_at)) {
        acc[key] = log;
      }
      return acc;
    }, {} as Record<string, SecurityLog>);

  const sessions = Object.values(activeSessions);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">Active Sessions ({sessions.length})</h3>
        <button className="px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-black flex items-center gap-2 text-sm transition-colors">
          <Ban className="h-4 w-4" />
          Terminate All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sessions.map(session => (
          <div key={session.id} className="bg-white border border-stone-100 rounded-lg p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5 text-stone-600" />
                </div>
                <div>
                  <div className="font-medium text-stone-900">{session.email}</div>
                  <div className="text-sm text-stone-500">
                    {session.user ? `${session.user.first_name} ${session.user.last_name}` : 'Unknown User'}
                  </div>
                </div>
              </div>
              <button className="text-stone-600 hover:text-stone-900 text-sm font-medium">
                Terminate
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-stone-600">
                <Server className="h-4 w-4" />
                <span className="font-mono">{session.ip_address}</span>
              </div>
              <div className="flex items-center gap-2 text-stone-600">
                <MapPin className="h-4 w-4" />
                <span>{session.geo_city}, {session.geo_country}</span>
              </div>
              <div className="flex items-center gap-2 text-stone-600">
                <Activity className="h-4 w-4" />
                <span>{session.device_info?.browser} on {session.device_info?.os}</span>
              </div>
              <div className="flex items-center gap-2 text-stone-600">
                <Clock className="h-4 w-4" />
                <span>Last active: {new Date(session.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
