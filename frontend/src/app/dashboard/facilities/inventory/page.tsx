'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { Card } from '@/components/ui/minimal/card';
import { IOSButton } from '@/components/ui/ios-button';
import { facilitiesAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { Package, RefreshCw, Plus, Search, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface SupplyItem {
  id: string;
  name: string;
  description: string;
  unit: string;
  minimum_stock: number;
  current_stock: number;
  status: string;
  category_name: string;
  category_id: string;
  last_ordered_at: string;
}

interface Supply { id: string; name: string; current_stock: number; minimum_stock: number; category_name: string; }

function InventoryContent() {
  const { activeBranch, activeBranchId } = useBranch();
  const [inventory, setInventory] = useState<SupplyItem[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState({ category: '', status: '' });
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ supply_id: '', quantity: 10, notes: '', urgency: 'normal' });

  // Fetch supplies for dropdown
  useEffect(() => {
    const fetchSupplies = async () => {
      try {
        const res = await facilitiesAPI.getSuppliesList(activeBranchId);
        if (res.success) setSupplies(res.data || []);
      } catch (error) {
        console.error('Error fetching supplies:', error);
      }
    };
    fetchSupplies();
  }, [activeBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supply_id || formData.quantity <= 0) { toast.error('Please select a supply item'); return; }
    setIsSubmitting(true);
    try {
      const response = await facilitiesAPI.requestSupplies({ 
        supply_id: formData.supply_id,
        quantity: formData.quantity,
        urgency: formData.urgency,
        notes: formData.notes,
        branch_id: activeBranchId 
      });
      if (response.success) {
        toast.success('Supply request submitted successfully');
        setShowModal(false);
        setFormData({ supply_id: '', quantity: 10, notes: '', urgency: 'normal' });
        fetchInventory();
      } else { toast.error(response.error || 'Failed to submit request'); }
    } catch (error) { toast.error('Failed to submit request'); }
    finally { setIsSubmitting(false); }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const response = await facilitiesAPI.getInventory(activeBranchId);
      if (response.success) {
        setInventory(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (_status?: string) => 'bg-gray-100 text-gray-700 border border-gray-200';

  const getStockIndicator = (_current?: number, _minimum?: number) => {
    return { icon: TrendingUp, color: 'text-gray-600' };
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filter.category || item.category_id === filter.category;
    const matchesStatus = !filter.status || item.status === filter.status;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = [...new Set(inventory.map(i => ({ id: i.category_id, name: i.category_name })))];
  const uniqueCategories = categories.filter((cat, index, self) => 
    index === self.findIndex(c => c.id === cat.id)
  );

  const stats = {
    total: inventory.length,
    sufficient: inventory.filter(i => i.status === 'sufficient').length,
    low: inventory.filter(i => i.status === 'low').length,
    critical: inventory.filter(i => i.status === 'critical' || i.status === 'out_of_stock').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.FACILITIES_MANAGER, UserRole.HOUSEKEEPING, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout
        title="Supplies Inventory"
        subtitle="Manage housekeeping and maintenance supplies"
        actionButton={
          <div className="flex gap-2">
            <IOSButton variant="secondary" onClick={fetchInventory} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            <IOSButton variant="primary" onClick={() => setShowModal(true)} leftIcon={<Plus />}>Request Supplies</IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Items</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.sufficient}</p>
              <p className="text-sm text-gray-500">Sufficient</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.low}</p>
              <p className="text-sm text-gray-500">Low Stock</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.critical}</p>
              <p className="text-sm text-gray-500">Critical</p>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search supplies..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <select
                value={filter.category}
                onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Status</option>
                <option value="sufficient">Sufficient</option>
                <option value="low">Low</option>
                <option value="critical">Critical</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </Card>

          {/* Inventory List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Item</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Category</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Current Stock</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Min. Stock</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map(item => {
                    const indicator = getStockIndicator(item.current_stock, item.minimum_stock);
                    const Icon = indicator.icon;
                    return (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <Package className="h-5 w-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              {item.description && (
                                <p className="text-sm text-gray-500">{item.description}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-600">{item.category_name}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Icon className={`h-4 w-4 ${indicator.color}`} />
                            <span className="font-medium">{item.current_stock}</span>
                            <span className="text-gray-400">{item.unit}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center text-gray-600">
                          {item.minimum_stock} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                            {item.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <IOSButton size="sm" variant="secondary">
                            Request
                          </IOSButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && filteredInventory.length === 0 && (
            <Card className="p-12 text-center">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No supplies found</h3>
              <p className="text-gray-500">Add new supplies or adjust your filters</p>
            </Card>
          )}
        </div>
      <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Request Supplies</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Supply Item *</Label>
                <select value={formData.supply_id} onChange={(e) => setFormData({ ...formData, supply_id: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">Select a supply item...</option>
                  {supplies.map(supply => (
                    <option key={supply.id} value={supply.id}>{supply.name} (Stock: {supply.current_stock})</option>
                  ))}
                </select>
              </div>
              <div><Label>Quantity *</Label><Input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })} /></div>
              <div>
                <Label>Urgency</Label>
                <select value={formData.urgency} onChange={(e) => setFormData({ ...formData, urgency: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div><Label>Notes</Label><textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Additional notes..." /></div>
              <div className="flex gap-2 justify-end"><IOSButton type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</IOSButton><IOSButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : 'Submit Request'}</IOSButton></div>
            </form>
          </DialogContent>
        </Dialog>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function InventoryPage() {
  return (
    <BranchPageWrapper>
      <InventoryContent />
    </BranchPageWrapper>
  );
}
