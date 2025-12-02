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
import { toast } from 'sonner';
import { housekeepingAPI } from '@/lib/api';

// ============= REPORT ISSUE MODAL =============
export function ReportIssueModal({ isOpen, onClose, roomNumber = '' }: any) {
  const [issueData, setIssueData] = useState({
    roomNumber: roomNumber,
    category: 'maintenance',
    priority: 'normal',
    description: '',
    photos: [],
    reportedBy: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.warning('Issue reported for Room ' + issueData.roomNumber);
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
        className="bg-white rounded-xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Report Issue</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Room Number *</label>
            <input
              type="text"
              required
              value={issueData.roomNumber}
              onChange={(e) => setIssueData({ ...issueData, roomNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., 301"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={issueData.category}
              onChange={(e) => setIssueData({ ...issueData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="maintenance">Maintenance</option>
              <option value="electrical">Electrical</option>
              <option value="plumbing">Plumbing</option>
              <option value="hvac">HVAC</option>
              <option value="cleaning">Deep Cleaning</option>
              <option value="damage">Damage</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
            <select
              value={issueData.priority}
              onChange={(e) => setIssueData({ ...issueData, priority: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea
              required
              value={issueData.description}
              onChange={(e) => setIssueData({ ...issueData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500"
              rows={4}
              placeholder="Describe the issue in detail..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attach Photos</label>
            <div className="border-2 border-dashed border-gray-300 rounded-ios-lg p-4 text-center">
              <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Click to upload photos</p>
              <input type="file" multiple accept="image/*" className="hidden" />
            </div>
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
              className="px-6 py-2 bg-red-600 text-white rounded-ios-lg hover:bg-red-700 flex items-center gap-2"
            >
              <AlertTriangle className="h-4 w-4" />
              Report Issue
            </button>
          </div>
        </form>
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
        className="bg-white rounded-xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
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

  // Fetch rooms ready for inspection
  useEffect(() => {
    const fetchRooms = async () => {
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

    if (isOpen) {
      fetchRooms();
    }
  }, [isOpen]);

  const handleInspectionSubmit = () => {
    toast.success('Room ' + selectedRoom?.roomNumber + ' inspection completed');
    setSelectedRoom(null);
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
        className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Inspection Mode</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!selectedRoom ? (
          <div>
            <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-4">Select Room for Inspection</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roomsForInspection.map((room: RoomStatus) => (
                <div
                  key={room.roomId}
                  className="border rounded-ios-lg p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedRoom(room)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Room {room.roomNumber}</p>
                      <p className="text-sm text-gray-500">
                        Last cleaned: {room.lastCleaned ? new Date(room.lastCleaned).toLocaleTimeString() : 'Never'}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-ios-lg p-4">
              <p className="font-medium text-gray-900">Inspecting Room {selectedRoom.roomNumber}</p>
              <p className="text-sm text-gray-500">Please rate each category</p>
            </div>

            {['Cleanliness', 'Amenities', 'Maintenance', 'Overall'].map((category) => (
              <div key={category}>
                <label className="block text-sm font-medium text-gray-700 mb-2">{category}</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setInspectionData({
                        ...inspectionData,
                        [category.toLowerCase()]: rating
                      })}
                      className={'px-4 py-2 rounded-ios-lg border-2 ' + (inspectionData[category.toLowerCase() as keyof typeof inspectionData] === rating ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-gray-300')}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={inspectionData.notes}
                onChange={(e) => setInspectionData({ ...inspectionData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:ring-2 focus:ring-indigo-500"
                rows={4}
                placeholder="Any observations or issues..."
              />
            </div>

            <div className="flex justify-between pt-4 border-t">
              <button
                onClick={() => setSelectedRoom(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                Back
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    toast.error('Room failed inspection');
                    setSelectedRoom(null);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-ios-lg hover:bg-red-700"
                >
                  Fail Inspection
                </button>
                <button
                  onClick={handleInspectionSubmit}
                  className="px-6 py-2 bg-green-600 text-white rounded-ios-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4" />
                  Pass Inspection
                </button>
              </div>
            </div>
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
        className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
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
