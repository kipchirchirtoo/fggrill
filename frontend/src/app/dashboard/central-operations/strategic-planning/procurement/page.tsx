'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ShoppingCart, Plus, RefreshCw, Loader2, Clock, CheckCircle, Package, Edit2, Trash2, Eye, XCircle, Send } from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface ProcurementRequest {
  id: number;
  request_number: string;
  branch_id: number;
  branch_name: string;
  category: string;
  title: string;
  description: string;
  items: any[];
  total_amount: number;
  priority: string;
  status: string;
  requested_by_name: string;
  approved_by_name: string;
  requested_date: string;
  required_date: string;
  notes: string;
  created_at: string;
}

interface Vendor { id: number; name: string; contact_person: string; email: string; phone: string; category: string; is_preferred: boolean; }

function ProcurementContent() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [summary, setSummary] = useState({ pending_count: 0, approved_count: 0, pending_amount: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ProcurementRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewRequest, setViewRequest] = useState<ProcurementRequest | null>(null);
  const [formData, setFormData] = useState({
    category: '',
    title: '',
    description: '',
    total_amount: '',
    priority: 'medium',
    required_date: '',
    notes: ''
  });

  const fetchProcurement = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/central-operations/strategic-planning/procurement`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data.data?.requests) ? data.data.requests : []);
        setVendors(Array.isArray(data.data?.vendors) ? data.data.vendors : []);
        setSummary(data.data?.summary || { pending_count: 0, approved_count: 0, pending_amount: 0 });
      }
    } catch (error) { 
      console.error('Error:', error); 
      toast.error('Failed to load procurement requests'); 
    } finally { 
      setIsLoading(false); 
    }
  }, []);

  useEffect(() => { fetchProcurement(); }, [fetchProcurement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const url = editingRequest 
        ? `${API_BASE}/api/central-operations/strategic-planning/procurement/${editingRequest.id}`
        : `${API_BASE}/api/central-operations/strategic-planning/procurement`;
      const method = editingRequest ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          total_amount: parseFloat(formData.total_amount) || 0 
        })
      });
      
      if (res.ok) { 
        toast.success(editingRequest ? 'Request updated' : 'Request created'); 
        setShowForm(false);
        setEditingRequest(null);
        resetForm();
        fetchProcurement(); 
      } else { 
        toast.error('Failed to save request'); 
      }
    } catch (error) { 
      console.error('Error:', error); 
      toast.error('Failed to save request'); 
    }
  };

  const handleEdit = (request: ProcurementRequest) => {
    setEditingRequest(request);
    setFormData({
      category: request.category,
      title: request.title,
      description: request.description || '',
      total_amount: request.total_amount?.toString() || '',
      priority: request.priority,
      required_date: request.required_date?.split('T')[0] || '',
      notes: request.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this request?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/central-operations/strategic-planning/procurement/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Request deleted');
        fetchProcurement();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to delete request');
    }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/central-operations/strategic-planning/procurement/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        toast.success(`Request ${status}`);
        fetchProcurement();
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      category: '',
      title: '',
      description: '',
      total_amount: '',
      priority: 'medium',
      required_date: '',
      notes: ''
    });
  };

  const filteredRequests = requests.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterPriority && r.priority !== filterPriority) return false;
    if (searchTerm && !r.title?.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !r.request_number?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const categories = ['Equipment', 'Supplies', 'Food & Beverage', 'Maintenance', 'IT', 'Furniture', 'Other'];
  const priorities = ['low', 'medium', 'high', 'urgent'];
  const statuses = ['pending', 'under_review', 'approved', 'rejected', 'ordered', 'received', 'cancelled'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-gray-100 text-gray-700';
      case 'pending': return 'bg-gray-100 text-gray-700';
      case 'under_review': return 'bg-gray-100 text-gray-700';
      case 'rejected': return 'bg-gray-100 text-gray-700';
      case 'ordered': return 'bg-gray-100 text-gray-700';
      case 'received': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-gray-100 text-gray-700';
      case 'high': return 'bg-gray-100 text-gray-700';
      case 'medium': return 'bg-gray-100 text-gray-700';
      case 'low': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CENTRAL_OPERATIONS_MANAGER, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Procurement Management</h1>
              <p className="text-gray-500">Manage procurement requests and vendor relationships</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchProcurement} disabled={isLoading} leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}>
                Refresh
              </IOSButton>
              <IOSButton variant="primary" onClick={() => { resetForm(); setEditingRequest(null); setShowForm(true); }} leftIcon={<Plus className="h-4 w-4" />}>
                New Request
              </IOSButton>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <Clock className="h-6 w-6 text-gray-500 mb-2" />
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-xl font-bold text-gray-600">{summary.pending_count || 0}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <CheckCircle className="h-6 w-6 text-gray-500 mb-2" />
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-xl font-bold text-gray-600">{summary.approved_count || 0}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <ShoppingCart className="h-6 w-6 text-gray-500 mb-2" />
              <p className="text-sm text-gray-500">Pending Amount</p>
              <p className="text-xl font-bold text-gray-600">KES {parseFloat(summary.pending_amount?.toString() || '0').toLocaleString()}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <Package className="h-6 w-6 text-gray-500 mb-2" />
              <p className="text-sm text-gray-500">Vendors</p>
              <p className="text-xl font-bold text-gray-600">{vendors.length}</p>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Search</label>
                <Input 
                  placeholder="Search requests..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-48"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700">
                  <option value="">All Statuses</option>
                  {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ').charAt(0).toUpperCase() + s.replace('_', ' ').slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700">
                  <option value="">All Priorities</option>
                  {priorities.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
            </div>
          </IOSCard>

          {/* Add/Edit Form */}
          {showForm && (
            <IOSCard className="p-4">
              <h3 className="font-semibold text-lg mb-4">{editingRequest ? 'Edit Request' : 'Create Procurement Request'}</h3>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Request title" required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category *</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" required>
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Priority *</label>
                  <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700">
                    {priorities.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Total Amount (KES) *</label>
                  <Input type="number" value={formData.total_amount} onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Required Date</label>
                  <Input type="date" value={formData.required_date} onChange={(e) => setFormData({ ...formData, required_date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes" />
                </div>
                <div className="flex items-end gap-2">
                  <IOSButton type="submit" variant="primary">{editingRequest ? 'Update' : 'Submit Request'}</IOSButton>
                  <IOSButton type="button" variant="secondary" onClick={() => { setShowForm(false); setEditingRequest(null); }}>Cancel</IOSButton>
                </div>
              </form>
            </IOSCard>
          )}

          {/* Requests Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
          ) : filteredRequests.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <ShoppingCart className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No procurement requests found. Create your first request to get started.</p>
            </IOSCard>
          ) : (
            <IOSCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Request #</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Title</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Category</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-500">Amount</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">Priority</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-500">Date</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((request) => (
                      <tr key={request.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-3 px-4 font-mono text-sm">{request.request_number}</td>
                        <td className="py-3 px-4">
                          <p className="font-medium">{request.title}</p>
                          {request.description && <p className="text-sm text-gray-500 truncate max-w-xs">{request.description}</p>}
                        </td>
                        <td className="py-3 px-4">{request.category}</td>
                        <td className="py-3 px-4 text-right font-medium">KES {parseFloat(request.total_amount?.toString() || '0').toLocaleString()}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                            {request.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                            {request.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">{new Date(request.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <IOSButton variant="ghost" size="sm" onClick={() => setViewRequest(request)}>
                              <Eye className="h-4 w-4" />
                            </IOSButton>
                            <IOSButton variant="ghost" size="sm" onClick={() => handleEdit(request)}>
                              <Edit2 className="h-4 w-4" />
                            </IOSButton>
                            {request.status === 'pending' && (
                              <>
                                <IOSButton variant="ghost" size="sm" onClick={() => handleStatusChange(request.id, 'approved')}>
                                  <CheckCircle className="h-4 w-4 text-gray-500" />
                                </IOSButton>
                                <IOSButton variant="ghost" size="sm" onClick={() => handleStatusChange(request.id, 'rejected')}>
                                  <XCircle className="h-4 w-4 text-gray-500" />
                                </IOSButton>
                              </>
                            )}
                            {request.status === 'approved' && (
                              <IOSButton variant="ghost" size="sm" onClick={() => handleStatusChange(request.id, 'ordered')}>
                                <Send className="h-4 w-4 text-gray-500" />
                              </IOSButton>
                            )}
                            <IOSButton variant="ghost" size="sm" onClick={() => handleDelete(request.id)}>
                              <Trash2 className="h-4 w-4 text-gray-500" />
                            </IOSButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IOSCard>
          )}

          {/* View Dialog */}
          <Dialog open={!!viewRequest} onOpenChange={() => setViewRequest(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Procurement Request Details</DialogTitle>
              </DialogHeader>
              {viewRequest && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><p className="text-sm text-gray-500">Request Number</p><p className="font-medium font-mono">{viewRequest.request_number}</p></div>
                    <div><p className="text-sm text-gray-500">Status</p><p className="font-medium capitalize">{viewRequest.status?.replace('_', ' ')}</p></div>
                    <div><p className="text-sm text-gray-500">Title</p><p className="font-medium">{viewRequest.title}</p></div>
                    <div><p className="text-sm text-gray-500">Category</p><p className="font-medium">{viewRequest.category}</p></div>
                    <div><p className="text-sm text-gray-500">Priority</p><p className="font-medium capitalize">{viewRequest.priority}</p></div>
                    <div><p className="text-sm text-gray-500">Total Amount</p><p className="font-medium">KES {parseFloat(viewRequest.total_amount?.toString() || '0').toLocaleString()}</p></div>
                    <div><p className="text-sm text-gray-500">Branch</p><p className="font-medium">{viewRequest.branch_name || 'Central'}</p></div>
                    <div><p className="text-sm text-gray-500">Required Date</p><p className="font-medium">{viewRequest.required_date ? new Date(viewRequest.required_date).toLocaleDateString() : 'Not specified'}</p></div>
                    <div><p className="text-sm text-gray-500">Requested By</p><p className="font-medium">{viewRequest.requested_by_name || 'Unknown'}</p></div>
                    <div><p className="text-sm text-gray-500">Created</p><p className="font-medium">{new Date(viewRequest.created_at).toLocaleDateString()}</p></div>
                  </div>
                  {viewRequest.description && (
                    <div><p className="text-sm text-gray-500">Description</p><p>{viewRequest.description}</p></div>
                  )}
                  {viewRequest.notes && (
                    <div><p className="text-sm text-gray-500">Notes</p><p>{viewRequest.notes}</p></div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function ProcurementPage() {
  return (
    <BranchPageWrapper>
      <ProcurementContent />
    </BranchPageWrapper>
  );
}
