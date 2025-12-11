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
import { Home, RefreshCw, Plus, Search, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface Asset {
  id: string;
  name: string;
  description: string;
  category: string;
  location: string;
  serial_number: string;
  purchase_date: string;
  warranty_expiry: string;
  status: string;
  last_maintenance_date: string;
  next_maintenance_date: string;
}

interface Room { id: string; room_number: string; floor: number; }

function AssetsContent() {
  const { activeBranch, activeBranchId } = useBranch();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState({ category: '', status: '' });
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '', category: 'hvac', location: '', serial_number: '' });

  // Fetch rooms for dropdown
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await facilitiesAPI.getRooms(activeBranchId);
        if (res.success) setRooms(res.data || []);
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    };
    if (activeBranchId) fetchRooms();
  }, [activeBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.location) { toast.error('Please fill required fields'); return; }
    setIsSubmitting(true);
    try {
      const response = await facilitiesAPI.createAsset({ ...formData, branch_id: activeBranchId });
      if (response.success) {
        toast.success('Asset added successfully');
        setShowModal(false);
        setFormData({ name: '', description: '', category: 'hvac', location: '', serial_number: '' });
        fetchAssets();
      } else { toast.error(response.error || 'Failed to add asset'); }
    } catch (error) { toast.error('Failed to add asset'); }
    finally { setIsSubmitting(false); }
  };

  useEffect(() => {
    if (activeBranchId) fetchAssets();
  }, [activeBranchId]);

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      const response = await facilitiesAPI.getAssets(activeBranchId);
      if (response.success) {
        setAssets(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      toast.error('Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (_status?: string) => 'bg-gray-100 text-gray-700 border border-gray-200';

  const getStatusIcon = (_status?: string) => <CheckCircle className="h-4 w-4 text-gray-600" />;

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filter.category || asset.category === filter.category;
    const matchesStatus = !filter.status || asset.status === filter.status;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = [...new Set(assets.map(a => a.category).filter(Boolean))];

  const stats = {
    total: assets.length,
    operational: assets.filter(a => a.status === 'operational' || a.status === 'active').length,
    maintenance: assets.filter(a => a.status === 'maintenance').length,
    outOfService: assets.filter(a => a.status === 'out_of_service' || a.status === 'inactive').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.FACILITIES_MANAGER, UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout
        title="Asset Management"
        subtitle={`Equipment and assets for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <div className="flex gap-2">
            <IOSButton variant="secondary" onClick={fetchAssets} leftIcon={<RefreshCw />}>Refresh</IOSButton>
            <IOSButton variant="primary" onClick={() => setShowModal(true)} leftIcon={<Plus />}>Add Asset</IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Assets</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.operational}</p>
              <p className="text-sm text-gray-500">Operational</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.maintenance}</p>
              <p className="text-sm text-gray-500">In Maintenance</p>
            </Card>
            <Card className="p-4 text-center border">
              <p className="text-2xl font-bold text-gray-900">{stats.outOfService}</p>
              <p className="text-sm text-gray-500">Out of Service</p>
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
                    placeholder="Search assets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>
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
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Status</option>
                <option value="operational">Operational</option>
                <option value="maintenance">In Maintenance</option>
                <option value="out_of_service">Out of Service</option>
              </select>
            </div>
          </Card>

          {/* Assets Grid */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map(asset => (
                <Card key={asset.id} className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Home className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{asset.name}</h3>
                        <p className="text-sm text-gray-500">{asset.category}</p>
                      </div>
                    </div>
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(asset.status)}`}>
                      {getStatusIcon(asset.status)}
                      {asset.status?.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Location:</span>
                      <span className="text-gray-900">{asset.location || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Serial #:</span>
                      <span className="text-gray-900 font-mono text-xs">{asset.serial_number || 'N/A'}</span>
                    </div>
                    {asset.next_maintenance_date && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Next Maintenance:</span>
                        <span className="text-gray-900">{new Date(asset.next_maintenance_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {asset.warranty_expiry && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Warranty:</span>
                        <span className="text-gray-900">
                          {new Date(asset.warranty_expiry).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filteredAssets.length === 0 && (
            <Card className="p-12 text-center">
              <Home className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No assets found</h3>
              <p className="text-gray-500">Add new assets or adjust your filters</p>
            </Card>
          )}
        </div>
      <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add New Asset</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><Label>Asset Name *</Label><Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., AC Unit" /></div>
              <div>
                <Label>Location *</Label>
                <select value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="">Select location...</option>
                  {rooms.map(room => (
                    <option key={room.id} value={`Room ${room.room_number}`}>Room {room.room_number} - Floor {room.floor}</option>
                  ))}
                  <option value="Lobby">Lobby</option>
                  <option value="Kitchen">Kitchen</option>
                  <option value="Restaurant">Restaurant</option>
                  <option value="Pool Area">Pool Area</option>
                  <option value="Parking">Parking</option>
                  <option value="Maintenance Room">Maintenance Room</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <Label>Category</Label>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg bg-white">
                  <option value="hvac">HVAC</option>
                  <option value="electrical">Electrical</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="appliance">Appliance</option>
                  <option value="furniture">Furniture</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div><Label>Serial Number</Label><Input value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} placeholder="Serial number" /></div>
              <div><Label>Description</Label><textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg" rows={2} placeholder="Description..." /></div>
              <div className="flex gap-2 justify-end"><IOSButton type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</IOSButton><IOSButton type="submit" disabled={isSubmitting}>{isSubmitting ? 'Adding...' : 'Add Asset'}</IOSButton></div>
            </form>
          </DialogContent>
        </Dialog>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function AssetsPage() {
  return (
    <BranchPageWrapper>
      <AssetsContent />
    </BranchPageWrapper>
  );
}
