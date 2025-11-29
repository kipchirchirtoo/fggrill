'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Wine, Plus, Edit2, Trash2, Search, Check, X, RefreshCw, Beer, GlassWater } from 'lucide-react';
import { toast } from 'sonner';
import { barAPI } from '@/lib/api';

const defaultCategories = ['beers', 'whisky', 'vodka', 'gin', 'rum', 'brandy', 'wines', 'cocktails', 'shooters', 'soft-drinks'];

const defaultDrinks = [
  // Beers
  { id: '1', name: 'Tusker Lager', price: 300, category: 'beers', available: true },
  { id: '2', name: 'Tusker Malt', price: 350, category: 'beers', available: true },
  { id: '3', name: 'White Cap Lager', price: 300, category: 'beers', available: true },
  { id: '4', name: 'Pilsner Lager', price: 300, category: 'beers', available: true },
  { id: '5', name: 'Guinness', price: 400, category: 'beers', available: true },
  { id: '6', name: 'Heineken', price: 450, category: 'beers', available: true },
  { id: '7', name: 'Corona', price: 500, category: 'beers', available: true },
  // Whisky
  { id: '8', name: 'Jameson (Shot)', price: 400, category: 'whisky', available: true },
  { id: '9', name: 'Jack Daniels (Shot)', price: 450, category: 'whisky', available: true },
  { id: '10', name: 'Johnnie Walker Red', price: 350, category: 'whisky', available: true },
  { id: '11', name: 'Johnnie Walker Black', price: 550, category: 'whisky', available: true },
  { id: '12', name: 'Glenfiddich 12yr', price: 800, category: 'whisky', available: true },
  // Vodka
  { id: '13', name: 'Smirnoff (Shot)', price: 300, category: 'vodka', available: true },
  { id: '14', name: 'Absolut (Shot)', price: 400, category: 'vodka', available: true },
  { id: '15', name: 'Grey Goose (Shot)', price: 700, category: 'vodka', available: true },
  { id: '16', name: 'Ciroc (Shot)', price: 650, category: 'vodka', available: true },
  // Gin
  { id: '17', name: 'Gordons Gin', price: 300, category: 'gin', available: true },
  { id: '18', name: 'Tanqueray', price: 450, category: 'gin', available: true },
  { id: '19', name: 'Bombay Sapphire', price: 500, category: 'gin', available: true },
  // Wines
  { id: '20', name: 'House Red (Glass)', price: 500, category: 'wines', available: true },
  { id: '21', name: 'House White (Glass)', price: 500, category: 'wines', available: true },
  { id: '22', name: 'Red Wine (Bottle)', price: 2500, category: 'wines', available: true },
  // Cocktails
  { id: '23', name: 'Mojito', price: 650, category: 'cocktails', available: true },
  { id: '24', name: 'Margarita', price: 700, category: 'cocktails', available: true },
  { id: '25', name: 'Piña Colada', price: 700, category: 'cocktails', available: true },
  { id: '26', name: 'Long Island', price: 850, category: 'cocktails', available: true },
  { id: '27', name: 'Cosmopolitan', price: 700, category: 'cocktails', available: true },
  // Soft Drinks
  { id: '28', name: 'Coca Cola', price: 150, category: 'soft-drinks', available: true },
  { id: '29', name: 'Fanta Orange', price: 150, category: 'soft-drinks', available: true },
  { id: '30', name: 'Red Bull', price: 400, category: 'soft-drinks', available: true },
];

interface Drink { id: string; name: string; price: number; category: string; available: boolean; }

