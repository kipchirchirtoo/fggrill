'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Search, Coffee, User, Bed, Clock,
  DollarSign, FileText, Utensils, Send
} from 'lucide-react';
import { toast } from 'sonner';

interface RoomServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
}

interface OrderItem extends MenuItem {
  quantity: number;
  notes: string;
}

export function RoomServiceModal({ isOpen, onClose }: RoomServiceModalProps): JSX.Element | null {
  const [searchTerm, setSearchTerm] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([
    { id: '1', name: 'Club Sandwich', price: 850, category: 'Mains', description: 'Classic triple-decker with chicken, bacon, lettuce, and tomato' },
    { id: '2', name: 'Caesar Salad', price: 650, category: 'Salads', description: 'Crisp romaine, parmesan, croutons with Caesar dressing' },
    { id: '3', name: 'Cappuccino', price: 350, category: 'Drinks', description: 'Espresso topped with foamy milk' },
    { id: '4', name: 'Fresh Fruit Platter', price: 450, category: 'Desserts', description: 'Seasonal fresh fruits' },
  ]);

  const handleAddItem = (item: MenuItem) => {
    setSelectedItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1, notes: '' }];
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleQuantityChange = (itemId: string, delta: number) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setSelectedItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, notes } : item
    ));
  };

  const totalAmount = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSubmitOrder = async () => {
    if (!roomNumber) {
      toast.error('Please enter a room number');
      return;
    }

    if (selectedItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    try {
      // TODO: Implement API call
      const response = await fetch('/api/room-service/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomNumber,
          items: selectedItems,
          totalAmount
        })
      });

      if (!response.ok) throw new Error('Failed to place order');
      
      toast.success('Room service order placed successfully!');
      onClose();
    } catch (error) {
      toast.error('Failed to place order');
    }
  };

  if (!isOpen) return null;

  const filteredItems = menuItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        className="bg-white rounded-xl p-6 max-w-4xl w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Room Service Order</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Menu Section */}
          <div className="space-y-4">
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search menu items..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2">
              {filteredItems.map(item => (
                <div key={item.id} className="border rounded-lg p-3 hover:border-indigo-500 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                    <span className="font-medium">KES {item.price}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{item.category}</span>
                    <button
                      onClick={() => handleAddItem(item)}
                      className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                    >
                      Add to Order
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">
                Room Number
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="Enter room number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="border rounded-lg divide-y">
              {selectedItems.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Utensils className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No items added to order</p>
                </div>
              ) : (
                selectedItems.map(item => (
                  <div key={item.id} className="p-3 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium">{item.name}</h4>
                        <p className="text-sm text-gray-500">KES {item.price} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(item.id, -1)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          -
                        </button>
                        <span className="w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(item.id, 1)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          +
                        </button>
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => handleNotesChange(item.id, e.target.value)}
                      placeholder="Add special instructions..."
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
                    />
                  </div>
                ))
              )}
            </div>

            {selectedItems.length > 0 && (
              <>
                <div className="flex justify-between items-center py-3 border-t">
                  <span className="font-medium">Total Amount</span>
                  <span className="font-bold">KES {totalAmount}</span>
                </div>

                <button
                  onClick={handleSubmitOrder}
                  className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  Place Order
                </button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
