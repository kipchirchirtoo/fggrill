'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Package, Search, AlertTriangle, Wine, Beer, Plus, Minus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { barAPI } from '@/lib/api';

const defaultStock = [
  // Beers
  { id: '1', name: 'Tusker Lager', category: 'beers', quantity: 48, unit: 'bottles', min_stock: 24, price: 300 },
  { id: '2', name: 'Tusker Malt', category: 'beers', quantity: 24, unit: 'bottles', min_stock: 12, price: 350 },
  { id: '3', name: 'White Cap', category: 'beers', quantity: 36, unit: 'bottles', min_stock: 24, price: 300 },
  { id: '4', name: 'Guinness', category: 'beers', quantity: 18, unit: 'bottles', min_stock: 12, price: 400 },
  { id: '5', name: 'Heineken', category: 'beers', quantity: 12, unit: 'bottles', min_stock: 12, price: 450 },
  { id: '6', name: 'Corona', category: 'beers', quantity: 6, unit: 'bottles', min_stock: 12, price: 500 },
  // Spirits
  { id: '7', name: 'Jameson Whiskey', category: 'whisky', quantity: 5, unit: '750ml', min_stock: 3, price: 3500 },
  { id: '8', name: 'Jack Daniels', category: 'whisky', quantity: 4, unit: '750ml', min_stock: 2, price: 4000 },
  { id: '9', name: 'Johnnie Walker Red', category: 'whisky', quantity: 6, unit: '750ml', min_stock: 3, price: 2500 },
  { id: '10', name: 'Johnnie Walker Black', category: 'whisky', quantity: 3, unit: '750ml', min_stock: 2, price: 4500 },
  { id: '11', name: 'Smirnoff Vodka', category: 'vodka', quantity: 8, unit: '750ml', min_stock: 4, price: 2000 },
  { id: '12', name: 'Absolut Vodka', category: 'vodka', quantity: 4, unit: '750ml', min_stock: 2, price: 3000 },
  { id: '13', name: 'Gordons Gin', category: 'gin', quantity: 5, unit: '750ml', min_stock: 3, price: 2200 },
  { id: '14', name: 'Tanqueray Gin', category: 'gin', quantity: 3, unit: '750ml', min_stock: 2, price: 3500 },
  { id: '15', name: 'Captain Morgan', category: 'rum', quantity: 4, unit: '750ml', min_stock: 2, price: 2500 },
  { id: '16', name: 'Bacardi White', category: 'rum', quantity: 3, unit: '750ml', min_stock: 2, price: 2200 },
  // Wines
  { id: '17', name: 'House Red Wine', category: 'wines', quantity: 8, unit: '750ml', min_stock: 4, price: 1500 },
  { id: '18', name: 'House White Wine', category: 'wines', quantity: 6, unit: '750ml', min_stock: 4, price: 1500 },
  { id: '19', name: 'Sparkling Wine', category: 'wines', quantity: 4, unit: '750ml', min_stock: 2, price: 2500 },
  // Mixers
  { id: '20', name: 'Coca Cola', category: 'mixers', quantity: 48, unit: '300ml', min_stock: 24, price: 100 },
  { id: '21', name: 'Tonic Water', category: 'mixers', quantity: 24, unit: '300ml', min_stock: 12, price: 150 },
  { id: '22', name: 'Red Bull', category: 'mixers', quantity: 12, unit: 'cans', min_stock: 12, price: 350 },
  { id: '23', name: 'Fresh Limes', category: 'garnish', quantity: 20, unit: 'pieces', min_stock: 10, price: 20 },
  { id: '24', name: 'Fresh Mint', category: 'garnish', quantity: 5, unit: 'bunches', min_stock: 3, price: 50 },
];

