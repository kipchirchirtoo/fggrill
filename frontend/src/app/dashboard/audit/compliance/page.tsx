'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { auditAPI } from '@/lib/api';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Shield, CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface ComplianceItem { id: string; category: string; requirement: string; status: 'compliant' | 'partial' | 'non_compliant'; lastChecked: string; notes?: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  compliant: { label: 'Compliant', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
  partial: { label: 'Partial', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: AlertTriangle },
  non_compliant: { label: 'Non-Compliant', color: 'text-red-700', bg: 'bg-red-100', icon: XCircle },
};

export default function CompliancePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const response = await auditAPI.getComplianceItems();
      if (response.success) {
        setItems(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching compliance items:', error);
      toast.error('Failed to load compliance items');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = {
    compliant: items.filter(i => i.status === 'compliant').length,
    partial: items.filter(i => i.status === 'partial').length,
    nonCompliant: items.filter(i => i.status === 'non_compliant').length,
    score: items.length > 0 ? Math.round((items.filter(i => i.status === 'compliant').length / items.length) * 100) : 0,
  };

  const categories = [...new Set(items.map(i => i.category))];

  return (
    <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Compliance Status</h1><p className="text-gray-500">Regulatory and policy compliance</p></div>
            <IOSButton variant="secondary" onClick={fetchItems} leftIcon={<RefreshCw />}>Run Check</IOSButton>
          </div>

          <IOSCard className="p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
            <p className="text-blue-100">Overall Compliance Score</p>
            <p className="text-4xl font-bold mt-2">{stats.score}%</p>
            <div className="mt-4 h-2 bg-blue-400 rounded-full overflow-hidden">
              <div className="h-full bg-[#FFFFFF]" style={{ width: `${stats.score}%` }} />
            </div>
          </IOSCard>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4 border-l-4 border-green-500"><CheckCircle className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Compliant</p><p className="text-xl font-bold text-[#34C759]">{stats.compliant}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-yellow-500"><AlertTriangle className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Partial</p><p className="text-xl font-bold text-yellow-600">{stats.partial}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-red-500"><XCircle className="h-6 w-6 text-[#FF3B30] mb-2" /><p className="text-sm text-gray-500">Non-Compliant</p><p className="text-xl font-bold text-[#FF3B30]">{stats.nonCompliant}</p></IOSCard>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : items.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No compliance items found</h3>
              <p className="text-gray-500">Run a compliance check to get started</p>
            </IOSCard>
          ) : categories.map((category) => (
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
