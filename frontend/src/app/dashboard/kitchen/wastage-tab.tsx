'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { restaurantAPI, wastageAPI } from '@/lib/api';
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
  user?: {
    first_name: string;
    last_name: string;
  };
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
      const [itemsRes, recordsRes, summaryRes] = await Promise.all([
        restaurantAPI.getWastageItems(),
        wastageAPI.getWastageRecords(),
        wastageAPI.getWastageSummary('30d'),
      ]);

      if (itemsRes.success) {
        setWastageItems(itemsRes.data || []);
      }

      if (recordsRes.success) {
        setWastageRecords(recordsRes.data || []);
      }

      if (summaryRes.success && summaryRes.data) {
        setStats({
          totalRecords: summaryRes.data.totalItems || 0,
          totalCost: summaryRes.data.totalCost || 0,
          byReason: summaryRes.data.byReason || {},
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
      await wastageAPI.createWastageRecord({
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
      await wastageAPI.updateWastageRecord(editingRecord.id, {
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
      await wastageAPI.deleteWastageRecord(deletingRecord.id);
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Wastage', value: stats.totalRecords, icon: Trash2, color: 'text-stone-600', bg: 'bg-stone-50' },
          { label: 'Total Loss', value: `KES ${stats.totalCost.toLocaleString()}`, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Spoilage', value: typeof stats.byReason['spoilage'] === 'object' ? (stats.byReason['spoilage'] as any)?.count || 0 : stats.byReason['spoilage'] || 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Overcooking', value: typeof stats.byReason['overcooking'] === 'object' ? (stats.byReason['overcooking'] as any)?.count || 0 : stats.byReason['overcooking'] || 0, icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-stone-200 rounded-xl p-3 sm:p-4 shadow-sm flex items-center gap-3 sm:gap-4">
            <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center shrink-0`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">{stat.label}</p>
              <p className="text-lg sm:text-xl font-bold text-stone-900 truncate">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions - Minimal Design */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-bold text-stone-900">Recent Wastage</h2>
        <div className="flex gap-2">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex-1 sm:flex-none h-10 px-4 btn-secondary flex items-center justify-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowRecordModal(true)}
            className="flex-1 sm:flex-none h-10 px-4 btn-primary flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Record Waste</span>
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
        <div className="grid gap-3">
          {wastageRecords.map((record) => {
            const reasonConfig = wasteReasonConfig[record.reason as WasteReason] || wasteReasonConfig.other;
            const Icon = reasonConfig.icon;

            return (
              <div key={record.id} className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm hover:border-stone-300 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${reasonConfig.bgColor} flex items-center justify-center shrink-0`}>
                      <Icon className={`h-6 w-6 ${reasonConfig.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-stone-900 truncate">{record.item_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <IOSBadge size="sm" className={`${reasonConfig.bgColor} ${reasonConfig.color} border-0 text-[10px]`}>
                          {reasonConfig.label}
                        </IOSBadge>
                        <span className="text-xs font-bold text-stone-400">
                          {record.quantity} {record.unit}
                        </span>
                      </div>
                      {record.description && (
                        <p className="text-[11px] text-stone-500 mt-1 line-clamp-1">{record.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-6 sm:gap-4 border-t sm:border-0 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="font-bold text-red-600">-KES {(record.cost_impact || 0).toLocaleString()}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-400 mt-1">
                        <Timer className="h-3 w-3" />
                        <span>{new Date(record.logged_at).toLocaleDateString()}</span>
                        {record.user ? (
                          <span className="hidden xs:inline">• {record.user.first_name[0]}. {record.user.last_name}</span>
                        ) : record.logged_by_name ? (
                          <span className="hidden xs:inline">• {record.logged_by_name}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleEditRecord(record)}
                        className="p-2 rounded-xl bg-stone-50 text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => confirmDelete(record)}
                        className="p-2 rounded-xl bg-red-50 text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors"
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
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Reason for Wastage</p>
              <div className="grid grid-cols-2 xs:grid-cols-4 gap-2">
                {(Object.entries(wasteReasonConfig) as [WasteReason, typeof wasteReasonConfig[WasteReason]][]).map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => setReason(key)}
                      className={`p-2.5 rounded-xl border-2 text-center transition-all ${reason === key
                        ? `border-stone-900 ${config.bgColor}`
                        : 'border-stone-100 hover:border-stone-200 bg-stone-50/50'
                        }`}
                    >
                      <Icon className={`h-4 w-4 mx-auto mb-1 ${config.color}`} />
                      <p className={`text-[10px] font-bold uppercase tracking-tight ${config.color}`}>{config.label}</p>
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
