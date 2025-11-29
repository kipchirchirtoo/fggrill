'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search, Package, Plus, RefreshCw, ArrowLeft, Filter, Phone, Mail,
  Clock, MapPin, DollarSign, User, Camera, CheckCircle, XCircle,
  AlertTriangle, Calendar, Archive, Truck, Eye, Edit
} from 'lucide-react';
import { housekeepingAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

interface LostFoundItem {
  id: string;
  item_number: string;
  item_description: string;
  item_category: string;
  estimated_value?: number;
  is_valuable: boolean;
  found_location: string;
  room_id?: string;
  floor_number?: number;
  photos: string[];
  found_at: string;
  status: 'found' | 'guest_contacted' | 'claimed' | 'shipped' | 'unclaimed' | 'disposed' | 'stored';
  storage_location?: string;
  storage_bin?: string;
  guest_name?: string;
  guest_contact?: string;
  contact_attempts: { date: string; method: string; result: string; notes?: string }[];
  claimed_at?: string;
  retention_end_date?: string;
  found_by_staff?: {
    user: { first_name: string; last_name: string };
  };
}

const ITEM_CATEGORIES = [
  'Electronics', 'Jewelry', 'Clothing', 'Documents', 'Bags/Luggage',
  'Personal Care', 'Toys', 'Books', 'Keys', 'Glasses', 'Chargers/Cables', 'Other'
];

const STATUS_COLORS: Record<string, string> = {
  found: 'bg-blue-100 text-blue-800',
  guest_contacted: 'bg-purple-100 text-purple-800',
  claimed: 'bg-emerald-100 text-emerald-800',
  shipped: 'bg-cyan-100 text-cyan-800',
  unclaimed: 'bg-gray-100 text-gray-800',
  disposed: 'bg-red-100 text-red-800',
  stored: 'bg-amber-100 text-amber-800'
};

export default function LostFoundPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [expiringItems, setExpiringItems] = useState<LostFoundItem[]>([]);
  const [stats, setStats] = useState({
    total: 0, found: 0, claimed: 0, unclaimed: 0, valuable: 0, byCategory: {} as Record<string, number>
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    itemDescription: '',
    itemCategory: 'Other',
    estimatedValue: '',
    isValuable: false,
    foundLocation: '',
    roomId: ''
  });

  // Contact form state
  const [contactForm, setContactForm] = useState({
    method: 'phone',
    result: 'no_answer',
    notes: ''
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [itemsRes, expiringRes, statsRes] = await Promise.all([
        housekeepingAPI.getLostFoundItems().catch(() => ({ data: [] })),
        housekeepingAPI.getExpiringLostFound(14).catch(() => ({ data: [] })),
        housekeepingAPI.getLostFoundStats().catch(() => ({ data: { total: 0, found: 0, claimed: 0, unclaimed: 0, valuable: 0, byCategory: {} } }))
      ]);

      setItems(itemsRes.data || []);
      setExpiringItems(expiringRes.data || []);
      setStats(statsRes.data || { total: 0, found: 0, claimed: 0, unclaimed: 0, valuable: 0, byCategory: {} });
    } catch (error) {
      console.error('Error fetching lost & found data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const createItem = async () => {
    if (!createForm.itemDescription || !createForm.foundLocation) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await housekeepingAPI.createLostFoundItem({
        itemDescription: createForm.itemDescription,
        itemCategory: createForm.itemCategory,
        estimatedValue: createForm.estimatedValue ? parseFloat(createForm.estimatedValue) : undefined,
        isValuable: createForm.isValuable,
        foundLocation: createForm.foundLocation,
        roomId: createForm.roomId || undefined
      });

      toast.success('Item logged successfully');
      setIsCreateModalOpen(false);
      setCreateForm({
        itemDescription: '',
        itemCategory: 'Other',
        estimatedValue: '',
        isValuable: false,
        foundLocation: '',
        roomId: ''
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to log item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateItemStatus = async (id: string, status: string, additionalData?: any) => {
    try {
      await housekeepingAPI.updateLostFoundStatus(id, { status, ...additionalData });
      toast.success('Status updated');
      fetchData();
      setIsDetailModalOpen(false);
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const addContactAttempt = async () => {
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await housekeepingAPI.addContactAttempt(selectedItem.id, contactForm);
      toast.success('Contact attempt logged');
      setIsContactModalOpen(false);
      setContactForm({ method: 'phone', result: 'no_answer', notes: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to log contact attempt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.item_description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.item_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.found_location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || item.item_category === filterCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const viewItemDetails = (item: LostFoundItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const daysUntilExpiry = (date: string) => {
    const diff = new Date(date).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.HOUSEKEEPING]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/housekeeping">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-lg">
                <Package className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Lost & Found</h1>
                <p className="text-gray-600">Track and manage found items</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={fetchData} variant="outline" size="icon">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Log Item
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Search className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold">{stats.found}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Claimed</p>
                  <p className="text-2xl font-bold">{stats.claimed}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <DollarSign className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valuable</p>
                  <p className="text-2xl font-bold">{stats.valuable}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expiring Soon</p>
                  <p className="text-2xl font-bold">{expiringItems.length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Expiring Items Alert */}
          {expiringItems.length > 0 && (
            <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-50">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">
                    {expiringItems.length} item(s) expiring within 14 days
                  </p>
                  <p className="text-sm text-amber-600">
                    Review and take action before retention period ends
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="found">Found</option>
              <option value="guest_contacted">Guest Contacted</option>
              <option value="claimed">Claimed</option>
              <option value="shipped">Shipped</option>
              <option value="stored">Stored</option>
              <option value="disposed">Disposed</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white"
            >
              <option value="all">All Categories</option>
              {ITEM_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => viewItemDetails(item)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_COLORS[item.status]}>
                        {item.status.replace('_', ' ')}
                      </Badge>
                      {item.is_valuable && (
                        <Badge className="bg-amber-100 text-amber-800">Valuable</Badge>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{item.item_number}</span>
                  </div>

                  <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                    {item.item_description}
                  </h3>

                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      <span>{item.item_category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{item.found_location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(item.found_at).toLocaleDateString()}</span>
                    </div>
                    {item.estimated_value && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        <span>${item.estimated_value.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {item.retention_end_date && (
                    <div className="mt-3 pt-3 border-t">
                      <p className={`text-xs ${daysUntilExpiry(item.retention_end_date) <= 7 ? 'text-red-600' : 'text-gray-500'}`}>
                        Retention ends: {new Date(item.retention_end_date).toLocaleDateString()}
                        ({daysUntilExpiry(item.retention_end_date)} days)
                      </p>
                    </div>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No items found matching your criteria</p>
            </div>
          )}

          {/* Create Item Modal */}
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-amber-500" />
                  Log Found Item
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Description *
                  </label>
                  <textarea
                    value={createForm.itemDescription}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, itemDescription: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={2}
                    placeholder="Describe the item (brand, color, condition...)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      value={createForm.itemCategory}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, itemCategory: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg bg-white"
                    >
                      {ITEM_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Value
                    </label>
                    <Input
                      type="number"
                      value={createForm.estimatedValue}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, estimatedValue: e.target.value }))}
                      placeholder="$0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Found Location *
                  </label>
                  <Input
                    value={createForm.foundLocation}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, foundLocation: e.target.value }))}
                    placeholder="e.g., Room 205, Lobby, Restaurant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Room Number (if applicable)
                  </label>
                  <Input
                    value={createForm.roomId}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, roomId: e.target.value }))}
                    placeholder="e.g., 205"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isValuable"
                    checked={createForm.isValuable}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, isValuable: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <label htmlFor="isValuable" className="text-sm text-gray-700">
                    Mark as valuable item (extended retention)
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createItem} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Log Item'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Item Detail Modal */}
          <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-amber-500" />
                  Item Details - {selectedItem?.item_number}
                </DialogTitle>
              </DialogHeader>

              {selectedItem && (
                <div className="space-y-6 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge className={STATUS_COLORS[selectedItem.status]}>
                        {selectedItem.status.replace('_', ' ')}
                      </Badge>
                      {selectedItem.is_valuable && (
                        <Badge className="bg-amber-100 text-amber-800 ml-2">Valuable</Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Description</p>
                      <p className="font-medium">{selectedItem.item_description}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Category</p>
                      <p className="font-medium">{selectedItem.item_category}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Found Location</p>
                      <p className="font-medium">{selectedItem.found_location}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Found Date</p>
                      <p className="font-medium">{new Date(selectedItem.found_at).toLocaleString()}</p>
                    </div>
                    {selectedItem.estimated_value && (
                      <div>
                        <p className="text-sm text-gray-500">Estimated Value</p>
                        <p className="font-medium">${selectedItem.estimated_value.toLocaleString()}</p>
                      </div>
                    )}
                    {selectedItem.storage_location && (
                      <div>
                        <p className="text-sm text-gray-500">Storage Location</p>
                        <p className="font-medium">{selectedItem.storage_location} - Bin {selectedItem.storage_bin}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-500">Found By</p>
                      <p className="font-medium">
                        {selectedItem.found_by_staff?.user.first_name} {selectedItem.found_by_staff?.user.last_name}
                      </p>
                    </div>
                    {selectedItem.retention_end_date && (
                      <div>
                        <p className="text-sm text-gray-500">Retention Ends</p>
                        <p className={`font-medium ${daysUntilExpiry(selectedItem.retention_end_date) <= 7 ? 'text-red-600' : ''}`}>
                          {new Date(selectedItem.retention_end_date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Contact Attempts */}
                  {selectedItem.contact_attempts?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Contact History</h4>
                      <div className="space-y-2">
                        {selectedItem.contact_attempts.map((attempt, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium capitalize">{attempt.method}</span>
                              <span className="text-gray-500">{attempt.date}</span>
                            </div>
                            <p className="text-gray-600 capitalize">{attempt.result.replace('_', ' ')}</p>
                            {attempt.notes && <p className="text-gray-500 mt-1">{attempt.notes}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    {selectedItem.status === 'found' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsContactModalOpen(true)}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Log Contact
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => updateItemStatus(selectedItem.id, 'guest_contacted')}
                        >
                          Guest Contacted
                        </Button>
                      </>
                    )}
                    {selectedItem.status === 'guest_contacted' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsContactModalOpen(true)}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          Log Contact
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => updateItemStatus(selectedItem.id, 'claimed')}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Claimed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateItemStatus(selectedItem.id, 'shipped')}
                        >
                          <Truck className="h-4 w-4 mr-2" />
                          Ship to Guest
                        </Button>
                      </>
                    )}
                    {['found', 'guest_contacted', 'stored'].includes(selectedItem.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateItemStatus(selectedItem.id, 'stored')}
                      >
                        <Archive className="h-4 w-4 mr-2" />
                        Move to Storage
                      </Button>
                    )}
                    {selectedItem.status !== 'claimed' && selectedItem.status !== 'disposed' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateItemStatus(selectedItem.id, 'disposed', {
                          disposalMethod: 'donation',
                          disposalNotes: 'Retention period expired'
                        })}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Dispose
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Contact Attempt Modal */}
          <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Log Contact Attempt</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                  <select
                    value={contactForm.method}
                    onChange={(e) => setContactForm(prev => ({ ...prev, method: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="phone">Phone</option>
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
                  <select
                    value={contactForm.result}
                    onChange={(e) => setContactForm(prev => ({ ...prev, result: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="no_answer">No Answer</option>
                    <option value="left_message">Left Message</option>
                    <option value="contacted">Contacted Successfully</option>
                    <option value="wrong_number">Wrong Number</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={contactForm.notes}
                    onChange={(e) => setContactForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    rows={2}
                    placeholder="Additional notes..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsContactModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={addContactAttempt} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Log Attempt'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
