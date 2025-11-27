'use client';

import { useState } from 'react';
import { useStockTransfers } from '@/hooks/useInventory';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Branch, InventoryItem } from '@/types/inventory';

interface StockTransferProps {
  isOpen: boolean;
  onClose: () => void;
  fromBranch: Branch;
  items: InventoryItem[];
}

export function StockTransfer({ isOpen, onClose, fromBranch, items }: StockTransferProps) {
  const [selectedItems, setSelectedItems] = useState<Array<{ id: string; quantity: number }>>([]);
  const [toBranch, setToBranch] = useState<Branch | ''>('');
  const { createTransfer } = useStockTransfers(fromBranch);

  const branches: Branch[] = ['Bomet', 'Kericho', 'Kapsoit', 'Litein'];

  const handleAddItem = (itemId: string) => {
    setSelectedItems(prev => [...prev, { id: itemId, quantity: 0 }]);
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setSelectedItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toBranch) return;

    try {
      await createTransfer({
        from_branch: fromBranch,
        to_branch: toBranch,
        items: selectedItems.map(item => ({
          item_id: item.id,
          quantity: item.quantity
        })),
        status: 'pending',
        created_at: new Date().toISOString()
      });
      onClose();
    } catch (error) {
      console.error('Failed to create transfer:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Stock Transfer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>From Branch</Label>
            <Input value={fromBranch} disabled />
          </div>

          <div>
            <Label>To Branch</Label>
            <Select value={toBranch} onValueChange={value => setToBranch(value as Branch)}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination branch" />
              </SelectTrigger>
              <SelectContent>
                {branches
                  .filter(branch => branch !== fromBranch)
                  .map(branch => (
                    <SelectItem key={branch} value={branch}>
                      {branch}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Add Items</Label>
            <Select onValueChange={handleAddItem}>
              <SelectTrigger>
                <SelectValue placeholder="Select items to transfer" />
              </SelectTrigger>
              <SelectContent>
                {items
                  .filter(item => !selectedItems.find(si => si.id === item.id))
                  .map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {selectedItems.length > 0 && (
            <div className="space-y-2">
              <Label>Selected Items</Label>
              {selectedItems.map(selectedItem => {
                const item = items.find(i => i.id === selectedItem.id);
                if (!item) return null;

                return (
                  <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">Available: {item.currentStock}</p>
                    </div>
                    <div className="w-32">
                      <Input
                        type="number"
                        value={selectedItem.quantity}
                        onChange={e => handleQuantityChange(item.id, parseInt(e.target.value))}
                        min={1}
                        max={item.currentStock}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={selectedItems.length === 0 || !toBranch}
            >
              Create Transfer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
