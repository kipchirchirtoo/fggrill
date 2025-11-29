'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ClipboardCheck, Search, Filter, RefreshCw, CheckCircle, XCircle,
  AlertTriangle, Star, Camera, ChevronRight, ArrowLeft, Eye, Bed,
  TrendingUp, BarChart3, Clock, User
} from 'lucide-react';
import { housekeepingAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

interface Inspection {
  id: string;
  inspection_number: string;
  room_number: string;
  room_id: string;
  inspection_type: string;
  cleanliness_score: number;
  tidiness_score: number;
  bathroom_score: number;
  amenities_score: number;
  linens_score: number;
  maintenance_score: number;
  overall_score: number;
  result: 'passed' | 'passed_with_notes' | 'failed' | 'needs_rework';
  deficiencies: any[];
  photos: string[];
  inspected_at: string;
  notes?: string;
  inspector?: {
    staff_code: string;
    user: { first_name: string; last_name: string };
  };
  task?: {
    task_number: string;
    task_type: string;
  };
}

interface InspectionQueue {
  id: string;
  task_number: string;
  room_number: string;
  floor_number: number;
  task_type: string;
  is_vip: boolean;
  completed_at: string;
  completed_by_staff?: {
    staff_code: string;
    user: { first_name: string; last_name: string };
  };
}

interface RoomForInspection {
  id: string;
  room_number: string;
  floor: number;
  room_type: string;
  last_cleaned_at: string;
  is_vip: boolean;
  attendant?: {
    staff_code: string;
    user: { first_name: string; last_name: string };
  };
}

export default function InspectionsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'stats'>('queue');
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [queue, setQueue] = useState<InspectionQueue[]>([]);
  const [roomsForInspection, setRoomsForInspection] = useState<RoomForInspection[]>([]);
  const [stats, setStats] = useState({ total: 0, passed: 0, failed: 0, passRate: 0, avgScore: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterResult, setFilterResult] = useState<string>('all');
  
  // Inspection modal state
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomForInspection | null>(null);
  const [selectedTask, setSelectedTask] = useState<InspectionQueue | null>(null);
  const [inspectionForm, setInspectionForm] = useState({
    cleanlinessScore: 5,
    tidinessScore: 5,
    bathroomScore: 5,
    amenitiesScore: 5,
    linensScore: 5,
    maintenanceScore: 5,
    notes: '',
    deficiencies: [] as { category: string; description: string; severity: string }[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [queueRes, inspectionsRes, roomsRes, statsRes] = await Promise.all([
        housekeepingAPI.getInspectionQueue().catch(() => ({ data: [] })),
        housekeepingAPI.getInspections().catch(() => ({ data: [] })),
        housekeepingAPI.getRoomsForInspection().catch(() => ({ data: [] })),
        housekeepingAPI.getInspectionStats().catch(() => ({ data: { total: 0, passed: 0, failed: 0, passRate: 0, avgScore: 0 } }))
      ]);

      setQueue(queueRes.data || []);
      setInspections(inspectionsRes.data || []);
      setRoomsForInspection(roomsRes.data || []);
      setStats(statsRes.data || { total: 0, passed: 0, failed: 0, passRate: 0, avgScore: 0 });
    } catch (error) {
      console.error('Error fetching inspection data:', error);
      toast.error('Failed to load inspection data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const startInspection = (item: InspectionQueue | RoomForInspection) => {
    if ('task_number' in item) {
      setSelectedTask(item);
      setSelectedRoom(null);
    } else {
      setSelectedRoom(item);
      setSelectedTask(null);
    }
    setInspectionForm({
      cleanlinessScore: 5,
      tidinessScore: 5,
      bathroomScore: 5,
      amenitiesScore: 5,
      linensScore: 5,
      maintenanceScore: 5,
      notes: '',
      deficiencies: []
    });
    setIsInspectModalOpen(true);
  };

  const addDeficiency = () => {
    setInspectionForm(prev => ({
      ...prev,
      deficiencies: [...prev.deficiencies, { category: 'cleanliness', description: '', severity: 'minor' }]
    }));
  };

  const updateDeficiency = (index: number, field: string, value: string) => {
    setInspectionForm(prev => ({
      ...prev,
      deficiencies: prev.deficiencies.map((d, i) => i === index ? { ...d, [field]: value } : d)
    }));
  };

  const removeDeficiency = (index: number) => {
    setInspectionForm(prev => ({
      ...prev,
      deficiencies: prev.deficiencies.filter((_, i) => i !== index)
    }));
  };

  const submitInspection = async (passed: boolean) => {
    setIsSubmitting(true);
    try {
      const roomId = selectedTask ? selectedTask.id : selectedRoom?.id;
      const taskId = selectedTask?.id;

      // Calculate overall score
      const scores = [
        inspectionForm.cleanlinessScore,
        inspectionForm.tidinessScore,
        inspectionForm.bathroomScore,
        inspectionForm.amenitiesScore,
        inspectionForm.linensScore,
        inspectionForm.maintenanceScore
      ];
      const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      await housekeepingAPI.submitInspection({
        taskId,
        roomId,
        inspectionType: selectedTask ? 'post_cleaning' : 'random',
        cleanlinessScore: inspectionForm.cleanlinessScore,
        tidinessScore: inspectionForm.tidinessScore,
        bathroomScore: inspectionForm.bathroomScore,
        amenitiesScore: inspectionForm.amenitiesScore,
        linensScore: inspectionForm.linensScore,
        maintenanceScore: inspectionForm.maintenanceScore,
        deficiencies: inspectionForm.deficiencies.filter(d => d.description),
        notes: inspectionForm.notes
      });

      toast.success(passed ? 'Room passed inspection!' : 'Inspection submitted - rework required');
      setIsInspectModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to submit inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getResultBadge = (result: string) => {
    const styles: Record<string, string> = {
      passed: 'bg-emerald-100 text-emerald-800',
      passed_with_notes: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      needs_rework: 'bg-orange-100 text-orange-800'
    };
    const labels: Record<string, string> = {
      passed: 'Passed',
      passed_with_notes: 'Passed (Notes)',
      failed: 'Failed',
      needs_rework: 'Needs Rework'
    };
    return (
      <Badge className={styles[result] || 'bg-gray-100 text-gray-800'}>
        {labels[result] || result}
      </Badge>
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-emerald-600';
    if (score >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const filteredInspections = inspections.filter(i => {
    const matchesSearch = searchQuery === '' || 
      i.room_number.includes(searchQuery) ||
      i.inspection_number.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterResult === 'all' || i.result === filterResult;
    return matchesSearch && matchesFilter;
  });

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HOUSEKEEPING]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/housekeeping">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl shadow-lg">
                <ClipboardCheck className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Room Inspections</h1>
                <p className="text-gray-600">Quality control and room verification</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={fetchData} variant="outline" size="icon">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Pending</p>
                  <p className="text-3xl font-bold">{queue.length}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-200" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-emerald-500 to-green-500 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-100 text-sm">Passed Today</p>
                  <p className="text-3xl font-bold">{stats.passed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-emerald-200" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-red-500 to-rose-500 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-100 text-sm">Failed Today</p>
                  <p className="text-3xl font-bold">{stats.failed}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-200" />
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-amber-500 to-orange-500 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-100 text-sm">Pass Rate</p>
                  <p className="text-3xl font-bold">{stats.passRate}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-amber-200" />
              </div>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            {[
              { id: 'queue', label: 'Inspection Queue', icon: Clock },
              { id: 'history', label: 'History', icon: ClipboardCheck },
              { id: 'stats', label: 'Statistics', icon: BarChart3 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Queue Tab */}
          {activeTab === 'queue' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pending Inspections */}
              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-500" />
                  Tasks Awaiting Inspection ({queue.length})
                </h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {queue.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No tasks pending inspection</p>
                  ) : (
                    queue.map(item => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => startInspection(item)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${item.is_vip ? 'bg-amber-100' : 'bg-purple-100'}`}>
                              <Bed className={`h-5 w-5 ${item.is_vip ? 'text-amber-600' : 'text-purple-600'}`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">Room {item.room_number}</p>
                              <p className="text-sm text-gray-500">
                                {item.task_type.replace(/_/g, ' ')} • Floor {item.floor_number}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {item.is_vip && (
                              <Badge className="bg-amber-100 text-amber-800 mb-1">VIP</Badge>
                            )}
                            <p className="text-xs text-gray-500">
                              {new Date(item.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        {item.completed_by_staff && (
                          <p className="text-sm text-gray-500 mt-2">
                            Cleaned by: {item.completed_by_staff.user.first_name} {item.completed_by_staff.user.last_name}
                          </p>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </Card>

              {/* Rooms Ready for Random Inspection */}
              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-indigo-500" />
                  Rooms for Random Inspection ({roomsForInspection.length})
                </h3>
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {roomsForInspection.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No rooms ready for inspection</p>
                  ) : (
                    roomsForInspection.map(room => (
                      <motion.div
                        key={room.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => startInspection(room)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${room.is_vip ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                              <Bed className={`h-5 w-5 ${room.is_vip ? 'text-amber-600' : 'text-indigo-600'}`} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">Room {room.room_number}</p>
                              <p className="text-sm text-gray-500">{room.room_type} • Floor {room.floor}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            {room.is_vip && (
                              <Badge className="bg-amber-100 text-amber-800 mb-1">VIP</Badge>
                            )}
                            <p className="text-xs text-gray-500">
                              Last cleaned: {new Date(room.last_cleaned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <Card className="p-5">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by room or inspection number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={filterResult}
                  onChange={(e) => setFilterResult(e.target.value)}
                  className="px-3 py-2 border rounded-lg bg-white"
                >
                  <option value="all">All Results</option>
                  <option value="passed">Passed</option>
                  <option value="passed_with_notes">Passed with Notes</option>
                  <option value="failed">Failed</option>
                  <option value="needs_rework">Needs Rework</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Inspection #</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Room</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Type</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Score</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Result</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Inspector</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInspections.map(inspection => (
                      <tr key={inspection.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium">{inspection.inspection_number}</td>
                        <td className="py-3 px-4">{inspection.room_number}</td>
                        <td className="py-3 px-4 capitalize">{inspection.inspection_type.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-4">
                          <span className={`font-semibold ${getScoreColor(inspection.overall_score)}`}>
                            {inspection.overall_score?.toFixed(1)}/5
                          </span>
                        </td>
                        <td className="py-3 px-4">{getResultBadge(inspection.result)}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {inspection.inspector?.user.first_name} {inspection.inspector?.user.last_name}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {new Date(inspection.inspected_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Today&apos;s Summary</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Inspections</span>
                    <span className="font-semibold">{stats.total}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Passed</span>
                    <span className="font-semibold text-emerald-600">{stats.passed}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Failed</span>
                    <span className="font-semibold text-red-600">{stats.failed}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Pass Rate</span>
                    <span className="font-semibold">{stats.passRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Average Score</span>
                    <span className={`font-semibold ${getScoreColor(stats.avgScore)}`}>
                      {stats.avgScore?.toFixed(2)}/5
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Quality Metrics</h3>
                <div className="space-y-4">
                  {['Cleanliness', 'Tidiness', 'Bathroom', 'Amenities', 'Linens', 'Maintenance'].map((category, idx) => (
                    <div key={category}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-600 text-sm">{category}</span>
                        <span className="text-sm font-medium">{(4.2 + idx * 0.1).toFixed(1)}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full"
                          style={{ width: `${(4.2 + idx * 0.1) / 5 * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Inspection Modal */}
          <Dialog open={isInspectModalOpen} onOpenChange={setIsInspectModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-purple-500" />
                  Room Inspection - {selectedRoom?.room_number || selectedTask?.room_number}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Scoring Section */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4">Quality Scores (1-5)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: 'cleanlinessScore', label: 'Cleanliness' },
                      { key: 'tidinessScore', label: 'Tidiness' },
                      { key: 'bathroomScore', label: 'Bathroom' },
                      { key: 'amenitiesScore', label: 'Amenities' },
                      { key: 'linensScore', label: 'Linens' },
                      { key: 'maintenanceScore', label: 'Maintenance' }
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map(score => (
                            <button
                              key={score}
                              type="button"
                              onClick={() => setInspectionForm(prev => ({ ...prev, [key]: score }))}
                              className={`w-10 h-10 rounded-lg border-2 font-semibold transition-colors ${
                                inspectionForm[key as keyof typeof inspectionForm] === score
                                  ? 'border-purple-500 bg-purple-50 text-purple-700'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Deficiencies */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-900">Deficiencies</h4>
                    <Button size="sm" variant="outline" onClick={addDeficiency}>
                      Add Issue
                    </Button>
                  </div>
                  {inspectionForm.deficiencies.length === 0 ? (
                    <p className="text-sm text-gray-500">No issues reported</p>
                  ) : (
                    <div className="space-y-3">
                      {inspectionForm.deficiencies.map((def, idx) => (
                        <div key={idx} className="p-3 border rounded-lg space-y-2">
                          <div className="flex gap-2">
                            <select
                              value={def.category}
                              onChange={(e) => updateDeficiency(idx, 'category', e.target.value)}
                              className="px-2 py-1 border rounded text-sm"
                            >
                              <option value="cleanliness">Cleanliness</option>
                              <option value="tidiness">Tidiness</option>
                              <option value="bathroom">Bathroom</option>
                              <option value="amenities">Amenities</option>
                              <option value="linens">Linens</option>
                              <option value="maintenance">Maintenance</option>
                            </select>
                            <select
                              value={def.severity}
                              onChange={(e) => updateDeficiency(idx, 'severity', e.target.value)}
                              className="px-2 py-1 border rounded text-sm"
                            >
                              <option value="minor">Minor</option>
                              <option value="moderate">Moderate</option>
                              <option value="major">Major</option>
                            </select>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeDeficiency(idx)}
                              className="text-red-500"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                          <Input
                            placeholder="Describe the issue..."
                            value={def.description}
                            onChange={(e) => updateDeficiency(idx, 'description', e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                  <textarea
                    value={inspectionForm.notes}
                    onChange={(e) => setInspectionForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={3}
                    placeholder="Additional observations..."
                  />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsInspectModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => submitInspection(false)}
                    disabled={isSubmitting}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Fail Inspection
                  </Button>
                  <Button
                    onClick={() => submitInspection(true)}
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Pass Inspection
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
