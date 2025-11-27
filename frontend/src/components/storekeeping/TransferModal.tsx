'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export function TransferModal({ isOpen, onClose, onSubmit }: TransferModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    sku: '',
    transfer_quantity: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(formData);
      toast.success('Transfer initiated successfully');
      setFormData({ sku: '', transfer_quantity: 0 });
      onClose();
    } catch (error) {
      toast.error('Failed to initiate transfer');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request / Transfer Item</DialogTitle>
        </DialogHeader>
          
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="space-y-2">
                <Label htmlFor="sku">Item SKU</Label>
                <Input
                  id="sku"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Enter SKU to transfer"
                />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transfer_quantity">Quantity</Label>
              <Input
                id="transfer_quantity"
                type="number"
                min="1"
                required
                value={formData.transfer_quantity}
                onChange={(e) => setFormData({ ...formData, transfer_quantity: Number(e.target.value) })}
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
                {isLoading ? 'Processing...' : 'Transfer'}
              </Button>
            </div>
          </form>
      </DialogContent>
    </Dialog>
  );
}
