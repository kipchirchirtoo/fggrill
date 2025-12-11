'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Percent, DollarSign, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { ratePlansAPI } from '@/lib/api';

interface RatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: any;
}

export function RatePlanModal({ isOpen, onClose, onSuccess, initialData }: RatePlanModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    rateType: 'STANDARD',
    multiplier: 1.0,
    isPercentage: true,
    fixedAmount: 0,
    minNights: 1,
    maxNights: 30,
    cancellationHours: 24,
    refundable: true,
    active: true
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        code: initialData.code || '',
        description: initialData.description || '',
        rateType: initialData.rateType || 'STANDARD',
        multiplier: initialData.multiplier ?? 1.0,
        isPercentage: initialData.isPercentage ?? true,
        fixedAmount: initialData.fixedAmount ?? 0,
        minNights: initialData.minNights ?? 1,
        maxNights: initialData.maxNights ?? 30,
        cancellationHours: initialData.cancellationHours ?? 24,
        refundable: initialData.refundable ?? true,
        active: initialData.active ?? true
      });
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        rateType: 'STANDARD',
        multiplier: 1.0,
        isPercentage: true,
        fixedAmount: 0,
        minNights: 1,
        maxNights: 30,
        cancellationHours: 24,
        refundable: true,
        active: true
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (initialData?.id) {
        await ratePlansAPI.updateRatePlan(initialData.id, formData);
        toast.success('Rate plan updated successfully');
      } else {
        await ratePlansAPI.createRatePlan(formData);
        toast.success('Rate plan created successfully');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save rate plan');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {initialData ? 'Edit Rate Plan' : 'New Rate Plan'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g. Summer Special"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g. SUM24"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
            />
          </div>

          {/* Pricing Rules */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Pricing Rules
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.rateType}
                  onChange={(e) => setFormData({ ...formData, rateType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="WEEKEND">Weekend</option>
                  <option value="CORPORATE">Corporate</option>
                  <option value="GOVERNMENT">Government</option>
                  <option value="AAA">AAA</option>
                  <option value="SENIOR">Senior</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.isPercentage ? 'Multiplier' : 'Fixed Amount'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.isPercentage ? formData.multiplier : formData.fixedAmount}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (formData.isPercentage) {
                        setFormData({ ...formData, multiplier: val });
                      } else {
                        setFormData({ ...formData, fixedAmount: val });
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="pt-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.isPercentage}
                      onChange={(e) => setFormData({ ...formData, isPercentage: e.target.checked })}
                      className="rounded text-indigo-600"
                    />
                    Use Multiplier?
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Restrictions */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Restrictions
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Nights</label>
                <input
                  type="number"
                  min="1"
                  value={formData.minNights}
                  onChange={(e) => setFormData({ ...formData, minNights: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Nights</label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxNights}
                  onChange={(e) => setFormData({ ...formData, maxNights: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation (Hours)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.cancellationHours}
                  onChange={(e) => setFormData({ ...formData, cancellationHours: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="pt-6">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.refundable}
                    onChange={(e) => setFormData({ ...formData, refundable: e.target.checked })}
                    className="rounded text-indigo-600"
                  />
                  Refundable?
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              Save Rate Plan
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
