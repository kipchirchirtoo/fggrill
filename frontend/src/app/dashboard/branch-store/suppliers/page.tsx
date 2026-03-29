'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Input } from '@/components/ui/input';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Building2, Plus, Edit, Trash2, RefreshCw, Save, Phone, 
  Mail, MapPin, CheckCircle, XCircle, Ban, ArrowLeft, Search,
  Eye, FileText, ShoppingCart, Download, ExternalLink, Globe, CreditCard,
  X, Printer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { storeAPI } from '@/lib/api';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { downloadSupplierFolioPDF } from '@/lib/supplier-folio-pdf';

interface Supplier {
  id: string;
  name: string;
  supplier_code?: string;
  legal_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  alternate_phone?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  tax_id?: string;
  vat_number?: string;
  registration_number?: string;
  payment_terms?: string;
  credit_limit?: number;
  bank_name?: string;
  bank_account_number?: string;
  bank_branch?: string;
  lead_time_days?: number;
  status: string;
  is_preferred?: boolean;
  notes?: string;
  created_at: string;
  branch_id?: number | null;
}

const STATUSES = ['ACTIVE', 'INACTIVE', 'BLOCKED'];
const PAYMENT_TERMS = ['COD', 'NET7', 'NET15', 'NET30', 'NET60', 'NET90'];

