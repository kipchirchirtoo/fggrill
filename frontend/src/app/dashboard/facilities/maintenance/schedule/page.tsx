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
import { Calendar, RefreshCw, Plus, Clock, CheckCircle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface ScheduledMaintenance {
  id: string;
  title: string;
  description: string;
  asset_name: string;
  location: string;
  scheduled_date: string;
  frequency: string;
  assigned_to: string;
  status: string;
  last_completed: string;
}

interface Equipment { id: string; name: string; location: string; status: string; }
interface Staff { id: string; name: string; department: string; role: string; }

function MaintenanceScheduleContent() {
  const { activeBranch, activeBranchId } = useBranch();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<ScheduledMaintenance[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ title: '', equipment_id: '', frequency: 'monthly', maintenance_type: 'preventive', scheduled_date: new Date().toISOString().split('T')[0], assigned_to: '', description: '' });

  // Fetch equipment and staff for dropdowns
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [equipRes, staffRes] = await Promise.all([
          facilitiesAPI.getEquipmentList(activeBranchId),
          facilitiesAPI.getStaffList('maintenance', activeBranchId)
        ]);
        if (equipRes.success) setEquipment(equipRes.data || []);
        if (staffRes.success) setStaffList(staffRes.data || []);
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
      }
    };
    if (activeBranchId) fetchDropdownData();
  }, [activeBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.equipment_id) { toast.error('Please fill required fields'); return; }
    setIsSubmitting(true);
    try {
      const selectedEquip = equipment.find(e => e.id === formData.equipment_id);
      const response = await facilitiesAPI.createScheduledMaintenance({ 
        title: formData.title,
        equipment_id: formData.equipment_id,
        equipment_name: selectedEquip?.name || '',
        maintenance_type: formData.maintenance_type,
        description: formData.description,
        frequency: formData.frequency,
        next_due: formData.scheduled_date,
        assigned_to: formData.assigned_to || null,
        branch_id: activeBranchId 
      });
      if (response.success) {
        toast.success('Maintenance scheduled successfully');
        setShowModal(false);
        setFormData({ title: '', equipment_id: '', frequency: 'monthly', maintenance_type: 'preventive', scheduled_date: new Date().toISOString().split('T')[0], assigned_to: '', description: '' });
        fetchSchedules();
      } else { toast.error(response.error || 'Failed to schedule maintenance'); }
    } catch (error) { toast.error('Failed to schedule maintenance'); }
    finally { setIsSubmitting(false); }
  };

  useEffect(() => {
    if (activeBranchId) fetchSchedules();
  }, [activeBranchId]);

  const fetchSchedules = async () => {
    setIsLoading(true);
    try {
      const response = await facilitiesAPI.getMaintenanceSchedule(activeBranchId);
      if (response.success) {
        setSchedules(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching maintenance schedule:', error);
      toast.error('Failed to load maintenance schedule');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (_status?: string) => 'bg-gray-100 text-gray-700 border border-gray-200';

  const getFrequencyColor = (_frequency?: string) => 'bg-gray-100 text-gray-700 border border-gray-200';

  const stats = {
    total: schedules.length,
    scheduled: schedules.filter(s => s.status === 'scheduled').length,
    completed: schedules.filter(s => s.status === 'completed').length,
    overdue: schedules.filter(s => s.status === 'overdue').length,
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const getSchedulesForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return schedules.filter(s => s.scheduled_date === dateStr);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.FACILITIES_MANAGER, UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout
        title="Maintenance Schedule"
        subtitle={`Preventive maintenance schedule for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <div className="flex gap-2">
            <IOSButton variant="secondary" onClick={fetchSchedules} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            <IOSButton variant="primary" onClick={() => setShowModal(true)} leftIcon={<Plus />}>Schedule Maintenance</IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Scheduled</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.scheduled}</p>
              <p className="text-sm text-gray-500">Upcoming</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.overdue}</p>
              <p className="text-sm text-gray-500">Overdue</p>
            </Card>
          </div>

          {/* View Toggle */}
          <Card className="p-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <IOSButton
                  variant={view === 'list' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setView('list')}
                >
                  List View
                </IOSButton>
                <IOSButton
                  variant={view === 'calendar' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setView('calendar')}
                >
                  Calendar View
                </IOSButton>
              </div>
              {view === 'calendar' && (
                <div className="flex items-center gap-4">
                  <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="font-medium">
                    {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </span>
                  <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-gray-100 rounded">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </Card>

          {/* Calendar View */}
          {view === 'calendar' && (
            <Card className="p-4">
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
                {Array(getFirstDayOfMonth(currentDate)).fill(null).map((_, i) => (
                  <div key={`empty-${i}`} className="p-2 min-h-[80px]"></div>
                ))}
                {Array(getDaysInMonth(currentDate)).fill(null).map((_, i) => {
                  const day = i + 1;
                  const daySchedules = getSchedulesForDate(day);
                  return (
                    <div key={day} className="p-2 min-h-[80px] border rounded hover:bg-gray-50">
                      <span className="text-sm font-medium">{day}</span>
                      <div className="mt-1 space-y-1">
                        {daySchedules.slice(0, 2).map(s => (
                          <div key={s.id} className={`text-xs p-1 rounded truncate ${getStatusColor(s.status)}`}>
                            {s.title}
                          </div>
                        ))}
                        {daySchedules.length > 2 && (
                          <div className="text-xs text-gray-500">+{daySchedules.length - 2} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* List View */}
          {view === 'list' && (
            <div className="space-y-4">
              {schedules.map(schedule => (
                <Card key={schedule.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-gray-100">
                        <Calendar className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{schedule.title}</h3>
                        <p className="text-sm text-gray-500">{schedule.description}</p>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                          <span>🏠 {schedule.asset_name}</span>
                          <span>📍 {schedule.location}</span>
                          <span>👤 {schedule.assigned_to}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getFrequencyColor(schedule.frequency)}`}>
                            {schedule.frequency}
                          </span>
                          <span className="text-xs text-gray-400">
                            Last: {new Date(schedule.last_completed).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(schedule.status)}`}>
                        {schedule.status === 'completed' && <CheckCircle className="h-3 w-3" />}
                        {schedule.status === 'overdue' && <AlertTriangle className="h-3 w-3" />}
                        {schedule.status === 'scheduled' && <Clock className="h-3 w-3" />}
                        {schedule.status}
                      </span>
                      <span className="text-sm text-gray-500">
                        📅 {new Date(schedule.scheduled_date).toLocaleDateString()}
                      </span>
                      {schedule.status !== 'completed' && (
                        <IOSButton size="sm" variant="primary" className="mt-2">
                          Mark Complete
                        </IOSButton>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Schedule Maintenance</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Title *</Label><Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g., AC Filter Replacement" /></div>
              <div>
                <Label>Equipment *</Label>
                <select value={formData.equipment_id} onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">Select equipment...</option>
                  {equipment.map(equip => (
                    <option key={equip.id} value={equip.id}>{equip.name} - {equip.location}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Maintenance Type</Label>
                <select value={formData.maintenance_type} onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="preventive">Preventive</option>
                  <option value="corrective">Corrective</option>
                  <option value="inspection">Inspection</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div>
                <Label>Frequency</Label>
                <select value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div><Label>Scheduled Date</Label><Input type="date" value={formData.scheduled_date} onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })} /></div>
              <div>
                <Label>Assign To</Label>
                <select value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">Unassigned</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                  ))}
                </select>
              </div>
              <div><Label>Description</Label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Description..." /></div>
              <div className="flex gap-2 justify-end"><IOSButton type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</IOSButton><IOSButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Scheduling...' : 'Schedule'}</IOSButton></div>
            </form>
          </DialogContent>
        </Dialog>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function MaintenanceSchedulePage() {
  return (
    <BranchPageWrapper>
      <MaintenanceScheduleContent />
    </BranchPageWrapper>
  );
}
