'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { restaurantAPI } from '@/lib/api';
import {
  Trash2, Plus, RefreshCw, AlertTriangle, Package, Search,
  Flame, RotateCcw, Ban, Timer, HelpCircle, TrendingDown, Check,
  Edit2, MoreVertical, X
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface WastageItem {
  id: string;
  name: string;
  type: 'menu_item' | 'inventory_item';
  category: string;
  unit: string;
  cost: number;
}

interface WastageRecord {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  reason: string;
  cost_impact: number;
  description?: string;
  logged_by_name?: string;
  logged_at: string;
}

type WasteReason = 'spoilage' | 'expiry' | 'damage' | 'overcooking' | 'customer_return' | 'quality_control' | 'other';

const wasteReasonConfig: Record<WasteReason, { label: string; color: string; icon: any; bgColor: string }> = {
  spoilage: { label: 'Spoilage', color: 'text-red-700', icon: AlertTriangle, bgColor: 'bg-red-100' },
  expiry: { label: 'Expired', color: 'text-purple-700', icon: Timer, bgColor: 'bg-purple-100' },
  damage: { label: 'Damaged', color: 'text-orange-700', icon: Ban, bgColor: 'bg-orange-100' },
  overcooking: { label: 'Overcooked', color: 'text-amber-700', icon: Flame, bgColor: 'bg-amber-100' },
  customer_return: { label: 'Customer Return', color: 'text-blue-700', icon: RotateCcw, bgColor: 'bg-blue-100' },
  quality_control: { label: 'Quality Control', color: 'text-yellow-700', icon: Search, bgColor: 'bg-yellow-100' },
  other: { label: 'Other', color: 'text-gray-700', icon: HelpCircle, bgColor: 'bg-gray-100' },
};

interface WastageTabProps {
  onDataChange?: () => void;
}

export function WastageTab({ onDataChange }: WastageTabProps) {
  const { user } = useAuth();
  const [wastageItems, setWastageItems] = useState<WastageItem[]>([]);
  const [wastageRecords, setWastageRecords] = useState<WastageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal state
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<WastageRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<WastageRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [selectedItem, setSelectedItem] = useState<WastageItem | null>(null);
  const [customItemName, setCustomItemName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState('portion');
  const [reason, setReason] = useState<WasteReason>('spoilage');
  const [costImpact, setCostImpact] = useState(0);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalCost: 0,
    byReason: {} as Record<string, number>,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [itemsRes, recordsRes] = await Promise.all([
        restaurantAPI.getWastageItems(),
        restaurantAPI.getWastageRecords(),
      ]);

      if (itemsRes.success) {
        setWastageItems(itemsRes.data || []);
      }

      if (recordsRes.success) {
        setWastageRecords(recordsRes.data || []);
        setStats({
          totalRecords: recordsRes.summary?.totalRecords || recordsRes.data?.length || 0,
          totalCost: recordsRes.summary?.totalCost || 0,
          byReason: recordsRes.summary?.byReason || {},
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load wastage data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = wastageItems.filter(item =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRecordWastage = async () => {
    const itemName = selectedItem?.name || customItemName;
    if (!itemName) {
      toast.error('Please select or enter an item name');
      return;
    }
    if (quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      await restaurantAPI.createWastageRecord({
        item_name: itemName,
        item_id: selectedItem?.id,
        quantity,
        unit: selectedItem?.unit || unit,
        reason,
        cost_impact: costImpact || (selectedItem?.cost ? selectedItem.cost * quantity : 0),
        description: description || undefined,
      });

      toast.success('Wastage recorded successfully');
      setShowRecordModal(false);
      resetForm();
      fetchData();
      onDataChange?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record wastage');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedItem(null);
    setCustomItemName('');
    setQuantity(1);
    setUnit('portion');
    setReason('spoilage');
    setCostImpact(0);
    setDescription('');
    setSearchQuery('');
    setEditingRecord(null);
  };

  const handleEditRecord = (record: WastageRecord) => {
    setEditingRecord(record);
    setCustomItemName(record.item_name);
    setQuantity(record.quantity);
    setUnit(record.unit);
    setReason(record.reason as WasteReason);
    setCostImpact(record.cost_impact || 0);
    setDescription(record.description || '');
    setShowEditModal(true);
  };

  const handleUpdateWastage = async () => {
    if (!editingRecord) return;

    const itemName = selectedItem?.name || customItemName;
    if (!itemName) {
      toast.error('Please enter an item name');
      return;
    }
    if (quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      await restaurantAPI.updateWastageRecord(editingRecord.id, {
        item_name: itemName,
        quantity,
        unit: selectedItem?.unit || unit,
        reason,
        cost_impact: costImpact,
        description: description || undefined,
      });

      toast.success('Wastage record updated successfully');
      setShowEditModal(false);
      resetForm();
      fetchData();
      onDataChange?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update wastage record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;

    setIsDeleting(true);
    try {
      await restaurantAPI.deleteWastageRecord(deletingRecord.id);
      toast.success('Wastage record deleted successfully');
      setShowDeleteConfirm(false);
      setDeletingRecord(null);
      fetchData();
      onDataChange?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete wastage record');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (record: WastageRecord) => {
    setDeletingRecord(record);
    setShowDeleteConfirm(true);
  };

  const selectItem = (item: WastageItem) => {
    setSelectedItem(item);
    setUnit(item.unit);
    setCostImpact(item.cost * quantity);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading wastage data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards - Minimal Design */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Wastage</p>
          <p className="text-xl font-semibold text-gray-900">{stats.totalRecords}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Total Loss</p>
          <p className="text-xl font-semibold text-gray-900">KES {stats.totalCost.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Spoilage</p>
          <p className="text-xl font-semibold text-gray-900">{typeof stats.byReason['spoilage'] === 'object' ? (stats.byReason['spoilage'] as any)?.count || 0 : stats.byReason['spoilage'] || 0}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">Overcooking</p>
          <p className="text-xl font-semibold text-gray-900">{typeof stats.byReason['overcooking'] === 'object' ? (stats.byReason['overcooking'] as any)?.count || 0 : stats.byReason['overcooking'] || 0}</p>
        </div>
      </div>

      {/* Actions - Minimal Design */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-base font-medium text-gray-900">Wastage Records</h2>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-50"
          >
            Refresh
          </button>
          <button
            onClick={() => setShowRecordModal(true)}
            className="px-3 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
          >
            Record Wastage
          </button>
        </div>
      </div>

      {/* Records List - Minimal Design */}
      {wastageRecords.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-500 mb-1">No wastage recorded yet</p>
          <p className="text-sm text-gray-400 mb-4">Record food waste to track losses</p>
          <button
            onClick={() => setShowRecordModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
          >
            Record First Wastage
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {wastageRecords.map((record) => {
            const reasonConfig = wasteReasonConfig[record.reason as WasteReason] || wasteReasonConfig.other;
            const Icon = reasonConfig.icon;

            return (
              <div key={record.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${reasonConfig.bgColor} flex items-center justify-center`}>
                      <span className={`text-xs font-medium ${reasonConfig.color}`}>
                        {reasonConfig.label.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{record.item_name}</p>
                      <p className="text-sm text-gray-500">
                        {record.quantity} {record.unit} • {reasonConfig.label}
                      </p>
                      {record.description && (
                        <p className="text-xs text-gray-400 mt-1">{record.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-medium text-red-600">-KES {(record.cost_impact || 0).toLocaleString()}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(record.logged_at).toLocaleDateString()} {new Date(record.logged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {record.logged_by_name && (
                        <p className="text-xs text-gray-400">by {record.logged_by_name}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEditRecord(record)}
                        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                        title="Edit record"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => confirmDelete(record)}
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                        title="Delete record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Record Wastage Modal */}
      <Dialog open={showRecordModal} onOpenChange={setShowRecordModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Record Food Wastage
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Search/Select Item */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Item</label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <input
                  type="text"
                  placeholder="Search menu items or type custom..."
                  value={selectedItem ? selectedItem.name : searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedItem(null);
                    setCustomItemName(e.target.value);
                  }}
                  className="w-full h-10 pl-9 pr-4 text-sm bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Item suggestions */}
              {searchQuery && !selectedItem && filteredItems.length > 0 && (
                <div className="max-h-32 overflow-y-auto border rounded-lg mb-2">
                  {filteredItems.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className="p-2 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                      onClick={() => selectItem(item)}
                    >
                      <span className="text-sm">{item.name}</span>
                      <span className="text-xs text-gray-500">{item.category}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedItem && (
                <div className="bg-red-50 border border-red-200 p-2 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{selectedItem.name}</p>
                    <p className="text-xs text-gray-500">{selectedItem.category} • KES {selectedItem.cost}/{selectedItem.unit}</p>
                  </div>
                  <button onClick={() => { setSelectedItem(null); setSearchQuery(''); }} className="text-red-600">
                    <Ban className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Waste Reason */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Reason for Wastage</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(wasteReasonConfig) as [WasteReason, typeof wasteReasonConfig[WasteReason]][]).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setReason(key)}
                      className={`p-2 rounded-lg border-2 text-center transition-all ${reason === key
                          ? `border-red-500 ${config.bgColor}`
                          : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <Icon className={`h-4 w-4 mx-auto mb-1 ${config.color}`} />
                      <p className={`text-xs font-medium ${config.color}`}>{config.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Quantity</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={quantity}
                  onChange={(e) => {
                    const q = parseFloat(e.target.value) || 1;
                    setQuantity(q);
                    if (selectedItem) setCostImpact(selectedItem.cost * q);
                  }}
                  className="w-full h-10 px-4 text-sm bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  disabled={!!selectedItem}
                  className="w-full h-10 px-4 text-sm bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-red-500"
                >
                  <option value="portion">Portion</option>
                  <option value="kg">Kg</option>
                  <option value="g">Grams</option>
                  <option value="liter">Liter</option>
                  <option value="ml">ml</option>
                  <option value="piece">Piece</option>
                  <option value="plate">Plate</option>
                </select>
              </div>
            </div>

            {/* Cost Impact */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Cost Impact (KES)</label>
              <input
                type="number"
                min={0}
                value={costImpact}
                onChange={(e) => setCostImpact(parseFloat(e.target.value) || 0)}
                className="w-full h-10 px-4 text-sm bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about the wastage..."
                rows={2}
                className="w-full px-4 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <IOSButton
                variant="secondary"
                className="flex-1"
                onClick={() => { setShowRecordModal(false); resetForm(); }}
              >
                Cancel
              </IOSButton>
              <IOSButton
                className="flex-1"
                onClick={handleRecordWastage}
                disabled={isSubmitting || (!selectedItem && !customItemName)}
                variant="destructive"
              >
                {isSubmitting ? 'Recording...' : 'Record Wastage'}
              </IOSButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Wastage Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => { setShowEditModal(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-stone-600" />
              Edit Wastage Record
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Item Name */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Item Name</label>
              <input
                type="text"
                value={customItemName}
                onChange={(e) => setCustomItemName(e.target.value)}
                className="w-full h-10 px-4 text-sm bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-stone-500"
              />
            </div>

            {/* Waste Reason */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Reason for Wastage</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.entries(wasteReasonConfig) as [WasteReason, typeof wasteReasonConfig[WasteReason]][]).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setReason(key)}
                      className={`p-2 rounded-lg border-2 text-center transition-all ${reason === key
                          ? `border-stone-500 ${config.bgColor}`
                          : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <Icon className={`h-4 w-4 mx-auto mb-1 ${config.color}`} />
                      <p className={`text-xs font-medium ${config.color}`}>{config.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quantity & Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Quantity</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                  className="w-full h-10 px-4 text-sm bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-stone-500"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Unit</label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full h-10 px-4 text-sm bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-stone-500"
                >
                  <option value="portion">Portion</option>
                  <option value="kg">Kg</option>
                  <option value="g">Grams</option>
                  <option value="liter">Liter</option>
                  <option value="ml">ml</option>
                  <option value="piece">Piece</option>
                  <option value="plate">Plate</option>
                </select>
              </div>
            </div>

            {/* Cost Impact */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Cost Impact (KES)</label>
              <input
                type="number"
                min={0}
                value={costImpact}
                onChange={(e) => setCostImpact(parseFloat(e.target.value) || 0)}
                className="w-full h-10 px-4 text-sm bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-stone-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about the wastage..."
                rows={2}
                className="w-full px-4 py-2 text-sm bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-stone-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <IOSButton
                variant="secondary"
                className="flex-1"
                onClick={() => { setShowEditModal(false); resetForm(); }}
              >
                Cancel
              </IOSButton>
              <IOSButton
                className="flex-1"
                onClick={handleUpdateWastage}
                disabled={isSubmitting || !customItemName}
              >
                {isSubmitting ? 'Updating...' : 'Update Record'}
              </IOSButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Wastage Record
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-stone-600">
              Are you sure you want to delete this wastage record?
            </p>
            {deletingRecord && (
              <div className="p-3 bg-stone-50 rounded-lg">
                <p className="font-medium">{deletingRecord.item_name}</p>
                <p className="text-sm text-stone-500">
                  {deletingRecord.quantity} {deletingRecord.unit} • KES {(deletingRecord.cost_impact || 0).toLocaleString()}
                </p>
              </div>
            )}
            <p className="text-sm text-stone-500">
              This action cannot be undone.
            </p>
            <div className="flex gap-2 pt-2">
              <IOSButton
                variant="secondary"
                className="flex-1"
                onClick={() => { setShowDeleteConfirm(false); setDeletingRecord(null); }}
              >
                Cancel
              </IOSButton>
              <IOSButton
                className="flex-1"
                onClick={handleDeleteRecord}
                disabled={isDeleting}
                variant="destructive"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </IOSButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
