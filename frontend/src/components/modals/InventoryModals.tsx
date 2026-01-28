'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Plus,
  Minus,
  Package,
  Send,
  Save,
  Truck,
  ClipboardCheck,
  AlertTriangle,
  History,
  ArrowRight,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  StockItem,
  StockTransfer,
  StockRequest,
  StockTransferItem,
  StockRequestItem
} from '@/types/inventory.types';

import { inventoryAPI } from '@/lib/api';

interface NewItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  items: StockItem[];
  fromBranchId: string;
  toBranchId: string;
}

interface TransferItemInput {
  itemId: string;
  requestedQuantity: number;
}

interface RequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  items: StockItem[];
  branchId: string;
}

interface RequestItemInput {
  itemId: string;
  requestedQuantity: number;
}

export function NewItemModal({ isOpen, onClose, onSuccess }: NewItemModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<{
    code: string;
    name: string;
    description: string;
    category: string;
    subCategory: string;
    unit: string;
    minStock: number;
    maxStock: number;
    reorderPoint: number;
    unitCost: number;
    supplier: string;
    branch: string;
    isBarItem: boolean;
    isSaunaItem: boolean;
    isRoomItem: boolean;
    parStock?: number;
    isReusable?: boolean;
    replacementCycle?: number;
    isMinibarItem?: boolean;
    isAmenity?: boolean;
  }>({
    code: '',
    name: '',
    description: '',
    category: '',
    subCategory: '',
    unit: '',
    minStock: 0,
    maxStock: 0,
    reorderPoint: 0,
    unitCost: 0,
    supplier: '',
    branch: 'Bomet',
    isBarItem: false,
    isSaunaItem: false,
    isRoomItem: false,
    parStock: 0,
    isReusable: false,
    replacementCycle: 0,
    isMinibarItem: false,
    isAmenity: false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    try {
      // Map frontend fields to database schema names
      const payload = {
        item_code: formData.code,
        name: formData.name,
        description: formData.description,
        category: formData.category.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_'), // Map to enum if needed
        unit: formData.unit,
        min_stock_level: formData.minStock,
        max_stock_level: formData.maxStock,
        unit_cost: formData.unitCost,
        supplier: formData.supplier,
        branch_id: formData.branch === 'Bomet' ? 1 : (formData.branch === 'Kericho' ? 2 : (formData.branch === 'Kapsoit' ? 3 : 4)), // Temporary hardcoded mapping
        is_active: true
      };
      await inventoryAPI.createItem(payload);
      toast.success('Item created successfully');
      onSuccess?.();
      onClose();
      setStep(1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create item');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const totalSteps = 4;
  const categories = ['Food & Beverage', 'Housekeeping', 'Sauna & Wellness', 'Administration', 'Maintenance'];
  const branches = ['Bomet', 'Kericho', 'Kapsoit', 'Litein'];

  const getSubCategories = () => {
    switch (formData.category) {
      case 'Food & Beverage':
        return ['Bar Stock-Alcoholic', 'Bar Stock-Non-alcoholic', 'Kitchen Supplies', 'Restaurant Items'];
      case 'Housekeeping':
        return ['Linens & Bedding', 'Cleaning Supplies', 'Guest Amenities'];
      case 'Sauna & Wellness':
        return ['Towels & Robes', 'Spa Products', 'Maintenance Supplies'];
      case 'Administration':
        return ['Stationery', 'Office Supplies', 'Printing Materials'];
      case 'Maintenance':
        return ['Electrical', 'Plumbing', 'General Repair'];
      default:
        return [];
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Add New Inventory Item</h2>
              <div className="flex items-center gap-1.5 mt-2">
                {[1, 2, 3, 4].map((s) => (
                  <div
                    key={s}
                    className={`h-1 rounded-full transition-all duration-300 ${s <= step ? 'w-8 bg-indigo-600' : 'w-4 bg-gray-100'}`}
                  />
                ))}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto min-h-[400px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-2">
                  <Package className="h-5 w-5" />
                  <span>Basic Identification</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Item Code / SKU</label>
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="e.g. F&B-BEV-001"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-mono"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Item Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Tusker Cider 500ml"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Detailed Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      placeholder="Enter item specifications, storage requirements, etc."
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-2">
                  <ClipboardCheck className="h-5 w-5" />
                  <span>Classification & Assignment</span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Primary Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value, subCategory: '' })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Sub Category</label>
                    <select
                      value={formData.subCategory}
                      onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      required
                      disabled={!formData.category}
                    >
                      <option value="">Select Sub Category</option>
                      {getSubCategories().map(sc => <option key={sc} value={sc}>{sc}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 ml-1">Branch</label>
                      <select
                        value={formData.branch}
                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        required
                      >
                        {branches.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 ml-1">Unit (e.g. Kg, Pkt)</label>
                      <input
                        type="text"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                        placeholder="e.g. Bottles"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-2">
                  <Truck className="h-5 w-5" />
                  <span>Stock levels & Procurement</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Min Level</label>
                    <input
                      type="number"
                      value={formData.minStock}
                      onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium"
                      min="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Max Level</label>
                    <input
                      type="number"
                      value={formData.maxStock}
                      onChange={(e) => setFormData({ ...formData, maxStock: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium"
                      min="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Reorder Pt</label>
                    <input
                      type="number"
                      value={formData.reorderPoint}
                      onChange={(e) => setFormData({ ...formData, reorderPoint: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-medium text-amber-600"
                      min="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Unit Cost (KES)</label>
                    <input
                      type="number"
                      value={formData.unitCost}
                      onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none font-bold text-green-700"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500 ml-1">Preferred Supplier</label>
                    <input
                      type="text"
                      value={formData.supplier}
                      onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                      placeholder="Supplier Name"
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-2">
                  <Plus className="h-5 w-5" />
                  <span>Category-Specific Configuration</span>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 space-y-4">
                  {/* F&B / Bar Specific */}
                  {formData.subCategory.includes('Bar Stock') && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-500 ml-1">Par Stock Level (Absolute Min)</label>
                      <input
                        type="number"
                        value={formData.parStock}
                        onChange={(e) => setFormData({ ...formData, parStock: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                        min="0"
                      />
                    </div>
                  )}

                  {/* Sauna Specific */}
                  {formData.category === 'Sauna & Wellness' && (
                    <div className="grid grid-cols-2 gap-4 text-sm font-medium">
                      <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.isReusable}
                          onChange={(e) => setFormData({ ...formData, isReusable: e.target.checked })}
                          className="h-5 w-5 rounded-lg text-indigo-600"
                        />
                        Reusable Item
                      </label>
                      {formData.isReusable && (
                        <div className="space-y-1">
                          <label className="text-[10px] text-gray-500 uppercase tracking-wider">Replace Cycle (Days)</label>
                          <input
                            type="number"
                            value={formData.replacementCycle}
                            onChange={(e) => setFormData({ ...formData, replacementCycle: parseInt(e.target.value) })}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-right"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Housekeeping Specific */}
                  {formData.category === 'Housekeeping' && (
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-2 cursor-pointer p-4 bg-white border border-gray-100 rounded-xl shadow-sm text-sm font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={formData.isMinibarItem}
                          onChange={(e) => setFormData({ ...formData, isMinibarItem: e.target.checked })}
                          className="h-5 w-5 rounded-lg text-indigo-600"
                        />
                        Minibar Stock
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer p-4 bg-white border border-gray-100 rounded-xl shadow-sm text-sm font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={formData.isAmenity}
                          onChange={(e) => setFormData({ ...formData, isAmenity: e.target.checked })}
                          className="h-5 w-5 rounded-lg text-indigo-600"
                        />
                        Room Amenity
                      </label>
                    </div>
                  )}

                  {!formData.subCategory.includes('Bar Stock') &&
                    formData.category !== 'Sauna & Wellness' &&
                    formData.category !== 'Housekeeping' && (
                      <div className="py-8 text-center text-gray-500">
                        <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No additional configuration required for this category</p>
                      </div>
                    )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 shrink-0 border-t border-gray-100">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 font-semibold transition-all shadow-sm"
              >
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex-1 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 px-6 py-2.5 bg-[#34C759] text-white rounded-xl hover:bg-[#2EB150] font-semibold shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Processing...' : 'Create Item'}
                {!isSubmitting && <Save className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function TransferModal({ isOpen, onClose, onSuccess, items, fromBranchId, toBranchId }: TransferModalProps) {
  const [selectedItems, setSelectedItems] = useState<TransferItemInput[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryAPI.createTransfer({
        fromBranchId,
        toBranchId,
        items: selectedItems,
      });
      toast.success('Transfer created successfully');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create transfer');
    }
  };

  const addItem = (itemId: string) => {
    setSelectedItems([
      ...selectedItems,
      {
        itemId,
        requestedQuantity: 0
      }
    ]);
  };

  const removeItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(item => item.itemId !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setSelectedItems(
      selectedItems.map(item =>
        item.itemId === itemId ? { ...item, requestedQuantity: quantity } : item
      )
    );
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Create Stock Transfer</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Items
            </label>
            <select
              onChange={(e) => addItem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              value=""
            >
              <option value="">Add Item</option>
              {items
                .filter(item => !selectedItems.find(si => si.itemId === item.id))
                .map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            {selectedItems.map(selectedItem => {
              const item = items.find(i => i.id === selectedItem.itemId);
              return (
                <div key={selectedItem.itemId} className="flex items-center gap-4 p-3 border rounded-ios-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item?.name}</p>
                    <p className="text-sm text-gray-500">{item?.unit}</p>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      value={selectedItem.requestedQuantity}
                      onChange={(e) =>
                        updateQuantity(selectedItem.itemId, parseInt(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      min="1"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(selectedItem.itemId)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-ios-lg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-ios-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700"
              disabled={selectedItems.length === 0}
            >
              Create Transfer
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

export function RequestModal({ isOpen, onClose, onSuccess, items, branchId }: RequestModalProps) {
  const [selectedItems, setSelectedItems] = useState<RequestItemInput[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryAPI.createRequest({
        branchId,
        items: selectedItems,
      });
      toast.success('Request created successfully');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create request');
    }
  };

  const addItem = (itemId: string) => {
    setSelectedItems([
      ...selectedItems,
      {
        itemId,
        requestedQuantity: 0
      }
    ]);
  };

  const removeItem = (itemId: string) => {
    setSelectedItems(selectedItems.filter(item => item.itemId !== itemId));
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setSelectedItems(
      selectedItems.map(item =>
        item.itemId === itemId ? { ...item, requestedQuantity: quantity } : item
      )
    );
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Create Stock Request</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Items
            </label>
            <select
              onChange={(e) => addItem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              value=""
            >
              <option value="">Add Item</option>
              {items
                .filter(item => !selectedItems.find(si => si.itemId === item.id))
                .map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-2">
            {selectedItems.map(selectedItem => {
              const item = items.find(i => i.id === selectedItem.itemId);
              return (
                <div key={selectedItem.itemId} className="flex items-center gap-4 p-3 border rounded-ios-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item?.name}</p>
                    <p className="text-sm text-gray-500">{item?.unit}</p>
                  </div>
                  <div className="w-32">
                    <input
                      type="number"
                      value={selectedItem.requestedQuantity}
                      onChange={(e) =>
                        updateQuantity(selectedItem.itemId, parseInt(e.target.value))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      min="1"
                      required
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(selectedItem.itemId)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-ios-lg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-ios-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700"
              disabled={selectedItems.length === 0}
            >
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
