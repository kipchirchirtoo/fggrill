'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, Bell, Clock, CheckCircle, AlertCircle,
  Home, Wrench, UtensilsCrossed, Coffee, Users, Loader2,
  Plus, X, ChevronRight, RefreshCw, Phone, Mail
} from 'lucide-react';
import { toast } from 'sonner';
import { housekeepingAPI, maintenanceAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDate } from '@/lib/date-utils';

interface DepartmentRequest {
  id: string;
  type: 'housekeeping' | 'maintenance' | 'room_service' | 'concierge';
  room_number: string;
  guest_name?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  description: string;
  created_at: string;
  assigned_to?: string;
  completed_at?: string;
  notes?: string;
}

interface DepartmentCommunicationProps {
  fromDepartment: 'reception' | 'housekeeping' | 'restaurant' | 'bar' | 'management';
  branchId?: number;
  roomNumber?: string;
  guestName?: string;
  onRequestCreated?: () => void;
}

const DEPARTMENT_CONFIG = {
  housekeeping: {
    icon: Home,
    label: 'Housekeeping',
    color: 'bg-blue-100 text-blue-700',
    requestTypes: [
      { id: 'cleaning', label: 'Room Cleaning' },
      { id: 'turndown', label: 'Turndown Service' },
      { id: 'extra_towels', label: 'Extra Towels' },
      { id: 'extra_pillows', label: 'Extra Pillows' },
      { id: 'extra_blankets', label: 'Extra Blankets' },
      { id: 'amenities', label: 'Amenities Refill' },
      { id: 'deep_clean', label: 'Deep Cleaning' },
      { id: 'laundry', label: 'Laundry Pickup' }
    ]
  },
  maintenance: {
    icon: Wrench,
    label: 'Maintenance',
    color: 'bg-orange-100 text-orange-700',
    requestTypes: [
      { id: 'ac_issue', label: 'AC Issue' },
      { id: 'plumbing', label: 'Plumbing Issue' },
      { id: 'electrical', label: 'Electrical Issue' },
      { id: 'tv_issue', label: 'TV Not Working' },
      { id: 'wifi_issue', label: 'WiFi Issue' },
      { id: 'door_lock', label: 'Door/Lock Issue' },
      { id: 'furniture', label: 'Furniture Repair' },
      { id: 'other', label: 'Other Issue' }
    ]
  },
  room_service: {
    icon: UtensilsCrossed,
    label: 'Room Service',
    color: 'bg-green-100 text-green-700',
    requestTypes: [
      { id: 'food_order', label: 'Food Order' },
      { id: 'beverage', label: 'Beverage Order' },
      { id: 'special_diet', label: 'Special Dietary Request' }
    ]
  },
  concierge: {
    icon: Users,
    label: 'Concierge',
    color: 'bg-purple-100 text-purple-700',
    requestTypes: [
      { id: 'transport', label: 'Transportation' },
      { id: 'tour', label: 'Tour Booking' },
      { id: 'restaurant_res', label: 'Restaurant Reservation' },
      { id: 'special_request', label: 'Special Request' }
    ]
  }
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' }
];

