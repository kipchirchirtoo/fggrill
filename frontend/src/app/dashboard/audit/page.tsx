'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { auditorAPI } from '@/lib/api';
import {
  Shield,
  RefreshCw,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  ClipboardList,
  BarChart3,
  DollarSign,
  Package,
  Users,
  CreditCard
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

interface AuditStats {
  totalAudits: number;
  pendingReviews: number;
  complianceScore: number;
  recentFindings: number;
}

export default function AuditDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AuditStats>({ totalAudits: 0, pendingReviews: 0, complianceScore: 0, recentFindings: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch stats from various endpoints (mocked for now or aggregated)
      // const response = await auditorAPI.getNightAudits();
      // For MVP, we'll keep the stats somewhat static or simple until we have aggregation endpoints
      setStats({
        totalAudits: 12, // Placeholder
        pendingReviews: 5,
        complianceScore: 92,
        recentFindings: 3,
      });
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load dashboard stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const modules = [
    {
      href: '/dashboard/audit/sales-verification',
      icon: DollarSign,
      label: 'Sales Verification',
      desc: 'Verify daily sales, cash, and POS transactions.',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      href: '/dashboard/audit/stock-oversight',
      icon: Package,
      label: 'Stock Oversight',
      desc: 'Monitor stock levels, variances, and high-value items.',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      href: '/dashboard/audit/requisitions',
      icon: ClipboardList,
      label: 'Requisitions',
      desc: 'Approve stock requests and analyze consumption.',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      href: '/dashboard/audit/payroll',
      icon: Users,
      label: 'Payroll Audit',
      desc: 'Review payroll, overtime, and attendance anomalies.',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      href: '/dashboard/audit/staff-credit',
      icon: CreditCard,
      label: 'Staff Credit',
      desc: 'Manage employee credit limits and bills.',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    {
      href: '/dashboard/audit/logs',
      icon: FileText,
      label: 'Audit Logs',
      desc: 'View comprehensive system audit trails.',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50'
    },
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
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Auditors Dashboard</h1>
              <p className="text-stone-500 mt-0.5">Internal control, fraud detection, and compliance center</p>
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

          {/* Modules Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((module) => (
              <Link key={module.href} href={module.href}>
                <div className="card-elevated p-5 hover:shadow-md transition-shadow cursor-pointer h-full border border-transparent hover:border-stone-200">
                  <div className={`w-10 h-10 rounded-lg ${module.bgColor} flex items-center justify-center mb-4`}>
                    <module.icon className={`h-5 w-5 ${module.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold text-stone-900 mb-1">{module.label}</h3>
                  <p className="text-sm text-stone-500">{module.desc}</p>
                </div>
              </Link>
            ))}
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
              <p className="text-[13px] text-stone-500">Overall compliance score based on recent audits</p>
              <p className="text-[15px] font-semibold text-stone-700">{stats.complianceScore}%</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
