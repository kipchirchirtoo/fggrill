'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Plus, RefreshCw, ArrowLeft, Package, ChefHat, AlertTriangle, CheckCircle, XCircle,
  ClipboardList, Users, Clock, TrendingUp, TrendingDown, BarChart3, FileText, Send
} from 'lucide-react';
import { toast } from 'sonner';
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

const statusColors: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  closed: 'bg-gray-100 text-gray-800',
  pending_chef_confirmation: 'bg-yellow-100 text-yellow-800',
  pending_accountant_review: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800'
};

export default function KitchenShiftDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('items');

  // Modals
  const [stockModal, setStockModal] = useState(false);
  const [productionModal, setProductionModal] = useState(false);
  const [spoilageModal, setSpoilageModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [reviewModal, setReviewModal] = useState(false);

  // Form states
  const [stockItems, setStockItems] = useState([{ sku: '', name: '', quantity: '', unit: '', cost_price: '' }]);
  const [productionForm, setProductionForm] = useState([{ raw_item_sku: '', raw_item_name: '', raw_quantity_used: '', raw_unit: '', produced_item_name: '', produced_quantity: '', produced_unit: 'portion' }]);
  const [spoilageItems, setSpoilageItems] = useState([{ sku: '', quantity: '', reason: '', reason_category: 'other' }]);
  const [physicalCounts, setPhysicalCounts] = useState<any[]>([]);
  const [reviewNotes, setReviewNotes] = useState('');

  const isStoreKeeper = [UserRole.BRANCH_STOREKEEPER, UserRole.CENTRAL_STOREKEEPER, UserRole.STOREKEEPER].includes(user?.role as UserRole);
  const isChef = [UserRole.HEAD_CHEF, UserRole.CHEF, UserRole.COOK].includes(user?.role as UserRole);
  const isAccountant = [UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT].includes(user?.role as UserRole);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await kitchenShiftAPI.getShift(id);
      setData(res.data);
      if (res.data?.items) {
        setPhysicalCounts(res.data.items.map((it: any) => ({ sku: it.item_sku, quantity: '', notes: '' })));
      }
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { if (id) fetch(); }, [id]);

  const handleAddStock = async () => {
    const items = stockItems.filter(it => it.sku && it.name && it.quantity);
    if (!items.length) { toast.error('Add items'); return; }
    try {
      await kitchenShiftAPI.addStock(id, {
        items: items.map(it => ({ sku: it.sku, name: it.name, quantity: Number(it.quantity), unit: it.unit, cost_price: Number(it.cost_price) || 0 }))
      });
      toast.success('Stock added'); setStockModal(false); setStockItems([{ sku: '', name: '', quantity: '', unit: '', cost_price: '' }]); fetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleProduction = async () => {
    const prods = productionForm.filter(p => p.raw_item_sku && p.produced_item_name && p.raw_quantity_used && p.produced_quantity);
    if (!prods.length) { toast.error('Add productions'); return; }
    try {
      await kitchenShiftAPI.recordProduction(id, {
        productions: prods.map(p => ({ raw_item_sku: p.raw_item_sku, raw_item_name: p.raw_item_name, raw_quantity_used: Number(p.raw_quantity_used), raw_unit: p.raw_unit,
          produced_item_name: p.produced_item_name, produced_quantity: Number(p.produced_quantity), produced_unit: p.produced_unit }))
      });
      toast.success('Production recorded'); setProductionModal(false); setProductionForm([{ raw_item_sku: '', raw_item_name: '', raw_quantity_used: '', raw_unit: '', produced_item_name: '', produced_quantity: '', produced_unit: 'portion' }]); fetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSpoilage = async () => {
    const items = spoilageItems.filter(it => it.sku && it.quantity);
    if (!items.length) { toast.error('Add spoilage items'); return; }
    try {
      await kitchenShiftAPI.recordSpoilage(id, { items: items.map(it => ({ sku: it.sku, quantity: Number(it.quantity), reason: it.reason, reason_category: it.reason_category })) });
      toast.success('Spoilage recorded'); setSpoilageModal(false); setSpoilageItems([{ sku: '', quantity: '', reason: '', reason_category: 'other' }]); fetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleClose = async () => {
    const counts = physicalCounts.filter(c => c.quantity !== '');
    if (!counts.length) { toast.error('Enter physical counts'); return; }
    try {
      await kitchenShiftAPI.closeShift(id, { physical_counts: counts.map(c => ({ sku: c.sku, quantity: Number(c.quantity), notes: c.notes })) });
      toast.success('Shift closed'); setCloseModal(false); fetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSubmit = async () => {
    try { await kitchenShiftAPI.submitForApproval(id); toast.success('Submitted'); fetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleChefConfirm = async (confirmed: boolean) => {
    try { await kitchenShiftAPI.chefConfirm(id, { confirmed, notes: reviewNotes }); toast.success(confirmed ? 'Confirmed' : 'Rejected'); setReviewModal(false); fetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  const handleAccountantReview = async (approved: boolean) => {
    try { await kitchenShiftAPI.accountantReview(id, { approved, notes: reviewNotes }); toast.success(approved ? 'Approved' : 'Rejected'); setReviewModal(false); fetch(); }
    catch (e: any) { toast.error(e.message); }
  };

  const shift = data?.shift;
  const items = data?.items || [];
  const prodData = data?.productions || [];
  const stockTake = data?.stock_take || [];
  const summary = data?.summary;
  const n = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0;

  const updatePhysCount = (sku: string, val: string) => {
    setPhysicalCounts(prev => prev.map(p => p.sku === sku ? { ...p, quantity: val } : p));
  };

  if (loading && !data) return (
    <ProtectedRoute allowedRoles={KITCHEN_ROLES}><DashboardLayout><div className="p-8 text-center">Loading...</div></DashboardLayout></ProtectedRoute>
  );

  return (
    <ProtectedRoute allowedRoles={KITCHEN_ROLES}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/kitchen/shifts"><IOSButton variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>Back</IOSButton></Link>
              <div>
                <h1 className="text-2xl font-bold">{shift?.shift_number}</h1>
                <p className="text-gray-500 text-sm">{shift?.shift_type} shift | {shift?.shift_date}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <IOSBadge className={statusColors[shift?.status] || 'bg-gray-100'}>{(shift?.status || '').replace(/_/g, ' ')}</IOSBadge>
              <IOSButton variant="secondary" size="sm" onClick={fetch} leftIcon={<RefreshCw size={14} />}>Refresh</IOSButton>
              {shift?.status === 'open' && isStoreKeeper && (
                <>
                  <IOSButton size="sm" variant="secondary" onClick={() => setStockModal(true)} leftIcon={<Plus size={14} />}>Add Stock</IOSButton>
                  <IOSButton size="sm" variant="secondary" onClick={() => setProductionModal(true)} leftIcon={<ChefHat size={14} />}>Production</IOSButton>
                  <IOSButton size="sm" variant="secondary" onClick={() => setSpoilageModal(true)} leftIcon={<AlertTriangle size={14} />}>Spoilage</IOSButton>
                  <IOSButton size="sm" onClick={() => setCloseModal(true)} leftIcon={<ClipboardList size={14} />}>Close Shift</IOSButton>
                </>
              )}
              {shift?.status === 'closed' && isStoreKeeper && (
                <IOSButton size="sm" onClick={handleSubmit} leftIcon={<Send size={14} />}>Submit</IOSButton>
              )}
              {shift?.status === 'pending_chef_confirmation' && isChef && (
                <IOSButton size="sm" onClick={() => setReviewModal(true)} leftIcon={<CheckCircle size={14} />}>Review</IOSButton>
              )}
              {shift?.status === 'pending_accountant_review' && isAccountant && (
                <IOSButton size="sm" onClick={() => setReviewModal(true)} leftIcon={<ClipboardList size={14} />}>Review</IOSButton>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><div className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-green-600" /><div><p className="text-xs text-gray-500">Revenue</p><p className="text-xl font-bold">KES {(shift?.total_revenue || 0).toLocaleString()}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><TrendingDown className="h-5 w-5 text-red-600" /><div><p className="text-xs text-gray-500">COGS</p><p className="text-xl font-bold">KES {(shift?.total_cogs || 0).toLocaleString()}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-orange-600" /><div><p className="text-xs text-gray-500">Spoilage</p><p className="text-xl font-bold">KES {(shift?.total_spoilage_cost || 0).toLocaleString()}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><BarChart3 className="h-5 w-5 text-purple-600" /><div><p className="text-xs text-gray-500">Variance</p><p className="text-xl font-bold">KES {(shift?.total_variance_cost || 0).toLocaleString()}</p></div></div></IOSCard>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            {['items', 'production', 'stock-take', 'approvals'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === tab ? 'border-[#007AFF] text-[#007AFF]' : 'border-transparent text-gray-500'}`}>
                {tab.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </button>
            ))}
          </div>

          {/* Items Tab */}
          {activeTab === 'items' && (
            <IOSCard>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-3">Item</th><th className="text-right p-3">Opening</th><th className="text-right p-3">Additions</th><th className="text-right p-3">Sold</th><th className="text-right p-3">Spoilage</th><th className="text-right p-3">System Close</th><th className="text-right p-3">Physical</th><th className="text-right p-3">Variance</th></tr></thead>
                  <tbody>
                    {items.map((it: any) => (
                      <tr key={it.id} className="border-b hover:bg-gray-50">
                        <td className="p-3"><div className="font-medium">{it.item_name}</div><div className="text-xs text-gray-400">{it.item_sku}</div></td>
                        <td className="p-3 text-right">{it.opening_stock} {it.unit_of_measure}</td>
                        <td className="p-3 text-right text-green-600">+{it.additions}</td>
                        <td className="p-3 text-right text-red-600">-{it.sold_quantity}</td>
                        <td className="p-3 text-right text-orange-600">-{it.spoilage_quantity}</td>
                        <td className="p-3 text-right font-medium">{it.system_closing_stock}</td>
                        <td className="p-3 text-right">{it.physical_count !== null ? it.physical_count : '-'}</td>
                        <td className={`p-3 text-right font-medium ${n(it.variance) < 0 ? 'text-red-600' : n(it.variance) > 0 ? 'text-green-600' : ''}`}>
                          {n(it.variance) > 0 ? '+' : ''}{it.variance} {it.unit_of_measure}
                        </td>
                      </tr>
                    ))}
                    {items.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-gray-500">No items</td></tr>}
                  </tbody>
                </table>
              </div>
              {summary && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg grid grid-cols-4 gap-4 text-sm">
                  <div><span className="text-gray-500">Opening Value:</span> <span className="font-medium">KES {summary.opening_value?.toLocaleString()}</span></div>
                  <div><span className="text-gray-500">Additions Value:</span> <span className="font-medium">KES {summary.additions_value?.toLocaleString()}</span></div>
                  <div><span className="text-gray-500">Sold Value:</span> <span className="font-medium text-red-600">KES {summary.sold_value?.toLocaleString()}</span></div>
                  <div><span className="text-gray-500">Variance Value:</span> <span className="font-medium text-red-600">KES {summary.variance_value?.toLocaleString()}</span></div>
                </div>
              )}
            </IOSCard>
          )}

          {/* Production Tab */}
          {activeTab === 'production' && (
            <IOSCard>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-3">Raw Material</th><th className="text-right p-3">Qty Used</th><th className="text-left p-3">Produced Item</th><th className="text-right p-3">Qty Produced</th><th className="text-right p-3">Ratio</th><th className="text-left p-3">At</th></tr></thead>
                  <tbody>
                    {prodData.map((p: any) => (
                      <tr key={p.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{p.raw_item_name} <span className="text-xs text-gray-400">({p.raw_item_sku})</span></td>
                        <td className="p-3 text-right">{p.raw_quantity_used} {p.raw_unit}</td>
                        <td className="p-3">{p.produced_item_name}</td>
                        <td className="p-3 text-right">{p.produced_quantity} {p.produced_unit}</td>
                        <td className="p-3 text-right">{p.conversion_ratio ? p.conversion_ratio.toFixed(2) : '-'}</td>
                        <td className="p-3 text-xs text-gray-500">{new Date(p.produced_at).toLocaleString()}</td>
                      </tr>
                    ))}
                    {prodData.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-500">No production records</td></tr>}
                  </tbody>
                </table>
              </div>
            </IOSCard>
          )}

          {/* Stock Take Tab */}
          {activeTab === 'stock-take' && (
            <IOSCard>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-3">Item</th><th className="text-right p-3">Opening</th><th className="text-right p-3">Additions</th><th className="text-right p-3">Available</th><th className="text-right p-3">Sales</th><th className="text-right p-3">Spoilage</th><th className="text-right p-3">System Close</th><th className="text-right p-3">Physical</th><th className="text-right p-3">Variance</th></tr></thead>
                  <tbody>
                    {stockTake.map((st: any) => (
                      <tr key={st.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{st.item_name}</td>
                        <td className="p-3 text-right">{st.opening_stock}</td>
                        <td className="p-3 text-right">{st.additions}</td>
                        <td className="p-3 text-right font-medium">{st.total_available}</td>
                        <td className="p-3 text-right text-red-600">{st.system_sales}</td>
                        <td className="p-3 text-right text-orange-600">{st.spoilage}</td>
                        <td className="p-3 text-right">{st.system_closing_stock}</td>
                        <td className="p-3 text-right font-bold">{st.physical_count}</td>
                        <td className={`p-3 text-right font-bold ${st.variance < 0 ? 'text-red-600' : st.variance > 0 ? 'text-green-600' : ''}`}>
                          {st.variance > 0 ? '+' : ''}{st.variance} {st.unit_of_measure}
                        </td>
                      </tr>
                    ))}
                    {stockTake.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-gray-500">No stock take recorded yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </IOSCard>
          )}

          {/* Approvals Tab */}
          {activeTab === 'approvals' && (
            <IOSCard>
              <div className="space-y-3">
                {(data?.approvals || []).map((ap: any) => (
                  <div key={ap.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium capitalize">{ap.approval_stage.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-500">{ap.notes}</p>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(ap.approved_at).toLocaleString()}</span>
                  </div>
                ))}
                {(!data?.approvals || data.approvals.length === 0) && <p className="p-8 text-center text-gray-500">No approval history</p>}
              </div>
            </IOSCard>
          )}
        </div>

        {/* Stock Modal */}
        <Dialog open={stockModal} onOpenChange={setStockModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Stock to Shift</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {stockItems.map((it, i) => (
                <div key={i} className="grid grid-cols-5 gap-2">
                  <Input placeholder="SKU" value={it.sku} onChange={e => { const n = [...stockItems]; n[i].sku = e.target.value; setStockItems(n); }} className="text-xs" />
                  <Input placeholder="Name" value={it.name} onChange={e => { const n = [...stockItems]; n[i].name = e.target.value; setStockItems(n); }} className="text-xs" />
                  <Input placeholder="Qty" type="number" value={it.quantity} onChange={e => { const n = [...stockItems]; n[i].quantity = e.target.value; setStockItems(n); }} className="text-xs" />
                  <Input placeholder="Unit" value={it.unit} onChange={e => { const n = [...stockItems]; n[i].unit = e.target.value; setStockItems(n); }} className="text-xs" />
                  <Input placeholder="Cost" type="number" value={it.cost_price} onChange={e => { const n = [...stockItems]; n[i].cost_price = e.target.value; setStockItems(n); }} className="text-xs" />
                </div>
              ))}
              <IOSButton size="sm" variant="secondary" onClick={() => setStockItems([...stockItems, { sku: '', name: '', quantity: '', unit: '', cost_price: '' }])} leftIcon={<Plus size={14} />}>Add Row</IOSButton>
              <IOSButton onClick={handleAddStock} className="w-full">Add Stock</IOSButton>
            </div>
          </DialogContent>
        </Dialog>

        {/* Production Modal */}
        <Dialog open={productionModal} onOpenChange={setProductionModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Record Production</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {productionForm.map((p, i) => (
                <div key={i} className="space-y-2 border p-3 rounded-lg">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Raw SKU" value={p.raw_item_sku} onChange={e => { const next = [...productionForm]; next[i].raw_item_sku = e.target.value; setProductionForm(next); }} className="text-xs" />
                    <Input placeholder="Raw Name" value={p.raw_item_name} onChange={e => { const next = [...productionForm]; next[i].raw_item_name = e.target.value; setProductionForm(next); }} className="text-xs" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="Qty Used" type="number" value={p.raw_quantity_used} onChange={e => { const next = [...productionForm]; next[i].raw_quantity_used = e.target.value; setProductionForm(next); }} className="text-xs" />
                    <Input placeholder="Unit" value={p.raw_unit} onChange={e => { const next = [...productionForm]; next[i].raw_unit = e.target.value; setProductionForm(next); }} className="text-xs" />
                    <Input placeholder="Produced Qty" type="number" value={p.produced_quantity} onChange={e => { const next = [...productionForm]; next[i].produced_quantity = e.target.value; setProductionForm(next); }} className="text-xs" />
                  </div>
                  <Input placeholder="Produced Item Name" value={p.produced_item_name} onChange={e => { const next = [...productionForm]; next[i].produced_item_name = e.target.value; setProductionForm(next); }} className="text-xs" />
                </div>
              ))}
              <IOSButton size="sm" variant="secondary" onClick={() => setProductionForm([...productionForm, { raw_item_sku: '', raw_item_name: '', raw_quantity_used: '', raw_unit: '', produced_item_name: '', produced_quantity: '', produced_unit: 'portion' }])} leftIcon={<Plus size={14} />}>Add Row</IOSButton>
              <IOSButton onClick={handleProduction} className="w-full">Record Production</IOSButton>
            </div>
          </DialogContent>
        </Dialog>

        {/* Spoilage Modal */}
        <Dialog open={spoilageModal} onOpenChange={setSpoilageModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Record Spoilage</DialogTitle></DialogHeader>
            <div className="space-y-3">
              {spoilageItems.map((it, i) => (
                <div key={i} className="grid grid-cols-4 gap-2">
                  <Input placeholder="SKU" value={it.sku} onChange={e => { const n = [...spoilageItems]; n[i].sku = e.target.value; setSpoilageItems(n); }} className="text-xs" />
                  <Input placeholder="Qty" type="number" value={it.quantity} onChange={e => { const n = [...spoilageItems]; n[i].quantity = e.target.value; setSpoilageItems(n); }} className="text-xs" />
                  <select value={it.reason_category} onChange={e => { const n = [...spoilageItems]; n[i].reason_category = e.target.value; setSpoilageItems(n); }} className="text-xs border rounded px-2">
                    <option value="burnt_food">Burnt</option><option value="overcooked_food">Overcooked</option><option value="expired_food">Expired</option><option value="staff_meals">Staff Meal</option><option value="complimentary_meals">Complimentary</option><option value="wastage">Wastage</option><option value="quality_issue">Quality</option><option value="pest_damage">Pest</option><option value="other">Other</option>
                  </select>
                  <Input placeholder="Notes" value={it.reason} onChange={e => { const n = [...spoilageItems]; n[i].reason = e.target.value; setSpoilageItems(n); }} className="text-xs" />
                </div>
              ))}
              <IOSButton size="sm" variant="secondary" onClick={() => setSpoilageItems([...spoilageItems, { sku: '', quantity: '', reason: '', reason_category: 'other' }])} leftIcon={<Plus size={14} />}>Add Row</IOSButton>
              <IOSButton onClick={handleSpoilage} className="w-full">Record Spoilage</IOSButton>
            </div>
          </DialogContent>
        </Dialog>

        {/* Close Shift Modal */}
        <Dialog open={closeModal} onOpenChange={setCloseModal}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Close Shift - Physical Count</DialogTitle></DialogHeader>
            <div className="space-y-2">
              {items.map((it: any) => (
                <div key={it.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{it.item_name}</p>
                    <p className="text-xs text-gray-400">System close: {it.system_closing_stock} {it.unit_of_measure}</p>
                  </div>
                  <Input placeholder="Physical" type="number" value={physicalCounts.find((p: any) => p.sku === it.item_sku)?.quantity || ''} onChange={e => updatePhysCount(it.item_sku, e.target.value)} className="w-24 text-xs" />
                </div>
              ))}
              <IOSButton onClick={handleClose} className="w-full">Close Shift</IOSButton>
            </div>
          </DialogContent>
        </Dialog>

        {/* Review Modal (Chef / Accountant) */}
        <Dialog open={reviewModal} onOpenChange={setReviewModal}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{shift?.status === 'pending_chef_confirmation' ? 'Chef Confirmation' : 'Accountant Review'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Notes..." className="w-full border rounded-lg p-3 text-sm min-h-[80px]" />
              <div className="flex gap-2">
                <IOSButton onClick={() => shift?.status === 'pending_chef_confirmation' ? handleChefConfirm(true) : handleAccountantReview(true)} className="flex-1 bg-green-600 text-white hover:bg-green-700" leftIcon={<CheckCircle size={16} />}>
                  {shift?.status === 'pending_chef_confirmation' ? 'Confirm' : 'Approve'}
                </IOSButton>
                <IOSButton onClick={() => shift?.status === 'pending_chef_confirmation' ? handleChefConfirm(false) : handleAccountantReview(false)} variant="secondary" className="flex-1 text-red-600 border-red-200" leftIcon={<XCircle size={16} />}>
                  {shift?.status === 'pending_chef_confirmation' ? 'Reject' : 'Reject'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
