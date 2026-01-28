'use client';

import { useState, useEffect } from 'react';
import type { RoomStatus } from '@/types/system.types';
import { motion } from 'framer-motion';
import {
  X, Camera, MessageSquare, AlertTriangle, Clock, CheckCircle,
  User, Bed, ClipboardCheck, Package, Calendar, Timer, Upload,
  Save, AlertCircle, Play, Pause, RotateCw, Filter, Search,
  ChevronRight
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { housekeepingAPI } from '@/lib/api';

// ============= REPORT ISSUE MODAL =============
export function ReportIssueModal({ isOpen, onClose, roomNumber = '' }: any) {
  const [step, setStep] = useState(1);
  const [issueData, setIssueData] = useState({
    roomNumber: roomNumber,
    category: 'maintenance',
    priority: 'normal',
    description: '',
    photos: [],
    reportedBy: ''
  });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setIssueData(prev => ({ ...prev, roomNumber }));
    }
  }, [isOpen, roomNumber]);

  const handleSubmit = () => {
    toast.warning('Issue reported for Room ' + issueData.roomNumber);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Report Room Issue</h2>
              <div className="flex gap-2 mt-2">
                {[1, 2].map(s => (
                  <div key={s} className={`h-1 rounded-full transition-all duration-300 ${s <= step ? 'w-8 bg-red-600' : 'w-2 bg-gray-100'}`} />
                ))}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ x: 10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -10, opacity: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target Location</label>
                  <div className="relative">
                    <Bed className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={issueData.roomNumber}
                      onChange={(e) => setIssueData({ ...issueData, roomNumber: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-red-500 focus:bg-white rounded-xl outline-none transition-all font-bold"
                      placeholder="Enter Room Number..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select
                        value={issueData.category}
                        onChange={(e) => setIssueData({ ...issueData, category: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-red-500 focus:bg-white rounded-xl outline-none transition-all appearance-none font-medium"
                      >
                        <option value="maintenance">Maintenance</option>
                        <option value="cleaning">Deep Cleaning</option>
                        <option value="damage">Damage</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Priority</label>
                    <div className="relative">
                      <AlertCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select
                        value={issueData.priority}
                        onChange={(e) => setIssueData({ ...issueData, priority: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-red-500 focus:bg-white rounded-xl outline-none transition-all appearance-none font-medium"
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ x: 10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -10, opacity: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Issue Description</label>
                  <textarea
                    required
                    value={issueData.description}
                    onChange={(e) => setIssueData({ ...issueData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-red-500 focus:bg-white rounded-xl outline-none transition-all min-h-[120px] resize-none text-sm"
                    placeholder="Provide specific details about what's broken or needs attention..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Evidence / Photos</label>
                  <div className="relative border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-red-400 transition-colors group cursor-pointer">
                    <Camera className="h-8 w-8 text-gray-300 mx-auto mb-2 group-hover:text-red-400 transition-colors" />
                    <p className="text-xs font-bold text-gray-400 group-hover:text-red-500 uppercase tracking-tight">Tap to capture or upload</p>
                    <input type="file" multiple accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 py-5 bg-gray-50 border-t border-gray-100 flex gap-3">
          {step === 1 ? (
            <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">
              Discard
            </button>
          ) : (
            <button onClick={() => setStep(1)} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">
              Go Back
            </button>
          )}

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!issueData.roomNumber}
              className="flex-[2] bg-gray-900 text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!issueData.description}
              className="flex-[2] bg-red-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" /> Report Issue
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============= UPDATE ROOM STATUS MODAL =============
export function UpdateRoomStatusModal({ isOpen, onClose, room }: any) {
  const [status, setStatus] = useState(room?.currentStatus || 'dirty');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Room ' + room?.roomNumber + ' status updated to ' + status);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Update Room Status</h2>
            <p className="text-sm text-gray-500">Room {room?.roomNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Status</label>
            <div className="grid grid-cols-2 gap-3">
              {['clean', 'dirty', 'inspected', 'in-progress'].map((statusOption) => (
                <button
                  key={statusOption}
                  type="button"
                  onClick={() => setStatus(statusOption)}
                  className={'p-3 rounded-ios-lg border-2 capitalize transition-colors ' + (status === statusOption ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300')}
                >
                  {statusOption.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500"
              rows={3}
              placeholder="Any additional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Update Status
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ============= INSPECTION MODE MODAL =============
export function InspectionModeModal({ isOpen, onClose }: any) {
  const [step, setStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);
  const [inspectionData, setInspectionData] = useState({
    cleanliness: 5,
    amenities: 5,
    maintenance: 5,
    overall: 5,
    notes: '',
    issues: []
  });

  const [roomsForInspection, setRoomsForInspection] = useState<RoomStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedRoom(null);
      const fetchRooms = async () => {
        setIsLoading(true);
        try {
          const data = await housekeepingAPI.getRoomsForInspection();
          setRoomsForInspection(data.data || data || []);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An error occurred');
          toast.error('Failed to load rooms for inspection');
        } finally {
          setIsLoading(false);
        }
      };
      fetchRooms();
    }
  }, [isOpen]);

  const handleInspectionSubmit = () => {
    toast.success('Room ' + selectedRoom?.roomNumber + ' inspection completed');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Room Inspection</h2>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1 rounded-full transition-all duration-300 ${s <= (selectedRoom ? (step === 2 ? 2 : 3) : 1) ? 'w-8 bg-indigo-600' : 'w-2 bg-gray-100'}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {!selectedRoom ? (
              <motion.div
                key="selection"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-2">
                  <RotateCw className="h-4 w-4" /> Phase 1: Select Room
                </div>
                {isLoading ? (
                  <div className="py-20 text-center text-gray-400 font-medium">Scanning for ready rooms...</div>
                ) : roomsForInspection.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roomsForInspection.map((room: RoomStatus) => (
                      <button
                        key={room.roomId}
                        onClick={() => { setSelectedRoom(room); setStep(2); }}
                        className="group flex items-center justify-between p-5 bg-gray-50 hover:bg-indigo-50 border-2 border-transparent hover:border-indigo-100 rounded-2xl transition-all text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600 font-bold group-hover:scale-110 transition-transform">
                            {room.roomNumber}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 leading-none">Standard Room</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight mt-2">Cleaned: {room.lastCleaned ? new Date(room.lastCleaned).toLocaleTimeString() : 'N/A'}</p>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100">
                    <p className="text-gray-400 font-medium italic">No rooms currently awaiting inspection.</p>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="space-y-8">
                {step === 2 && (
                  <motion.div
                    key="ratings"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-8"
                  >
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Active Inspection</p>
                        <p className="text-lg font-bold text-indigo-900 leading-none mt-1">Room {selectedRoom.roomNumber}</p>
                      </div>
                      <div className="bg-white p-2 rounded-xl shadow-sm">
                        <ClipboardCheck className="h-5 w-5 text-indigo-600" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {['Cleanliness', 'Amenities', 'Maintenance', 'Overall'].map((category) => (
                        <div key={category} className="space-y-3">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">{category} Rating</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((rating) => (
                              <button
                                key={rating}
                                onClick={() => setInspectionData({ ...inspectionData, [category.toLowerCase() as any]: rating })}
                                className={`flex-1 aspect-square rounded-xl font-bold transition-all border-2 ${inspectionData[category.toLowerCase() as keyof typeof inspectionData] === rating
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105'
                                  : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-100 hover:text-indigo-400'
                                  }`}
                              >
                                {rating}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="notes"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-6"
                  >
                    <div>
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Observation Notes</label>
                      <textarea
                        value={inspectionData.notes}
                        onChange={(e) => setInspectionData({ ...inspectionData, notes: e.target.value })}
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-3xl outline-none transition-all text-sm min-h-[160px] resize-none mt-2"
                        placeholder="Log any minor defects or positive feedback here..."
                      />
                    </div>

                    <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-amber-700 leading-relaxed">
                        Failing an inspection will automatically generate a deep cleaning task for the next housekeeper.
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>

        {selectedRoom && (
          <div className="px-6 py-5 bg-gray-50 border-t border-gray-100 flex gap-4 shrink-0">
            <button
              onClick={() => step === 2 ? setSelectedRoom(null) : setStep(2)}
              className="px-6 py-4 bg-white border border-gray-200 text-gray-500 rounded-2xl font-bold transition-all hover:bg-gray-100 shadow-sm"
            >
              Back
            </button>

            {step === 2 ? (
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                Continue <ChevronRight className="h-5 w-5" />
              </button>
            ) : (
              <div className="flex-[2] flex gap-3">
                <button
                  onClick={() => { toast.error('Inspection failed'); onClose(); }}
                  className="flex-1 bg-white border-2 border-red-500 text-red-600 py-4 rounded-2xl font-bold hover:bg-red-50 transition-all"
                >
                  Fail
                </button>
                <button
                  onClick={handleInspectionSubmit}
                  className="flex-[1.5] bg-green-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-100 hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle className="h-5 w-5" /> Pass & Close
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ============= TASK DETAILS MODAL =============
export function TaskDetailsModal({ isOpen, onClose, task }: any) {
  if (!isOpen || !task) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="bg-white rounded-xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Task Details</h2>
            <p className="text-sm text-gray-500">Room {task.roomNumber}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Task Type</p>
              <p className="font-medium capitalize">{task.taskType?.replace('-', ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Priority</p>
              <p className="font-medium capitalize text-red-600">{task.priority}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-medium capitalize">{task.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Assigned To</p>
              <p className="font-medium">{task.assignedTo || 'Unassigned'}</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-3">Checklist</h3>
            <div className="space-y-2">
              {task.checklist?.map((item: any, index: number) => (
                <label key={index} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                    readOnly
                  />
                  <span className={item.completed ? 'line-through text-gray-400' : 'text-gray-700'}>
                    {item.item}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {task.notes && (
            <div>
              <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-2">Notes</h3>
              <p className="text-gray-700 bg-yellow-50 rounded-ios-lg p-3">{task.notes}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-ios-lg">
              Close
            </button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-ios-lg">
              Edit Task
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
