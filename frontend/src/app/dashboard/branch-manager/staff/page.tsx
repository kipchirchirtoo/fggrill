'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Search, RefreshCw, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { staffAPI } from '@/lib/api';

export default function BranchManagerStaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchStaff();
  }, [user]);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const res = await staffAPI.getStaff(user?.branch_id);
      setStaff(res.staff || res || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStaff = staff.filter((s: any) => 
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Branch Staff</h1>
              <p className="text-gray-600">Manage your branch team</p>
            </div>
            <Button onClick={fetchStaff} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStaff.map((s: any) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{s.first_name} {s.last_name}</h3>
                    <p className="text-sm text-gray-500">{s.email}</p>
                    <Badge className="mt-2 bg-indigo-100 text-indigo-800">{s.role}</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filteredStaff.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {isLoading ? 'Loading...' : 'No staff found'}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