export default function BranchSuppliersPage() {
  const { user } = useAuth();
  // Only branch storekeepers and managers can manage their local suppliers
  const canEdit = user?.role === UserRole.BRANCH_STOREKEEPER || user?.role === UserRole.STOREKEEPER || user?.role === UserRole.BRANCH_MANAGER || user?.role === UserRole.SUPER_ADMIN;
  
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFolioOpen, setIsFolioOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    supplier_code: '',
    contact_person: '',
    email: '',
    phone: '',
    address_line1: '',
    city: '',
    payment_terms: 'NET30',
    status: 'ACTIVE'
  });

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      // STRICT ISOLATION: Only fetch branch-specific suppliers
      const res = await storeAPI.getSuppliers({ scope: 'branch' });
      if (res.success) {
        setSuppliers(res.data || []);
      }
    } catch (error) {
      console.error('Error fetching branch suppliers:', error);
      toast.error('Failed to load local vendors');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const handleSave = async () => {
    if (!form.name) {
      toast.error('Supplier name is required');
      return;
    }
    try {
      if (selectedSupplier) {
        await storeAPI.updateSupplier(selectedSupplier.id, form);
        toast.success('Local vendor updated');
      } else {
        await storeAPI.createSupplier(form);
        toast.success('Local vendor added');
      }
      setIsModalOpen(false);
      fetchSuppliers();
    } catch (error: any) { 
      toast.error(error.message || 'Error saving vendor'); 
    }
  };

  const handleDelete = useCallback(async () => {
    if (!selectedSupplier) return;
    try {
      await storeAPI.deleteSupplier(selectedSupplier.id);
      toast.success('Vendor removed');
      setIsDeleteModalOpen(false);
      fetchSuppliers();
    } catch { toast.error('Error deleting vendor'); }
  }, [selectedSupplier, fetchSuppliers]);

  const handleExportPDF = async (s: Supplier) => {
    setIsExporting(s.id);
    try {
      await downloadSupplierFolioPDF(s);
      toast.success('Folio PDF exported successfully');
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsExporting(null);
    }
  };

  const handleCreatePO = (s: Supplier) => {
    router.push(`/dashboard/storekeeping/purchase-orders?supplier_id=${s.id}&auto_create=true`);
  };

  const openAddModal = () => {
    setSelectedSupplier(null);
    setForm({ name: '', supplier_code: '', contact_person: '', email: '', phone: '', address_line1: '', city: '', payment_terms: 'NET30', status: 'ACTIVE' });
    setIsModalOpen(true);
  };

  const openEditModal = (s: Supplier) => {
    setSelectedSupplier(s);
    setForm({
      name: s.name,
      supplier_code: s.supplier_code || '',
      contact_person: s.contact_person || '',
      email: s.email || '',
      phone: s.phone || '',
      address_line1: s.address_line1 || '',
      city: s.city || '',
      payment_terms: s.payment_terms || 'NET30',
      status: s.status
    });
    setIsModalOpen(true);
  };

  const getStatusColor = (s: string): "success" | "warning" | "danger" | "secondary" => {
    if (s === 'ACTIVE') return 'success';
    if (s === 'INACTIVE') return 'warning';
    if (s === 'BLOCKED') return 'danger';
    return 'secondary';
  };

  const getStatusIcon = (s: string) => {
    if (s === 'ACTIVE') return <CheckCircle className="h-4 w-4" />;
    if (s === 'INACTIVE') return <XCircle className="h-4 w-4" />;
    if (s === 'BLOCKED') return <Ban className="h-4 w-4" />;
    return null;
  };

  const filteredSuppliers = suppliers.filter(s =>
    !searchTerm ||
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.supplier_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.address_line1?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = suppliers.filter(s => s.status === 'ACTIVE').length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/branch-store" className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                <ArrowLeft className="h-5 w-5 text-stone-500" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Local Vendors</h1>
                <p className="text-gray-600">Manage branch-specific suppliers and producers</p>
              </div>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={fetchSuppliers} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              {canEdit && <IOSButton onClick={openAddModal} leftIcon={<Plus />}>Add Local Vendor</IOSButton>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Total Vendors</p>
                  <p className="text-2xl font-black text-stone-900">{suppliers.length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Active</p>
                  <p className="text-2xl font-black text-emerald-600">{activeCount}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                  <Ban className="h-6 w-6 text-rose-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Blocked</p>
                  <p className="text-2xl font-black text-stone-900">{suppliers.filter(s => s.status === 'BLOCKED').length}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          <div className="flex gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <Input 
                placeholder="Search local vendors by name or code..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                className="pl-10 bg-white border-stone-200" 
              />
            </div>
          </div>

          <IOSCard className="overflow-hidden">
            {isLoading ? (
              <div className="p-20 text-center">
                <RefreshCw className="h-10 w-10 animate-spin text-stone-200 mx-auto mb-4" />
                <p className="text-stone-400 text-sm font-medium">Fetching local vendor registry...</p>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-20 text-center">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-stone-100" />
                <p className="text-stone-500 font-bold">No local vendors registered</p>
                <p className="text-stone-400 text-sm mt-1">Start by adding your branch's specific suppliers.</p>
                {canEdit && (
                  <IOSButton onClick={openAddModal} variant="secondary" className="mt-6" leftIcon={<Plus />}>Add First Vendor</IOSButton>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-stone-50/50 border-b border-stone-100">
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-stone-400 uppercase tracking-widest">Vendor Details</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-stone-400 uppercase tracking-widest">Contact Information</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-stone-400 uppercase tracking-widest">Location</th>
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-stone-400 uppercase tracking-widest">Terms</th>
                      <th className="px-6 py-4 text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest">Status</th>
                      {canEdit && <th className="px-6 py-4 text-right text-[10px] font-bold text-stone-400 uppercase tracking-widest">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {filteredSuppliers.map(s => (
                      <tr key={s.id} className="group hover:bg-stone-50/40 transition-colors">
                        <td className="px-6 py-5">
                          <div>
                            <p className="font-bold text-stone-900">{s.name}</p>
                            <p className="text-[10px] text-stone-400 font-mono tracking-tighter uppercase">{s.supplier_code || '---'}</p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1.5">
                            {s.contact_person && <p className="text-xs font-bold text-stone-700">{s.contact_person}</p>}
                            <div className="flex flex-col gap-1">
                              {s.phone && <p className="text-[11px] text-stone-500 flex items-center gap-1.5"><Phone className="h-3 w-3 text-stone-300" />{s.phone}</p>}
                              {s.email && <p className="text-[11px] text-stone-500 flex items-center gap-1.5"><Mail className="h-3 w-3 text-stone-300" />{s.email}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 text-xs font-medium text-stone-600">
                            <MapPin className="h-3.5 w-3.5 text-stone-300" />
                            {s.city || s.address_line1 || 'Not specified'}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <IOSBadge variant="light" color="info">{s.payment_terms || 'NET30'}</IOSBadge>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex justify-center">
                            <IOSBadge variant="light" color={getStatusColor(s.status)}>
                              <span className="flex items-center gap-1.5">{getStatusIcon(s.status)} {s.status}</span>
                            </IOSBadge>
                          </div>
                        </td>
                        {canEdit && (
                          <td className="px-6 py-5">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <IOSButton size="sm" variant="outline" onClick={() => { setSelectedSupplier(s); setIsFolioOpen(true); }} className="h-8 w-8 p-0" title="View Folio"><Eye className="h-3.5 w-3.5" /></IOSButton>
                              <IOSButton size="sm" variant="outline" onClick={() => handleExportPDF(s)} disabled={isExporting === s.id} className="h-8 w-8 p-0" title="Export PDF">
                                {isExporting === s.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                              </IOSButton>
                              <IOSButton size="sm" variant="outline" onClick={() => handleCreatePO(s)} className="h-8 w-8 p-0 text-blue-600 border-blue-100 hover:bg-blue-50" title="Create Purchase Order"><ShoppingCart className="h-3.5 w-3.5" /></IOSButton>
                              <IOSButton size="sm" variant="outline" onClick={() => openEditModal(s)} className="h-8 w-8 p-0" title="Edit"><Edit className="h-3.5 w-3.5" /></IOSButton>
                              <IOSButton size="sm" variant="outline" onClick={() => { setSelectedSupplier(s); setIsDeleteModalOpen(true); }} className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50" title="Delete"><Trash2 className="h-3.5 w-3.5" /></IOSButton>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </IOSCard>
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl border-none shadow-2xl p-0 overflow-hidden rounded-2xl flex flex-col max-h-[95vh]">
            <div className="bg-stone-50 p-6 border-b border-stone-100 shrink-0">
              <DialogHeader>
                <DialogTitle className="text-xl font-black text-stone-900">
                  {selectedSupplier ? 'Edit Local Vendor' : 'Add Local Vendor'}
                </DialogTitle>
                <p className="text-sm text-stone-500">Enter local supplier details for your branch inventory</p>
              </DialogHeader>
            </div>
            
            <div className="p-6 space-y-6 bg-white flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-stone-200">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">Vendor Name *</label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bomet Fresh Produce" className="h-11 bg-stone-50 border-stone-100 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">Vendor Code</label>
                  <Input value={form.supplier_code} onChange={e => setForm({ ...form, supplier_code: e.target.value.toUpperCase() })} placeholder="e.g. LCL001" className="h-11 bg-stone-50 border-stone-100 focus:bg-white font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">Contact Person</label>
                  <Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="Rep name" className="h-11 bg-stone-50 border-stone-100 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">Phone Number</label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+254..." className="h-11 bg-stone-50 border-stone-100 focus:bg-white" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">Physical Address / Line 1</label>
                <Input value={form.address_line1} onChange={e => setForm({ ...form, address_line1: e.target.value })} placeholder="Street, Building, etc." className="h-11 bg-stone-50 border-stone-100 focus:bg-white" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">Email Address</label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="vendor@example.com" className="h-11 bg-stone-50 border-stone-100 focus:bg-white" />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">City/Town</label>
                  <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} placeholder="Bomet" className="h-11 bg-stone-50 border-stone-100 focus:bg-white" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">Payment Terms</label>
                  <select 
                    value={form.payment_terms} 
                    onChange={e => setForm({ ...form, payment_terms: e.target.value })} 
                    className="w-full h-11 px-4 bg-stone-50 border border-stone-100 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-stone-400 px-1">Vendor Status</label>
                <div className="flex gap-4 p-1 bg-stone-50 rounded-xl">
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, status: s })}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all",
                        form.status === s 
                          ? "bg-white text-stone-900 shadow-sm" 
                          : "text-stone-400 hover:text-stone-600"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-stone-50 p-6 flex justify-end gap-3 border-t border-stone-100 shrink-0">
              <IOSButton variant="outline" onClick={() => setIsModalOpen(false)} className="h-11 px-8">Cancel</IOSButton>
              <IOSButton onClick={handleSave} leftIcon={<Save />} className="h-11 px-8 bg-black hover:bg-stone-900">
                {selectedSupplier ? 'Update Vendor' : 'Register Vendor'}
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
          <DialogContent className="max-w-sm rounded-none border-none p-6 bg-white animate-ios-slide-in shadow-xl">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="h-8 w-8 text-rose-500" />
              </div>
              <DialogHeader>
                <DialogTitle className="text-center text-xl font-black text-stone-900">Confirm Deletion</DialogTitle>
              </DialogHeader>
              <p className="mt-4 text-sm text-stone-500">
                Are you sure you want to remove <strong>{selectedSupplier?.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-8">
              <IOSButton variant="destructive" onClick={handleDelete} className="w-full h-11" leftIcon={<Trash2 />}>Delete Vendor</IOSButton>
              <IOSButton variant="outline" onClick={() => setIsDeleteModalOpen(false)} className="w-full h-11 border-none text-stone-400 hover:text-stone-600">Keep Vendor</IOSButton>
            </div>
          </DialogContent>
        </Dialog>

        {/* Supplier Folio Modal */}
        <Dialog open={isFolioOpen} onOpenChange={setIsFolioOpen}>
          <DialogContent className="max-w-5xl border-none shadow-2xl p-0 overflow-hidden rounded-none bg-white animate-ios-slide-in flex flex-col max-h-[90vh]">
            {selectedSupplier && (
              <>
                <div className="bg-stone-50 p-8 border-b border-stone-100 relative overflow-hidden">
                  <div className="absolute right-[-20px] top-[-20px] opacity-10">
                    <Building2 className="w-48 h-48 text-stone-200" />
                  </div>
                  <div className="relative z-10">
                    <DialogHeader className="mb-6 flex flex-row items-center justify-between">
                      <div>
                        <DialogTitle className="text-sm font-black text-stone-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Building2 className="h-3 w-3" /> Supplier Folio Record
                        </DialogTitle>
                        <h2 className="text-4xl font-black tracking-tight text-stone-900">{selectedSupplier.name}</h2>
                      </div>
                      <IOSBadge variant="light" color={getStatusColor(selectedSupplier.status)}>
                        <span className="flex items-center gap-1.5 font-bold">{getStatusIcon(selectedSupplier.status)} {selectedSupplier.status}</span>
                      </IOSBadge>
                    </DialogHeader>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <IOSBadge variant="light" color="info" className="bg-blue-50 text-blue-600 border-none font-bold">#{selectedSupplier.supplier_code || 'LCL_VND'}</IOSBadge>
                        {selectedSupplier.is_preferred && <IOSBadge variant="light" color="warning" className="bg-amber-50 text-amber-600 border-none font-bold">PREFERRED</IOSBadge>}
                      </div>
                      <p className="text-stone-400 text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4" /> {selectedSupplier.city || 'Location unspecified'} • {selectedSupplier.country || 'Kenya'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-10 py-8 space-y-10 bg-white scrollbar-thin scrollbar-thumb-stone-300 scrollbar-track-transparent pr-4 max-h-[60vh]">
                  {/* General Info */}
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Contact Details</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <Building2 className="h-4 w-4 text-stone-300 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-stone-900">{selectedSupplier.contact_person || 'No Contact Person'}</p>
                            <p className="text-xs text-stone-500">Primary Representative</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Phone className="h-4 w-4 text-stone-300 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-stone-900">{selectedSupplier.phone || '---'}</p>
                            <p className="text-xs text-stone-500">Primary Phone</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Mail className="h-4 w-4 text-stone-300 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-stone-900">{selectedSupplier.email || '---'}</p>
                            <p className="text-xs text-stone-500">Email Address</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Business Registration</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <FileText className="h-4 w-4 text-stone-300 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-stone-900">{selectedSupplier.legal_name || selectedSupplier.name}</p>
                            <p className="text-xs text-stone-500">Legal Business Name</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-4 w-4 text-stone-300 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-stone-900">{selectedSupplier.tax_id || 'Not Provided'}</p>
                            <p className="text-xs text-stone-500">Tax ID / PIN Number</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Globe className="h-4 w-4 text-stone-300 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-stone-900">{selectedSupplier.website || '---'}</p>
                            <p className="text-xs text-stone-500">Company Website</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-stone-100" />

                  {/* Financial Info */}
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Banking & Settlement</h3>
                      <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100 space-y-4">
                        <div className="flex items-center gap-3">
                          <CreditCard className="h-5 w-5 text-stone-400" />
                          <div>
                            <p className="text-xs text-stone-500 uppercase font-bold tracking-tighter">Bank Selection</p>
                            <p className="text-sm font-bold text-stone-900">{selectedSupplier.bank_name || 'No Bank Recorded'}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest px-1">Account & Branch</p>
                          <div className="bg-white p-3 rounded-xl border border-stone-100 font-mono text-sm font-bold text-stone-700">
                            {selectedSupplier.bank_account_number || '----------------'}
                            <span className="block text-[9px] text-stone-400 mt-1 uppercase">{selectedSupplier.bank_branch || 'Global Branch'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Trade Terms</h3>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                          <span className="text-xs font-bold text-stone-500">Payment Terms</span>
                          <IOSBadge variant="light" color="info">{selectedSupplier.payment_terms || 'NET30'}</IOSBadge>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                          <span className="text-xs font-bold text-stone-500">Credit Limit</span>
                          <span className="text-sm font-black text-stone-900">Ksh {selectedSupplier.credit_limit?.toLocaleString() || '0.00'}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl border border-stone-100">
                          <span className="text-xs font-bold text-stone-500">Lead Time</span>
                          <span className="text-sm font-bold text-stone-700">{selectedSupplier.lead_time_days || '---'} Days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {selectedSupplier.notes && (
                    <div className="p-6 bg-amber-50 rounded-none border-l-4 border-amber-400">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-1">Administrative Notes</p>
                      <p className="text-xs text-amber-800 leading-relaxed font-bold italic">{selectedSupplier.notes}</p>
                    </div>
                  )}
                </div>

                {/* Sticky Action Footer */}
                <div className="p-6 border-t border-stone-100 bg-[#FAFAF8] flex items-center justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <IOSButton 
                      variant="outline" 
                      className="bg-white border-stone-200 text-stone-600 font-bold hover:bg-stone-50"
                      onClick={() => window.print()}
                      leftIcon={<Printer className="h-4 w-4" />}
                    >
                      Print Folio
                    </IOSButton>
                    <IOSButton 
                      variant="outline" 
                      className="bg-white border-stone-200 text-stone-600 font-bold hover:bg-stone-50"
                      onClick={() => handleExportPDF(selectedSupplier)}
                      leftIcon={<ExternalLink className="h-4 w-4" />}
                    >
                      Export PDF
                    </IOSButton>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsFolioOpen(false)}
                      className="px-6 py-2.5 text-xs font-black text-stone-400 uppercase tracking-widest hover:text-stone-900 transition-colors"
                    >
                      Close
                    </button>
                    <IOSButton 
                      variant="primary" 
                      className="bg-stone-900 text-white font-black uppercase tracking-widest text-[11px] px-8 h-11"
                      onClick={() => {
                        setIsFolioOpen(false);
                        window.location.href = `/dashboard/storekeeping/purchase-orders?supplier_id=${selectedSupplier.id}&auto_create=true`;
                      }}
                    >
                      Create Purchase Order
                    </IOSButton>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
