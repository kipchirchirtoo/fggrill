'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UtensilsCrossed, Plus, Edit2, Trash2, Search, Check, X, RefreshCw, DollarSign, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { restaurantAPI } from '@/lib/api';

const defaultCategories = ['breakfast', 'lunch', 'dinner', 'appetizers', 'soups', 'desserts', 'beverages', 'specials'];

const defaultMenuItems = [
  { id: '1', name: 'Full English Breakfast', price: 850, category: 'breakfast', available: true, description: 'Eggs, bacon, sausage, beans, toast' },
  { id: '2', name: 'Pancakes Stack', price: 550, category: 'breakfast', available: true, description: 'Fluffy pancakes with maple syrup' },
  { id: '3', name: 'Eggs Benedict', price: 750, category: 'breakfast', available: true, description: 'Poached eggs with hollandaise' },
  { id: '4', name: 'Grilled Chicken Salad', price: 750, category: 'lunch', available: true, description: 'Fresh greens with grilled chicken' },
  { id: '5', name: 'Club Sandwich', price: 650, category: 'lunch', available: true, description: 'Triple decker with fries' },
  { id: '6', name: 'Beef Burger', price: 850, category: 'lunch', available: true, description: 'Angus beef with toppings' },
  { id: '7', name: 'Fish & Chips', price: 950, category: 'lunch', available: true, description: 'Beer battered fish' },
  { id: '8', name: 'Grilled Tilapia', price: 1200, category: 'dinner', available: true, description: 'Fresh tilapia with vegetables' },
  { id: '9', name: 'Beef Steak', price: 1800, category: 'dinner', available: true, description: '300g ribeye with sides' },
  { id: '10', name: 'Chicken Curry', price: 950, category: 'dinner', available: true, description: 'Aromatic curry with rice' },
  { id: '11', name: 'Lamb Chops', price: 1650, category: 'dinner', available: true, description: 'Grilled with mint sauce' },
  { id: '12', name: 'Chicken Wings', price: 550, category: 'appetizers', available: true, description: '8 pcs with dipping sauce' },
  { id: '13', name: 'Spring Rolls', price: 350, category: 'appetizers', available: true, description: '6 pcs vegetable rolls' },
  { id: '14', name: 'Samosas', price: 250, category: 'appetizers', available: true, description: '4 pcs beef samosas' },
  { id: '15', name: 'Tomato Soup', price: 350, category: 'soups', available: true, description: 'Creamy tomato with croutons' },
  { id: '16', name: 'Chicken Soup', price: 400, category: 'soups', available: true, description: 'Hearty chicken broth' },
  { id: '17', name: 'Chocolate Cake', price: 450, category: 'desserts', available: true, description: 'Rich chocolate layer' },
  { id: '18', name: 'Ice Cream', price: 300, category: 'desserts', available: true, description: '3 scoops choice of flavor' },
  { id: '19', name: 'Fresh Juice', price: 250, category: 'beverages', available: true, description: 'Orange, mango, passion' },
  { id: '20', name: 'Soft Drinks', price: 150, category: 'beverages', available: true, description: 'Coke, Fanta, Sprite' },
  { id: '21', name: 'Tea/Coffee', price: 200, category: 'beverages', available: true, description: 'Hot beverage' },
  { id: '22', name: 'Beer', price: 350, category: 'beverages', available: true, description: 'Tusker, White Cap' },
  { id: '23', name: 'Wine Glass', price: 500, category: 'beverages', available: true, description: 'House red or white' },
];

interface MenuItem { id: string; name: string; price: number; category: string; available: boolean; description?: string; }

