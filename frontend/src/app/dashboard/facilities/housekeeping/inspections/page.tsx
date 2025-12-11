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
import { CheckSquare, RefreshCw, Plus, Star, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface Inspection {
  id: string;
  room_number: string;
  floor: number;
  inspector_name: string;
  inspection_date: string;
  overall_score: number;
  cleanliness_score: number;
  maintenance_score: number;
  amenities_score: number;
  notes: string;
  issues_found: string[];
  status: string;
}

interface Room { id: string; room_number: string; floor: number; room_type: string; }

function InspectionsContent() {
  const { activeBranch, activeBranchId } = useBranch();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ room_id: '', room_number: '', cleanliness_score: 80, maintenance_score: 80, amenities_score: 80, notes: '' });

  // Fetch rooms for dropdown
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await facilitiesAPI.getRooms(activeBranchId);
        if (res.success) setRooms(res.data || []);
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    };
    if (activeBranchId) fetchRooms();
  }, [activeBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.room_number) { toast.error('Please select a room'); return; }
    setIsSubmitting(true);
    try {
      // Scale scores from 0-100 to 0-10 for database
      const cleanlinessScaled = Math.round(formData.cleanliness_score / 10 * 10) / 10;
      const maintenanceScaled = Math.round(formData.maintenance_score / 10 * 10) / 10;
      const amenitiesScaled = Math.round(formData.amenities_score / 10 * 10) / 10;
      const overallScaled = Math.round((cleanlinessScaled + maintenanceScaled + amenitiesScaled) / 3 * 10) / 10;
      const response = await facilitiesAPI.createInspection({ 
        room_number: formData.room_number,
        cleanliness_score: cleanlinessScaled,
        maintenance_score: maintenanceScaled,
        amenities_score: amenitiesScaled,
        overall_score: overallScaled,
        notes: formData.notes,
        branch_id: activeBranchId 
      });
      if (response.success) {
        toast.success('Inspection created successfully');
        setShowModal(false);
        setFormData({ room_id: '', room_number: '', cleanliness_score: 80, maintenance_score: 80, amenities_score: 80, notes: '' });
        fetchInspections();
      } else { toast.error(response.error || 'Failed to create inspection'); }
    } catch (error) { toast.error('Failed to create inspection'); }
    finally { setIsSubmitting(false); }
  };

  useEffect(() => {
    if (activeBranchId) fetchInspections();
  }, [activeBranchId]);

  const fetchInspections = async () => {
    setIsLoading(true);
    try {
      const response = await facilitiesAPI.getInspections(activeBranchId);
      if (response.success) {
        setInspections(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching inspections:', error);
      toast.error('Failed to load inspections');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (_score?: number) => 'text-gray-700 bg-gray-100 border border-gray-200';

  const renderStars = (score: number) => {
    const stars = Math.round(score / 20);
    return Array(5).fill(0).map((_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < stars ? 'text-gray-600 fill-gray-600' : 'text-gray-300'}`} />
    ));
  };

  const avgScore = inspections.length > 0
    ? Math.round(inspections.reduce((sum, i) => sum + (i.overall_score || 0), 0) / inspections.length)
    : 0;

  return (
    <ProtectedRoute allowedRoles={[UserRole.FACILITIES_MANAGER, UserRole.HOUSEKEEPING, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout
        title="Room Inspections"
        subtitle={`Quality inspections for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <div className="flex gap-2">
            <IOSButton variant="secondary" onClick={fetchInspections} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            <IOSButton variant="primary" onClick={() => setShowModal(true)} leftIcon={<Plus />}>New Inspection</IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{inspections.length}</p>
              <p className="text-sm text-gray-500">Total Inspections</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">
                {avgScore}%
              </p>
              <p className="text-sm text-gray-500">Average Score</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">
                {inspections.filter(i => (i.overall_score || 0) >= 80).length}
              </p>
              <p className="text-sm text-gray-500">Passed</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">
                {inspections.filter(i => (i.overall_score || 0) < 80).length}
              </p>
              <p className="text-sm text-gray-500">Needs Attention</p>
            </Card>
          </div>

          {/* Inspections List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {inspections.map(inspection => (
                <Card key={inspection.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${getScoreColor(inspection.overall_score || 0)}`}>
                        <CheckSquare className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          Room {inspection.room_number}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Inspected by: {inspection.inspector_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(inspection.inspection_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`inline-block px-3 py-1 rounded-full text-lg font-bold ${getScoreColor(inspection.overall_score || 0)}`}>
                        {inspection.overall_score || 0}%
                      </div>
                      <div className="flex justify-end mt-2">
                        {renderStars(inspection.overall_score || 0)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Score Breakdown */}
                  <div className="mt-4 grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Cleanliness</p>
                      <p className="font-bold">{inspection.cleanliness_score || 0}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Maintenance</p>
                      <p className="font-bold">{inspection.maintenance_score || 0}%</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Amenities</p>
                      <p className="font-bold">{inspection.amenities_score || 0}%</p>
                    </div>
                  </div>

                  {inspection.notes && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">{inspection.notes}</p>
                    </div>
                  )}

                  {inspection.issues_found && inspection.issues_found.length > 0 && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-2 text-gray-700 mb-2">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium">Issues Found</span>
                      </div>
                      <ul className="list-disc list-inside text-sm text-gray-600">
                        {inspection.issues_found.map((issue, i) => (
                          <li key={i}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {!isLoading && inspections.length === 0 && (
            <Card className="p-12 text-center">
              <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No inspections found</h3>
              <p className="text-gray-500">Start a new inspection to track room quality</p>
            </Card>
          )}
        </div>
      <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New Room Inspection</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Room *</Label>
                <select 
                  value={formData.room_number} 
                  onChange={(e) => setFormData({ ...formData, room_number: e.target.value })} 
                  className="w-full px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="">Select a room...</option>
                  {rooms.map(room => (
                    <option key={room.id} value={room.room_number}>Room {room.room_number} - Floor {room.floor} ({room.room_type})</option>
                  ))}
                </select>
              </div>
              <div><Label>Cleanliness Score (0-100)</Label><Input type="number" min="0" max="100" value={formData.cleanliness_score} onChange={(e) => setFormData({ ...formData, cleanliness_score: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Maintenance Score (0-100)</Label><Input type="number" min="0" max="100" value={formData.maintenance_score} onChange={(e) => setFormData({ ...formData, maintenance_score: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Amenities Score (0-100)</Label><Input type="number" min="0" max="100" value={formData.amenities_score} onChange={(e) => setFormData({ ...formData, amenities_score: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Notes</Label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Notes..." /></div>
              <div className="flex gap-2 justify-end"><IOSButton type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</IOSButton><IOSButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Inspection'}</IOSButton></div>
            </form>
          </DialogContent>
        </Dialog>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function InspectionsPage() {
  return (
    <BranchPageWrapper>
      <InspectionsContent />
    </BranchPageWrapper>
  );
}
