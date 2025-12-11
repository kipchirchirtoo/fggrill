'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { Card } from '@/components/ui/minimal/card';
import { IOSButton } from '@/components/ui/ios-button';
import { facilitiesAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { Users, RefreshCw, Plus, Search, Phone, Mail, Briefcase } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  status: string;
  active: boolean;
  hire_date: string;
  role: string;
}

function StaffManagementContent() {
  const { activeBranch, activeBranchId } = useBranch();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState({ department: '' });
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', department: 'housekeeping', position: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.department) { toast.error('Please fill required fields'); return; }
    setIsSubmitting(true);
    try {
      const response = await facilitiesAPI.createStaff({ ...formData, branch_id: activeBranchId });
      if (response.success) {
        toast.success('Staff member added successfully');
        setShowModal(false);
        setFormData({ name: '', email: '', phone: '', department: 'housekeeping', position: '' });
        fetchStaff();
      } else { toast.error(response.error || 'Failed to add staff'); }
    } catch (error) { toast.error('Failed to add staff'); }
    finally { setIsSubmitting(false); }
  };

  useEffect(() => {
    if (activeBranchId) fetchStaff();
  }, [activeBranchId]);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const response = await facilitiesAPI.getStaff(activeBranchId);
      if (response.success) {
        setStaff(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
      toast.error('Failed to load staff');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (_status?: string, _active?: boolean) => 'bg-gray-100 text-gray-700 border border-gray-200';

  const filteredStaff = staff.filter(member => {
    const matchesSearch = member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = !filter.department || member.department === filter.department;
    return matchesSearch && matchesDept;
  });

  const housekeepingStaff = staff.filter(s => s.department === 'housekeeping');
  const maintenanceStaff = staff.filter(s => s.department === 'maintenance');
  const onDuty = staff.filter(s => s.status === 'on_duty' || s.status === 'active');

  return (
    <ProtectedRoute allowedRoles={[UserRole.FACILITIES_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout
        title="Staff Management"
        subtitle={`Facilities staff for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <div className="flex gap-2">
            <IOSButton variant="secondary" onClick={fetchStaff} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            <IOSButton variant="primary" onClick={() => setShowModal(true)} leftIcon={<Plus />}>Add Staff</IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{staff.length}</p>
              <p className="text-sm text-gray-500">Total Staff</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{housekeepingStaff.length}</p>
              <p className="text-sm text-gray-500">Housekeeping</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{maintenanceStaff.length}</p>
              <p className="text-sm text-gray-500">Maintenance</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{onDuty.length}</p>
              <p className="text-sm text-gray-500">On Duty</p>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search staff..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <select
                value={filter.department}
                onChange={(e) => setFilter({ ...filter, department: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Departments</option>
                <option value="housekeeping">Housekeeping</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          </Card>

          {/* Staff List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaff.map(member => (
                <Card key={member.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-600">
                        {member.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900">{member.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(member.status, member.active)}`}>
                          {member.active ? (member.status?.replace('_', ' ') || 'Active') : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <Briefcase className="h-3 w-3" />
                        <span>{member.position || member.department}</span>
                      </div>
                      <div className="mt-3 space-y-1">
                        {member.email && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{member.email}</span>
                          </div>
                        )}
                        {member.phone && (
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Phone className="h-3 w-3" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 pt-3 border-t flex justify-between text-xs text-gray-400">
                        <span className="capitalize">{member.department}</span>
                        {member.hire_date && (
                          <span>Since {new Date(member.hire_date).getFullYear()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filteredStaff.length === 0 && (
            <Card className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No staff found</h3>
              <p className="text-gray-500">Add new staff members or adjust your filters</p>
            </Card>
          )}
        </div>
      <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Full Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., John Doe" /></div>
              <div><Label>Department *</Label><select value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="w-full px-3 py-2 border rounded-lg"><option value="housekeeping">Housekeeping</option><option value="maintenance">Maintenance</option><option value="facilities">Facilities</option></select></div>
              <div><Label>Position</Label><Input value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} placeholder="e.g., Room Attendant" /></div>
              <div><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@example.com" /></div>
              <div><Label>Phone</Label><Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+254..." /></div>
              <div className="flex gap-2 justify-end"><IOSButton type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</IOSButton><IOSButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Staff'}</IOSButton></div>
            </form>
          </DialogContent>
        </Dialog>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function StaffManagementPage() {
  return (
    <BranchPageWrapper>
      <StaffManagementContent />
    </BranchPageWrapper>
  );
}
