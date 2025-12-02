'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { userAPI, systemAPI } from '@/lib/api';
import { Users, RefreshCw, Plus, Search, Edit2, Trash2, User, Mail, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface UserData { id: string; email: string; first_name: string; last_name: string; role: string; branch_name?: string; status: 'active' | 'inactive'; }

export default function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [formData, setFormData] = useState({ email: '', first_name: '', last_name: '', role: '', branch_id: '', password: '' });

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const [usersRes, rolesRes, branchesRes] = await Promise.all([
        userAPI.getUsers(),
        systemAPI.getRoles(),
        systemAPI.getBranches(),
      ]);
      if (usersRes.success) setUsers(usersRes.data || []);
      if (rolesRes.success) setRoles(rolesRes.data || []);
      if (branchesRes.success) setBranches(branchesRes.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = users.filter((u) => 
    `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = async () => {
    if (!formData.email || !formData.first_name || !formData.role) { toast.error('Fill required fields'); return; }
    try {
      await userAPI.createUser(formData);
      toast.success('User created');
      setAddModalOpen(false);
      fetchUsers();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Users</h1><p className="text-gray-500">Manage system users</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchUsers}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)}><Plus className="h-4 w-4 mr-2" /> Add User</IOSButton>
            </div>
          </div>

          <IOSCard className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredUsers.length === 0 ? (
            <IOSCard className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No users found</p></IOSCard>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Role</th>
                    <th className="text-left p-3 font-medium">Branch</th>
                    <th className="text-center p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><User className="h-4 w-4 text-[#007AFF]" /></div>
                          <span className="font-medium">{u.first_name} {u.last_name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-gray-500">{u.email}</td>
                      <td className="p-3"><IOSBadge variant="info">{u.role}</IOSBadge></td>
                      <td className="p-3 text-gray-500">{u.branch_name || 'All'}</td>
                      <td className="p-3 text-center"><IOSBadge variant={u.status === 'active' ? 'success' : 'neutral'}>{u.status}</IOSBadge></td>
                      <td className="p-3 text-right">
                        <IOSButton size="sm" variant="ghost"><Edit2 className="h-4 w-4" /></IOSButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">First Name *</label><Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} /></div>
                <div><label className="text-sm font-medium">Last Name</label><Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} /></div>
              </div>
              <div><label className="text-sm font-medium">Email *</label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Password *</label><Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Role *</label>
                <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="">Select role</option>
                  {roles.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-medium">Branch</label>
                <select value={formData.branch_id} onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })} className="w-full p-2 border rounded-ios-lg">
                  <option value="">All Branches</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleCreateUser} className="flex-1">Create</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
