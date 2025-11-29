'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, FileSearch, ClipboardCheck, AlertTriangle, RefreshCw, CheckCircle, XCircle, Clock, 
  BarChart3, FileText, Package, Building2, TrendingUp, Eye, Calendar, Download, AlertCircle,
  Activity, Target, DollarSign, Lock, Database, ChevronRight, Zap, Search, Bell, Settings,
  Fingerprint, Radar, Brain, LineChart, PieChart, Scale, Wallet, CreditCard, Users, Truck,
  ShieldCheck, ShieldAlert, Timer, Play, Pause, RotateCcw, FileWarning, CheckCheck, Sparkles
} from 'lucide-react';
import { auditAPI } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';
import Link from 'next/link';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-green-700', bg: 'bg-green-100' },
  medium: { label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-100' },
  high: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100' },
  critical: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-100' },
};

const BRANCHES = [
  { code: 'FGB-HQ', name: 'Bomet HQ', score: 94, findings: 2, status: 'good', lastAudit: '2024-11-25' },
  { code: 'FGB-BMT', name: 'Bomet Town', score: 87, findings: 5, status: 'warning', lastAudit: '2024-11-20' },
  { code: 'FGB-KER', name: 'Kericho', score: 91, findings: 3, status: 'good', lastAudit: '2024-11-22' },
  { code: 'FGB-KAP', name: 'Kapsoit', score: 78, findings: 8, status: 'critical', lastAudit: '2024-11-18' },
  { code: 'FGB-MOG', name: 'Mogogosiek', score: 89, findings: 4, status: 'good', lastAudit: '2024-11-24' },
  { code: 'FGB-LIT', name: 'Litein', score: 85, findings: 6, status: 'warning', lastAudit: '2024-11-21' },
];

const AUDIT_TOOLS = [
  { id: 'continuous', name: 'Continuous Monitoring', icon: Radar, status: 'active', desc: 'Real-time transaction monitoring', color: 'green' },
  { id: 'fraud', name: 'Fraud Detection', icon: ShieldAlert, status: 'active', desc: 'AI-powered anomaly detection', color: 'red' },
  { id: 'analytics', name: 'Data Analytics', icon: Brain, status: 'active', desc: 'Pattern recognition & insights', color: 'purple' },
  { id: 'risk', name: 'Risk Assessment', icon: Target, status: 'active', desc: 'Automated risk scoring', color: 'orange' },
  { id: 'sampling', name: 'Smart Sampling', icon: Sparkles, status: 'active', desc: 'Statistical sample selection', color: 'blue' },
  { id: 'reconcile', name: 'Auto Reconciliation', icon: Scale, status: 'paused', desc: 'Automated account matching', color: 'indigo' },
];

const SCHEDULED_AUDITS = [
  { id: '1', name: 'Monthly Financial Review', type: 'Financial', branch: 'All Branches', date: '2024-12-01', status: 'scheduled' },
  { id: '2', name: 'Inventory Stock Take', type: 'Inventory', branch: 'Kapsoit', date: '2024-11-30', status: 'scheduled' },
  { id: '3', name: 'Quarterly Compliance Check', type: 'Compliance', branch: 'All Branches', date: '2024-12-15', status: 'scheduled' },
  { id: '4', name: 'Security Access Review', type: 'Security', branch: 'Bomet HQ', date: '2024-11-29', status: 'in_progress' },
];

const FRAUD_ALERTS = [
  { id: '1', type: 'Unusual Transaction', severity: 'high', desc: 'Large cash withdrawal outside normal hours', branch: 'Litein', time: '2 hours ago' },
  { id: '2', type: 'Access Anomaly', severity: 'medium', desc: 'Multiple failed login attempts', branch: 'Bomet Town', time: '4 hours ago' },
  { id: '3', type: 'Pattern Deviation', severity: 'low', desc: 'Expense approval bypassed normal workflow', branch: 'Kericho', time: '1 day ago' },
];

