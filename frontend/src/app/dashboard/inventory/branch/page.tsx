'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
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
import { branchOperationsAPI } from '@/lib/branch-api';
import { IOSButton } from '@/components/ui/ios-button';

function BranchInventoryPageContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
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
      if (!activeBranchId) return;
      
      try {
        // Fetch branch inventory
        const inventoryResponse = await branchOperationsAPI.getInventory({}, activeBranchId);
        if (inventoryResponse.success) {
          setItems(inventoryResponse.data || []);
        } else {
          throw new Error(inventoryResponse.message || 'Failed to fetch inventory');
        }
        
        // Fetch branch stock requests
        const requestsResponse = await branchOperationsAPI.getStockRequests(undefined, activeBranchId);
        if (requestsResponse.success) {
          setRequests(requestsResponse.data || []);
        } else {
          throw new Error(requestsResponse.message || 'Failed to fetch stock requests');
        }
        
        // Set branch stock from inventory data
        // This is simulating the branch stock from inventory items until we have a separate endpoint
        if (inventoryResponse.data) {
          const stockData = inventoryResponse.data.map((item: any) => ({
            id: item.id,
            itemId: item.id,
            currentStock: item.quantity || 0
          }));
          setBranchStock(stockData);
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        toast.error('Failed to load inventory data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [activeBranchId]);

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
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Branch Inventory Management</h1>
            <IOSButton
              onClick={() => setShowRequestModal(true)}
              leftIcon={<Send className="h-4 w-4" />}
              variant="primary"
            >
              New Stock Request
            </IOSButton>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <Package className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <AlertTriangle className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.lowStock}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <ClipboardCheck className="h-8 w-8 text-[#3C3C43]" />
                <div>
                  <p className="text-sm font-medium text-gray-500">Pending Requests</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingRequests}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] p-6 border border-gray-100">
              <div className="flex items-center gap-4">
                <Package className="h-8 w-8 text-[#3C3C43]" />
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
          <div className="border-b border-[#E5E5EA]">
            <nav className="-mb-px flex gap-6">
              <button
                onClick={() => setActiveTab('stock')}
                className={`pb-4 px-1 ${
                  activeTab === 'stock'
                    ? 'border-b-2 border-[rgba(60,60,67,0.12)] text-[#3C3C43]'
                    : 'text-gray-500 hover:text-gray-700 hover:border-[#E5E5EA]'
                }`}
              >
                Stock Overview
              </button>
              <button
                onClick={() => setActiveTab('requests')}
                className={`pb-4 px-1 ${
                  activeTab === 'requests'
                    ? 'border-b-2 border-[rgba(60,60,67,0.12)] text-[#3C3C43]'
                    : 'text-gray-500 hover:text-gray-700 hover:border-[#E5E5EA]'
                }`}
              >
                Stock Requests
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="bg-[#FFFFFF] rounded-xl shadow-none 0_1px_3px_rgba(0,0,0,0.04)] border border-gray-100">
            {/* Search and Filter */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-[#E5E5EA] rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="pl-9 pr-8 py-2 border border-[#E5E5EA] rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent appearance-none bg-[#FFFFFF]"
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
                                  <p className="text-xs text-[#3C3C43]">Low Stock</p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  item.status === 'active'
                                    ? 'bg-[#F2F2F7] text-[#000000]'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <button className="text-[#3C3C43] hover:text-[#3C3C43]">Request</button>
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
                                  ? 'bg-[#F2F2F7] text-[#000000]'
                                  : request.status === 'approved'
                                  ? 'bg-[#F2F2F7] text-[#000000]'
                                  : request.status === 'rejected'
                                  ? 'bg-[#F2F2F7] text-[#000000]'
                                  : request.status === 'cancelled'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-[#F2F2F7] text-[#3C3C43]'
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
                            <button className="text-[#3C3C43] hover:text-[#3C3C43]">View</button>
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

// Wrap with BranchPageWrapper to prevent hydration errors
export default function BranchInventoryPage() {
  return (
    <BranchPageWrapper>
      <BranchInventoryPageContent />
    </BranchPageWrapper>
  );
}
