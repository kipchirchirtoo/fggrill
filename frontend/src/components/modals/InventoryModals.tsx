'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Plus,
  Minus,
  Package,
  Send,
  Save,
  Truck,
  ClipboardCheck
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create item');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Add New Item</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Item Code
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch
              </label>
              <select
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
              >
                <option value="Bomet">Bomet</option>
                <option value="Kericho">Kericho</option>
                <option value="Kapsoit">Kapsoit</option>
                <option value="Litein">Litein</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
              >
                <option value="">Select Category</option>
                <option value="Food & Beverage">Food & Beverage</option>
                <option value="Housekeeping">Housekeeping</option>
                <option value="Sauna & Wellness">Sauna & Wellness</option>
                <option value="Administration">Administration</option>
                <option value="Maintenance">Maintenance</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sub Category
            </label>
            <select
              value={formData.subCategory}
              onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              required
            >
              <option value="">Select Sub Category</option>
              {formData.category === 'Food & Beverage' && (
                <>
                  <option value="Bar Stock-Alcoholic">Bar Stock - Alcoholic</option>
                  <option value="Bar Stock-Non-alcoholic">Bar Stock - Non-alcoholic</option>
                  <option value="Kitchen Supplies">Kitchen Supplies</option>
                  <option value="Restaurant Items">Restaurant Items</option>
                </>
              )}
              {formData.category === 'Housekeeping' && (
                <>
                  <option value="Linens & Bedding">Linens & Bedding</option>
                  <option value="Cleaning Supplies">Cleaning Supplies</option>
                  <option value="Guest Amenities">Guest Amenities</option>
                </>
              )}
              {formData.category === 'Sauna & Wellness' && (
                <>
                  <option value="Towels & Robes">Towels & Robes</option>
                  <option value="Spa Products">Spa Products</option>
                  <option value="Maintenance Supplies">Maintenance Supplies</option>
                </>
              )}
              {formData.category === 'Administration' && (
                <>
                  <option value="Stationery">Stationery</option>
                  <option value="Office Supplies">Office Supplies</option>
                  <option value="Printing Materials">Printing Materials</option>
                </>
              )}
              {formData.category === 'Maintenance' && (
                <>
                  <option value="Electrical">Electrical</option>
                  <option value="Plumbing">Plumbing</option>
                  <option value="General Repair">General Repair</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit
            </label>
            <input
              type="text"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              required
              placeholder="e.g., kg, liters, pieces"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min Stock
              </label>
              <input
                type="number"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Stock
              </label>
              <input
                type="number"
                value={formData.maxStock}
                onChange={(e) => setFormData({ ...formData, maxStock: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reorder Point
              </label>
              <input
                type="number"
                value={formData.reorderPoint}
                onChange={(e) => setFormData({ ...formData, reorderPoint: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Cost
              </label>
              <input
                type="number"
                value={formData.unitCost}
                onChange={(e) => setFormData({ ...formData, unitCost: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                required
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier
              </label>
              <input
                type="text"
                value={formData.supplier}
                onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
              />
            </div>
          </div>

          {/* Conditional Fields Based on Category */}
          {formData.subCategory.includes('Bar Stock') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Par Stock Level
                </label>
                <input
                  type="number"
                  value={formData.parStock}
                  onChange={(e) => setFormData({ ...formData, parStock: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  min="0"
                />
              </div>
            </div>
          )}

          {formData.category === 'Sauna & Wellness' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reusable Item
                </label>
                <select
                  value={formData.isReusable ? 'yes' : 'no'}
                  onChange={(e) => setFormData({ ...formData, isReusable: e.target.value === 'yes' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              {formData.isReusable && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Replacement Cycle (days)
                  </label>
                  <input
                    type="number"
                    value={formData.replacementCycle}
                    onChange={(e) => setFormData({ ...formData, replacementCycle: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                    min="0"
                  />
                </div>
              )}
            </div>
          )}

          {formData.category === 'Housekeeping' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minibar Item
                </label>
                <select
                  value={formData.isMinibarItem ? 'yes' : 'no'}
                  onChange={(e) => setFormData({ ...formData, isMinibarItem: e.target.value === 'yes' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Room Amenity
                </label>
                <select
                  value={formData.isAmenity ? 'yes' : 'no'}
                  onChange={(e) => setFormData({ ...formData, isAmenity: e.target.value === 'yes' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
          )}

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
            >
              Create Item
            </button>
          </div>
        </form>
      </div>
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-6">
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
