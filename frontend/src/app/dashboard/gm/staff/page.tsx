'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { staffAPI } from '@/lib/api';
import { Users, RefreshCw, Search, User, Building2, Mail, Phone } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Staff { id: string; first_name: string; last_name: string; email: string; phone?: string; role: string; branch_name?: string; status: 'active' | 'inactive'; }

export default function GMStaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await staffAPI.getStaff();
      if (response.success) setStaff(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const filteredStaff = staff.filter((s) => 
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = { total: staff.length, active: staff.filter(s => s.status === 'active').length };

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">All Staff</h1><p className="text-gray-500">Manage employees across all branches</p></div>
            <IOSButton variant="secondary" onClick={fetchStaff}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <IOSCard className="p-4"><Users className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Staff</p><p className="text-xl font-bold">{stats.total}</p></IOSCard>
            <IOSCard className="p-4"><User className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Active</p><p className="text-xl font-bold text-[#34C759]">{stats.active}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search staff..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredStaff.length === 0 ? (
            <IOSCard className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No staff found</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map((member) => (
                <IOSCard key={member.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                      {member.first_name?.[0]}{member.last_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold">{member.first_name} {member.last_name}</p>
                      <p className="text-sm text-gray-500">{member.role}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {member.branch_name && <span className="text-xs text-gray-400 flex items-center gap-1"><Building2 className="h-3 w-3" /> {member.branch_name}</span>}
                        <IOSBadge variant={member.status === 'active' ? 'success' : 'neutral'}>{member.status}</IOSBadge>
                      </div>
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
