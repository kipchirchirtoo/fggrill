'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { 
  Search, RefreshCw, Plus, Package, MapPin, Calendar, User,
  CheckCircle, Clock, XCircle, Phone, Eye
} from 'lucide-react';
import { housekeepingAPI } from '@/lib/api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface LostFoundItem {
  id: string;
  item_name: string;
  description: string;
  category: string;
  found_location: string;
  found_date: string;
  found_by: string;
  status: 'stored' | 'claimed' | 'disposed';
  claimed_by?: string;
  claimed_date?: string;
  storage_location?: string;
  photo_url?: string;
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  stored: { label: 'Stored', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  claimed: { label: 'Claimed', color: 'text-green-700', bgColor: 'bg-green-100' },
  disposed: { label: 'Disposed', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

const categories = ['Electronics', 'Clothing', 'Jewelry', 'Documents', 'Bags', 'Other'];

export default function LostFoundPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);
  const [newItem, setNewItem] = useState({
    item_name: '',
    description: '',
    category: 'Other',
    found_location: '',
    storage_location: '',
  });
  const [claimInfo, setClaimInfo] = useState({ name: '', phone: '', id_number: '' });

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const response = await housekeepingAPI.getLostFoundItems();
      if (response.success) {
        setItems(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesSearch = 
      item.item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.found_location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleAddItem = async () => {
    if (!newItem.item_name || !newItem.found_location) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      const response = await housekeepingAPI.createLostFoundItem({
        ...newItem,
        found_by: user?.email || 'Staff',
      });
      
      if (response.success) {
        toast.success('Item logged successfully');
        setAddModalOpen(false);
        setNewItem({ item_name: '', description: '', category: 'Other', found_location: '', storage_location: '' });
        fetchItems();
      } else {
        toast.error(response.message || 'Failed to log item');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to log item');
    }
  };

  const handleClaim = async () => {
    if (!selectedItem || !claimInfo.name || !claimInfo.phone) {
      toast.error('Please fill claim information');
      return;
    }

    try {
      const response = await housekeepingAPI.updateLostFoundStatus(selectedItem.id, {
        status: 'claimed',
        claimed_by: claimInfo.name,
        claimed_phone: claimInfo.phone,
        claimed_id: claimInfo.id_number,
      });
      
      if (response.success) {
        toast.success('Item marked as claimed');
        setClaimModalOpen(false);
        setClaimInfo({ name: '', phone: '', id_number: '' });
        setSelectedItem(null);
        fetchItems();
      } else {
        toast.error(response.message || 'Failed to update item');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
    }
  };

  const stats = {
    total: items.length,
    stored: items.filter(i => i.status === 'stored').length,
    claimed: items.filter(i => i.status === 'claimed').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING, UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Lost & Found</h1>
              <p className="text-gray-500">Track and manage found items</p>
            </div>
            <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>
              Log Found Item
            </IOSButton>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">In Storage</p>
              <p className="text-2xl font-bold">{stats.stored}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Claimed</p>
              <p className="text-2xl font-bold">{stats.claimed}</p>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input
                  placeholder="Search items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'stored', 'claimed'].map((status) => (
                  <IOSButton
                    key={status}
                    variant={statusFilter === status ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {/* Items List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No items found</p>
            </IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const statusInfo = statusConfig[item.status];

                return (
                  <IOSCard key={item.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-ios-lg flex items-center justify-center">
                          <Package className="h-8 w-8 text-gray-400" />
                        </div>
                        <div>
                          <p className="font-bold">{item.item_name}</p>
                          <p className="text-sm text-gray-500">{item.description}</p>
                          <div className="flex gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {item.found_location}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" /> {new Date(item.found_date).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {item.found_by}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </IOSBadge>
                        {item.status === 'stored' && (
                          <IOSButton
                            size="sm"
                            onClick={() => {
                              setSelectedItem(item);
                              setClaimModalOpen(true);
                            }}
                          >
                            Mark Claimed
                          </IOSButton>
                        )}
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Item Modal */}
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log Found Item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium">Item Name *</label>
                <Input
                  value={newItem.item_name}
                  onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                  placeholder="e.g., Black iPhone"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="w-full p-2 border rounded-ios-lg"
                  rows={2}
                  placeholder="Detailed description..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="w-full p-2 border rounded-ios-lg"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Found Location *</label>
                <Input
                  value={newItem.found_location}
                  onChange={(e) => setNewItem({ ...newItem, found_location: e.target.value })}
                  placeholder="e.g., Room 205, Restaurant"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Storage Location</label>
                <Input
                  value={newItem.storage_location}
                  onChange={(e) => setNewItem({ ...newItem, storage_location: e.target.value })}
                  placeholder="e.g., Cabinet A, Safe Box 1"
                />
              </div>
              <div className="flex gap-3">
                <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">
                  Cancel
                </IOSButton>
                <IOSButton onClick={handleAddItem} className="flex-1">
                  Log Item
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Claim Modal */}
        <Dialog open={claimModalOpen} onOpenChange={setClaimModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Mark Item as Claimed</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4 mt-4">
                <div className="p-3 bg-gray-50 rounded-ios-lg">
                  <p className="font-bold">{selectedItem.item_name}</p>
                  <p className="text-sm text-gray-500">{selectedItem.description}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Claimant Name *</label>
                  <Input
                    value={claimInfo.name}
                    onChange={(e) => setClaimInfo({ ...claimInfo, name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone Number *</label>
                  <Input
                    value={claimInfo.phone}
                    onChange={(e) => setClaimInfo({ ...claimInfo, phone: e.target.value })}
                    placeholder="+254..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">ID Number</label>
                  <Input
                    value={claimInfo.id_number}
                    onChange={(e) => setClaimInfo({ ...claimInfo, id_number: e.target.value })}
                    placeholder="National ID / Passport"
                  />
                </div>
                <div className="flex gap-3">
                  <IOSButton variant="secondary" onClick={() => setClaimModalOpen(false)} className="flex-1">
                    Cancel
                  </IOSButton>
                  <IOSButton onClick={handleClaim} className="flex-1">
                    Confirm Claim
                  </IOSButton>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