export default function RestaurantMenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>(defaultMenuItems);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({ name: '', price: '', category: 'breakfast', description: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    restaurantAPI.getMenuItems().then(res => {
      const items = res.items || res.data || res.menu || [];
      if (items.length > 0) setMenuItems(items);
    }).catch(() => {});
  }, []);

  const filteredItems = menuItems.filter(item => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) { toast.error('Name and price required'); return; }
    setIsLoading(true);
    const newItem: MenuItem = {
      id: editItem?.id || `${Date.now()}`,
      name: formData.name,
      price: parseInt(formData.price),
      category: formData.category,
      description: formData.description,
      available: true
    };
    
    if (editItem) {
      setMenuItems(prev => prev.map(i => i.id === editItem.id ? newItem : i));
      toast.success('Item updated');
    } else {
      setMenuItems(prev => [...prev, newItem]);
      toast.success('Item added');
    }
    
    try { await (editItem ? restaurantAPI.updateMenuItem(editItem.id, newItem) : restaurantAPI.createMenuItem(newItem)).catch(() => {}); } catch {}
    setShowModal(false);
    setEditItem(null);
    setFormData({ name: '', price: '', category: 'breakfast', description: '' });
    setIsLoading(false);
  };

  const toggleAvailability = (id: string) => {
    setMenuItems(prev => prev.map(i => i.id === id ? { ...i, available: !i.available } : i));
  };

  const deleteItem = (id: string) => {
    if (confirm('Delete this item?')) {
      setMenuItems(prev => prev.filter(i => i.id !== id));
      toast.success('Item deleted');
    }
  };

  const openEdit = (item: MenuItem) => {
    setEditItem(item);
    setFormData({ name: item.name, price: item.price.toString(), category: item.category, description: item.description || '' });
    setShowModal(true);
  };

  const categoryStats = defaultCategories.map(cat => ({ name: cat, count: menuItems.filter(i => i.category === cat).length }));

  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Menu Management</h1>
              <p className="text-gray-600 mt-1">Manage menu items and pricing</p>
            </div>
            <button onClick={() => { setEditItem(null); setFormData({ name: '', price: '', category: 'breakfast', description: '' }); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              <Plus className="h-5 w-5" /> Add Item
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {categoryStats.map(cat => (
              <div key={cat.name} onClick={() => setSelectedCategory(cat.name)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedCategory === cat.name ? 'bg-indigo-50 border-indigo-300' : 'bg-white hover:bg-gray-50'}`}>
                <div className="text-2xl font-bold text-indigo-600">{cat.count}</div>
                <div className="text-xs text-gray-500 capitalize">{cat.name}</div>
              </div>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Search menu..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
            </div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-4 py-2 border rounded-lg">
              <option value="all">All Categories</option>
              {defaultCategories.map(cat => <option key={cat} value={cat} className="capitalize">{cat}</option>)}
            </select>
          </div>

          {/* Menu Items Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredItems.map(item => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${!item.available ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-medium">{item.name}</div>
                      {item.description && <div className="text-sm text-gray-500">{item.description}</div>}
                    </td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded text-sm capitalize">{item.category}</span></td>
                    <td className="px-6 py-4 font-bold text-indigo-600">KES {item.price.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => toggleAvailability(item.id)} className={`px-3 py-1 rounded-full text-xs font-medium ${item.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {item.available ? 'Available' : 'Unavailable'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(item)} className="p-2 hover:bg-gray-100 rounded"><Edit2 className="h-4 w-4 text-gray-600" /></button>
                        <button onClick={() => deleteItem(item.id)} className="p-2 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4 text-red-500" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 && (
              <div className="text-center py-12 text-gray-500"><UtensilsCrossed className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No items found</p></div>
            )}
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between mb-4">
                <h2 className="text-xl font-bold">{editItem ? 'Edit Item' : 'Add Menu Item'}</h2>
                <button onClick={() => setShowModal(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="Item name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price (KES)</label>
                  <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    {defaultCategories.map(cat => <option key={cat} value={cat} className="capitalize">{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Brief description" />
                </div>
                <button onClick={handleSubmit} disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center justify-center gap-2">
                  {isLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {editItem ? 'Update' : 'Add'} Item
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
