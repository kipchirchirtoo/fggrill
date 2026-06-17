'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, RefreshCw, Search, ChefHat, Calendar, Clock, Package,
  CheckCircle, XCircle, AlertTriangle, TrendingUp, ArrowRight, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { kitchenShiftAPI } from '@/lib/api/kitchen-shift';
import Link from 'next/link';

const KITCHEN_ROLES = [
  UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.BRANCH_STOREKEEPER,
  UserRole.CENTRAL_STOREKEEPER, UserRole.STOREKEEPER, UserRole.HEAD_CHEF,
  UserRole.CHEF, UserRole.COOK, UserRole.KITCHEN,
  UserRole.KITCHEN_OPERATIONS, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR
];

interface KitchenShift {
  id: string;
  shift_number: string;
  shift_type: string;
  shift_date: string;
  status: string;
  opened_at: string;
  closed_at?: string;
  store_keeper_id: string;
  store_keeper?: { first_name: string; last_name: string };
  assigned_chef_ids: string[];
  total_revenue: number;
  total_cogs: number;
  total_spoilage_cost: number;
  total_variance_cost: number;
  chef_confirmed_by?: string;
  accountant_approved_by?: string;
}

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
  pending_chef_confirmation: 'bg-yellow-100 text-yellow-800',
  pending_accountant_review: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

