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
import { housekeepingAPI } from '@/lib/api';
import { 
  Eye, RefreshCw, Search, Plus, CheckCircle, XCircle, AlertTriangle,
  Bed, User, Calendar, Clock, Star, ClipboardCheck, Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Inspection {
  id: string;
  room_number: string;
  room_id: string;
  inspected_by: string;
  inspector_name?: string;
  result: 'passed' | 'failed' | 'needs_attention';
  score?: number;
  checklist?: { item: string; passed: boolean; notes?: string }[];
  notes?: string;
  photos?: string[];
  created_at: string;
}

interface RoomForInspection {
  id: string;
  room_number: string;
  floor: number;
  room_type: string;
  cleaned_by?: string;
  cleaned_at?: string;
}

const resultConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  passed: { label: 'Passed', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle },
  failed: { label: 'Failed', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
  needs_attention: { label: 'Needs Attention', color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: AlertTriangle },
};

const inspectionChecklist = [
  { id: 'bed', label: 'Bed made properly' },
  { id: 'bathroom', label: 'Bathroom clean' },
  { id: 'floor', label: 'Floor vacuumed/mopped' },
  { id: 'dusting', label: 'Surfaces dusted' },
  { id: 'amenities', label: 'Amenities restocked' },
  { id: 'trash', label: 'Trash emptied' },
  { id: 'windows', label: 'Windows clean' },
  { id: 'smell', label: 'Room smells fresh' },
];

export default function HousekeepingInspectionsPage() {
  const { user } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [roomsForInspection, setRoomsForInspection] = useState<RoomForInspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [resultFilter, setResultFilter] = useState<string>('all');

  // Modal states
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomForInspection | null>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchInspections = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (resultFilter !== 'all') params.result = resultFilter;

      const [inspectionsRes, queueRes] = await Promise.all([
        housekeepingAPI.getInspections(params),
        housekeepingAPI.getInspectionQueue(),
      ]);

      if (inspectionsRes.success) setInspections(inspectionsRes.data || []);
      if (queueRes.success) setRoomsForInspection(queueRes.data || []);
    } catch (error) {
      console.error('Error fetching inspections:', error);
    } finally {
      setIsLoading(false);
    }
  }, [resultFilter]);

  useEffect(() => {
    fetchInspections();
  }, [fetchInspections]);

  const filteredInspections = inspections.filter((inspection) => {
    const matchesSearch = inspection.room_number?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const openInspectModal = (room: RoomForInspection) => {
    setSelectedRoom(room);
    setChecklist({});
    setNotes('');
    setInspectModalOpen(true);
  };

  const handleSubmitInspection = async () => {
    if (!selectedRoom) return;

    const passedItems = Object.values(checklist).filter(Boolean).length;
    const totalItems = inspectionChecklist.length;
    const score = Math.round((passedItems / totalItems) * 100);
    
    let result: 'passed' | 'failed' | 'needs_attention' = 'passed';
    if (score < 60) result = 'failed';
    else if (score < 80) result = 'needs_attention';

    setIsSubmitting(true);
    try {
      await housekeepingAPI.submitInspection({
        room_id: selectedRoom.id,
        room_number: selectedRoom.room_number,
        result,
        score,
        checklist: inspectionChecklist.map(item => ({
          item: item.label,
          passed: checklist[item.id] || false,
        })),
        notes,
      });

      toast.success(`Inspection submitted - ${result.replace('_', ' ')}`);
      setInspectModalOpen(false);
      fetchInspections();
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stats
  const stats = {
    total: inspections.length,
    passed: inspections.filter(i => i.result === 'passed').length,
    failed: inspections.filter(i => i.result === 'failed').length,
    pending: roomsForInspection.length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Room Inspections</h1>
              <p className="text-gray-500">Quality control for cleaned rooms</p>
            </div>
            <IOSButton variant="outline" onClick={fetchInspections} leftIcon={<RefreshCw />}>Refresh
            </IOSButton>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Total Inspections</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500">
              <p className="text-sm text-gray-500">Passed</p>
              <p className="text-2xl font-bold text-[#34C759]">{stats.passed}</p>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-red-500">
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold text-[#FF3B30]">{stats.failed}</p>
            </IOSCard>
            <IOSCard className="p-4 border-l-4 border-[#007AFF]">
              <p className="text-sm text-gray-500">Awaiting Inspection</p>
              <p className="text-2xl font-bold text-[#007AFF]">{stats.pending}</p>
            </IOSCard>
          </div>

          {/* Rooms Awaiting Inspection */}
          {roomsForInspection.length > 0 && (
            <IOSCard className="p-6">
              <h2 className="text-lg font-semibold font-sf-pro-display mb-4 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-[#007AFF]" />
                Rooms Ready for Inspection ({roomsForInspection.length})
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {roomsForInspection.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => openInspectModal(room)}
                    className="p-4 bg-blue-50 rounded-ios-lg cursor-pointer hover:bg-blue-100 transition text-center"
                  >
                    <Bed className="h-6 w-6 mx-auto mb-2 text-[#007AFF]" />
                    <p className="font-bold">{room.room_number}</p>
                    <p className="text-xs text-gray-500">Floor {room.floor}</p>
                    <IOSButton size="sm" className="mt-2 w-full">
                      <Eye className="h-3 w-3 mr-1" /> Inspect
                    </IOSButton>
                  </div>
                ))}
              </div>
            </IOSCard>
          )}

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <Input
                    placeholder="Search room number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <select
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
                className="px-3 py-2 border rounded-ios-lg text-sm"
              >
                <option value="all">All Results</option>
                {Object.entries(resultConfig).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
          </IOSCard>

          {/* Inspections History */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredInspections.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Eye className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No inspections found</p>
            </IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredInspections.map((inspection) => {
                const resultInfo = resultConfig[inspection.result] || resultConfig.passed;
                const ResultIcon = resultInfo.icon;

                return (
                  <IOSCard key={inspection.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-ios-lg ${resultInfo.bgColor}`}>
                          <ResultIcon className={`h-6 w-6 ${resultInfo.color}`} />
                        </div>
                        <div>
                          <p className="font-bold">Room {inspection.room_number}</p>
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <User className="h-3 w-3" /> {inspection.inspector_name || 'Unknown'}
                            <span>•</span>
                            <Calendar className="h-3 w-3" /> {new Date(inspection.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {inspection.score !== undefined && (
                          <div className="text-center">
                            <p className="text-2xl font-bold">{inspection.score}%</p>
                            <p className="text-xs text-gray-500">Score</p>
                          </div>
                        )}
                        <IOSBadge className={`${resultInfo.bgColor} ${resultInfo.color}`}>
                          {resultInfo.label}
                        </IOSBadge>
                      </div>
                    </div>
                    {inspection.notes && (
                      <p className="mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded">{inspection.notes}</p>
                    )}
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Inspection Modal */}
        <Dialog open={inspectModalOpen} onOpenChange={setInspectModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Inspect Room {selectedRoom?.room_number}
              </DialogTitle>
            </DialogHeader>
            {selectedRoom && (
              <div className="space-y-4 mt-4">
                <div className="p-3 bg-blue-50 rounded-ios-lg">
                  <p className="font-medium">Room {selectedRoom.room_number}</p>
                  <p className="text-sm text-[#007AFF]">Floor {selectedRoom.floor} • {selectedRoom.room_type}</p>
                </div>

                {/* Checklist */}
                <div className="space-y-2">
                  <p className="font-medium">Inspection Checklist</p>
                  {inspectionChecklist.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-center gap-3 p-3 rounded-ios-lg cursor-pointer transition ${
                        checklist[item.id] ? 'bg-green-50 border border-green-200' : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checklist[item.id] || false}
                        onChange={(e) => setChecklist({ ...checklist, [item.id]: e.target.checked })}
                        className="w-5 h-5"
                      />
                      <span className={checklist[item.id] ? 'text-green-700' : ''}>{item.label}</span>
                      {checklist[item.id] && <CheckCircle className="h-4 w-4 text-[#34C759] ml-auto" />}
                    </label>
                  ))}
                </div>

                {/* Score Preview */}
                <div className="p-4 bg-gray-50 rounded-ios-lg text-center">
                  <p className="text-sm text-gray-500">Current Score</p>
                  <p className="text-3xl font-bold">
                    {Math.round((Object.values(checklist).filter(Boolean).length / inspectionChecklist.length) * 100)}%
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2 border rounded-ios-lg mt-1"
                    rows={3}
                    placeholder="Any issues or comments..."
                  />
                </div>

                <div className="flex gap-3">
                  <IOSButton variant="outline" onClick={() => setInspectModalOpen(false)} className="flex-1">
                    Cancel
                  </IOSButton>
                  <IOSButton onClick={handleSubmitInspection} disabled={isSubmitting} className="flex-1">
                    {isSubmitting ? 'Submitting...' : 'Submit Inspection'}
                  </IOSButton>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
