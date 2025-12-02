'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { auditAPI } from '@/lib/api';
import { Shield, RefreshCw, FileText, AlertTriangle, CheckCircle, Clock, ClipboardList, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

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
    { href: '/dashboard/audit/logs', icon: ClipboardList, label: 'Audit Logs', desc: 'View all logs', color: 'bg-blue-50 text-[#007AFF]' },
    { href: '/dashboard/audit/reports', icon: FileText, label: 'Reports', desc: 'Audit reports', color: 'bg-green-50 text-[#34C759]' },
    { href: '/dashboard/audit/compliance', icon: Shield, label: 'Compliance', desc: 'Check status', color: 'bg-purple-50 text-purple-600' },
    { href: '/dashboard/audit/inventory', icon: BarChart3, label: 'Inventory Audit', desc: 'Stock checks', color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Shield className="h-7 w-7" /> Audit Dashboard</h1><p className="text-gray-500">Internal audit and compliance</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><ClipboardList className="h-8 w-8 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Audits</p><p className="text-2xl font-bold">{stats.totalAudits}</p></IOSCard>
            <IOSCard className="p-4"><Clock className="h-8 w-8 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Pending Reviews</p><p className="text-2xl font-bold text-yellow-600">{stats.pendingReviews}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-8 w-8 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Compliance Score</p><p className="text-2xl font-bold text-[#34C759]">{stats.complianceScore}%</p></IOSCard>
            <IOSCard className="p-4"><AlertTriangle className="h-8 w-8 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">High Findings</p><p className="text-2xl font-bold text-[#FF3B30]">{stats.recentFindings}</p></IOSCard>
          </div>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-none 0_2px_14px_rgba(0,0,0,0.06)] transition cursor-pointer ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-8 w-8 mb-2 ${link.color.split(' ')[1]}`} />
                    <p className="font-medium">{link.label}</p>
                    <p className="text-sm text-gray-500">{link.desc}</p>
                  </IOSCard>
                </Link>
              ))}
            </div>
          </IOSCard>

          <IOSCard className="p-6">
            <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Compliance Overview</h2>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-[#34C759]" style={{ width: `${stats.complianceScore}%` }} />
            </div>
            <p className="text-sm text-gray-500 mt-2">Overall compliance: {stats.complianceScore}%</p>
          </IOSCard>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
