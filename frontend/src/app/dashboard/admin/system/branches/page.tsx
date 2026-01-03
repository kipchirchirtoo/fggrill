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
import { Building2, RefreshCw, Plus, MapPin, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Branch { id: number; name: string; location: string; is_central: boolean; status: 'active' | 'inactive'; }

export default function AdminBranchesPage() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const resetForm = () => setFormData({ name: '', location: '', is_central: false });

  const handleAddBranch = async () => {
    if (!formData.name) { toast.error('Name is required'); return; }
    setIsSubmitting(true);
    try {
      await systemAPI.createBranch(formData);
      toast.success('Branch added');
      setAddModalOpen(false);
      resetForm();
      fetchBranches();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const openEditModal = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({ name: branch.name, location: branch.location || '', is_central: branch.is_central });
    setEditModalOpen(true);
  };

  const handleUpdateBranch = async () => {
    if (!selectedBranch || !formData.name) { toast.error('Name is required'); return; }
    setIsSubmitting(true);
    try {
      await systemAPI.updateBranch(selectedBranch.id, formData);
      toast.success('Branch updated');
      setEditModalOpen(false);
      setSelectedBranch(null);
      resetForm();
      fetchBranches();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteBranch = async () => {
    if (!selectedBranch) return;
    setIsSubmitting(true);
    try {
      await systemAPI.deleteBranch(selectedBranch.id);
      toast.success('Branch deleted');
      setDeleteConfirmOpen(false);
      setSelectedBranch(null);
      fetchBranches();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
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
                      <IOSBadge className={branch.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>{branch.status}</IOSBadge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <IOSButton variant="secondary" size="sm" className="flex-1" onClick={() => openEditModal(branch)} leftIcon={<Edit2 className="h-3 w-3" />}>Edit</IOSButton>
                    <IOSButton variant="destructive" size="sm" onClick={() => { setSelectedBranch(branch); setDeleteConfirmOpen(true); }}><Trash2 className="h-3 w-3" /></IOSButton>
                  </div>
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
                <IOSButton onClick={handleAddBranch} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Adding...' : 'Add'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={editModalOpen} onOpenChange={(open) => { setEditModalOpen(open); if (!open) setSelectedBranch(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Branch</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Location</label><Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_central} onChange={(e) => setFormData({ ...formData, is_central: e.target.checked })} />
                <label className="text-sm">Central Branch</label>
              </div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleUpdateBranch} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Updating...' : 'Update'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-red-600">Delete Branch</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-stone-600">Are you sure you want to delete this branch?</p>
              {selectedBranch && <div className="p-3 bg-stone-50 rounded-lg"><p className="font-medium">{selectedBranch.name}</p><p className="text-sm text-stone-500">{selectedBranch.location}</p></div>}
              <div className="flex gap-2">
                <IOSButton variant="secondary" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>Cancel</IOSButton>
                <IOSButton variant="destructive" className="flex-1" onClick={handleDeleteBranch} disabled={isSubmitting}>{isSubmitting ? 'Deleting...' : 'Delete'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
