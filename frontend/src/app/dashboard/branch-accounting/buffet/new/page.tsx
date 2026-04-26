'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface MenuItem {
  menu_item_id: string;
  menu_item_name: string;
  portion_per_guest: number;
}

export default function NewBuffetPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    buffet_name: '',
    buffet_date: '',
    expected_guests: '',
    price_per_guest: '',
    notes: '',
  });
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  const { data: availableMenuItems } = useQuery({
    queryKey: ['menu-items'],
    queryFn: async () => {
      const response = await fetch('/api/restaurant/menu-items', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch menu items');
      const result = await response.json();
      return result.data;
    },
  });

  const createBuffetMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/buffet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create buffet');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast.success('Buffet event created successfully');
      router.push(`/dashboard/branch-accounting/buffet/${data.data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (menuItems.length === 0) {
      toast.error('Please add at least one menu item');
      return;
    }

    createBuffetMutation.mutate({
      ...formData,
      expected_guests: parseInt(formData.expected_guests),
      price_per_guest: parseFloat(formData.price_per_guest),
      menu_items: menuItems,
    });
  };

  const addMenuItem = () => {
    setMenuItems([...menuItems, { menu_item_id: '', menu_item_name: '', portion_per_guest: 1 }]);
  };

  const removeMenuItem = (index: number) => {
    setMenuItems(menuItems.filter((_, i) => i !== index));
  };

  const updateMenuItem = (index: number, field: keyof MenuItem, value: any) => {
    const updated = [...menuItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'menu_item_id' && availableMenuItems) {
      const item = availableMenuItems.find((m: any) => m.id === value);
      if (item) {
        updated[index].menu_item_name = item.name;
      }
    }
    
    setMenuItems(updated);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/branch-accounting/buffet">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create Buffet Event</h1>
          <p className="text-gray-600 mt-1">Set up a new buffet event with menu items</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="buffet_name">Buffet Name *</Label>
              <Input
                id="buffet_name"
                value={formData.buffet_name}
                onChange={(e) => setFormData({ ...formData, buffet_name: e.target.value })}
                placeholder="e.g., Sunday Brunch Buffet"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="buffet_date">Date *</Label>
                <Input
                  id="buffet_date"
                  type="date"
                  value={formData.buffet_date}
                  onChange={(e) => setFormData({ ...formData, buffet_date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label htmlFor="expected_guests">Expected Guests *</Label>
                <Input
                  id="expected_guests"
                  type="number"
                  value={formData.expected_guests}
                  onChange={(e) => setFormData({ ...formData, expected_guests: e.target.value })}
                  placeholder="50"
                  required
                  min="1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="price_per_guest">Price per Guest (KES) *</Label>
              <Input
                id="price_per_guest"
                type="number"
                step="0.01"
                value={formData.price_per_guest}
                onChange={(e) => setFormData({ ...formData, price_per_guest: e.target.value })}
                placeholder="1500.00"
                required
                min="0"
              />
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes about the buffet event"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Menu Items</CardTitle>
              <Button type="button" onClick={addMenuItem} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {menuItems.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No menu items added yet</p>
            ) : (
              menuItems.map((item, index) => (
                <div key={index} className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label>Menu Item</Label>
                    <select
                      className="w-full border rounded-md p-2"
                      value={item.menu_item_id}
                      onChange={(e) => updateMenuItem(index, 'menu_item_id', e.target.value)}
                      required
                    >
                      <option value="">Select item...</option>
                      {availableMenuItems?.map((menuItem: any) => (
                        <option key={menuItem.id} value={menuItem.id}>
                          {menuItem.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-32">
                    <Label>Portions/Guest</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={item.portion_per_guest}
                      onChange={(e) => updateMenuItem(index, 'portion_per_guest', parseFloat(e.target.value))}
                      required
                      min="0.1"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => removeMenuItem(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Link href="/dashboard/branch-accounting/buffet">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={createBuffetMutation.isPending}>
            {createBuffetMutation.isPending ? 'Creating...' : 'Create Buffet Event'}
          </Button>
        </div>
      </form>
    </div>
  );
}
