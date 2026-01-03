'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Bed, User, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { IOSInput } from '@/components/ui/ios-input';
import { IOSButton } from '@/components/ui/ios-button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskFormData) => Promise<void>;
  rooms?: { room_number: string; room_id: string }[];
  staff?: { id: string; name: string }[];
}

export interface TaskFormData {
  room_number: string;
  room_id?: string;
  task_type: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assigned_to?: string;
  notes?: string;
}

const taskTypes = [
  { value: 'checkout_clean', label: 'Checkout Clean', icon: '🧹' },
  { value: 'stayover_clean', label: 'Stayover Clean', icon: '🛏️' },
  { value: 'deep_clean', label: 'Deep Clean', icon: '✨' },
  { value: 'turndown', label: 'Turndown Service', icon: '🌙' },
  { value: 'inspection', label: 'Inspection', icon: '🔍' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
];

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'bg-stone-400' },
  { value: 'normal', label: 'Normal', color: 'bg-sky-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
];

export function NewTaskModal({ isOpen, onClose, onSubmit, rooms = [], staff = [] }: NewTaskModalProps) {
  const [formData, setFormData] = useState<TaskFormData>({
    room_number: '',
    task_type: 'checkout_clean',
    priority: 'normal',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFormData, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        room_number: '',
        task_type: 'checkout_clean',
        priority: 'normal',
      });
      setErrors({});
    }
  }, [isOpen]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof TaskFormData, string>> = {};
    
    if (!formData.room_number.trim()) {
      newErrors.room_number = 'Room number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // Find room_id if rooms are provided
      const room = rooms.find(r => r.room_number === formData.room_number);
      await onSubmit({
        ...formData,
        room_id: room?.room_id,
      });
      toast.success('Task created successfully');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof TaskFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={!isSubmitting ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-stone-900">New Task</h2>
                  <p className="text-sm text-stone-500">Create a housekeeping task</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="p-2 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50"
              >
                <X className="h-5 w-5 text-stone-500" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-180px)]">
              {/* Room Number */}
              {rooms.length > 0 ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-stone-900">Room</label>
                  <select
                    value={formData.room_number}
                    onChange={(e) => handleChange('room_number', e.target.value)}
                    disabled={isSubmitting}
                    className={cn(
                      'w-full h-11 px-4 rounded-xl border bg-white text-sm focus:ring-1 transition-colors',
                      errors.room_number
                        ? 'border-red-300 focus:border-red-400 focus:ring-red-400'
                        : 'border-stone-200 focus:border-stone-400 focus:ring-stone-400'
                    )}
                  >
                    <option value="">Select a room</option>
                    {rooms.map((room) => (
                      <option key={room.room_id} value={room.room_number}>
                        Room {room.room_number}
                      </option>
                    ))}
                  </select>
                  {errors.room_number && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {errors.room_number}
                    </p>
                  )}
                </div>
              ) : (
                <IOSInput
                  label="Room Number"
                  placeholder="Enter room number"
                  value={formData.room_number}
                  onChange={(e) => handleChange('room_number', e.target.value)}
                  error={errors.room_number}
                  icon={<Bed className="h-4 w-4" />}
                  disabled={isSubmitting}
                />
              )}

              {/* Task Type */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-stone-900">Task Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {taskTypes.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleChange('task_type', type.value)}
                      disabled={isSubmitting}
                      className={cn(
                        'py-3 px-3 rounded-xl text-sm font-medium transition-all border-2 text-left',
                        formData.task_type === type.value
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                      )}
                    >
                      <span className="mr-2">{type.icon}</span>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-stone-900">Priority</label>
                <div className="grid grid-cols-4 gap-2">
                  {priorityOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleChange('priority', option.value)}
                      disabled={isSubmitting}
                      className={cn(
                        'py-2.5 px-2 rounded-xl text-xs font-medium transition-all border-2',
                        formData.priority === option.value
                          ? 'border-stone-900 bg-stone-900 text-white'
                          : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
                      )}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <div className={cn('w-2 h-2 rounded-full', option.color)} />
                        <span>{option.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Assign To (Optional) */}
              {staff.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-stone-900">Assign To (Optional)</label>
                  <select
                    value={formData.assigned_to || ''}
                    onChange={(e) => handleChange('assigned_to', e.target.value)}
                    disabled={isSubmitting}
                    className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-white text-sm focus:border-stone-400 focus:ring-1 focus:ring-stone-400 transition-colors"
                  >
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes (Optional) */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-stone-900">Notes (Optional)</label>
                <textarea
                  placeholder="Any special instructions..."
                  value={formData.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-sm resize-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400 transition-colors"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50">
              <IOSButton
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1"
              >
                Cancel
              </IOSButton>
              <IOSButton
                type="submit"
                variant="success"
                onClick={handleSubmit}
                loading={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? 'Creating...' : 'Create Task'}
              </IOSButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default NewTaskModal;
