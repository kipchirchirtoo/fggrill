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
import { LifeBuoy, RefreshCw, Plus, Search, Package, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface LostFoundItem {
  id: string;
  item_name: string;
  description: string;
  location_found: string;
  found_by: string;
  found_date: string;
  status: string;
  claimed_by?: string;
  claimed_date?: string;
  category: string;
}

interface Room { id: string; room_number: string; floor: number; }
interface Staff { id: string; name: string; department: string; }

function LostFoundContent() {
  const { activeBranch, activeBranchId } = useBranch();
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState({ status: '', category: '' });
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ item_name: '', description: '', location_found: '', found_by: '', category: 'personal' });

  // Fetch rooms and staff for dropdowns
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [roomsRes, staffRes] = await Promise.all([
          facilitiesAPI.getRooms(activeBranchId),
          facilitiesAPI.getStaffList('housekeeping', activeBranchId)
        ]);
        if (roomsRes.success) setRooms(roomsRes.data || []);
        if (staffRes.success) setStaffList(staffRes.data || []);
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
      }
    };
    if (activeBranchId) fetchDropdownData();
  }, [activeBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_name || !formData.location_found) { toast.error('Please fill required fields'); return; }
    setIsSubmitting(true);
    try {
      const response = await facilitiesAPI.createLostFoundItem({ ...formData, branch_id: activeBranchId, found_date: new Date().toISOString() });
      if (response.success) {
        toast.success('Item logged successfully');
        setShowModal(false);
        setFormData({ item_name: '', description: '', location_found: '', found_by: '', category: 'personal' });
        fetchItems();
      } else { toast.error(response.error || 'Failed to log item'); }
    } catch (error) { toast.error('Failed to log item'); }
    finally { setIsSubmitting(false); }
  };

  useEffect(() => {
    if (activeBranchId) fetchItems();
  }, [activeBranchId]);

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      const response = await facilitiesAPI.getLostFound(activeBranchId);
      if (response.success) {
        setItems(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching lost & found items:', error);
      toast.error('Failed to load lost & found items');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (_status?: string) => 'bg-gray-100 text-gray-700 border border-gray-200';

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'claimed': return <CheckCircle className="h-4 w-4" />;
      case 'unclaimed': return <Clock className="h-4 w-4" />;
      case 'disposed': return <XCircle className="h-4 w-4" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !filter.status || item.status === filter.status;
    const matchesCategory = !filter.category || item.category === filter.category;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))];

  const stats = {
    total: items.length,
    unclaimed: items.filter(i => i.status === 'unclaimed').length,
    claimed: items.filter(i => i.status === 'claimed').length,
    disposed: items.filter(i => i.status === 'disposed').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.FACILITIES_MANAGER, UserRole.HOUSEKEEPING, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout
        title="Lost & Found"
        subtitle={`Lost and found items for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <div className="flex gap-2">
            <IOSButton variant="secondary" onClick={fetchItems} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            <IOSButton variant="primary" onClick={() => setShowModal(true)} leftIcon={<Plus />}>Log Item</IOSButton>
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
              <p className="text-2xl font-bold text-gray-900">{stats.unclaimed}</p>
              <p className="text-sm text-gray-500">Unclaimed</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.claimed}</p>
              <p className="text-sm text-gray-500">Claimed</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.disposed}</p>
              <p className="text-sm text-gray-500">Disposed</p>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Status</option>
                <option value="unclaimed">Unclaimed</option>
                <option value="claimed">Claimed</option>
                <option value="disposed">Disposed</option>
              </select>
              <select
                value={filter.category}
                onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </Card>

          {/* Items List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map(item => (
                <Card key={item.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gray-100 rounded-lg">
                        <LifeBuoy className="h-6 w-6 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{item.item_name}</h3>
                        <p className="text-sm text-gray-500">{item.description}</p>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                          <span>📍 {item.location_found}</span>
                          <span>👤 Found by: {item.found_by}</span>
                          <span>📅 {new Date(item.found_date).toLocaleDateString()}</span>
                        </div>
                        {item.claimed_by && (
                          <p className="text-sm text-gray-600 mt-2">
                            Claimed by: {item.claimed_by} on {new Date(item.claimed_date!).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {getStatusIcon(item.status)}
                        {item.status}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                        {item.category}
                      </span>
                      {item.status === 'unclaimed' && (
                        <IOSButton size="sm" variant="primary" className="mt-2">
                          Mark Claimed
                        </IOSButton>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filteredItems.length === 0 && (
            <Card className="p-12 text-center">
              <LifeBuoy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No items found</h3>
              <p className="text-gray-500">Log a new item or adjust your filters</p>
            </Card>
          )}
        </div>
      <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Log Lost & Found Item</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Item Name *</Label><Input value={formData.item_name} onChange={(e) => setFormData({ ...formData, item_name: e.target.value })} placeholder="e.g., Black Wallet" /></div>
              <div>
                <Label>Location Found *</Label>
                <select value={formData.location_found} onChange={(e) => setFormData({ ...formData, location_found: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">Select location...</option>
                  {rooms.map(room => (
                    <option key={room.id} value={`Room ${room.room_number}`}>Room {room.room_number} - Floor {room.floor}</option>
                  ))}
                  <option value="Lobby">Lobby</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Pool Area">Pool Area</option>
                  <option value="Parking">Parking</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <Label>Category</Label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="personal">Personal Items</option>
                  <option value="electronics">Electronics</option>
                  <option value="clothing">Clothing</option>
                  <option value="jewelry">Jewelry</option>
                  <option value="documents">Documents</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <Label>Found By</Label>
                <select value={formData.found_by} onChange={(e) => setFormData({ ...formData, found_by: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">Select staff member...</option>
                  {staffList.map(staff => (
                    <option key={staff.id} value={staff.id}>{staff.name}</option>
                  ))}
                </select>
              </div>
              <div><Label>Description</Label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Description..." /></div>
              <div className="flex gap-2 justify-end"><IOSButton type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</IOSButton><IOSButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Logging...' : 'Log Item'}</IOSButton></div>
            </form>
          </DialogContent>
        </Dialog>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function LostFoundPage() {
  return (
    <BranchPageWrapper>
      <LostFoundContent />
    </BranchPageWrapper>
  );
}
