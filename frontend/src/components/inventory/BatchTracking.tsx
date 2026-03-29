'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';
import { API_URL } from '@/lib/config';

interface BatchTrackingProps {
  itemId: string;
  branch: string;
  onBatchAdded?: () => void;
}

interface Batch {
  batchNumber: string;
  quantity: number;
  manufacturingDate: Date | null;
  expiryDate: Date | null;
  costPrice: number;
}

import { apiClient } from '@/lib/api/core';

export function BatchTracking({ itemId, branch, onBatchAdded }: BatchTrackingProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [batch, setBatch] = useState<Batch>({
    batchNumber: '',
    quantity: 0,
    manufacturingDate: null,
    expiryDate: null,
    costPrice: 0
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await apiClient.post<any>('/inventory/batches', {
        itemId,
        branch,
        batchNumber: batch.batchNumber,
        quantity: batch.quantity,
        manufacturingDate: batch.manufacturingDate,
        expiryDate: batch.expiryDate,
        costPrice: batch.costPrice
      });

      if (!res.success) throw new Error(res.error || res.message || 'Failed to add batch');

      toast.success('Batch added successfully');
      onBatchAdded?.();

      // Reset form
      setBatch({
        batchNumber: '',
        quantity: 0,
        manufacturingDate: null,
        expiryDate: null,
        costPrice: 0
      });
    } catch (error) {
      console.error('Error adding batch:', error);
      toast.error('Failed to add batch');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold font-sf-pro-display mb-4">Add New Batch</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Batch Number</Label>
            <Input
              required
              value={batch.batchNumber}
              onChange={(e) => setBatch(prev => ({ ...prev, batchNumber: e.target.value }))}
              placeholder="Enter batch number"
            />
          </div>

          <div>
            <Label>Quantity</Label>
            <Input
              type="number"
              required
              min="1"
              value={batch.quantity}
              onChange={(e) => setBatch(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
            />
          </div>

          <div>
            <Label>Manufacturing Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {batch.manufacturingDate ? (
                    format(batch.manufacturingDate, 'PPP')
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={batch.manufacturingDate || undefined}
                  onSelect={(date) => setBatch(prev => ({ ...prev, manufacturingDate: date || null }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Expiry Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {batch.expiryDate ? (
                    format(batch.expiryDate, 'PPP')
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={batch.expiryDate || undefined}
                  onSelect={(date) => setBatch(prev => ({ ...prev, expiryDate: date || null }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Cost Price</Label>
            <Input
              type="number"
              required
              min="0"
              step="0.01"
              value={batch.costPrice}
              onChange={(e) => setBatch(prev => ({ ...prev, costPrice: parseFloat(e.target.value) }))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Adding...' : 'Add Batch'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
