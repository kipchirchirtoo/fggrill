'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { systemAPI } from '@/lib/api';
import { Users, RefreshCw, Plus, Edit2 } from 'lucide-react';

interface Department { id: string; name: string; description?: string; staff_count: number; status: 'active' | 'inactive'; }

export default function AdminDepartmentsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await systemAPI.getDepartments();
      if (response.success) setDepartments(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Departments</h1><p className="text-gray-500">Manage departments</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchDepartments}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton><Plus className="h-4 w-4 mr-2" /> Add Department</IOSButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : departments.length === 0 ? (
            <IOSCard className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No departments</p></IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept) => (
                <IOSCard key={dept.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-bold text-lg">{dept.name}</p>
                      {dept.description && <p className="text-sm text-gray-500">{dept.description}</p>}
                    </div>
                    <IOSBadge variant={dept.status === 'active' ? 'success' : 'neutral'}>{dept.status}</IOSBadge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 flex items-center gap-1"><Users className="h-4 w-4" /> {dept.staff_count} staff</span>
                    <IOSButton variant="ghost" size="sm"><Edit2 className="h-4 w-4" /></IOSButton>
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
