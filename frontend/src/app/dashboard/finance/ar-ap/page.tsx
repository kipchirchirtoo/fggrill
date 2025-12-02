'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { financeAPI } from '@/lib/api';
import { ArrowDownRight, ArrowUpRight, RefreshCw, User, Building2, Calendar, AlertTriangle } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface ARAPItem { id: string; type: 'receivable' | 'payable'; entity_name: string; amount: number; due_date: string; status: 'current' | 'overdue' | 'paid'; days_overdue?: number; }

export default function ARAPPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ARAPItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<'all' | 'receivable' | 'payable'>('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getArAp();
      if (response.success) setItems(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = items.filter(i => typeFilter === 'all' || i.type === typeFilter);
  const totalAR = items.filter(i => i.type === 'receivable' && i.status !== 'paid').reduce((sum, i) => sum + i.amount, 0);
  const totalAP = items.filter(i => i.type === 'payable' && i.status !== 'paid').reduce((sum, i) => sum + i.amount, 0);
  const overdueAR = items.filter(i => i.type === 'receivable' && i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Accounts Receivable & Payable</h1><p className="text-gray-500">Track money owed to and by you</p></div>
            <IOSButton variant="secondary" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-ios-lg"><ArrowDownRight className="h-5 w-5 text-[#34C759]" /></div>
                <div><p className="text-sm text-gray-500">Receivables</p><p className="text-xl font-bold text-[#34C759]">KES {totalAR.toLocaleString()}</p></div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-ios-lg"><ArrowUpRight className="h-5 w-5 text-[#FF3B30]" /></div>
                <div><p className="text-sm text-gray-500">Payables</p><p className="text-xl font-bold text-[#FF3B30]">KES {totalAP.toLocaleString()}</p></div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-ios-lg"><AlertTriangle className="h-5 w-5 text-yellow-600" /></div>
                <div><p className="text-sm text-gray-500">Overdue AR</p><p className="text-xl font-bold text-yellow-600">KES {overdueAR.toLocaleString()}</p></div>
              </div>
            </IOSCard>
          </div>

          <div className="flex gap-2">
            {(['all', 'receivable', 'payable'] as const).map((type) => (
              <IOSButton key={type} variant={typeFilter === type ? 'primary' : 'secondary'} size="sm" onClick={() => setTypeFilter(type)}>
                {type === 'all' ? 'All' : type === 'receivable' ? 'Receivables' : 'Payables'}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filtered.length === 0 ? (
            <IOSCard className="p-12 text-center"><Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No items found</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {filtered.map((item) => (
                <IOSCard key={item.id} className={`p-4 ${item.status === 'overdue' ? 'border-l-4 border-red-500' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-ios-lg flex items-center justify-center ${item.type === 'receivable' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {item.type === 'receivable' ? <ArrowDownRight className="h-5 w-5 text-[#34C759]" /> : <ArrowUpRight className="h-5 w-5 text-[#FF3B30]" />}
                      </div>
                      <div>
                        <p className="font-bold">{item.entity_name}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3" /> Due: {new Date(item.due_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className={`font-bold text-lg ${item.type === 'receivable' ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>KES {item.amount.toLocaleString()}</p>
                      <IOSBadge variant={item.status === 'overdue' ? 'error' : item.status === 'paid' ? 'success' : 'info'}>
                        {item.status === 'overdue' ? `${item.days_overdue}d overdue` : item.status}
                      </IOSBadge>
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