export default function KitchenShiftsPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [shifts, setShifts] = useState<KitchenShift[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [openingItems, setOpeningItems] = useState<any[]>([{ sku: '', name: '', quantity: '', unit: '', cost_price: '' }]);
  const [shiftType, setShiftType] = useState('morning');
  const [chefIds, setChefIds] = useState('');

  const isStoreKeeper = [UserRole.BRANCH_STOREKEEPER, UserRole.CENTRAL_STOREKEEPER, UserRole.STOREKEEPER].includes(user?.role as UserRole);
  const isChef = [UserRole.HEAD_CHEF, UserRole.CHEF, UserRole.COOK].includes(user?.role as UserRole);
  const isAccountant = [UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT].includes(user?.role as UserRole);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const res = await kitchenShiftAPI.getShifts({
        branch_id: activeBranchId || undefined,
        status: statusFilter || undefined,
        from_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
      });
      setShifts(res.data || []);
      const statsRes = await kitchenShiftAPI.getStats({ branch_id: activeBranchId || '' });
      setStats(statsRes.data);
    } catch (e: any) {
      toast.error(e.message || 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (activeBranchId) fetchShifts(); }, [activeBranchId, statusFilter]);

  const handleOpenShift = async () => {
    const items = openingItems.filter(it => it.sku && it.name && it.quantity && it.unit);
    if (!items.length) { toast.error('Add at least one item'); return; }
    try {
      await kitchenShiftAPI.openShift({
        branch_id: activeBranchId,
        shift_type: shiftType,
        shift_date: new Date().toISOString().split('T')[0],
        opening_items: items.map(it => ({ sku: it.sku, name: it.name, quantity: Number(it.quantity), unit: it.unit, cost_price: Number(it.cost_price) || 0 })),
        assigned_chef_ids: chefIds.split(',').map((s: string) => s.trim()).filter(Boolean)
      });
      toast.success('Shift opened');
      setOpenModal(false);
      setOpeningItems([{ sku: '', name: '', quantity: '', unit: '', cost_price: '' }]);
      fetchShifts();
    } catch (e: any) { toast.error(e.message); }
  };

  const addItemRow = () => setOpeningItems([...openingItems, { sku: '', name: '', quantity: '', unit: '', cost_price: '' }]);
  const updateItem = (i: number, field: string, val: string) => {
    const next = [...openingItems]; next[i][field] = val; setOpeningItems(next);
  };
  const removeItem = (i: number) => { const next = [...openingItems]; next.splice(i, 1); setOpeningItems(next); };

  const filtered = shifts.filter(s =>
    s.shift_number.toLowerCase().includes(search.toLowerCase()) ||
    (s.store_keeper?.first_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const openCount = shifts.filter(s => s.status === 'open').length;
  const pendingChef = shifts.filter(s => s.status === 'pending_chef_confirmation').length;
  const pendingAcct = shifts.filter(s => s.status === 'pending_accountant_review').length;

  return (
    <ProtectedRoute allowedRoles={KITCHEN_ROLES}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ChefHat className="h-6 w-6 text-[#007AFF]" />
                Kitchen Shift Management
              </h1>
              <p className="text-gray-500 mt-1">Manage kitchen shifts, stock, production & approvals</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchShifts} leftIcon={<RefreshCw size={16} />}>
                Refresh
              </IOSButton>
              {isStoreKeeper && (
                <IOSButton onClick={() => setOpenModal(true)} leftIcon={<Plus size={16} />}>
                  Open Shift
                </IOSButton>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><div className="flex items-center gap-3"><Package className="h-5 w-5 text-blue-600" /><div><p className="text-xs text-gray-500">Open Shifts</p><p className="text-xl font-bold">{openCount}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-yellow-600" /><div><p className="text-xs text-gray-500">Pending Chef</p><p className="text-xl font-bold">{pendingChef}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><Clock className="h-5 w-5 text-orange-600" /><div><p className="text-xs text-gray-500">Pending Accountant</p><p className="text-xl font-bold">{pendingAcct}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-green-600" /><div><p className="text-xs text-gray-500">Revenue (30d)</p><p className="text-xl font-bold">KES {(stats?.financials?.revenue || 0).toLocaleString()}</p></div></div></IOSCard>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input placeholder="Search shifts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
              <option value="">All Status</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="pending_chef_confirmation">Pending Chef</option>
              <option value="pending_accountant_review">Pending Accountant</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Shifts Table */}
          <IOSCard>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3">Shift #</th><th className="text-left p-3">Type</th><th className="text-left p-3">Date</th><th className="text-left p-3">Status</th><th className="text-right p-3">Revenue</th><th className="text-right p-3">COGS</th><th className="text-right p-3">Variance</th><th className="text-left p-3">Actions</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading...</td></tr> :
                  filtered.length === 0 ? <tr><td colSpan={8} className="p-8 text-center text-gray-500">No shifts found</td></tr> :
                  filtered.map(s => (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-medium">{s.shift_number}</td>
                      <td className="p-3 capitalize">{s.shift_type}</td>
                      <td className="p-3">{formatDate(s.shift_date)}</td>
                      <td className="p-3"><IOSBadge className={statusColors[s.status] || 'bg-gray-100'}>{s.status.replace(/_/g, ' ')}</IOSBadge></td>
                      <td className="p-3 text-right">KES {(s.total_revenue || 0).toLocaleString()}</td>
                      <td className="p-3 text-right">KES {(s.total_cogs || 0).toLocaleString()}</td>
                      <td className="p-3 text-right text-red-600">KES {(s.total_variance_cost || 0).toLocaleString()}</td>
                      <td className="p-3">
                        <Link href={`/dashboard/kitchen/shifts/${s.id}`}>
                          <IOSButton variant="secondary" size="sm" leftIcon={<ArrowRight size={14} />}>View</IOSButton>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </IOSCard>
        </div>

        {/* Open Shift Modal */}
        <Dialog open={openModal} onOpenChange={setOpenModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Open Kitchen Shift</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Shift Type</label>
                <select value={shiftType} onChange={e => setShiftType(e.target.value)} className="w-full border rounded-lg px-3 py-2 mt-1">
                  <option value="morning">Morning</option><option value="afternoon">Afternoon</option><option value="night">Night</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Assigned Chef IDs (comma-separated)</label>
                <Input value={chefIds} onChange={e => setChefIds(e.target.value)} placeholder="e.g. uuid1, uuid2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between"><label className="text-sm font-medium">Opening Stock Items</label><IOSButton size="sm" variant="secondary" onClick={addItemRow} leftIcon={<Plus size={14} />}>Add Item</IOSButton></div>
                {openingItems.map((it, i) => (
                  <div key={i} className="grid grid-cols-5 gap-2 items-center">
                    <Input placeholder="SKU" value={it.sku} onChange={e => updateItem(i, 'sku', e.target.value)} className="text-xs" />
                    <Input placeholder="Name" value={it.name} onChange={e => updateItem(i, 'name', e.target.value)} className="text-xs" />
                    <Input placeholder="Qty" type="number" value={it.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} className="text-xs" />
                    <Input placeholder="Unit" value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)} className="text-xs" />
                    <div className="flex gap-1">
                      <Input placeholder="Cost" type="number" value={it.cost_price} onChange={e => updateItem(i, 'cost_price', e.target.value)} className="text-xs" />
                      {openingItems.length > 1 && <button onClick={() => removeItem(i)} className="text-red-500 text-xs">X</button>}
                    </div>
                  </div>
                ))}
              </div>
              <IOSButton onClick={handleOpenShift} className="w-full">Open Shift</IOSButton>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