export function DepartmentCommunication({
  fromDepartment,
  branchId,
  roomNumber: initialRoom,
  guestName: initialGuest,
  onRequestCreated
}: DepartmentCommunicationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRequests, setActiveRequests] = useState<DepartmentRequest[]>([]);
  
  // Form state
  const [selectedDepartment, setSelectedDepartment] = useState<keyof typeof DEPARTMENT_CONFIG | null>(null);
  const [selectedRequestType, setSelectedRequestType] = useState('');
  const [roomNumber, setRoomNumber] = useState(initialRoom || '');
  const [guestName, setGuestName] = useState(initialGuest || '');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchActiveRequests();
  }, []);

  useEffect(() => {
    if (initialRoom) setRoomNumber(initialRoom);
    if (initialGuest) setGuestName(initialGuest);
  }, [initialRoom, initialGuest]);

  const fetchActiveRequests = async () => {
    setIsLoading(true);
    try {
      // Fetch housekeeping tasks
      const hkRes = await housekeepingAPI.getGuestRequests({ status: 'pending' }).catch(() => ({ data: [] }));
      const hkRequests = (hkRes.data || hkRes || []).map((r: any) => ({
        id: r.id,
        type: 'housekeeping' as const,
        room_number: r.room_number || r.room?.room_number || '-',
        guest_name: r.guest_name,
        priority: r.priority || 'normal',
        status: r.status || 'pending',
        description: r.request_type || r.description || '',
        created_at: r.created_at,
        assigned_to: r.assigned_to?.name || r.assigned_to
      }));

      // Fetch maintenance requests
      const maintRes = await maintenanceAPI.getRequests(branchId, 'pending').catch(() => ({ data: [] }));
      const maintRequests = (maintRes.data || maintRes || []).map((r: any) => ({
        id: r.id,
        type: 'maintenance' as const,
        room_number: r.room_number || r.location || '-',
        guest_name: r.reported_by,
        priority: r.priority || 'normal',
        status: r.status || 'pending',
        description: r.issue_type || r.description || '',
        created_at: r.created_at,
        assigned_to: r.assigned_to?.name || r.assigned_to
      }));

      setActiveRequests([...hkRequests, ...maintRequests].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!selectedDepartment || !roomNumber) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedDepartment === 'housekeeping') {
        await housekeepingAPI.createGuestRequest({
          room_number: roomNumber,
          guest_name: guestName,
          request_type: selectedRequestType || 'general',
          priority: priority,
          description: description,
          source: fromDepartment
        });
      } else if (selectedDepartment === 'maintenance') {
        await maintenanceAPI.createRequest({
          room_number: roomNumber,
          location: `Room ${roomNumber}`,
          issue_type: selectedRequestType || 'general',
          priority: priority,
          description: description,
          reported_by: guestName || fromDepartment,
          branch_id: branchId
        });
      }

      toast.success('Request submitted successfully');
      resetForm();
      setIsOpen(false);
      fetchActiveRequests();
      onRequestCreated?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedDepartment(null);
    setSelectedRequestType('');
    setRoomNumber(initialRoom || '');
    setGuestName(initialGuest || '');
    setPriority('normal');
    setDescription('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'assigned': return 'bg-purple-100 text-purple-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'low': return 'bg-gray-100 text-gray-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <>
      {/* Quick Action Button */}
      <IOSButton 
        onClick={() => setIsOpen(true)}
        className="bg-[#3C3C43] hover:bg-[#000000] text-white"
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        Department Request
        {activeRequests.filter(r => r.status === 'pending').length > 0 && (
          <span className="ml-2 bg-red-500 text-white rounded-full px-2 py-0.5 text-xs font-bold">
            {activeRequests.filter(r => r.status === 'pending').length}
          </span>
        )}
      </IOSButton>

      {/* Active Requests Summary */}
      {activeRequests.length > 0 && (
        <IOSCard className="mt-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Active Requests</h3>
            <IOSButton variant="ghost" size="sm" onClick={fetchActiveRequests}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </IOSButton>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {activeRequests.slice(0, 5).map(request => {
              const config = DEPARTMENT_CONFIG[request.type];
              const Icon = config?.icon || MessageSquare;
              return (
                <div key={request.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config?.color || 'bg-gray-100'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Room {request.room_number}</p>
                      <p className="text-xs text-gray-500">{request.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <IOSBadge className={getPriorityColor(request.priority)}>
                      {request.priority}
                    </IOSBadge>
                    <IOSBadge className={getStatusColor(request.status)}>
                      {request.status}
                    </IOSBadge>
                  </div>
                </div>
              );
            })}
          </div>
        </IOSCard>
      )}

      {/* Request Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              New Department Request
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Department Selection */}
            {!selectedDepartment ? (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(DEPARTMENT_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <motion.button
                      key={key}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedDepartment(key as keyof typeof DEPARTMENT_CONFIG)}
                      className={`p-4 rounded-xl border-2 border-transparent hover:border-[#3C3C43] transition-all ${config.color}`}
                    >
                      <Icon className="h-8 w-8 mx-auto mb-2" />
                      <p className="font-medium">{config.label}</p>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  {/* Selected Department Header */}
                  <div className="flex items-center justify-between p-3 bg-[#F2F2F7] rounded-lg">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon = DEPARTMENT_CONFIG[selectedDepartment].icon;
                        return <Icon className="h-5 w-5" />;
                      })()}
                      <span className="font-medium">{DEPARTMENT_CONFIG[selectedDepartment].label}</span>
                    </div>
                    <IOSButton variant="ghost" size="sm" onClick={() => setSelectedDepartment(null)}>
                      <X className="h-4 w-4" />
                    </IOSButton>
                  </div>

                  {/* Request Type */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Request Type</label>
                    <div className="flex flex-wrap gap-2">
                      {DEPARTMENT_CONFIG[selectedDepartment].requestTypes.map(type => (
                        <button
                          key={type.id}
                          onClick={() => setSelectedRequestType(type.id)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            selectedRequestType === type.id 
                              ? 'bg-[#3C3C43] text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Room Number */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Room Number *</label>
                    <Input
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      placeholder="e.g., 101"
                    />
                  </div>

                  {/* Guest Name */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Guest Name</label>
                    <Input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Guest name (optional)"
                    />
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Priority</label>
                    <div className="flex gap-2">
                      {PRIORITY_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setPriority(opt.value as any)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            priority === opt.value 
                              ? opt.color + ' ring-2 ring-offset-1 ring-gray-400' 
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Additional Details</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Provide any additional details..."
                      className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                      rows={3}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <IOSButton variant="outline" className="flex-1" onClick={() => { resetForm(); setIsOpen(false); }}>
                      Cancel
                    </IOSButton>
                    <IOSButton 
                      className="flex-1 bg-[#3C3C43] hover:bg-[#000000]"
                      onClick={handleSubmitRequest}
                      disabled={isSubmitting || !roomNumber}
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Send Request
                    </IOSButton>
                  </div>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
