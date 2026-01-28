'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wrench, MapPin, AlertTriangle, FileText, User, Calendar, Loader2, CheckCircle } from 'lucide-react';
import { IOSInput } from '@/components/ui/ios-input';
import { IOSButton } from '@/components/ui/ios-button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NewWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: WorkOrderFormData) => Promise<void>;
  branchId?: number;
}

export interface WorkOrderFormData {
  title: string;
  description: string;
  location: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  category: string;
  assigned_to?: string;
  due_date?: string;
  branch_id?: number;
}

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'bg-stone-400' },
  { value: 'normal', label: 'Normal', color: 'bg-sky-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
];

const categoryOptions = [
  'Plumbing',
  'Electrical',
  'HVAC',
  'Carpentry',
  'Painting',
  'Appliances',
  'Furniture',
  'General',
  'Safety',
  'Other',
];

export function NewWorkOrderModal({ isOpen, onClose, onSubmit, branchId }: NewWorkOrderModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<WorkOrderFormData>({
    title: '',
    description: '',
    location: '',
    priority: 'normal',
    category: 'General',
    branch_id: branchId,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof WorkOrderFormData, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        description: '',
        location: '',
        priority: 'normal',
        category: 'General',
        branch_id: branchId,
      });
      setErrors({});
      setStep(1);
    }
  }, [isOpen, branchId]);

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Partial<Record<keyof WorkOrderFormData, string>> = {};

    if (currentStep === 1) {
      if (!formData.title.trim()) newErrors.title = 'Title is required';
      if (!formData.description.trim()) newErrors.description = 'Description is required';
    } else if (currentStep === 2) {
      if (!formData.location.trim()) newErrors.location = 'Location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!validateStep(step)) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      toast.success('Work order created successfully');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof WorkOrderFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={!isSubmitting ? onClose : undefined}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <Wrench className="h-6 w-6 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-stone-900">New Maintenance Request</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {[1, 2].map(s => (
                      <div
                        key={s}
                        className={`h-1.5 rounded-full transition-all duration-300 ${s <= step ? 'w-10 bg-amber-500' : 'w-4 bg-stone-100'}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="p-2.5 rounded-full hover:bg-stone-50 transition-colors"
              >
                <X className="h-5 w-5 text-stone-400" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 min-h-[350px]">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-2 text-amber-600 font-bold uppercase tracking-widest text-[10px] mb-2">
                      <FileText className="h-3 w-3" />
                      Step 1: Issue Identification
                    </div>

                    <IOSInput
                      label="Title"
                      placeholder="e.g., Leaking sink in Room 204"
                      value={formData.title}
                      onChange={(e) => handleChange('title', e.target.value)}
                      error={errors.title}
                      icon={<FileText className="h-4 w-4" />}
                      disabled={isSubmitting}
                    />

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-stone-900 ml-1">Category</label>
                      <div className="grid grid-cols-2 gap-2">
                        {categoryOptions.slice(0, 6).map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => handleChange('category', cat)}
                            className={cn(
                              "px-4 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
                              formData.category === cat
                                ? "bg-amber-100 text-amber-900 border-2 border-amber-300 shadow-sm"
                                : "bg-stone-50 text-stone-600 border-2 border-transparent hover:bg-stone-100"
                            )}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-stone-900 ml-1">Issue Description</label>
                      <textarea
                        placeholder="Please provide details about the problem..."
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        disabled={isSubmitting}
                        rows={4}
                        className={cn(
                          'w-full px-4 py-3 rounded-2xl border-2 bg-stone-50 text-sm resize-none focus:ring-4 transition-all',
                          errors.description
                            ? 'border-red-200 focus:border-red-400 focus:ring-red-100'
                            : 'border-transparent focus:border-amber-400 focus:ring-amber-50'
                        )}
                      />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center gap-2 text-amber-600 font-bold uppercase tracking-widest text-[10px] mb-2">
                      <MapPin className="h-3 w-3" />
                      Step 2: Context & Urgency
                    </div>

                    <IOSInput
                      label="Precise Location"
                      placeholder="e.g. Room 302, Staff Canteen, etc."
                      value={formData.location}
                      onChange={(e) => handleChange('location', e.target.value)}
                      error={errors.location}
                      icon={<MapPin className="h-4 w-4" />}
                      disabled={isSubmitting}
                    />

                    <div className="space-y-3">
                      <label className="block text-sm font-semibold text-stone-900 ml-1">Priority Level</label>
                      <div className="grid grid-cols-2 gap-3">
                        {priorityOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleChange('priority', option.value as any)}
                            disabled={isSubmitting}
                            className={cn(
                              'p-4 rounded-2xl text-sm font-bold transition-all border-2 text-left flex flex-col gap-2',
                              formData.priority === option.value
                                ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-md scale-[1.02]'
                                : 'border-stone-100 bg-white text-stone-400 hover:border-stone-200'
                            )}
                          >
                            <div className={cn('w-4 h-4 rounded-full shadow-inner', option.color)} />
                            <span className="capitalize">{option.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <IOSInput
                      label="Expected Completion (Optional)"
                      type="date"
                      value={formData.due_date || ''}
                      onChange={(e) => handleChange('due_date', e.target.value)}
                      icon={<Calendar className="h-4 w-4" />}
                      disabled={isSubmitting}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-stone-50 shrink-0 border-t border-stone-100">
              <div className="flex gap-3">
                {step > 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(step - 1)}
                    disabled={isSubmitting}
                    className="px-6 py-3 bg-white border border-stone-200 text-stone-600 rounded-2xl hover:bg-stone-100 font-bold transition-all shadow-sm"
                  >
                    Back
                  </button>
                )}
                {step < 2 ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-2xl hover:bg-amber-700 font-bold shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    Continue to Context
                  </button>
                ) : (
                  <IOSButton
                    type="submit"
                    variant="primary"
                    onClick={handleSubmit}
                    loading={isSubmitting}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 h-14 rounded-2xl text-lg"
                  >
                    {isSubmitting ? 'Submitting...' : 'Send Request'}
                  </IOSButton>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// View Work Order Modal
interface ViewWorkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: {
    id: string;
    title: string;
    description?: string;
    location: string;
    priority: string;
    status: string;
    category?: string;
    created_at: string;
    assigned_to?: string;
    completed_at?: string;
  } | null;
  onUpdateStatus?: (id: string, status: string) => Promise<void>;
}

export function ViewWorkOrderModal({ isOpen, onClose, workOrder, onUpdateStatus }: ViewWorkOrderModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  if (!workOrder) return null;

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    normal: 'bg-sky-100 text-sky-700',
    low: 'bg-stone-100 text-stone-700',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-sky-100 text-sky-700',
    completed: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-stone-100 text-stone-700',
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!onUpdateStatus) return;
    setIsUpdating(true);
    try {
      await onUpdateStatus(workOrder.id, newStatus);
      toast.success('Status updated');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-stone-100">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <h2 className="text-lg font-semibold text-stone-900">{workOrder.title}</h2>
                  <p className="text-sm text-stone-500 mt-0.5">{workOrder.location}</p>
                </div>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-stone-100 transition-colors">
                  <X className="h-5 w-5 text-stone-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Badges */}
              <div className="flex gap-2">
                <span className={cn('px-3 py-1 rounded-full text-xs font-medium capitalize', priorityColors[workOrder.priority] || priorityColors.normal)}>
                  {workOrder.priority}
                </span>
                <span className={cn('px-3 py-1 rounded-full text-xs font-medium capitalize', statusColors[workOrder.status] || statusColors.pending)}>
                  {workOrder.status.replace('_', ' ')}
                </span>
                {workOrder.category && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
                    {workOrder.category}
                  </span>
                )}
              </div>

              {/* Description */}
              {workOrder.description && (
                <div>
                  <h4 className="text-sm font-medium text-stone-700 mb-1">Description</h4>
                  <p className="text-sm text-stone-600">{workOrder.description}</p>
                </div>
              )}

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-xs text-stone-500">Created</p>
                  <p className="text-sm font-medium text-stone-900">
                    {new Date(workOrder.created_at).toLocaleDateString()}
                  </p>
                </div>
                {workOrder.assigned_to && (
                  <div>
                    <p className="text-xs text-stone-500">Assigned To</p>
                    <p className="text-sm font-medium text-stone-900">{workOrder.assigned_to}</p>
                  </div>
                )}
                {workOrder.completed_at && (
                  <div>
                    <p className="text-xs text-stone-500">Completed</p>
                    <p className="text-sm font-medium text-stone-900">
                      {new Date(workOrder.completed_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            {onUpdateStatus && workOrder.status !== 'completed' && (
              <div className="flex gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50">
                {workOrder.status === 'pending' && (
                  <IOSButton
                    variant="primary"
                    onClick={() => handleStatusUpdate('in_progress')}
                    loading={isUpdating}
                    className="flex-1"
                  >
                    Start Work
                  </IOSButton>
                )}
                {workOrder.status === 'in_progress' && (
                  <IOSButton
                    variant="success"
                    onClick={() => handleStatusUpdate('completed')}
                    loading={isUpdating}
                    className="flex-1"
                    leftIcon={<CheckCircle className="h-4 w-4" />}
                  >
                    Mark Complete
                  </IOSButton>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default NewWorkOrderModal;
