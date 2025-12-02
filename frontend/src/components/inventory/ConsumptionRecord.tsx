'use client';

import { useState } from 'react';
import { useConsumptionRecords } from '@/hooks/useInventory';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Branch, InventoryItem } from '@/types/inventory';

interface ConsumptionRecordProps {
  isOpen: boolean;
  onClose: () => void;
  branch: Branch;
  department: string;
  items: InventoryItem[];
}

export function ConsumptionRecordModal({ isOpen, onClose, branch, department, items }: ConsumptionRecordProps) {
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  
  const { recordConsumption } = useConsumptionRecords(branch, department);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      await recordConsumption({
        branch,
        department,
        item_id: selectedItem,
        quantity,
        consumption_date: new Date().toISOString(),
        notes,
        recorded_by: 'Current User' // Replace with actual user info
      });
      onClose();
    } catch (error) {
      console.error('Failed to record consumption:', error);
    }
  };

  const selectedItemDetails = items.find(item => item.item_id === selectedItem);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Consumption - {department}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Select Item</Label>
            <Select value={selectedItem} onValueChange={setSelectedItem}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an item" />
              </SelectTrigger>
              <SelectContent>
                {items.map(item => (
                  <SelectItem key={item.item_id} value={item.item_id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedItemDetails && (
            <div className="p-3 bg-gray-50 rounded-ios-lg">
              <p className="text-sm text-gray-500">Current Stock: {selectedItemDetails.currentStock}</p>
              <p className="text-sm text-gray-500">Unit: {selectedItemDetails.unit}</p>
            </div>
          )}

          <div>
            <Label>Quantity Used</Label>
            <Input
              type="number"
              value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value))}
              min={1}
              max={selectedItemDetails?.currentStock}
            />
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedItem || quantity <= 0}
            >
              Record Consumption
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
