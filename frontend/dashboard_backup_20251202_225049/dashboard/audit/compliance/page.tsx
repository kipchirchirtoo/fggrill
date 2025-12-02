'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Shield, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

interface ComplianceItem { id: string; category: string; requirement: string; status: 'compliant' | 'partial' | 'non_compliant'; lastChecked: string; notes?: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  compliant: { label: 'Compliant', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
  partial: { label: 'Partial', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: AlertTriangle },
  non_compliant: { label: 'Non-Compliant', color: 'text-red-700', bg: 'bg-red-100', icon: XCircle },
};

export default function CompliancePage() {
  const { user } = useAuth();
  const [items] = useState<ComplianceItem[]>([
    { id: '1', category: 'Health & Safety', requirement: 'Fire safety equipment inspection', status: 'compliant', lastChecked: '2024-11-15' },
    { id: '2', category: 'Health & Safety', requirement: 'Food handling certification', status: 'compliant', lastChecked: '2024-10-01' },
    { id: '3', category: 'Financial', requirement: 'Tax compliance documentation', status: 'partial', lastChecked: '2024-11-20', notes: 'Missing Q3 receipts' },
    { id: '4', category: 'HR', requirement: 'Employee contracts updated', status: 'compliant', lastChecked: '2024-11-01' },
    { id: '5', category: 'Data Protection', requirement: 'Guest data privacy policy', status: 'non_compliant', lastChecked: '2024-10-15', notes: 'Policy needs update' },
  ]);

  const stats = {
    compliant: items.filter(i => i.status === 'compliant').length,
    partial: items.filter(i => i.status === 'partial').length,
    nonCompliant: items.filter(i => i.status === 'non_compliant').length,
    score: Math.round((items.filter(i => i.status === 'compliant').length / items.length) * 100),
  };

  const categories = [...new Set(items.map(i => i.category))];

  return (
    <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Compliance Status</h1><p className="text-gray-500">Regulatory and policy compliance</p></div>
            <IOSButton variant="secondary"><RefreshCw className="h-4 w-4 mr-2" /> Run Check</IOSButton>
          </div>

          <IOSCard className="p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
            <p className="text-blue-100">Overall Compliance Score</p>
            <p className="text-4xl font-bold mt-2">{stats.score}%</p>
            <div className="mt-4 h-2 bg-blue-400 rounded-full overflow-hidden">
              <div className="h-full bg-white" style={{ width: `${stats.score}%` }} />
            </div>
          </IOSCard>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4 border-l-4 border-green-500"><CheckCircle className="h-6 w-6 text-green-600 mb-2" /><p className="text-sm text-gray-500">Compliant</p><p className="text-xl font-bold text-green-600">{stats.compliant}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500"><AlertTriangle className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Partial</p><p className="text-xl font-bold text-yellow-600">{stats.partial}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-red-500"><XCircle className="h-6 w-6 text-red-600 mb-2" /><p className="text-sm text-gray-500">Non-Compliant</p><p className="text-xl font-bold text-red-600">{stats.nonCompliant}</p></IOSCard>
          </div>

          {categories.map((category) => (
            <IOSCard key={category} className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-4">{category}</h2>
              <div className="space-y-3">
                {items.filter(i => i.category === category).map((item) => {
                  const status = statusConfig[item.status];
                  const StatusIcon = status.icon;
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-ios-lg">
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`h-5 w-5 ${status.color}`} />
                        <div>
                          <p className="font-medium">{item.requirement}</p>
                          {item.notes && <p className="text-sm text-gray-500">{item.notes}</p>}
                          <p className="text-xs text-gray-400">Last checked: {new Date(item.lastChecked).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                    </div>
                  );
                })}
              </div>
            </IOSCard>
          ))}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
