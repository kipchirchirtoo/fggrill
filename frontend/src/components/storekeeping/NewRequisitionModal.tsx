'use client';

import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface RequisitionItem {
  item_id: string;
  quantity_requested: number;
  notes?: string;
}

interface NewRequisitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  items: Array<{
    id: string;
    name: string;
    item_code: string;
    unit: string;
  }>;
}

export function NewRequisitionModal({ isOpen, onClose, onSubmit, items }: NewRequisitionModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    department: '',
    priority: 'normal',
    required_date: '',
    notes: '',
    items: [] as RequisitionItem[]
  });

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { item_id: '', quantity_requested: 1 }
      ]
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const handleItemChange = (index: number, field: keyof RequisitionItem, value: string | number) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    setFormData({ ...formData, items: updatedItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit(formData);
      toast.success('Requisition created successfully');
      onClose();
    } catch (error) {
      toast.error('Failed to create requisition');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Purchase Requisition</DialogTitle>
        </DialogHeader>
          
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => setFormData({ ...formData, department: value })}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="kitchen">Kitchen</SelectItem>
                      <SelectItem value="housekeeping">Housekeeping</SelectItem>
                      <SelectItem value="restaurant">Restaurant</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="front_office">Front Office</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger id="priority">
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="required_date">Required Date</Label>
              <Input
                id="required_date"
                type="date"
                required
                min={new Date().toISOString().split('T')[0]}
                value={formData.required_date}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, required_date: e.target.value })}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button
                  type="button"
                  onClick={handleAddItem}
                  variant="outline"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              </div>

              <div className="space-y-3">
                {formData.items.map((item, index) => (
                  <div key={index} className="flex items-start gap-4 p-3 border rounded-ios-lg">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`item-${index}`}>Item</Label>
                        <Select
                          value={item.item_id}
                          onValueChange={(value) => handleItemChange(index, 'item_id', value)}
                        >
                          <SelectTrigger id={`item-${index}`}>
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {items.map((i) => (
                                <SelectItem key={i.id} value={i.id}>
                                  {i.name} ({i.item_code})
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`quantity-${index}`}>Quantity</Label>
                        <Input
                          id={`quantity-${index}`}
                          type="number"
                          min="1"
                          required
                          value={item.quantity_requested}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleItemChange(index, 'quantity_requested', Number(e.target.value))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`notes-${index}`}>Notes</Label>
                        <Input
                          id={`notes-${index}`}
                          value={item.notes || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleItemChange(index, 'notes', e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-8"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                ))}

                {formData.items.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No items added. Click "Add Item" to start.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <textarea
                id="notes"
                rows={3}
                className="w-full px-3 py-2 border rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                value={formData.notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional information..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Requisition'}
              </Button>
            </div>
          </form>
      </DialogContent>
    </Dialog>
  );
}