export default function BarInventoryPage() {
  const { user } = useAuth();
  const [stock, setStock] = useState(defaultStock);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showLowOnly, setShowLowOnly] = useState(false);

  useEffect(() => {
    barAPI.getStock().then(res => {
      const items = res.stock || res.data || [];
      if (items.length > 0) setStock(items);
    }).catch(() => {});
  }, []);

  const categories = ['all', ...new Set(defaultStock.map(s => s.category))];
  
  const filteredStock = stock.filter(item => {
    const matchesCat = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLow = !showLowOnly || item.quantity <= item.min_stock;
    return matchesCat && matchesSearch && matchesLow;
  });

  const lowStockItems = stock.filter(s => s.quantity <= s.min_stock);
  const totalValue = stock.reduce((sum, s) => sum + (s.quantity * s.price), 0);

  const adjustStock = (id: string, delta: number) => {
    setStock(prev => prev.map(s => s.id === id ? { ...s, quantity: Math.max(0, s.quantity + delta) } : s));
    toast.success('Stock updated');
  };

  const getStockStatus = (item: typeof stock[0]) => {
    if (item.quantity === 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-800' };
    if (item.quantity <= item.min_stock) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'In Stock', color: 'bg-green-100 text-green-800' };
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Package className="h-8 w-8 text-purple-600" />
                Bar Inventory
              </h1>
              <p className="text-gray-600 mt-1">{user?.branch_name || 'Famous Gate Hotel'} - Stock Management</p>
            </div>
            <button onClick={() => window.location.reload()} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-purple-100 rounded-lg"><Package className="h-6 w-6 text-purple-600" /></div>
                <span className="text-3xl font-bold text-purple-600">{stock.length}</span>
              </div>
              <div className="text-sm text-gray-500 mt-2">Total Items</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-yellow-100 rounded-lg"><AlertTriangle className="h-6 w-6 text-yellow-600" /></div>
                <span className="text-3xl font-bold text-yellow-600">{lowStockItems.length}</span>
              </div>
              <div className="text-sm text-gray-500 mt-2">Low Stock Items</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-red-100 rounded-lg"><Package className="h-6 w-6 text-red-600" /></div>
                <span className="text-3xl font-bold text-red-600">{stock.filter(s => s.quantity === 0).length}</span>
              </div>
              <div className="text-sm text-gray-500 mt-2">Out of Stock</div>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-green-100 rounded-lg"><Wine className="h-6 w-6 text-green-600" /></div>
                <span className="text-2xl font-bold text-green-600">KES {totalValue.toLocaleString()}</span>
              </div>
              <div className="text-sm text-gray-500 mt-2">Stock Value</div>
            </div>
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">Low Stock Alert</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.map(item => (
                  <span key={item.id} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                    {item.name} ({item.quantity} {item.unit})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search & Filter */}
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="text" placeholder="Search inventory..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
            </div>
            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="px-4 py-2 border rounded-lg">
              {categories.map(cat => <option key={cat} value={cat} className="capitalize">{cat}</option>)}
            </select>
            <button onClick={() => setShowLowOnly(!showLowOnly)} className={`px-4 py-2 rounded-lg ${showLowOnly ? 'bg-yellow-500 text-white' : 'bg-gray-100'}`}>
              <AlertTriangle className="h-4 w-4 inline mr-1" /> Low Stock Only
            </button>
          </div>

          {/* Inventory Table */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Min Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Adjust</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredStock.map(item => {
                  const status = getStockStatus(item);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {item.category === 'beers' ? <Beer className="h-5 w-5 text-amber-500" /> : <Wine className="h-5 w-5 text-purple-500" />}
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className="px-2 py-1 bg-gray-100 rounded text-sm capitalize">{item.category}</span></td>
                      <td className="px-6 py-4 font-bold">{item.quantity} <span className="text-gray-400 font-normal">{item.unit}</span></td>
                      <td className="px-6 py-4 text-gray-500">{item.min_stock}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span></td>
                      <td className="px-6 py-4 text-purple-600 font-medium">KES {(item.quantity * item.price).toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => adjustStock(item.id, -1)} className="p-1 rounded bg-gray-100 hover:bg-gray-200"><Minus className="h-4 w-4" /></button>
                          <button onClick={() => adjustStock(item.id, 1)} className="p-1 rounded bg-gray-100 hover:bg-gray-200"><Plus className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredStock.length === 0 && (
              <div className="text-center py-12 text-gray-500"><Package className="h-12 w-12 mx-auto mb-3 text-gray-300" /><p>No items found</p></div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
