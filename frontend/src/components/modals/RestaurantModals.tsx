'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Save, Plus, Minus, UtensilsCrossed, DollarSign,
  Clock, User, Hash, FileText, ChevronRight, Search,
  Trash2, CheckCircle2
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
  const [step, setStep] = useState(1);
  const [itemData, setItemData] = useState<MenuItem>(initialData || {
    id: '',
    name: '',
    description: '',
    price: 0,
    category: '',
    available: true
  });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      if (initialData) setItemData(initialData);
    }
  }, [isOpen, initialData]);

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
      } else if (itemData.id) {
        await restaurantAPI.updateMenuItem(itemData.id, itemData);
      }
      toast.success('Menu item ' + (mode === 'create' ? 'created' : 'updated') + ' successfully!');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save menu item');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {mode === 'create' ? 'New Menu Item' : 'Edit Menu Item'}
              </h2>
              <div className="flex gap-2 mt-2">
                {[1, 2].map(s => (
                  <div key={s} className={`h-1 rounded-full transition-all duration-300 ${s <= step ? 'w-8 bg-indigo-600' : 'w-2 bg-gray-100'}`} />
                ))}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ x: 10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -10, opacity: 0 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Item Name</label>
                  <div className="relative">
                    <UtensilsCrossed className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      value={itemData.name}
                      onChange={handleChange}
                      placeholder="e.g. Grilled Chicken Salad"
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    name="description"
                    value={itemData.description}
                    onChange={handleChange}
                    placeholder="Briefly describe the ingredients or preparation..."
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all min-h-[100px] resize-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                  <select
                    name="category"
                    value={itemData.category}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-medium appearance-none"
                  >
                    <option value="">Select category</option>
                    <option value="starters">Starters</option>
                    <option value="main">Main Course</option>
                    <option value="desserts">Desserts</option>
                    <option value="drinks">Drinks</option>
                  </select>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ x: 10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -10, opacity: 0 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pricing (KES)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      name="price"
                      value={itemData.price}
                      onChange={handleChange}
                      min="0"
                      placeholder="0.00"
                      className="w-full pl-11 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-black text-2xl text-indigo-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border-2 border-transparent hover:border-indigo-100 transition-all">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${itemData.available ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">Availability Status</p>
                      <p className="text-xs text-gray-500">{itemData.available ? 'Visible to customers' : 'Hidden from menu'}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="available"
                      checked={itemData.available}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="px-6 py-5 bg-gray-50 border-t border-gray-100 flex gap-3">
          {step === 1 ? (
            <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">
              Cancel
            </button>
          ) : (
            <button onClick={() => setStep(1)} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors">
              Go Back
            </button>
          )}

          {step === 1 ? (
            <button
              onClick={() => setStep(2)}
              disabled={!itemData.name || !itemData.category}
              className="flex-[2] bg-gray-900 text-white py-3 rounded-xl font-bold text-sm shadow-lg hover:bg-gray-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" /> {mode === 'create' ? 'Add Item' : 'Update Item'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export function OrderModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [tableNumber, setTableNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    toast.success(`${item.name} added to order`, { duration: 1000 });
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

  const deleteItem = (itemId: string) => {
    setOrderItems(prev => prev.filter(item => item.id !== itemId));
  };

  const updateNotes = (itemId: string, notes: string) => {
    setOrderItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, notes } : item
      )
    );
  };

  const calculateSubtotal = () => {
    return orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const subtotal = calculateSubtotal();
      await restaurantAPI.createOrder({
        tableNumber,
        customerName,
        items: orderItems,
        notes,
        total: subtotal * 1.1 // Including 10% service charge
      });
      toast.success('Order created successfully!');
      onClose();
      resetForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setOrderItems([]);
    setTableNumber('');
    setCustomerName('');
    setNotes('');
  };

  if (!isOpen) return null;

  const categories = ['all', ...Array.from(new Set(menuItems.map(m => m.category)))];
  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory && item.available;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Restaurant Order Wizard</h2>
              <div className="flex items-center gap-2 mt-2">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-1 rounded-full transition-all duration-300 ${s <= step ? 'w-10 bg-indigo-600' : 'w-6 bg-gray-100'}`}
                  />
                ))}
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-0 overflow-y-auto flex-1 h-full">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="p-6 space-y-6"
              >
                <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-4">
                  <User className="h-5 w-5" />
                  <span>Order Context</span>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Table Number</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        placeholder="e.g. T-12"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Customer Name (Optional)</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Guest Name"
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider ml-1">Order Notes / Priorities</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="e.g. Allerries, split billing, urgent..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div className="bg-indigo-50 p-4 rounded-2xl flex items-start gap-3">
                  <Clock className="h-5 w-5 text-indigo-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-indigo-900">Pro-Tip: Context First</h4>
                    <p className="text-xs text-indigo-700 mt-0.5">Setting the table and notes first helps kitchen staff prioritize and identify orders correctly from the start.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="flex flex-col h-full"
              >
                <div className="p-4 border-b border-gray-100 flex items-center gap-4 bg-gray-50/50">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search menu items..."
                      className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm outline-none capitalize"
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="p-4 grid grid-cols-2 gap-3 overflow-y-auto max-h-[500px]">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => addItem(item)}
                      className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-2xl hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left group shadow-sm"
                    >
                      <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <UtensilsCrossed className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                        <p className="text-xs text-indigo-600 font-semibold">KES {item.price}</p>
                      </div>
                      <Plus className="h-4 w-4 text-gray-300 group-hover:text-indigo-600" />
                    </button>
                  ))}
                </div>

                {orderItems.length > 0 && (
                  <div className="p-3 bg-indigo-600 text-white flex items-center justify-between px-6">
                    <span className="text-sm font-medium">{orderItems.length} items selected</span>
                    <span className="text-sm font-bold">Current Total: KES {calculateSubtotal()}</span>
                  </div>
                )}
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="p-6 space-y-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-indigo-600 font-semibold">
                    <UtensilsCrossed className="h-5 w-5" />
                    <span>Review & Finalize Order</span>
                  </div>
                  <div className="text-xs bg-gray-100 px-3 py-1 rounded-full font-bold text-gray-600">
                    TABLE: {tableNumber || 'N/A'}
                  </div>
                </div>

                <div className="space-y-3">
                  {orderItems.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                              KES {item.price} each
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white p-1.5 rounded-xl border border-gray-100 shadow-sm">
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="w-8 text-center font-bold text-indigo-900">{item.quantity}</span>
                          <button
                            onClick={() => addItem(item)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-2 text-gray-300 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => updateNotes(item.id, e.target.value)}
                        placeholder="Add special instructions for this item..."
                        className="mt-3 w-full bg-white border border-gray-100 px-3 py-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-indigo-500/30"
                      />
                    </div>
                  ))}
                </div>

                <div className="bg-white border-2 border-dashed border-gray-100 rounded-3xl p-6 space-y-3">
                  <div className="flex justify-between text-gray-500 font-medium">
                    <span>Subtotal</span>
                    <span>KES {calculateSubtotal()}</span>
                  </div>
                  <div className="flex justify-between text-gray-400 text-sm">
                    <span>Service Charge (10%)</span>
                    <span>KES {Math.round(calculateSubtotal() * 0.1)}</span>
                  </div>
                  <div className="flex justify-between items-end pt-3 border-t border-gray-50">
                    <div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Total Payable</p>
                      <p className="text-3xl font-black text-gray-900">KES {Math.round(calculateSubtotal() * 1.1)}</p>
                    </div>
                    <div className="bg-green-100 text-green-700 p-2 rounded-xl">
                      <DollarSign className="h-6 w-6" />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 shrink-0 border-t border-gray-100">
          <div className="flex gap-3">
            {step === 1 ? (
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white border border-gray-200 text-gray-500 rounded-2xl hover:bg-gray-100 font-bold transition-all shadow-sm flex-1"
              >
                Discard
              </button>
            ) : (
              <button
                onClick={() => setStep(step - 1)}
                className="px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-2xl hover:bg-gray-100 font-bold transition-all shadow-sm"
              >
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !tableNumber}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:bg-gray-400"
              >
                Next Step
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={orderItems.length === 0 || isSubmitting}
                className="flex-1 px-6 py-3 bg-[#34C759] text-white rounded-2xl hover:bg-[#2EB150] font-bold shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2 animate-in fade-in zoom-in duration-300"
              >
                {isSubmitting ? 'Processing...' : 'Place Final Order'}
                {!isSubmitting && <CheckCircle2 className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