export default function AuditDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tools' | 'analytics' | 'schedule' | 'branches'>('overview');
  const [auditStats, setAuditStats] = useState({
    totalAudits: 156, completedAudits: 142, pendingAudits: 14, findings: 28,
    openFindings: 12, resolvedRate: 89, complianceRate: 87, riskScore: 13,
    fraudAlerts: 3, anomalies: 7, transactionsMonitored: 12450,
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [findings] = useState([
    { id: '1', title: 'Inventory variance in kitchen supplies', category: 'Inventory', risk: 'high' as RiskLevel, status: 'open', branch: 'Kapsoit', date: '2024-11-27' },
    { id: '2', title: 'Unauthorized access attempt', category: 'Security', risk: 'critical' as RiskLevel, status: 'in_progress', branch: 'Bomet Town', date: '2024-11-26' },
    { id: '3', title: 'Missing receipt documentation', category: 'Financial', risk: 'medium' as RiskLevel, status: 'open', branch: 'Litein', date: '2024-11-25' },
    { id: '4', title: 'Expired items in storage', category: 'Compliance', risk: 'high' as RiskLevel, status: 'resolved', branch: 'Mogogosiek', date: '2024-11-24' },
    { id: '5', title: 'Cash register discrepancy', category: 'Financial', risk: 'medium' as RiskLevel, status: 'open', branch: 'Kericho', date: '2024-11-23' },
  ]);

  useEffect(() => { fetchAuditData(); }, []);

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      const [logsRes] = await Promise.all([auditAPI.getAuditLogs().catch(() => ({ logs: [] }))]);
      const logs = logsRes.logs || logsRes.data || [];
      setRecentLogs(Array.isArray(logs) ? logs.slice(0, 10) : []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => score >= 90 ? 'text-green-600' : score >= 80 ? 'text-amber-600' : 'text-red-600';
  const getStatusColor = (status: string) => status === 'good' ? 'bg-green-100 text-green-700' : status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                Audit Command Center
              </h1>
              <p className="text-gray-600 mt-1">AI-powered audit management, real-time monitoring & compliance tracking</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">{auditStats.fraudAlerts}</span>
              </Button>
              <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Export</Button>
              <Button onClick={fetchAuditData} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Sync
              </Button>
            </div>
          </div>

          {/* Risk Score & Monitoring Banner */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className={`p-5 col-span-2 ${auditStats.riskScore < 15 ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-4 rounded-2xl ${auditStats.riskScore < 15 ? 'bg-green-100' : 'bg-amber-100'}`}>
                    <Target className={`h-8 w-8 ${auditStats.riskScore < 15 ? 'text-green-600' : 'text-amber-600'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Enterprise Risk Score</p>
                    <div className="flex items-center gap-3">
                      <span className={`text-4xl font-bold ${auditStats.riskScore < 15 ? 'text-green-700' : 'text-amber-700'}`}>{auditStats.riskScore}%</span>
                      <Badge className={auditStats.riskScore < 15 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                        {auditStats.riskScore < 15 ? 'Low Risk' : 'Moderate Risk'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="hidden md:grid grid-cols-3 gap-6">
                  <div className="text-center"><p className="text-3xl font-bold text-green-600">{auditStats.complianceRate}%</p><p className="text-xs text-gray-500">Compliance</p></div>
                  <div className="text-center"><p className="text-3xl font-bold text-blue-600">{auditStats.resolvedRate}%</p><p className="text-xs text-gray-500">Resolved</p></div>
                  <div className="text-center"><p className="text-3xl font-bold text-purple-600">{auditStats.transactionsMonitored.toLocaleString()}</p><p className="text-xs text-gray-500">Monitored</p></div>
                </div>
              </div>
            </Card>

            {/* Live Monitoring Status */}
            <Card className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-sm font-medium">Live Monitoring</span>
                </div>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Active</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div><p className="text-2xl font-bold">{auditStats.fraudAlerts}</p><p className="text-xs text-gray-400">Fraud Alerts</p></div>
                <div><p className="text-2xl font-bold">{auditStats.anomalies}</p><p className="text-xs text-gray-400">Anomalies</p></div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Radar className="h-4 w-4" />
                  <span>Scanning all 6 branches in real-time</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: 'Total Audits', value: auditStats.totalAudits, icon: FileSearch, color: 'blue' },
              { label: 'Completed', value: auditStats.completedAudits, icon: CheckCircle, color: 'green' },
              { label: 'In Progress', value: auditStats.pendingAudits, icon: Clock, color: 'amber' },
              { label: 'Findings', value: auditStats.findings, icon: AlertTriangle, color: 'red' },
              { label: 'Open Issues', value: auditStats.openFindings, icon: FileWarning, color: 'orange' },
              { label: 'This Week', value: 24, icon: Activity, color: 'purple' },
              { label: 'Branches', value: 6, icon: Building2, color: 'indigo' },
              { label: 'Alerts', value: auditStats.fraudAlerts, icon: Bell, color: 'pink' },
            ].map((stat, idx) => (
              <Card key={idx} className="p-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 bg-${stat.color}-100 rounded-lg`}><stat.icon className={`h-4 w-4 text-${stat.color}-600`} /></div>
                  <div><p className="text-xs text-gray-500">{stat.label}</p><p className="text-lg font-bold">{stat.value}</p></div>
                </div>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
            {(['overview', 'tools', 'analytics', 'schedule', 'branches'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${activeTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}>
                {tab}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Navigation */}
              <Card className="p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Quick Access</h2>
                <div className="space-y-3">
                  {[
                    { href: '/dashboard/audit/logs', icon: FileSearch, label: 'Audit Trail', desc: 'Activity logs', color: 'blue' },
                    { href: '/dashboard/audit/inventory', icon: Package, label: 'Inventory Audit', desc: 'Stock verification', color: 'green' },
                    { href: '/dashboard/audit/financial', icon: BarChart3, label: 'Financial Audit', desc: 'Transaction review', color: 'purple' },
                    { href: '/dashboard/audit/compliance', icon: ClipboardCheck, label: 'Compliance', desc: 'Policy checks', color: 'amber' },
                  ].map((item, idx) => (
                    <Link key={idx} href={item.href}>
                      <motion.div whileHover={{ x: 4 }} className={`p-4 bg-${item.color}-50 rounded-lg flex items-center justify-between cursor-pointer`}>
                        <div className="flex items-center gap-3"><item.icon className={`h-5 w-5 text-${item.color}-600`} /><div><p className="font-medium">{item.label}</p><p className="text-xs text-gray-500">{item.desc}</p></div></div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </motion.div>
                    </Link>
                  ))}
                </div>
              </Card>

              {/* Fraud Alerts */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-red-500" /> Fraud Alerts</h2>
                  <Badge className="bg-red-100 text-red-700">{FRAUD_ALERTS.length} Active</Badge>
                </div>
                <div className="space-y-3">
                  {FRAUD_ALERTS.map(alert => (
                    <div key={alert.id} className={`p-3 rounded-lg border-l-4 ${alert.severity === 'high' ? 'bg-red-50 border-red-500' : alert.severity === 'medium' ? 'bg-amber-50 border-amber-500' : 'bg-blue-50 border-blue-500'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{alert.type}</span>
                        <Badge className={alert.severity === 'high' ? 'bg-red-100 text-red-700' : alert.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}>{alert.severity}</Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{alert.desc}</p>
                      <p className="text-xs text-gray-400 mt-1">{alert.branch} • {alert.time}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Recent Findings */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Recent Findings</h2>
                  <Badge variant="outline">{findings.filter(f => f.status === 'open').length} Open</Badge>
                </div>
                <div className="space-y-3">
                  {findings.slice(0, 4).map(f => (
                    <div key={f.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className={`h-4 w-4 ${RISK_CONFIG[f.risk].color}`} />
                        <span className="text-sm font-medium truncate">{f.title}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{f.branch}</span>
                        <Badge className={`${RISK_CONFIG[f.risk].bg} ${RISK_CONFIG[f.risk].color} text-xs`}>{f.risk}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Tools Tab */}
          {activeTab === 'tools' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AUDIT_TOOLS.map(tool => (
                  <motion.div key={tool.id} whileHover={{ y: -2 }}>
                    <Card className={`p-5 border-l-4 ${tool.status === 'active' ? 'border-l-green-500' : 'border-l-amber-500'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`p-3 bg-${tool.color}-100 rounded-xl`}><tool.icon className={`h-6 w-6 text-${tool.color}-600`} /></div>
                        <Badge className={tool.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                          {tool.status === 'active' ? <><div className="h-2 w-2 bg-green-500 rounded-full mr-1 animate-pulse" /> Active</> : 'Paused'}
                        </Badge>
                      </div>
                      <h3 className="font-semibold">{tool.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{tool.desc}</p>
                      <div className="flex gap-2 mt-4">
                        <Button size="sm" variant="outline" className="flex-1">
                          {tool.status === 'active' ? <><Pause className="h-3 w-3 mr-1" /> Pause</> : <><Play className="h-3 w-3 mr-1" /> Start</>}
                        </Button>
                        <Button size="sm" variant="ghost"><Settings className="h-4 w-4" /></Button>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* AI Insights */}
              <Card className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-purple-100 rounded-xl"><Brain className="h-6 w-6 text-purple-600" /></div>
                  <div><h3 className="font-semibold">AI-Powered Insights</h3><p className="text-sm text-gray-600">Automated pattern recognition and recommendations</p></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white rounded-lg"><p className="text-sm font-medium">Spending Pattern</p><p className="text-xs text-gray-500 mt-1">Kitchen supplies spending 23% higher than average this month</p><Badge className="mt-2 bg-amber-100 text-amber-700">Review Recommended</Badge></div>
                  <div className="p-4 bg-white rounded-lg"><p className="text-sm font-medium">Access Anomaly</p><p className="text-xs text-gray-500 mt-1">3 users accessed system outside business hours</p><Badge className="mt-2 bg-blue-100 text-blue-700">Low Risk</Badge></div>
                  <div className="p-4 bg-white rounded-lg"><p className="text-sm font-medium">Inventory Trend</p><p className="text-xs text-gray-500 mt-1">Stock levels in Kapsoit consistently below threshold</p><Badge className="mt-2 bg-red-100 text-red-700">Action Required</Badge></div>
                </div>
              </Card>
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><PieChart className="h-5 w-5 text-blue-600" /> Findings by Category</h3>
                <div className="space-y-3">
                  {[
                    { category: 'Financial', count: 12, pct: 43, color: 'purple' },
                    { category: 'Inventory', count: 8, pct: 29, color: 'green' },
                    { category: 'Security', count: 4, pct: 14, color: 'red' },
                    { category: 'Compliance', count: 4, pct: 14, color: 'amber' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full bg-${item.color}-500`} />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm"><span>{item.category}</span><span className="font-medium">{item.count} ({item.pct}%)</span></div>
                        <div className="h-2 bg-gray-100 rounded-full mt-1"><div className={`h-full bg-${item.color}-500 rounded-full`} style={{ width: `${item.pct}%` }} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><LineChart className="h-5 w-5 text-green-600" /> Monthly Trend</h3>
                <div className="flex items-end justify-between h-40 border-b border-l pl-2 pb-2">
                  {[65, 45, 78, 52, 88, 42, 95, 68, 74, 56, 82, 48].map((val, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <div className="w-6 bg-indigo-500 rounded-t" style={{ height: `${val}%` }} />
                      <span className="text-xs text-gray-400 mt-1">{['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][idx]}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-3 text-sm text-gray-500"><span>Audits completed per month</span><span className="text-green-600 font-medium">+12% vs last year</span></div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Building2 className="h-5 w-5 text-indigo-600" /> Branch Risk Heatmap</h3>
                <div className="grid grid-cols-3 gap-2">
                  {BRANCHES.map(b => (
                    <div key={b.code} className={`p-3 rounded-lg text-center ${b.score >= 90 ? 'bg-green-100' : b.score >= 80 ? 'bg-amber-100' : 'bg-red-100'}`}>
                      <p className="text-xs font-medium">{b.name}</p>
                      <p className={`text-lg font-bold ${getScoreColor(b.score)}`}>{b.score}%</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2"><Timer className="h-5 w-5 text-amber-600" /> Resolution Time</h3>
                <div className="space-y-4">
                  {[
                    { type: 'Critical', avg: '4 hours', target: '6 hours', status: 'good' },
                    { type: 'High', avg: '18 hours', target: '24 hours', status: 'good' },
                    { type: 'Medium', avg: '3 days', target: '3 days', status: 'warning' },
                    { type: 'Low', avg: '5 days', target: '7 days', status: 'good' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div><p className="font-medium text-sm">{item.type}</p><p className="text-xs text-gray-500">Target: {item.target}</p></div>
                      <div className="text-right"><p className={`font-bold ${item.status === 'good' ? 'text-green-600' : 'text-amber-600'}`}>{item.avg}</p>
                        {item.status === 'good' ? <CheckCheck className="h-4 w-4 text-green-600 inline" /> : <Clock className="h-4 w-4 text-amber-600 inline" />}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Scheduled Audits</h3>
                <Button size="sm"><Calendar className="h-4 w-4 mr-2" /> Schedule New</Button>
              </div>
              <Card className="overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr><th className="p-4 text-left text-xs font-semibold text-gray-600">Audit</th><th className="p-4 text-left text-xs font-semibold text-gray-600">Type</th><th className="p-4 text-left text-xs font-semibold text-gray-600">Branch</th><th className="p-4 text-left text-xs font-semibold text-gray-600">Date</th><th className="p-4 text-left text-xs font-semibold text-gray-600">Status</th><th className="p-4 text-left text-xs font-semibold text-gray-600">Actions</th></tr></thead>
                  <tbody className="divide-y">
                    {SCHEDULED_AUDITS.map(audit => (
                      <tr key={audit.id} className="hover:bg-gray-50">
                        <td className="p-4 font-medium">{audit.name}</td>
                        <td className="p-4 text-sm">{audit.type}</td>
                        <td className="p-4 text-sm">{audit.branch}</td>
                        <td className="p-4 text-sm">{audit.date}</td>
                        <td className="p-4"><Badge className={audit.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}>{audit.status.replace('_', ' ')}</Badge></td>
                        <td className="p-4"><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}

          {/* Branches Tab */}
          {activeTab === 'branches' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {BRANCHES.map(branch => (
                <motion.div key={branch.code} whileHover={{ y: -2 }}>
                  <Card className={`p-5 border-l-4 ${branch.status === 'good' ? 'border-l-green-500' : branch.status === 'warning' ? 'border-l-amber-500' : 'border-l-red-500'}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-gray-400" /><div><p className="font-semibold">{branch.name}</p><p className="text-xs text-gray-500">{branch.code}</p></div></div>
                      <Badge className={getStatusColor(branch.status)}>{branch.status}</Badge>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between"><span className="text-sm text-gray-500">Compliance</span><span className={`font-bold ${getScoreColor(branch.score)}`}>{branch.score}%</span></div>
                      <div className="h-2 bg-gray-100 rounded-full"><div className={`h-full rounded-full ${branch.score >= 90 ? 'bg-green-500' : branch.score >= 80 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${branch.score}%` }} /></div>
                      <div className="flex justify-between pt-2"><span className="text-sm text-gray-500">Findings</span><Badge className={branch.findings > 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>{branch.findings}</Badge></div>
                      <div className="flex justify-between text-xs text-gray-400"><span>Last audit</span><span>{branch.lastAudit}</span></div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* Alert Banner */}
          {auditStats.openFindings > 0 && (
            <Card className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div className="flex-1"><p className="font-medium text-amber-800">Action Required</p><p className="text-sm text-amber-600">{auditStats.openFindings} open findings need attention. {auditStats.fraudAlerts} fraud alerts pending review.</p></div>
                <Button size="sm" className="bg-amber-600 hover:bg-amber-700">Review All</Button>
              </div>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
