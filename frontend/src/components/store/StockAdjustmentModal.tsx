'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { IOSButton } from '@/components/ui/ios-button';
import { toast } from 'sonner';
import { storeAPI } from '@/lib/api';
import { useAuth, UserRole } from '@/lib/auth-context';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: {
    sku: string;
    name: string;
    quantity: number;
    reorder_level?: number;
    unit: string;
  } | null;
  initialType?: string;
  onSuccess: () => void;
}

export function StockAdjustmentModal({ isOpen, onClose, item, initialType, onSuccess }: StockAdjustmentModalProps) {
  const [quantity, setQuantity] = useState<number>(0);
  const [reorderLevel, setReorderLevel] = useState<number>(item?.reorder_level || 10);
  const [adjustmentType, setAdjustmentType] = useState(initialType || 'MANUAL_ADJUSTMENT');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const isStorekeeper = user?.role === UserRole.BRANCH_STOREKEEPER;

  useEffect(() => {
    if (item) {
      setQuantity(0);
      setReorderLevel(item.reorder_level || 10);
      setAdjustmentType(initialType || 'MANUAL_ADJUSTMENT');
      setNotes('');
    }
  }, [item, initialType]);

  const handleSubmit = async () => {
    if (!item) return;
    if (isStorekeeper && quantity > 0 && adjustmentType !== 'INITIAL_STOCK') {
      toast.error('Manual stock increases are not allowed for storekeepers. Please use the request flow.');
      return;
    }

    if (quantity === 0 && reorderLevel === item.reorder_level) {
      toast.error('Please specify an adjustment quantity or change the reorder level');
      return;
    }

    setIsLoading(true);
    try {
      const response = await storeAPI.adjustBranchStock({
        item_sku: item.sku,
        quantity: quantity,
        movement_type: adjustmentType,
        notes: notes || `Manual adjustment for ${item.name}`,
        reorder_level: reorderLevel
      });

      if (response.success) {
        toast.success('Stock adjusted successfully');
        onSuccess();
        onClose();
        setQuantity(0);
        setNotes('');
      } else {
        toast.error(response.message || 'Failed to adjust stock');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-white border-none shadow-2xl p-0 overflow-hidden rounded-xl">
        <div className="bg-stone-50 border-b border-stone-100 p-5">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-semibold text-stone-900">Adjust Stock: {item.name}</DialogTitle>
            <p className="text-[12px] text-stone-500 mt-1">Record manual changes to inventory levels.</p>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="bg-stone-50 rounded-lg p-3 border border-stone-100 flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Current Stock</p>
              <p className="text-xl font-black text-stone-900">{item.quantity} {item.unit}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-stone-400">Resulting Stock</p>
              <p className="text-xl font-black text-stone-400">{(item.quantity + quantity)} {item.unit}</p>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Adjustment Quantity</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="e.g. 5 or -2"
                className="bg-white border-stone-200 focus:ring-stone-500"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                disabled={isLoading}
              />
              <span className="text-stone-500 text-sm font-medium">{item.unit}</span>
            </div>
            {isStorekeeper && quantity > 0 && adjustmentType !== 'INITIAL_STOCK' && (
              <p className="text-[10px] text-red-500 mt-1 font-medium">Storekeepers cannot manually increase stock.</p>
            )}
            <p className="text-[10px] text-stone-400 mt-1">Use positive numbers to add, negative to deduct.</p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Minimum Stock (Reorder) Level</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="e.g. 10"
                className="bg-white border-stone-200 focus:ring-stone-500"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(parseFloat(e.target.value) || 0)}
              />
              <span className="text-stone-500 text-sm font-medium">{item.unit}</span>
            </div>
            <p className="text-[10px] text-stone-400 mt-1">Updates the threshold for low stock alerts.</p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Adjustment Reason</label>
            <select
              className="w-full h-10 px-3 bg-white border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400 transition-shadow"
              value={adjustmentType}
              onChange={(e) => setAdjustmentType(e.target.value)}
            >
              <option value="MANUAL_ADJUSTMENT">Manual Correction</option>
              <option value="DAMAGE">Damage / Spoilage</option>
              <option value="FOUND">Found in Stock</option>
              <option value="INITIAL_STOCK">Initial Branch Stock</option>
              <option value="EXPIRED">Expired Items</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 block">Notes</label>
            <Input
              placeholder="Provide more context..."
              className="bg-white border-stone-200 focus:ring-stone-500"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="p-5 bg-stone-50 border-t border-stone-100 flex justify-end gap-2">
          <IOSButton variant="secondary" onClick={onClose} disabled={isLoading}>Cancel</IOSButton>
          <IOSButton 
            onClick={handleSubmit} 
            disabled={isLoading || (quantity === 0 && reorderLevel === item.reorder_level) || (isStorekeeper && quantity > 0 && adjustmentType !== 'INITIAL_STOCK')}
            className={quantity < 0 ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {isLoading ? 'Updating...' : 'Apply Adjustment'}
          </IOSButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
