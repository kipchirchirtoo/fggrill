'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { auditAPI } from '@/lib/api';
import { Shield, RefreshCw, FileText, AlertTriangle, CheckCircle, Clock, ClipboardList, BarChart3 } from 'lucide-react';
import Link from 'next/link';

interface AuditStats { totalAudits: number; pendingReviews: number; complianceScore: number; recentFindings: number; }

export default function AuditDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AuditStats>({ totalAudits: 0, pendingReviews: 0, complianceScore: 0, recentFindings: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await auditAPI.getAuditLogs();
      if (response.success) {
        const logs = response.data || [];
        setStats({
          totalAudits: logs.length,
          pendingReviews: logs.filter((l: any) => l.status === 'pending').length,
          complianceScore: 92,
          recentFindings: logs.filter((l: any) => l.severity === 'high').length,
        });
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const quickLinks = [
    { href: '/dashboard/audit/logs', icon: ClipboardList, label: 'Audit Logs', desc: 'View all logs' },
    { href: '/dashboard/audit/reports', icon: FileText, label: 'Reports', desc: 'Audit reports' },
    { href: '/dashboard/audit/compliance', icon: Shield, label: 'Compliance', desc: 'Check status' },
    { href: '/dashboard/audit/inventory', icon: BarChart3, label: 'Inventory Audit', desc: 'Stock checks' },
  ];

  const statCards = [
    { label: 'Total Audits', value: stats.totalAudits, icon: ClipboardList },
    { label: 'Pending Reviews', value: stats.pendingReviews, icon: Clock },
    { label: 'Compliance Score', value: `${stats.complianceScore}%`, icon: CheckCircle },
    { label: 'High Findings', value: stats.recentFindings, icon: AlertTriangle },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Audit Dashboard</h1>
              <p className="text-stone-500 mt-0.5">Internal audit and compliance</p>
            </div>
            <button onClick={fetchData} disabled={isLoading} className="btn-secondary self-start sm:self-auto">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statCards.map((stat, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon">
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="stat-value">{stat.value}</p>
                <p className="stat-label">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Quick Access */}
          <div className="card-elevated p-5">
            <div className="section-header mb-4">
              <h2 className="section-title">Quick Access</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="action-card group">
                    <div className="action-card-icon">
                      <link.icon className="h-5 w-5" />
                    </div>
                    <p className="action-card-label">{link.label}</p>
                    <p className="text-[11px] text-stone-400 mt-0.5">{link.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Compliance Overview */}
          <div className="card-elevated p-5">
            <h2 className="text-[15px] font-semibold text-stone-900 mb-4">Compliance Overview</h2>
            <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-stone-400 rounded-full transition-all duration-500" 
                style={{ width: `${stats.complianceScore}%` }} 
              />
            </div>
            <div className="flex items-center justify-between mt-3">
              <p className="text-[13px] text-stone-500">Overall compliance</p>
              <p className="text-[15px] font-semibold text-stone-700">{stats.complianceScore}%</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
