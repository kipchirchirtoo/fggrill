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
  quantity: number;
  unit_price: number;
}

export default function NewCateringEventPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    event_name: '',
    event_date: '',
    event_time: '',
    client_name: '',
    client_contact: '',
    client_email: '',
    venue: '',
    expected_guests: '',
    price_per_guest: '',
    special_requirements: '',
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

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/catering-food-control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create catering event');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast.success('Catering event created successfully');
      router.push(`/dashboard/branch-accounting/catering/${data.data.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleNext = () => {
    if (step === 1) {
      if (!formData.event_name || !formData.event_date || !formData.client_name || !formData.venue) {
        toast.error('Please fill in all required fields');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (menuItems.length === 0) {
        toast.error('Please add at least one menu item');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = () => {
    const totalAmount = menuItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    
    createEventMutation.mutate({
      ...formData,
      expected_guests: parseInt(formData.expected_guests),
      price_per_guest: parseFloat(formData.price_per_guest),
      total_amount: totalAmount,
      menu_items: menuItems,
    });
  };

  const addMenuItem = () => {
    setMenuItems([...menuItems, { menu_item_id: '', menu_item_name: '', quantity: 1, unit_price: 0 }]);
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
        updated[index].unit_price = item.price || 0;
      }
    }
    
    setMenuItems(updated);
  };

  const totalAmount = menuItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/branch-accounting/catering">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create Catering Event</h1>
          <p className="text-gray-600 mt-1">Step {step} of 3</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`flex-1 h-2 rounded-full ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {/* Step 1: Event Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="event_name">Event Name *</Label>
              <Input
                id="event_name"
                value={formData.event_name}
                onChange={(e) => setFormData({ ...formData, event_name: e.target.value })}
                placeholder="e.g., Corporate Lunch"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="event_date">Event Date *</Label>
                <Input
                  id="event_date"
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="event_time">Event Time</Label>
                <Input
                  id="event_time"
                  type="time"
                  value={formData.event_time}
                  onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="client_name">Client Name *</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="Client or organization name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="client_contact">Client Contact</Label>
                <Input
                  id="client_contact"
                  value={formData.client_contact}
                  onChange={(e) => setFormData({ ...formData, client_contact: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div>
                <Label htmlFor="client_email">Client Email</Label>
                <Input
                  id="client_email"
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="venue">Venue *</Label>
              <Input
                id="venue"
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                placeholder="Event location"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expected_guests">Expected Guests *</Label>
                <Input
                  id="expected_guests"
                  type="number"
                  value={formData.expected_guests}
                  onChange={(e) => setFormData({ ...formData, expected_guests: e.target.value })}
                  placeholder="100"
                  min="1"
                />
              </div>
              <div>
                <Label htmlFor="price_per_guest">Price per Guest (KES)</Label>
                <Input
                  id="price_per_guest"
                  type="number"
                  step="0.01"
                  value={formData.price_per_guest}
                  onChange={(e) => setFormData({ ...formData, price_per_guest: e.target.value })}
                  placeholder="2000.00"
                  min="0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="special_requirements">Special Requirements</Label>
              <Textarea
                id="special_requirements"
                value={formData.special_requirements}
                onChange={(e) => setFormData({ ...formData, special_requirements: e.target.value })}
                placeholder="Dietary restrictions, setup requirements, etc."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Menu Items */}
      {step === 2 && (
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
                <div key={index} className="flex gap-4 items-end p-4 border rounded-lg">
                  <div className="flex-1">
                    <Label>Menu Item</Label>
                    <select
                      className="w-full border rounded-md p-2"
                      value={item.menu_item_id}
                      onChange={(e) => updateMenuItem(index, 'menu_item_id', e.target.value)}
                    >
                      <option value="">Select item...</option>
                      {availableMenuItems?.map((menuItem: any) => (
                        <option key={menuItem.id} value={menuItem.id}>
                          {menuItem.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateMenuItem(index, 'quantity', parseInt(e.target.value))}
                      min="1"
                    />
                  </div>

                  <div className="w-32">
                    <Label>Unit Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => updateMenuItem(index, 'unit_price', parseFloat(e.target.value))}
                      min="0"
                    />
                  </div>

                  <div className="w-32">
                    <Label>Total</Label>
                    <p className="font-bold p-2">
                      KES {(item.quantity * item.unit_price).toLocaleString()}
                    </p>
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

            {menuItems.length > 0 && (
              <div className="flex justify-end p-4 bg-gray-50 rounded-lg">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold">KES {totalAmount.toLocaleString()}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Confirm</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Event Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Event Name</p>
                  <p className="font-medium">{formData.event_name}</p>
                </div>
                <div>
                  <p className="text-gray-600">Date & Time</p>
                  <p className="font-medium">{formData.event_date} {formData.event_time}</p>
                </div>
                <div>
                  <p className="text-gray-600">Client</p>
                  <p className="font-medium">{formData.client_name}</p>
                </div>
                <div>
                  <p className="text-gray-600">Venue</p>
                  <p className="font-medium">{formData.venue}</p>
                </div>
                <div>
                  <p className="text-gray-600">Expected Guests</p>
                  <p className="font-medium">{formData.expected_guests}</p>
                </div>
                <div>
                  <p className="text-gray-600">Price per Guest</p>
                  <p className="font-medium">KES {parseFloat(formData.price_per_guest || '0').toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Menu Items ({menuItems.length})</h3>
              <div className="space-y-2">
                {menuItems.map((item, index) => (
                  <div key={index} className="flex justify-between p-3 bg-gray-50 rounded-lg">
                    <span>{item.menu_item_name}</span>
                    <span className="font-medium">
                      {item.quantity} × KES {item.unit_price.toLocaleString()} = KES {(item.quantity * item.unit_price).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total Event Value</span>
                <span className="text-2xl font-bold text-blue-600">
                  KES {totalAmount.toLocaleString()}
                </span>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional notes or instructions"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <div>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/branch-accounting/catering">
            <Button variant="outline">Cancel</Button>
          </Link>
          {step < 3 ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={createEventMutation.isPending}>
              {createEventMutation.isPending ? 'Creating...' : 'Create Event'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
