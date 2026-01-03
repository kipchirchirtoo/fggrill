'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, PlusCircle,
  Save, RefreshCw, Users, Clock, FileText, Edit,
  Trash2, User, MessageSquare, ArrowRight
} from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, isWithinInterval, addWeeks, subWeeks } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Schedule interfaces
interface StaffMember {
  id: string;
  name: string;
  position: string;
  department: string;
  avatar?: string;
}

interface ShiftType {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  color: string;
}

interface Shift {
  id: string;
  staff_id: string;
  date: string;
  shift_type_id: string;
  notes?: string;
}

export default function BranchStaffSchedulePage() {
  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER
    ]}>
      <BranchAwareDashboardLayout>
        <BranchStaffScheduleContent />
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

function BranchStaffScheduleContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Date and view controls
  const today = new Date();
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [currentView, setCurrentView] = useState<'week' | 'day'>('week');

  // Dialog states
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [shiftTypeId, setShiftTypeId] = useState<string>('');
  const [shiftNotes, setShiftNotes] = useState<string>('');

  useEffect(() => {
    if (activeBranchId) {
      fetchScheduleData();
    }
  }, [activeBranchId, currentDate]);

  const fetchScheduleData = async () => {
    setIsLoading(true);
    try {
      // Get staff members
      const staffResponse = await branchOperationsAPI.getStaff(activeBranchId);
      if (staffResponse.success && Array.isArray(staffResponse.data)) {
        setStaff(staffResponse.data);
      } else {
        setStaff([]);
      }

      // Get shift types
      const shiftTypesResponse = await branchOperationsAPI.getShiftTypes(activeBranchId);
      if (shiftTypesResponse.success && Array.isArray(shiftTypesResponse.data)) {
        setShiftTypes(shiftTypesResponse.data);
      } else {
        setShiftTypes([]);
      }

      // Get shifts for the current week
      const startDate = format(startOfWeek(currentDate), 'yyyy-MM-dd');
      const endDate = format(endOfWeek(currentDate), 'yyyy-MM-dd');

      const shiftsResponse = await branchOperationsAPI.getShifts({
        startDate,
        endDate
      }, activeBranchId);

      if (shiftsResponse.success && Array.isArray(shiftsResponse.data)) {
        setShifts(shiftsResponse.data);
      } else {
        setShifts([]);
      }

    } catch (error) {
      console.error('Error fetching schedule data:', error);
      toast.error('Failed to load schedule data');
      // Show empty state on error
      setStaff([]);
      setShiftTypes([]);
      setShifts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions for placeholder data
  const generatePlaceholderStaff = (): StaffMember[] => [
    { id: '1', name: 'John Doe', position: 'Chef', department: 'Kitchen' },
    { id: '2', name: 'Jane Smith', position: 'Waitress', department: 'Service' },
    { id: '3', name: 'Mike Johnson', position: 'Bartender', department: 'Bar' },
    { id: '4', name: 'Sarah Wilson', position: 'Manager', department: 'Management' },
  ];

  const generatePlaceholderShiftTypes = (): ShiftType[] => [
    { id: '1', name: 'Morning', start_time: '06:00', end_time: '14:00', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { id: '2', name: 'Afternoon', start_time: '14:00', end_time: '22:00', color: 'bg-green-100 text-green-800 border-green-200' },
    { id: '3', name: 'Night', start_time: '22:00', end_time: '06:00', color: 'bg-purple-100 text-purple-800 border-purple-200' },
    { id: '4', name: 'Full Day', start_time: '08:00', end_time: '20:00', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  ];

  const generatePlaceholderShifts = (): Shift[] => {
    const shifts: Shift[] = [];
    const startDate = startOfWeek(currentDate);
    // Generate some random shifts
    for (let i = 0; i < 7; i++) {
      const date = addDays(startDate, i);
      const dateStr = format(date, 'yyyy-MM-dd');

      if (i % 6 !== 0) { // Skip some days
        shifts.push({
          id: `s-${i}-1`,
          staff_id: '1',
          date: dateStr,
          shift_type_id: '1'
        });
      }

      if (i % 5 !== 0) {
        shifts.push({
          id: `s-${i}-2`,
          staff_id: '2',
          date: dateStr,
          shift_type_id: '2'
        });
      }
    }
    return shifts;
  };

  const handlePrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const handleNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const handleToday = () => setCurrentDate(today);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(currentDate), i));

  const getShiftForStaffAndDate = (staffId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return shifts.find(s => s.staff_id === staffId && s.date === dateStr);
  };

  const getShiftType = (id: string) => shiftTypes.find(t => t.id === id);

  return (
    <BranchPageWrapper
      title="Staff Schedule"
      subtitle="Manage staff shifts and rosters"
      actions={
        <div className="flex gap-2">
          <IOSButton variant="secondary" size="sm" onClick={fetchScheduleData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </IOSButton>
          <IOSButton variant="primary" size="sm">
            <Save className="w-4 h-4 mr-2" />
            Publish Schedule
          </IOSButton>
        </div>
      }
    >
      <IOSCard className="p-4 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={handlePrevWeek}
                className="p-2 hover:bg-white rounded-md transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 font-medium min-w-[150px] text-center">
                {format(startOfWeek(currentDate), 'MMM d')} - {format(endOfWeek(currentDate), 'MMM d, yyyy')}
              </span>
              <button
                onClick={handleNextWeek}
                className="p-2 hover:bg-white rounded-md transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <IOSButton variant="secondary" size="sm" onClick={handleToday}>
              Today
            </IOSButton>
          </div>

          <div className="flex gap-2">
            <IOSButton
              variant={currentView === 'week' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setCurrentView('week')}
            >
              Week View
            </IOSButton>
            <IOSButton
              variant={currentView === 'day' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setCurrentView('day')}
            >
              Day View
            </IOSButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-3 text-left border-b border-gray-200 min-w-[200px] bg-gray-50 sticky left-0 z-10">
                  Staff Member
                </th>
                {weekDays.map(day => (
                  <th key={day.toString()} className={`p-3 text-center border-b border-gray-200 min-w-[120px] ${isSameDay(day, today) ? 'bg-blue-50' : ''}`}>
                    <div className="font-medium">{format(day, 'EEE')}</div>
                    <div className="text-sm text-gray-500">{format(day, 'MMM d')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staff.map(member => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="p-3 border-b border-gray-100 sticky left-0 bg-white z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{member.name}</div>
                        <div className="text-xs text-gray-500">{member.position}</div>
                      </div>
                    </div>
                  </td>
                  {weekDays.map(day => {
                    const shift = getShiftForStaffAndDate(member.id, day);
                    const shiftType = shift ? getShiftType(shift.shift_type_id) : null;

                    return (
                      <td key={day.toString()} className={`p-2 border-b border-gray-100 text-center ${isSameDay(day, today) ? 'bg-blue-50/30' : ''}`}>
                        {shift && shiftType ? (
                          <div
                            className={`text-xs p-2 rounded-md border cursor-pointer transition-transform hover:scale-105 ${shiftType.color}`}
                            onClick={() => {
                              setSelectedShift(shift);
                              setSelectedStaffId(member.id);
                              setSelectedDate(day);
                              setShiftTypeId(shift.shift_type_id);
                              setShiftNotes(shift.notes || '');
                              setShowShiftDialog(true);
                            }}
                          >
                            <div className="font-medium">{shiftType.name}</div>
                            <div className="opacity-75">{shiftType.start_time} - {shiftType.end_time}</div>
                          </div>
                        ) : (
                          <button
                            className="w-full h-10 rounded-md border border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50 flex items-center justify-center text-gray-300 hover:text-blue-400 transition-colors"
                            onClick={() => {
                              setSelectedShift(null);
                              setSelectedStaffId(member.id);
                              setSelectedDate(day);
                              setShiftTypeId('');
                              setShiftNotes('');
                              setShowShiftDialog(true);
                            }}
                          >
                            <PlusCircle className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </IOSCard>

      <Dialog open={showShiftDialog} onOpenChange={setShowShiftDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedShift ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
            <DialogDescription>
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
              {selectedStaffId && ` - ${staff.find(s => s.id === selectedStaffId)?.name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Shift Type</label>
              <div className="grid grid-cols-2 gap-2">
                {shiftTypes.map(type => (
                  <button
                    key={type.id}
                    className={`p-3 rounded-lg border text-left transition-all ${shiftTypeId === type.id
                      ? 'ring-2 ring-blue-500 border-transparent bg-blue-50'
                      : 'hover:bg-gray-50 border-gray-200'
                      }`}
                    onClick={() => setShiftTypeId(type.id)}
                  >
                    <div className="font-medium text-sm">{type.name}</div>
                    <div className="text-xs text-gray-500">{type.start_time} - {type.end_time}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Notes</label>
              <Input
                value={shiftNotes}
                onChange={(e) => setShiftNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            {selectedShift && (
              <IOSButton
                variant="destructive"
                onClick={() => {
                  toast.success('Shift deleted');
                  setShowShiftDialog(false);
                }}
                className="mr-auto"
              >
                Delete
              </IOSButton>
            )}
            <IOSButton variant="ghost" onClick={() => setShowShiftDialog(false)}>
              Cancel
            </IOSButton>
            <IOSButton
              variant="primary"
              onClick={() => {
                toast.success(selectedShift ? 'Shift updated' : 'Shift added');
                setShowShiftDialog(false);
              }}
              disabled={!shiftTypeId}
            >
              Save Shift
            </IOSButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BranchPageWrapper>
  );
}
