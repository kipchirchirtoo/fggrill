'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
  Package,
  ClipboardCheck,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  Send
} from 'lucide-react';
import { toast } from 'sonner';
import type { StockItem, BranchStock, StockRequest } from '@/types/inventory.types';

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function BranchInventoryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'stock' | 'requests'>('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [items, setItems] = useState<StockItem[]>([]);
  const [branchStock, setBranchStock] = useState<BranchStock[]>([]);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch stock data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = {
          'Authorization': `Bearer ${token}`
        };

        // Fetch branch stock
        const stockResponse = await fetch(`${API_URL}/api/inventory/branch-stock`, { headers });
        if (!stockResponse.ok) throw new Error('Failed to fetch branch stock');
        const stockData = await stockResponse.json();
        setBranchStock(stockData.data);

        // Fetch items
        const itemsResponse = await fetch(`${API_URL}/api/inventory/items`, { headers });
        if (!itemsResponse.ok) throw new Error('Failed to fetch items');
        const itemsData = await itemsResponse.json();
        setItems(itemsData.data);

        // Fetch requests
        const requestsResponse = await fetch(`${API_URL}/api/inventory/requests`, { headers });
        if (!requestsResponse.ok) throw new Error('Failed to fetch requests');
        const requestsData = await requestsResponse.json();
        setRequests(requestsData.data);

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        toast.error('Failed to load inventory data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calculate statistics
  const stats = {
    totalItems: items.length,
    lowStock: items.filter(item => {
      const stock = branchStock.find(bs => bs.itemId === item.id);
      return stock && stock.currentStock <= item.reorderPoint;
    }).length,
    pendingRequests: requests.filter(r => r.status === 'pending').length,
    totalValue: branchStock.reduce((sum, bs) => {
      const item = items.find(i => i.id === bs.itemId);
      return sum + (item ? item.unitCost * bs.currentStock : 0);
    }, 0)
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Branch Inventory Management</h1>
            <button
              onClick={() => setShowRequestModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Send className="h-4 w-4" />
              New Stock Request
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <Package className="h-8 w-8 text-indigo-600" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.lowStock}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <ClipboardCheck className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Pending Requests</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingRequests}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <Package className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${stats.totalValue.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex gap-6">
              <button
                onClick={() => setActiveTab('stock')}
                className={`pb-4 px-1 ${
                  activeTab === 'stock'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Stock Overview
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`pb-4 px-1 ${
                  activeTab === 'requests'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Stock Requests
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            {/* Search and Filter */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="all">All Categories</option>
                    <option value="food">Food</option>
                    <option value="beverage">Beverage</option>
                    <option value="cleaning">Cleaning</option>
                    <option value="amenities">Amenities</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {activeTab === 'stock' && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items
                      .filter(
                        item =>
                          (filterCategory === 'all' || item.category === filterCategory) &&
                          (searchTerm === '' ||
                            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            item.code.toLowerCase().includes(searchTerm.toLowerCase()))
                      )
                      .map(item => {
                        const stock = branchStock.find(bs => bs.itemId === item.id);
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900">{item.code}</td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                <p className="text-xs text-gray-500">{item.description}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">{item.category}</td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{stock?.currentStock || 0} {item.unit}</p>
                                {stock && stock.currentStock <= item.reorderPoint && (
                                  <p className="text-xs text-red-600">Low Stock</p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  item.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <button className="text-indigo-600 hover:text-indigo-900">Request</button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}

              {activeTab === 'requests' && (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested By</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {requests
                      .filter(
                        request =>
                          searchTerm === '' ||
                          request.requestNumber.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map(request => (
                        <tr key={request.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {request.requestNumber}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                request.status === 'fulfilled'
                                  ? 'bg-green-100 text-green-800'
                                  : request.status === 'approved'
                                  ? 'bg-blue-100 text-blue-800'
                                  : request.status === 'rejected'
                                  ? 'bg-red-100 text-red-800'
                                  : request.status === 'cancelled'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {request.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {request.items.length} items
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{request.requestedBy}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {new Date(request.requestedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <button className="text-indigo-600 hover:text-indigo-900">View</button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* TODO: Add modals for stock requests and request details */}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
