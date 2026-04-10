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
    if (score >= 60) return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">High Risk</span>;
    if (score >= 40) return <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">Medium Risk</span>;
    if (score >= 20) return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Low Risk</span>;
    return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Clean</span>;
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-600" />
                Security Center
              </h1>
              <p className="text-gray-600 mt-1">
                Comprehensive security monitoring and threat detection
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <div className="relative">
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Report
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border z-50">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                    >
                      <Download className="w-4 h-4 text-green-600" />
                      <div>
                        <div className="font-medium text-sm">Export as CSV</div>
                        <div className="text-xs text-gray-500">Spreadsheet format</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b"
                    >
                      <Download className="w-4 h-4 text-blue-600" />
                      <div>
                        <div className="font-medium text-sm">Export as JSON</div>
                        <div className="text-xs text-gray-500">Structured data</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleExport('pdf')}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 rounded-b-lg"
                    >
                      <Download className="w-4 h-4 text-red-600" />
                      <div>
                        <div className="font-medium text-sm">Export as PDF</div>
                        <div className="text-xs text-gray-500">Printable report</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-lg shadow-sm border"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Logins Today</p>
                    <p className="text-3xl font-bold mt-1">{stats.loginsToday}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm text-green-600">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span>Active monitoring</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-lg shadow-sm border"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Failed Logins</p>
                    <p className="text-3xl font-bold mt-1">{stats.failedLoginsToday}</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm text-red-600">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  <span>{((stats.failedLoginsToday / (stats.loginsToday || 1)) * 100).toFixed(1)}% failure rate</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-lg shadow-sm border"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Suspicious Activity</p>
                    <p className="text-3xl font-bold mt-1">{threatStats.suspicious}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Eye className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm text-orange-600">
                  <Shield className="w-4 h-4 mr-1" />
                  <span>{threatStats.vpn} VPN, {threatStats.proxy} Proxy</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white p-6 rounded-lg shadow-sm border"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Critical Events</p>
                    <p className="text-3xl font-bold mt-1">{stats.criticalEvents24h}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <div className="mt-4 flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-1" />
                  <span>Last 24 hours</span>
                </div>
              </motion.div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="border-b">
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
                    className={`flex items-center gap-2 px-4 py-4 border-b-2 transition-colors ${
                      selectedTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="p-6 border-b bg-gray-50">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[300px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by email, IP address..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success Only</option>
                  <option value="failed">Failed Only</option>
                </select>
                <select
                  value={filterThreat}
                  onChange={(e) => setFilterThreat(e.target.value as any)}
                  className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Threat Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-gray-900">
                      {log.user ? `${log.user.first_name} ${log.user.last_name}` : 'Unknown'}
                    </div>
                    <div className="text-gray-500">{log.email}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  {log.ip_address}
                  {log.is_vpn && <span className="ml-2 text-xs text-orange-600">(VPN)</span>}
                  {log.is_proxy && <span className="ml-2 text-xs text-orange-600">(Proxy)</span>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {log.geo_city && log.geo_country ? (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-gray-400" />
                      {log.geo_city}, {log.geo_country}
                    </div>
                  ) : (
                    <span className="text-gray-400">Unknown</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {log.device_info?.browser || 'Unknown'} / {log.device_info?.os || 'Unknown'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {log.status === 'success' ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      Success
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="w-4 h-4" />
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="text-sm text-red-600 font-medium">High Threat</div>
          <div className="text-2xl font-bold text-red-700 mt-1">{threatStats.highThreat}</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="text-sm text-orange-600 font-medium">VPN Detected</div>
          <div className="text-2xl font-bold text-orange-700 mt-1">{threatStats.vpn}</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="text-sm text-yellow-600 font-medium">Proxy Detected</div>
          <div className="text-2xl font-bold text-yellow-700 mt-1">{threatStats.proxy}</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <div className="text-sm text-purple-600 font-medium">Suspicious</div>
          <div className="text-2xl font-bold text-purple-700 mt-1">{threatStats.suspicious}</div>
        </div>
      </div>

      {/* Suspicious Activity List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Suspicious Activity</h3>
        <div className="space-y-3">
          {suspiciousLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-12 h-12 mx-auto mb-2 text-green-500" />
              <p>No suspicious activity detected</p>
            </div>
          ) : (
            suspiciousLogs.map(log => (
              <div key={log.id} className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                      <span className="font-semibold text-red-900">{log.email}</span>
                      <span className="text-sm text-red-600">
                        Threat Score: {log.threat_score}/100
                      </span>
                    </div>
                    <div className="text-sm text-red-700 space-y-1">
                      <div>IP: {log.ip_address}</div>
                      <div>Location: {log.geo_city}, {log.geo_country}</div>
                      <div>Reason: {log.threat_reason || 'Suspicious pattern detected'}</div>
                      <div>Time: {new Date(log.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <button className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
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
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <button
          onClick={() => setShowIPLookup(!showIPLookup)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900"
        >
          <Search className="w-4 h-4" />
          IP Address Lookup Tool
          <ChevronDown className={`w-4 h-4 transition-transform ${showIPLookup ? 'rotate-180' : ''}`} />
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
          <h3 className="text-lg font-semibold mb-4">Access by Country</h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {countries.length > 0 ? (
              countries.map(({ country, count, suspicious }) => (
                <div key={country} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="font-medium">{country}</div>
                      <div className="text-sm text-gray-500">{count} access attempts</div>
                    </div>
                  </div>
                  {suspicious > 0 && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                      {suspicious} suspicious
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Globe className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No geolocation data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Interactive Map */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Geographic Distribution</h3>
          <div className="bg-gray-900 rounded-lg h-[500px] overflow-hidden">
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
        <h3 className="text-lg font-semibold">Active Sessions ({sessions.length})</h3>
        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
          <Ban className="w-4 h-4" />
          Terminate All
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sessions.map(session => (
          <div key={session.id} className="bg-white border rounded-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium">{session.email}</div>
                  <div className="text-sm text-gray-500">
                    {session.user ? `${session.user.first_name} ${session.user.last_name}` : 'Unknown User'}
                  </div>
                </div>
              </div>
              <button className="text-red-600 hover:text-red-700 text-sm">
                Terminate
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Server className="w-4 h-4" />
                <span className="font-mono">{session.ip_address}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{session.geo_city}, {session.geo_country}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Activity className="w-4 h-4" />
                <span>{session.device_info?.browser} on {session.device_info?.os}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-4 h-4" />
                <span>Last active: {new Date(session.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
