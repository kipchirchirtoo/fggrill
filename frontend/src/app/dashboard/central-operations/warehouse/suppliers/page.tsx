'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { toast } from 'sonner';
import { 
  Building2, Search, RefreshCw, PlusCircle, 
  Phone, Mail, MapPin, Package, Edit2, Trash2,
  X, Loader2, Star, CheckCircle2, AlertCircle, User
} from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  category: string;
  status: 'active' | 'inactive';
  rating: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

function SuppliersContent() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formRating, setFormRating] = useState(5);
  const [formNotes, setFormNotes] = useState('');

  const categories = ['Food & Beverages', 'Kitchen Equipment', 'Cleaning Supplies', 'Office Supplies', 'Packaging', 'Other'];

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const response = await fetch(`${API_BASE}/api/central-operations/warehouse/suppliers`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuppliers(data.data || []);
      } else {
        toast.error('Failed to load suppliers');
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const resetForm = () => {
    setFormName('');
    setFormContactPerson('');
    setFormEmail('');
    setFormPhone('');
    setFormAddress('');
    setFormCategory('');
    setFormStatus('active');
    setFormRating(5);
    setFormNotes('');
  };

  const handleAddSupplier = async () => {
    if (!formName || !formContactPerson || !formEmail || !formPhone) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const response = await fetch(`${API_BASE}/api/central-operations/warehouse/suppliers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formName,
          contact_person: formContactPerson,
          email: formEmail,
          phone: formPhone,
          address: formAddress,
          category: formCategory,
          status: formStatus,
          rating: formRating,
          notes: formNotes
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Supplier added successfully');
        setShowAddModal(false);
        resetForm();
        fetchSuppliers();
      } else {
        toast.error(data.message || 'Failed to add supplier');
      }
    } catch (error) {
      console.error('Error adding supplier:', error);
      toast.error('Failed to add supplier');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSupplier = async () => {
    if (!selectedSupplier || !formName || !formContactPerson || !formEmail || !formPhone) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const response = await fetch(`${API_BASE}/api/central-operations/warehouse/suppliers/${selectedSupplier.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formName,
          contact_person: formContactPerson,
          email: formEmail,
          phone: formPhone,
          address: formAddress,
          category: formCategory,
          status: formStatus,
          rating: formRating,
          notes: formNotes
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Supplier updated successfully');
        setShowEditModal(false);
        resetForm();
        setSelectedSupplier(null);
        fetchSuppliers();
      } else {
        toast.error(data.message || 'Failed to update supplier');
      }
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast.error('Failed to update supplier');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!selectedSupplier) return;
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const response = await fetch(`${API_BASE}/api/central-operations/warehouse/suppliers/${selectedSupplier.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Supplier deleted successfully');
        setShowDeleteModal(false);
        setSelectedSupplier(null);
        fetchSuppliers();
      } else {
        toast.error(data.message || 'Failed to delete supplier');
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast.error('Failed to delete supplier');
    } finally {
      setActionLoading(false);
    }
  };

  const openEditModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setFormName(supplier.name);
    setFormContactPerson(supplier.contact_person);
    setFormEmail(supplier.email);
    setFormPhone(supplier.phone);
    setFormAddress(supplier.address);
    setFormCategory(supplier.category);
    setFormStatus(supplier.status);
    setFormRating(supplier.rating);
    setFormNotes(supplier.notes);
    setShowEditModal(true);
  };

  const openDeleteModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setShowDeleteModal(true);
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = searchQuery === '' || 
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.contact_person.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || supplier.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const stats = {
    total: suppliers.length,
    active: suppliers.filter(s => s.status === 'active').length,
    inactive: suppliers.filter(s => s.status === 'inactive').length,
    avgRating: suppliers.length > 0 
      ? (suppliers.reduce((sum, s) => sum + s.rating, 0) / suppliers.length).toFixed(1)
      : '0'
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'text-gray-400 fill-gray-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.CENTRAL_OPERATIONS_MANAGER,
      UserRole.CENTRAL_STOREKEEPER
    ]}>
      <BranchAwareDashboardLayout
        title="Supplier Management"
        subtitle="Manage your suppliers and vendors"
        requireBranchContext={false}
        actionButton={
          <div className="flex space-x-2">
            <IOSButton 
              variant="secondary" 
              onClick={fetchSuppliers}
              disabled={isLoading}
              leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </IOSButton>
            <IOSButton 
              variant="primary" 
              onClick={() => { resetForm(); setShowAddModal(true); }}
              leftIcon={<PlusCircle className="h-4 w-4" />}
            >
              Add Supplier
            </IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Suppliers</p>
                  <p className="text-lg font-semibold">{stats.total}</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-lg font-semibold">{stats.active}</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Inactive</p>
                  <p className="text-lg font-semibold">{stats.inactive}</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Star className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg Rating</p>
                  <p className="text-lg font-semibold">{stats.avgRating}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Search and Filter */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex space-x-4">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-ios-lg text-sm appearance-none bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-200 rounded-ios-lg text-sm appearance-none bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </IOSCard>

          {/* Suppliers List */}
          <IOSCard className="overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-16 w-16 text-gray-200 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Suppliers Found</h3>
                <p className="text-gray-500 text-center max-w-md mb-6">
                  {suppliers.length === 0 
                    ? 'Add your first supplier to start managing your vendor relationships.'
                    : 'No suppliers match your current filters.'}
                </p>
                <IOSButton 
                  variant="primary"
                  onClick={() => { resetForm(); setShowAddModal(true); }}
                  leftIcon={<PlusCircle className="h-4 w-4" />}
                >
                  Add Supplier
                </IOSButton>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredSuppliers.map((supplier) => (
                  <div 
                    key={supplier.id}
                    className="p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="p-2 bg-gray-50 rounded-lg">
                          <Building2 className="h-6 w-6 text-gray-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold">{supplier.name}</span>
                            <IOSBadge variant={supplier.status === 'active' ? 'success' : 'secondary'}>
                              {supplier.status}
                            </IOSBadge>
                          </div>
                          <div className="mt-1 space-y-1 text-sm text-gray-500">
                            <div className="flex items-center">
                              <User className="h-3 w-3 mr-2" />
                              {supplier.contact_person}
                            </div>
                            <div className="flex items-center">
                              <Mail className="h-3 w-3 mr-2" />
                              {supplier.email}
                            </div>
                            <div className="flex items-center">
                              <Phone className="h-3 w-3 mr-2" />
                              {supplier.phone}
                            </div>
                            {supplier.address && (
                              <div className="flex items-center">
                                <MapPin className="h-3 w-3 mr-2" />
                                {supplier.address}
                              </div>
                            )}
                          </div>
                          <div className="mt-2 flex items-center space-x-4">
                            {supplier.category && (
                              <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {supplier.category}
                              </span>
                            )}
                            {renderStars(supplier.rating)}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <IOSButton 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openEditModal(supplier)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </IOSButton>
                        <IOSButton 
                          variant="ghost" 
                          size="sm"
                          onClick={() => openDeleteModal(supplier)}
                          className="text-gray-500 hover:bg-gray-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </IOSButton>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </IOSCard>
        </div>

        {/* Add Supplier Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-ios-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Add New Supplier</h2>
                  <IOSButton variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
                    <X className="h-5 w-5" />
                  </IOSButton>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name*</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g., ABC Supplies Ltd"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person*</label>
                    <input
                      type="text"
                      value={formContactPerson}
                      onChange={(e) => setFormContactPerson(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="e.g., John Smith"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email*</label>
                      <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone*</label>
                      <input
                        type="tel"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="+254 700 000 000"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Street address, City"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select category</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as 'active' | 'inactive')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                    <div className="flex items-center space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormRating(star)}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-6 w-6 ${star <= formRating ? 'text-gray-400 fill-gray-400' : 'text-gray-300'}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={3}
                      placeholder="Additional notes about this supplier..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <IOSButton variant="secondary" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </IOSButton>
                  <IOSButton 
                    variant="primary" 
                    onClick={handleAddSupplier}
                    disabled={actionLoading}
                    leftIcon={actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                  >
                    {actionLoading ? 'Adding...' : 'Add Supplier'}
                  </IOSButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Supplier Modal */}
        {showEditModal && selectedSupplier && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-ios-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">Edit Supplier</h2>
                  <IOSButton variant="ghost" size="sm" onClick={() => setShowEditModal(false)}>
                    <X className="h-5 w-5" />
                  </IOSButton>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name*</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person*</label>
                    <input
                      type="text"
                      value={formContactPerson}
                      onChange={(e) => setFormContactPerson(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email*</label>
                      <input
                        type="email"
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone*</label>
                      <input
                        type="tel"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select category</option>
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as 'active' | 'inactive')}
                        className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                    <div className="flex items-center space-x-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setFormRating(star)}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-6 w-6 ${star <= formRating ? 'text-gray-400 fill-gray-400' : 'text-gray-300'}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <IOSButton variant="secondary" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </IOSButton>
                  <IOSButton 
                    variant="primary" 
                    onClick={handleEditSupplier}
                    disabled={actionLoading}
                    leftIcon={actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit2 className="h-4 w-4" />}
                  >
                    {actionLoading ? 'Saving...' : 'Save Changes'}
                  </IOSButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedSupplier && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-ios-lg w-full max-w-md">
              <div className="p-6 space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-full">
                    <Trash2 className="h-6 w-6 text-gray-600" />
                  </div>
                  <h2 className="text-xl font-bold">Delete Supplier</h2>
                </div>
                
                <p className="text-gray-600">
                  Are you sure you want to delete <strong>{selectedSupplier.name}</strong>? This action cannot be undone.
                </p>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                  <IOSButton variant="secondary" onClick={() => setShowDeleteModal(false)}>
                    Cancel
                  </IOSButton>
                  <IOSButton 
                    variant="destructive" 
                    onClick={handleDeleteSupplier}
                    disabled={actionLoading}
                    leftIcon={actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  >
                    {actionLoading ? 'Deleting...' : 'Delete'}
                  </IOSButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

// Wrap with BranchPageWrapper to prevent hydration errors
export default function SuppliersPage() {
  return (
    <BranchPageWrapper>
      <SuppliersContent />
    </BranchPageWrapper>
  );
}
