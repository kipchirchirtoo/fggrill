'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion } from 'framer-motion';
import { ConsumptionTracking } from '@/components/inventory/ConsumptionTracking';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  TrendingDown,
  ShoppingCart,
  BarChart3,
  Download,
  Upload,
  QrCode,
  RefreshCw,
  Truck,
  Archive
} from 'lucide-react';
import { toast } from 'sonner';
import type { InventoryItem, StockMovement, PurchaseOrder } from '@/types/system.types';

export default function InventoryManagementPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'items' | 'movements' | 'orders' | 'consumption'>('items');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  
  // API base URL
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  // State for inventory items
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch inventory items
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/inventory`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch inventory items');
        }

        const data = await response.json();
        setItems(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        toast.error('Failed to load inventory items');
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();
  }, []);

  const getStockStatus = (item: InventoryItem) => {
    const percentage = (item.currentStock / item.maximumStock) * 100;
    if (item.currentStock <= item.minimumStock) return { color: 'red', label: 'Critical' };
    if (item.currentStock <= item.reorderPoint) return { color: 'yellow', label: 'Low' };
    if (percentage > 80) return { color: 'blue', label: 'Overstocked' };
    return { color: 'green', label: 'Optimal' };
  };

  const stats = {
    totalItems: items.length,
    lowStock: items.filter((i: InventoryItem) => i.currentStock <= i.reorderPoint).length,
    criticalStock: items.filter((i: InventoryItem) => i.currentStock <= i.minimumStock).length,
    totalValue: items.reduce((sum: number, i: InventoryItem) => sum + (i.currentStock * i.unitCost), 0),
    pendingOrders: 0, // Fetched from API
    recentMovements: 0 // Fetched from API
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Inventory Management System</h1>
              <p className="text-gray-600 mt-1">Real-time stock tracking with automated alerts</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                Scan
              </button>
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Item
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <Package className="h-8 w-8 text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{stats.totalItems}</p>
              <p className="text-sm text-gray-600">Total Items</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <TrendingDown className="h-8 w-8 text-yellow-600 mb-2" />
              <p className="text-2xl font-bold text-yellow-900">{stats.lowStock}</p>
              <p className="text-sm text-yellow-700">Low Stock</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <AlertTriangle className="h-8 w-8 text-red-600 mb-2" />
              <p className="text-2xl font-bold text-red-900">{stats.criticalStock}</p>
              <p className="text-sm text-red-700">Critical</p>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg p-4">
              <BarChart3 className="h-8 w-8 mb-2" />
              <p className="text-xl font-bold">KES {(stats.totalValue / 1000).toFixed(0)}K</p>
              <p className="text-sm opacity-90">Total Value</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <ShoppingCart className="h-8 w-8 text-purple-600 mb-2" />
              <p className="text-2xl font-bold">{stats.pendingOrders}</p>
              <p className="text-sm text-gray-600">Pending Orders</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <RefreshCw className="h-8 w-8 text-indigo-600 mb-2" />
              <p className="text-2xl font-bold">{stats.recentMovements}</p>
              <p className="text-sm text-gray-600">Recent Movements</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('items')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'items'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Inventory Items
              </button>
              <button
                onClick={() => setActiveTab('movements')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'movements'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Stock Movements
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'orders'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Purchase Orders
              </button>
              <button
                onClick={() => setActiveTab('consumption')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'consumption'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Consumption Tracking
              </button>
            </nav>
          </div>

          {/* Content based on active tab */}
          {activeTab === 'items' && (
            <>
              {/* Filters */}
              <div className="bg-white rounded-lg p-4 border border-gray-100">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search items by name, code, or supplier..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Categories</option>
                    <option value="food">Food</option>
                    <option value="beverage">Beverage</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="amenities">Amenities</option>
                    <option value="linen">Linen</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                  <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    More Filters
                  </button>
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock Level</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {items.map((item: InventoryItem) => {
                        const status = getStockStatus(item);
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                <p className="text-xs text-gray-500">{item.itemCode}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-600 capitalize">{item.category}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {item.currentStock} {item.unit}
                                </p>
                                <div className="mt-1 w-24 bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full ${
                                      status.color === 'red' ? 'bg-red-500' :
                                      status.color === 'yellow' ? 'bg-yellow-500' :
                                      status.color === 'blue' ? 'bg-blue-500' :
                                      'bg-green-500'
                                    }`}
                                    style={{ width: `${Math.min((item.currentStock / item.maximumStock) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                status.color === 'red' ? 'bg-red-100 text-red-800' :
                                status.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                                status.color === 'blue' ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                              }`}>
                                {status.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{(item as any).location || '-'}</td>
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                              KES {(item.currentStock * item.unitCost).toLocaleString()}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button className="text-indigo-600 hover:text-indigo-900 text-sm">Edit</button>
                                <button className="text-green-600 hover:text-green-900 text-sm">Restock</button>
                                {status.color === 'yellow' || status.color === 'red' ? (
                                  <button className="text-orange-600 hover:text-orange-900 text-sm">Order</button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'movements' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="text-center text-gray-500">
                <Archive className="h-12 w-12 mx-auto mb-4" />
                <p>Stock movement tracking</p>
                <p className="text-sm mt-2">View all inventory movements and transfers</p>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="text-center text-gray-500">
                <Truck className="h-12 w-12 mx-auto mb-4" />
                <p>Purchase order management</p>
                <p className="text-sm mt-2">Create and track purchase orders</p>
              </div>
            </div>
          )}

          {activeTab === 'consumption' && (
            <ConsumptionTracking
              branch="Bomet"
              records={[
                {
                  record_id: '1',
                  branch: 'Bomet',
                  department: 'Bar',
                  item_id: 'BEER-001',
                  quantity: 24,
                  consumption_date: '2025-11-24',
                  recorded_by: 'John Doe',
                  notes: 'Regular stock depletion'
                },
                {
                  record_id: '2',
                  branch: 'Bomet',
                  department: 'Sauna',
                  item_id: 'TOWEL-001',
                  quantity: 50,
                  consumption_date: '2025-11-24',
                  recorded_by: 'Jane Smith',
                  notes: 'Daily towel usage'
                },
                {
                  record_id: '3',
                  branch: 'Bomet',
                  department: 'Rooms',
                  item_id: 'MINI-001',
                  quantity: 12,
                  consumption_date: '2025-11-24',
                  recorded_by: 'James Brown',
                  notes: 'minibar restocking'
                }
              ]}
            />
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
