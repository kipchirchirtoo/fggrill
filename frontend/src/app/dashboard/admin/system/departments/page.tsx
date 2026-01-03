'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { systemAPI } from '@/lib/api';
import { Users, RefreshCw, Plus, Edit2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Department { id: string; name: string; description?: string; staff_count: number; status: 'active' | 'inactive'; }

export default function AdminDepartmentsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const fetchDepartments = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await systemAPI.getDepartments();
      if (response.success) setDepartments(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchDepartments(); }, [fetchDepartments]);

  const resetForm = () => setFormData({ name: '', description: '' });

  const handleAddDepartment = async () => {
    if (!formData.name) { toast.error('Name is required'); return; }
    setIsSubmitting(true);
    try {
      await systemAPI.createDepartment(formData);
      toast.success('Department added');
      setAddModalOpen(false);
      resetForm();
      fetchDepartments();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const openEditModal = (dept: Department) => {
    setSelectedDept(dept);
    setFormData({ name: dept.name, description: dept.description || '' });
    setEditModalOpen(true);
  };

  const handleUpdateDepartment = async () => {
    if (!selectedDept || !formData.name) { toast.error('Name is required'); return; }
    setIsSubmitting(true);
    try {
      await systemAPI.updateDepartment(selectedDept.id, formData);
      toast.success('Department updated');
      setEditModalOpen(false);
      setSelectedDept(null);
      resetForm();
      fetchDepartments();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteDepartment = async () => {
    if (!selectedDept) return;
    setIsSubmitting(true);
    try {
      await systemAPI.deleteDepartment(selectedDept.id);
      toast.success('Department deleted');
      setDeleteConfirmOpen(false);
      setSelectedDept(null);
      fetchDepartments();
    } catch (error: any) { toast.error(error.message || 'Failed'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Departments</h1><p className="text-gray-500">Manage departments</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchDepartments} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Department</IOSButton>
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
                    <IOSBadge className={dept.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>{dept.status}</IOSBadge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 flex items-center gap-1"><Users className="h-4 w-4" /> {dept.staff_count} staff</span>
                    <div className="flex gap-1">
                      <IOSButton variant="ghost" size="sm" onClick={() => openEditModal(dept)}><Edit2 className="h-4 w-4" /></IOSButton>
                      <IOSButton variant="ghost" size="sm" className="text-red-500" onClick={() => { setSelectedDept(dept); setDeleteConfirmOpen(true); }}><Trash2 className="h-4 w-4" /></IOSButton>
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        {/* Add Modal */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Description</label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleAddDepartment} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Adding...' : 'Add'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={editModalOpen} onOpenChange={(open) => { setEditModalOpen(open); if (!open) setSelectedDept(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Edit Department</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><label className="text-sm font-medium">Name *</label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} /></div>
              <div><label className="text-sm font-medium">Description</label><Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} /></div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleUpdateDepartment} disabled={isSubmitting} className="flex-1">{isSubmitting ? 'Updating...' : 'Update'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle className="text-red-600">Delete Department</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-stone-600">Are you sure you want to delete this department?</p>
              {selectedDept && <div className="p-3 bg-stone-50 rounded-lg"><p className="font-medium">{selectedDept.name}</p></div>}
              <div className="flex gap-2">
                <IOSButton variant="secondary" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>Cancel</IOSButton>
                <IOSButton variant="destructive" className="flex-1" onClick={handleDeleteDepartment} disabled={isSubmitting}>{isSubmitting ? 'Deleting...' : 'Delete'}</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