export default function BarMenuPage() {
  const [drinks, setDrinks] = useState<Drink[]>(defaultDrinks);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Drink | null>(null);
  const [formData, setFormData] = useState({ name: '', price: '', category: 'beers' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    barAPI.getDrinks().then(res => {
      const items = res.drinks || res.data || [];
      if (items.length > 0) setDrinks(items);
    }).catch(() => {});
  }, []);

  const filteredDrinks = drinks.filter(drink => {
    const matchesCat = selectedCategory === 'all' || drink.category === selectedCategory;
    const matchesSearch = drink.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) { toast.error('Name and price required'); return; }
    setIsLoading(true);
    const newItem: Drink = {
      id: editItem?.id || `${Date.now()}`,
      name: formData.name,
      price: parseInt(formData.price),
      category: formData.category,
      available: true
    };
    
    if (editItem) {
      setDrinks(prev => prev.map(i => i.id === editItem.id ? newItem : i));
      toast.success('Drink updated');
    } else {
      setDrinks(prev => [...prev, newItem]);
      toast.success('Drink added');
    }
    
    setShowModal(false);
    setEditItem(null);
    setFormData({ name: '', price: '', category: 'beers' });
    setIsLoading(false);
  };

  const toggleAvailability = (id: string) => {
    setDrinks(prev => prev.map(i => i.id === id ? { ...i, available: !i.available } : i));
  };

  const deleteItem = (id: string) => {
    if (confirm('Delete this drink?')) {
      setDrinks(prev => prev.filter(i => i.id !== id));
      toast.success('Drink deleted');
    }
  };

  const openEdit = (item: Drink) => {
    setEditItem(item);
    setFormData({ name: item.name, price: item.price.toString(), category: item.category });
    setShowModal(true);
  };

  const categoryStats = defaultCategories.map(cat => ({ name: cat, count: drinks.filter(i => i.category === cat).length }));

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Wine className="h-8 w-8 text-purple-600" />
                Drinks Menu
              </h1>
              <p className="text-gray-600 mt-1">Manage bar drinks and pricing</p>
            </div>
            <button onClick={() => { setEditItem(null); setFormData({ name: '', price: '', category: 'beers' }); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              <Plus className="h-5 w-5" /> Add Drink
            </button>
          </div>

          {/* Category Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
            {categoryStats.map(cat => (
              <div key={cat.name} onClick={() => setSelectedCategory(cat.name)} className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedCategory === cat.name ? 'bg-purple-50 border-purple-300' : 'bg-white hover:bg-gray-50'}`}>
                <div className="text-2xl font-bold text-purple-600">{cat.count}</div>
                <div className="text-xs text-gray-500 capitalize">{cat.name.replace('-', ' ')}</div>
              </div>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Search drinks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
            </div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-4 py-2 border rounded-lg">
              <option value="all">All Categories</option>
              {defaultCategories.map(cat => <option key={cat} value={cat} className="capitalize">{cat.replace('-', ' ')}</option>)}
            </select>
          </div>

          {/* Drinks Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Drink</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDrinks.map(drink => (
                  <tr key={drink.id} className={`hover:bg-gray-50 ${!drink.available ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {drink.category === 'beers' ? <Beer className="h-5 w-5 text-amber-500" /> : drink.category === 'cocktails' ? <GlassWater className="h-5 w-5 text-pink-500" /> : <Wine className="h-5 w-5 text-purple-500" />}
                        <span className="font-medium">{drink.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded text-sm capitalize">{drink.category.replace('-', ' ')}</span></td>
                    <td className="px-6 py-4 font-bold text-purple-600">KES {drink.price.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => toggleAvailability(drink.id)} className={`px-3 py-1 rounded-full text-xs font-medium ${drink.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {drink.available ? 'Available' : 'Out of Stock'}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(drink)} className="p-2 hover:bg-gray-100 rounded"><Edit2 className="h-4 w-4 text-gray-600" /></button>
                        <button onClick={() => deleteItem(drink.id)} className="p-2 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4 text-red-500" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredDrinks.length === 0 && (
              <div className="text-center py-12 text-gray-500"><Wine className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No drinks found</p></div>
            )}
          </div>
        </div>

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between mb-4">
                <h2 className="text-xl font-bold">{editItem ? 'Edit Drink' : 'Add Drink'}</h2>
                <button onClick={() => setShowModal(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="Drink name" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price (KES)</label>
                  <input type="number" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg">
                    {defaultCategories.map(cat => <option key={cat} value={cat} className="capitalize">{cat.replace('-', ' ')}</option>)}
                  </select>
                </div>
                <button onClick={handleSubmit} disabled={isLoading} className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center gap-2">
                  {isLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} {editItem ? 'Update' : 'Add'} Drink
                </button>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
