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
import { systemAPI } from '@/lib/api';
import { Building2, RefreshCw, Plus, MapPin, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Branch { id: number; name: string; location: string; is_central: boolean; status: 'active' | 'inactive'; }

export default function AdminBranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', location: '', is_central: false });

  const fetchBranches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await systemAPI.getBranches();
      if (response.success) setBranches(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  const handleAddBranch = async () => {
    if (!formData.name) { toast.error('Name is required'); return; }
    try {
      await systemAPI.createBranch(formData);
      toast.success('Branch added');
      setAddModalOpen(false);
      fetchBranches();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Branches</h1><p className="text-gray-500">Manage hotel locations</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchBranches} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Branch</IOSButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((branch) => (
                <IOSCard key={branch.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-bold text-lg">{branch.name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" /> {branch.location}</p>
                    </div>
                    <div className="flex gap-2">
                      {branch.is_central && <IOSBadge variant="light" color="info">Central</IOSBadge>}
                      <IOSBadge variant={branch.status === 'active' ? 'success' : 'neutral'}>{branch.status}</IOSBadge>
                    </div>
                  </div>
                  <IOSButton variant="secondary" size="sm" className="w-full" leftIcon={<Edit2 />}>Edit</IOSButton>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Branch</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Location</label><Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_central} onChange={(e) => setFormData({ ...formData, is_central: e.target.checked })} />
                <label className="text-sm">Central Branch</label>
              </div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleAddBranch} className="flex-1">Add</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
