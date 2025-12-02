'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Save, Plus, Minus, UtensilsCrossed, DollarSign,
  Clock, User, Hash, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { restaurantAPI } from '@/lib/api';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  available: boolean;
}

interface OrderItem extends MenuItem {
  quantity: number;
  notes?: string;
}

interface RestaurantModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialData?: any;
}

export function MenuItemModal({ isOpen, onClose, mode = 'create', initialData }: RestaurantModalProps) {
  const [itemData, setItemData] = useState<MenuItem>(initialData || {
    id: '',
    name: '',
    description: '',
    price: 0,
    category: '',
    available: true
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setItemData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async () => {
    try {
      if (mode === 'create') {
        await restaurantAPI.createMenuItem(itemData);
      } else if (initialData?.id) {
        await restaurantAPI.updateMenuItem(initialData.id, itemData);
      }
      toast.success('Menu item ' + (mode === 'create' ? 'created' : 'updated') + ' successfully!');
      onClose();
    } catch (error:any) {
      toast.error(error.message || 'Failed to save menu item');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'create' ? 'Add Menu Item' : 'Edit Menu Item'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              name="name"
              value={itemData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={itemData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price (KES)
              </label>
              <input
                type="number"
                name="price"
                value={itemData.price}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                name="category"
                value={itemData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
              >
                <option value="">Select category</option>
                <option value="starters">Starters</option>
                <option value="main">Main Course</option>
                <option value="desserts">Desserts</option>
                <option value="drinks">Drinks</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="available"
              checked={itemData.available}
              onChange={handleChange}
              className="h-4 w-4 text-indigo-600"
            />
            <label className="text-sm text-gray-700">Available</label>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700"
          >
            <Save className="inline h-4 w-4 mr-2" />
            {mode === 'create' ? 'Add Item' : 'Update Item'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function OrderModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const res = await restaurantAPI.getMenuItems();
        const items = res.data || res.items || res || [];
        setMenuItems(items);
      } catch {
        setMenuItems([]);
      }
    };
    if (isOpen) loadMenu();
  }, [isOpen]);

  const addItem = (item: MenuItem) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeItem = (itemId: string) => {
    setOrderItems(prev =>
      prev.map(item =>
        item.id === itemId
          ? { ...item, quantity: Math.max(0, item.quantity - 1) }
          : item
      ).filter(item => item.quantity > 0)
    );
  };

  const updateNotes = (itemId: string, notes: string) => {
    setOrderItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, notes } : item
      )
    );
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async () => {
    try {
      await restaurantAPI.createOrder({
        tableNumber,
        customerName,
        items: orderItems,
        notes,
        total: calculateTotal()
      });
      toast.success('Order created successfully!');
      onClose();
    } catch (error:any) {
      toast.error(error.message || 'Failed to create order');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">New Order</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Menu Items */}
          <div>
            <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-4">Menu Items</h3>
            <div className="space-y-4">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-ios-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">KES {item.price}</p>
                  </div>
                  <button
                    onClick={() => addItem(item)}
                    className="p-2 bg-indigo-100 text-indigo-600 rounded-ios-lg hover:bg-indigo-200"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Order Details */}
          <div>
            <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-4">Order Details</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Table Number
                  </label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                  />
                </div>
              </div>

              {orderItems.length > 0 ? (
                <div className="space-y-3">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-ios-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <input
                          type="text"
                          placeholder="Special instructions..."
                          value={item.notes}
                          onChange={(e) => updateNotes(item.id, e.target.value)}
                          className="mt-1 w-full text-sm px-2 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeItem(item.id)}
                          className="p-1 text-gray-500 hover:bg-gray-200 rounded"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => addItem(item)}
                          className="p-1 text-gray-500 hover:bg-gray-200 rounded"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm font-medium">
                        KES {item.price * item.quantity}
                      </p>
                    </div>
                  ))}

                  <div className="p-4 bg-gray-100 rounded-ios-lg">
                    <div className="flex justify-between font-medium">
                      <span>Subtotal</span>
                      <span>KES {calculateTotal()}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mt-1">
                      <span>Service Charge (10%)</span>
                      <span>KES {calculateTotal() * 0.1}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t border-gray-300 mt-2 pt-2">
                      <span>Total</span>
                      <span>KES {calculateTotal() * 1.1}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <UtensilsCrossed className="h-8 w-8 mx-auto mb-2" />
                  <p>No items added yet</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
                  placeholder="Any special instructions..."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            disabled={orderItems.length === 0}
            className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700 disabled:bg-gray-400"
          >
            <FileText className="inline h-4 w-4 mr-2" />
            Place Order
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
