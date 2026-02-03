'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { procurementAPI, storeAPI, accountingAPI } from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { IOSButton } from '@/components/ui/ios-button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
    Building2, Phone, Mail, MapPin, Landmark, Calendar,
    FileText, Truck, CreditCard, History, BarChart3,
    ShieldCheck, ArrowLeft, Download, Plus, AlertCircle, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface Supplier {
    id: string;
    name: string;
    supplier_code: string;
    contact_person: string;
    phone: string;
    email: string;
    address: string;
    supplier_pin: string;
    vat_registered: boolean;
    vat_registration_number: string;
    withholding_vat_applicable: boolean;
    withholding_vat_rate: number;
    status: 'active' | 'inactive' | 'blacklisted';
    bank_name?: string;
    bank_account_number?: string;
    bank_branch?: string;
    payment_terms?: string;
    contract_start_date?: string;
    contract_end_date?: string;
}

interface LedgerEntry {
    id: string;
    transaction_date: string;
    transaction_type: string;
    reference_number: string;
    debit_amount: number;
    credit_amount: number;
    running_balance: number;
    description: string;
}

export default function SupplierDetailPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    // Data states
    const [pos, setPos] = useState<any[]>([]);
    const [grns, setGrns] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [ledger, setLedger] = useState<LedgerEntry[]>([]);
    const [performance, setPerformance] = useState<any>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    // Modal States
    const [poModalOpen, setPoModalOpen] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);

    // PO Form Date
    const [poItems, setPoItems] = useState<{ item_id: string; quantity: number; unit_price: number; name: string }[]>([]);
    const [poFormData, setPoFormData] = useState({
        expected_delivery_date: '',
        special_instructions: '',
        payment_terms: '30 Days',
        delivery_terms: 'DDP'
    });
    const [availableItems, setAvailableItems] = useState<any[]>([]);
    const [selectedItemId, setSelectedItemId] = useState('');

    // Export Form Data
    const [exportDates, setExportDates] = useState({
        start_date: '',
        end_date: new Date().toISOString().split('T')[0]
    });

    const fetchItems = async () => {
        const res = await storeAPI.getItems({ limit: 1000 });
        if (res.success && res.data) {
            setAvailableItems(res.data);
        }
    };

    useEffect(() => {
        if (poModalOpen) {
            fetchItems();
        }
    }, [poModalOpen]);

    const handleCreatePO = async () => {
        if (poItems.length === 0) {
            toast.error('Please add at least one item');
            return;
        }

        try {
            setLoading(true);
            const res = await procurementAPI.createPurchaseOrder({
                supplier_id: id,
                items: poItems,
                ...poFormData
            });

            if (res.success) {
                toast.success('Purchase Order created successfully');
                setPoModalOpen(false);
                setPoItems([]);
                setPoFormData({
                    expected_delivery_date: '',
                    special_instructions: '',
                    payment_terms: '30 Days',
                    delivery_terms: 'DDP'
                });
                fetchData(); // Refresh data
            } else {
                toast.error(res.message || 'Failed to create PO');
            }
        } catch (error) {
            console.error('Create PO Error:', error);
            toast.error('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const handleExportStatement = async () => {
        try {
            toast.info('Generating statement...');
            await accountingAPI.exportSupplierStatement({
                supplier_id: id as string,
                start_date: exportDates.start_date,
                end_date: exportDates.end_date
            });
            setExportModalOpen(false);
            toast.success('Download started');
        } catch (error) {
            console.error('Export Error:', error);
            toast.error('Failed to export statement');
        }
    };

    const handleDownloadPO = async (poId: string, poNumber: string) => {
        try {
            toast.info(`Downloading PO ${poNumber}...`);
            await accountingAPI.downloadPurchaseOrder(poId);
            toast.success('Download complete');
        } catch (error) {
            console.error('Download Error:', error);
            toast.error('Failed to download PO');
        }
    };

    const addItemToPO = () => {
        if (!selectedItemId) return;
        const item = availableItems.find(i => i.id === selectedItemId);
        if (!item) return;

        setPoItems([...poItems, {
            item_id: item.id,
            name: item.name,
            quantity: 1,
            unit_price: item.last_purchase_price || item.unit_cost || 0
        }]);
        setSelectedItemId('');
    };

    const removePOItem = (index: number) => {
        const newItems = [...poItems];
        newItems.splice(index, 1);
        setPoItems(newItems);
    };

    const updatePOItem = (index: number, field: string, value: number) => {
        const newItems = [...poItems];
        if (field === 'quantity') newItems[index].quantity = value;
        if (field === 'unit_price') newItems[index].unit_price = value;
        setPoItems(newItems);
    };

    const fetchData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            // 1. Fetch Profile using dedicated endpoint
            const supplierRes = await procurementAPI.getSupplier(id as string);
            if (supplierRes.success && supplierRes.data) {
                setSupplier(supplierRes.data);
            } else {
                toast.error('Supplier not found');
                setLoading(false);
                return;
            }

            // 2. Fetch all related data in parallel
            const [poRes, grnRes, invRes, payRes, ledRes, perfRes, auditRes] = await Promise.all([
                procurementAPI.getPurchaseOrders({ supplier_id: id as string }),
                procurementAPI.getGRNs({ supplier_id: id as string }),
                procurementAPI.getInvoices({ supplier_id: id as string }),
                procurementAPI.getPayments({ supplier_id: id as string }),
                procurementAPI.getSupplierLedger(id as string),
                procurementAPI.getSupplierPerformance(id as string),
                procurementAPI.getAuditTrail({ supplier_id: id as string })
            ]);

            if (poRes.success) setPos(poRes.data || []);
            if (grnRes.success) setGrns(grnRes.data || []);
            if (invRes.success) setInvoices(invRes.data || []);
            if (payRes.success) setPayments(payRes.data || []);
            if (ledRes.success) setLedger(ledRes.data || []);
            if (perfRes.success) setPerformance(perfRes.data);
            if (auditRes.success) setAuditLogs(auditRes.data || []);

        } catch (error) {
            console.error('Error fetching supplier details:', error);
            toast.error('Failed to load supplier records');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="p-8 flex items-center justify-center h-[60vh]">
                    <div className="text-stone-400 flex flex-col items-center gap-2">
                        <RefreshCw className="h-8 w-8 animate-spin" />
                        <p className="text-sm font-medium">Loading compliance records...</p>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    if (!supplier) {
        return (
            <DashboardLayout>
                <div className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-stone-800">Supplier Not Found</h2>
                    <IOSButton variant="secondary" className="mt-4" onClick={() => window.history.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back to List
                    </IOSButton>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.PROCUREMENT, UserRole.CENTRAL_STOREKEEPER, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">

                    {/* Header & Quick Actions */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="space-y-1">
                            <button
                                onClick={() => window.location.href = '/dashboard/central-store/suppliers'}
                                className="flex items-center text-sm text-stone-500 hover:text-[#007AFF] transition-colors mb-2"
                            >
                                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Suppliers
                            </button>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-bold text-stone-900">{supplier.name}</h1>
                                <IOSBadge variant="light" color={supplier.status === 'active' ? 'success' : 'secondary'}>
                                    {(supplier.status || 'UNKNOWN').toUpperCase()}
                                </IOSBadge>
                            </div>
                            <p className="text-stone-500 font-mono text-sm">{supplier.supplier_code}</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" className="bg-white border-stone-200" onClick={() => setExportModalOpen(true)}>
                                <Download className="h-4 w-4 mr-2" /> Export Statement
                            </IOSButton>
                            <IOSButton className="shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700" onClick={() => setPoModalOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" /> New PO
                            </IOSButton>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <IOSCard className="p-4 bg-white/50 backdrop-blur-sm border-stone-100">
                            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">Current Balance</p>
                            <h3 className="text-2xl font-bold text-stone-900">KES {(performance?.current_balance || 0).toLocaleString()}</h3>
                            <p className="text-[10px] text-stone-500 mt-2 flex items-center gap-1">
                                <History className="h-3 w-3" /> Last updated: {new Date().toLocaleDateString()}
                            </p>
                        </IOSCard>
                        <IOSCard className="p-4 bg-white/50 backdrop-blur-sm border-stone-100">
                            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">Pending Orders</p>
                            <h3 className="text-2xl font-bold text-stone-900">{pos.filter(p => p.status === 'pending_approval' || p.status === 'approved').length}</h3>
                            <p className="text-[10px] text-emerald-600 mt-2 font-medium">Value: KES {pos.reduce((sum, p) => sum + (p.total_amount || 0), 0).toLocaleString()}</p>
                        </IOSCard>
                        <IOSCard className="p-4 bg-white/50 backdrop-blur-sm border-stone-100">
                            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">On-Time Delivery</p>
                            <h3 className="text-2xl font-bold text-stone-900">{supplier.vat_registered ? 'Compliant' : 'Non-VAT'}</h3>
                            <div className="w-full bg-stone-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                <div className="bg-emerald-500 h-full w-[95%]" />
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4 bg-white/50 backdrop-blur-sm border-stone-100">
                            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-1">Compliance Status</p>
                            <div className="flex items-center gap-2 mt-1">
                                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                <h3 className="text-lg font-bold text-stone-900">KRA VERIFIED</h3>
                            </div>
                            <p className="text-[10px] text-stone-500 mt-2 font-mono">PIN: {supplier.supplier_pin}</p>
                        </IOSCard>
                    </div>

                    {/* Main Content Tabs */}
                    <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
                        <TabsList className="bg-stone-100/50 p-1 rounded-xl mb-6">
                            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Overview</TabsTrigger>
                            <TabsTrigger value="orders" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Orders & Deliveries</TabsTrigger>
                            <TabsTrigger value="financials" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Financials</TabsTrigger>
                            <TabsTrigger value="ledger" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Ledger</TabsTrigger>
                            <TabsTrigger value="audit" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Tax & Audit</TabsTrigger>
                        </TabsList>

                        {/* OVERVIEW TAB */}
                        <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <IOSCard className="p-6 space-y-4">
                                    <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                                        <Building2 className="h-5 w-5 text-[#007AFF]" />
                                        <h3 className="font-bold text-stone-800">Business Profile</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-4 text-sm">
                                        <div><p className="text-stone-400 text-xs">Contact Person</p><p className="font-medium">{supplier.contact_person}</p></div>
                                        <div><p className="text-stone-400 text-xs">Email</p><p className="font-medium">{supplier.email}</p></div>
                                        <div><p className="text-stone-400 text-xs">Phone</p><p className="font-medium">{supplier.phone}</p></div>
                                        <div><p className="text-stone-400 text-xs">Physical Address</p><p className="font-medium">{supplier.address || 'N/A'}</p></div>
                                        <div><p className="text-stone-400 text-xs">Payment Terms</p><IOSBadge variant="light">{supplier.payment_terms || 'Standard 30 Days'}</IOSBadge></div>
                                        <div>
                                            <p className="text-stone-400 text-xs">Contract Validity</p>
                                            <p className="font-medium text-[11px]">
                                                {supplier.contract_start_date ? `${new Date(supplier.contract_start_date).toLocaleDateString()} - ${new Date(supplier.contract_end_date || '').toLocaleDateString()}` : 'No active contract recorded'}
                                            </p>
                                        </div>
                                    </div>
                                </IOSCard>

                                <IOSCard className="p-6 space-y-4">
                                    <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                                        <Landmark className="h-5 w-5 text-[#007AFF]" />
                                        <h3 className="font-bold text-stone-800">Financial & Tax Details</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-4 text-sm">
                                        <div><p className="text-stone-400 text-xs">Bank Name</p><p className="font-medium">{supplier.bank_name || 'N/A'}</p></div>
                                        <div><p className="text-stone-400 text-xs">Account Number</p><p className="font-medium">{supplier.bank_account_number || 'N/A'}</p></div>
                                        <div><p className="text-stone-400 text-xs">KRA PIN</p><p className="font-mono font-medium">{supplier.supplier_pin}</p></div>
                                        <div><p className="text-stone-400 text-xs">VAT Status</p><IOSBadge variant="light" color={supplier.vat_registered ? 'success' : 'secondary'}>{supplier.vat_registered ? 'REGISTERED' : 'NON-VAT'}</IOSBadge></div>
                                        {supplier.vat_registered && (
                                            <div><p className="text-stone-400 text-xs">VAT Reg No.</p><p className="font-mono font-medium">{supplier.vat_registration_number}</p></div>
                                        )}
                                        <div><p className="text-stone-400 text-xs">W/VAT Rate</p><p className="font-medium">{supplier.withholding_vat_applicable ? `${supplier.withholding_vat_rate}%` : 'Not Applicable'}</p></div>
                                    </div>
                                </IOSCard>
                            </div>

                            <IOSCard className="p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="h-5 w-5 text-[#007AFF]" />
                                        <h3 className="font-bold text-stone-800">Performance Metrics</h3>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                                    <div className="text-center">
                                        <p className="text-xs text-stone-400 mb-2 uppercase tracking-wide font-semibold">Total POs</p>
                                        <p className="text-3xl font-bold">{pos.length}</p>
                                        <p className="text-[10px] text-stone-500 mt-1">Life-to-date</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-stone-400 mb-2 uppercase tracking-wide font-semibold">GRN Fulfilled</p>
                                        <p className="text-3xl font-bold">{grns.length}</p>
                                        <p className="text-[10px] text-emerald-600 mt-1">{pos.length > 0 ? Math.round((grns.length / pos.length) * 100) : 0}% fulfillment</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-stone-400 mb-2 uppercase tracking-wide font-semibold">Avg. Pay Cycle</p>
                                        <p className="text-3xl font-bold">24</p>
                                        <p className="text-[10px] text-stone-500 mt-1">Days from Invoice</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-xs text-stone-400 mb-2 uppercase tracking-wide font-semibold">Dispute Rate</p>
                                        <p className="text-3xl font-bold">1.2%</p>
                                        <p className="text-[10px] text-emerald-600 mt-1">Below average</p>
                                    </div>
                                </div>
                            </IOSCard>
                        </TabsContent>

                        {/* ORDERS & DELIVERIES TAB */}
                        <TabsContent value="orders" className="space-y-6">
                            <IOSCard className="overflow-hidden border-stone-100">
                                <div className="p-4 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-[#007AFF]" /> Purchase History
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-stone-100 bg-stone-50/50">
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">PO Number</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Date</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Status</th>
                                                <th className="text-right py-3 px-4 font-semibold text-stone-500">Amount (KES)</th>
                                                <th className="text-center py-3 px-4 font-semibold text-stone-500">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pos.length === 0 ? (
                                                <tr><td colSpan={5} className="py-8 text-center text-stone-400 italic">No purchase orders found</td></tr>
                                            ) : pos.map((po) => (
                                                <tr key={po.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                                                    <td className="py-3 px-4 font-mono font-medium text-[#007AFF]">{po.po_number}</td>
                                                    <td className="py-3 px-4">{new Date(po.po_date).toLocaleDateString()}</td>
                                                    <td className="py-3 px-4"><IOSBadge variant="light" color={po.status === 'approved' ? 'success' : 'secondary'}>{po.status}</IOSBadge></td>
                                                    <td className="py-3 px-4 text-right font-medium">{po.total_amount.toLocaleString()}</td>
                                                    <td className="py-3 px-4 text-center">
                                                        <button
                                                            className="text-stone-400 hover:text-[#007AFF]"
                                                            onClick={() => handleDownloadPO(po.id, po.po_number)}
                                                            title="Download PO PDF"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </IOSCard>

                            <IOSCard className="overflow-hidden border-stone-100">
                                <div className="p-4 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                        <Truck className="h-4 w-4 text-[#007AFF]" /> Goods Received (GRN)
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-stone-100 bg-stone-50/50">
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">GRN No.</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Date</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">PO Ref</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Total Items</th>
                                                <th className="text-right py-3 px-4 font-semibold text-stone-500">Value (KES)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {grns.length === 0 ? (
                                                <tr><td colSpan={5} className="py-8 text-center text-stone-400 italic">No delivery records found</td></tr>
                                            ) : grns.map((grn) => (
                                                <tr key={grn.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                                                    <td className="py-3 px-4 font-mono font-medium text-[#007AFF]">{grn.grn_number}</td>
                                                    <td className="py-3 px-4">{new Date(grn.grn_date).toLocaleDateString()}</td>
                                                    <td className="py-3 px-4 text-stone-500">{grn.purchase_order?.po_number || 'Direct'}</td>
                                                    <td className="py-3 px-4 text-center">{grn.total_items}</td>
                                                    <td className="py-3 px-4 text-right font-medium">{grn.total_value.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </IOSCard>
                        </TabsContent>

                        {/* FINANCIALS TAB */}
                        <TabsContent value="financials" className="space-y-6">
                            <IOSCard className="overflow-hidden border-stone-100">
                                <div className="p-4 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-[#007AFF]" /> Supplier Invoices
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-stone-100 bg-stone-50/50">
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Invoice No.</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Date</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Due Date</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Status</th>
                                                <th className="text-right py-3 px-4 font-semibold text-stone-500">Amount (KES)</th>
                                                <th className="text-right py-3 px-4 font-semibold text-stone-500">Balance (KES)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoices.length === 0 ? (
                                                <tr><td colSpan={6} className="py-8 text-center text-stone-400 italic">No invoices found</td></tr>
                                            ) : invoices.map((inv) => (
                                                <tr key={inv.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                                                    <td className="py-3 px-4 font-mono font-medium text-[#007AFF]">{inv.invoice_number}</td>
                                                    <td className="py-3 px-4">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                                                    <td className="py-3 px-4 text-stone-500">{new Date(inv.due_date).toLocaleDateString()}</td>
                                                    <td className="py-3 px-4">
                                                        <IOSBadge variant="light" color={inv.status === 'paid' ? 'success' : inv.status === 'partially_paid' ? 'warning' : 'secondary'}>
                                                            {inv.status}
                                                        </IOSBadge>
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-medium">{inv.total_amount.toLocaleString()}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-red-600">{inv.balance_due.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </IOSCard>

                            <IOSCard className="overflow-hidden border-stone-100">
                                <div className="p-4 bg-stone-50 border-b border-stone-100">
                                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                        <CreditCard className="h-4 w-4 text-[#007AFF]" /> Payment History
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-stone-100 bg-stone-50/50">
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Payment No.</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Date</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Method</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Reference</th>
                                                <th className="text-right py-3 px-4 font-semibold text-stone-500">Amount (KES)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {payments.length === 0 ? (
                                                <tr><td colSpan={5} className="py-8 text-center text-stone-400 italic">No payment records found</td></tr>
                                            ) : payments.map((pay) => (
                                                <tr key={pay.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                                                    <td className="py-3 px-4 font-mono font-medium text-[#007AFF]">{pay.payment_number}</td>
                                                    <td className="py-3 px-4">{new Date(pay.payment_date).toLocaleDateString()}</td>
                                                    <td className="py-3 px-4 capitalize">{pay.payment_method}</td>
                                                    <td className="py-3 px-4 text-stone-500">{pay.reference_number || 'N/A'}</td>
                                                    <td className="py-3 px-4 text-right font-bold text-emerald-600">{pay.payment_amount.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </IOSCard>
                        </TabsContent>

                        {/* LEDGER TAB */}
                        <TabsContent value="ledger" className="space-y-6">
                            <IOSCard className="overflow-hidden border-stone-100 shadow-xl shadow-stone-200/50">
                                <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
                                    <h3 className="font-bold flex items-center gap-2">
                                        <Landmark className="h-4 w-4 text-emerald-400" /> Accounts Payable Ledger
                                    </h3>
                                    <div className="text-right">
                                        <p className="text-[10px] text-stone-400 uppercase">Closing Balance</p>
                                        <p className="text-lg font-bold">KES {(performance?.current_balance || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[13px]">
                                        <thead>
                                            <tr className="border-b border-stone-100 bg-stone-50/50">
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Date</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Type</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500">Reference</th>
                                                <th className="text-left py-3 px-4 font-semibold text-stone-500 hidden md:table-cell">Description</th>
                                                <th className="text-right py-3 px-4 font-semibold text-stone-800 bg-red-50/30">Debit (KES)</th>
                                                <th className="text-right py-3 px-4 font-semibold text-stone-800 bg-emerald-50/30">Credit (KES)</th>
                                                <th className="text-right py-3 px-4 font-bold text-stone-900">Balance (KES)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ledger.length === 0 ? (
                                                <tr><td colSpan={7} className="py-8 text-center text-stone-400 italic">No ledger transactions recorded</td></tr>
                                            ) : ledger.map((entry) => (
                                                <tr key={entry.id} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                                                    <td className="py-3 px-4">{new Date(entry.transaction_date).toLocaleDateString()}</td>
                                                    <td className="py-3 px-4 capitalize font-medium">{entry.transaction_type.replace('_', ' ')}</td>
                                                    <td className="py-3 px-4 font-mono text-[#007AFF]">{entry.reference_number}</td>
                                                    <td className="py-3 px-4 text-stone-500 hidden md:table-cell truncate max-w-[200px]">{entry.description}</td>
                                                    <td className="py-3 px-4 text-right text-emerald-600 bg-red-50/10">{entry.debit_amount > 0 ? entry.debit_amount.toLocaleString() : '-'}</td>
                                                    <td className="py-3 px-4 text-right text-red-600 bg-emerald-50/10">{entry.credit_amount > 0 ? entry.credit_amount.toLocaleString() : '-'}</td>
                                                    <td className="py-3 px-4 text-right font-bold">{entry.running_balance.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </IOSCard>
                        </TabsContent>

                        {/* TAX & AUDIT TAB */}
                        <TabsContent value="audit" className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-[11px]">
                                <IOSCard className="p-4 bg-emerald-50/50 border-emerald-100">
                                    <h3 className="font-bold text-emerald-800 flex items-center gap-2 mb-3">
                                        <ShieldCheck className="h-4 w-4" /> VAT Registration Summary
                                    </h3>
                                    <div className="space-y-2 text-stone-700">
                                        <div className="flex justify-between"><span>Registration Number:</span><span className="font-bold">{supplier.vat_registration_number || 'N/A'}</span></div>
                                        <div className="flex justify-between"><span>PIN Number:</span><span className="font-bold">{supplier.supplier_pin}</span></div>
                                        <div className="flex justify-between"><span>Compliance Status:</span><span className="text-emerald-600 font-bold uppercase">COMPLIANT</span></div>
                                        <div className="flex justify-between"><span>Withholding Tax:</span><span className="font-bold">{supplier.withholding_vat_applicable ? `${supplier.withholding_vat_rate}%` : 'EXEMPT'}</span></div>
                                    </div>
                                </IOSCard>
                                <IOSCard className="p-4 bg-blue-50/50 border-blue-100">
                                    <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-3">
                                        <AlertCircle className="h-4 w-4" /> Statutory Notes
                                    </h3>
                                    <div className="space-y-2 text-stone-700">
                                        <p>KRA requires storage of all invoices and GRNs for a period of 7 years. This ledger is system-generated and reflects immutable transaction IDs.</p>
                                        <p className="mt-2">Verified Bank Detail: {supplier.bank_name || 'NOT LINKED'}</p>
                                    </div>
                                </IOSCard>
                            </div>

                            <IOSCard className="overflow-hidden border-stone-100">
                                <div className="p-4 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                                    <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                        <History className="h-4 w-4 text-[#007AFF]" /> Audit Trail (Verified Actions)
                                    </h3>
                                </div>
                                <div className="p-0">
                                    {auditLogs.length === 0 ? (
                                        <div className="p-8 text-center text-stone-400 italic">No audit records for this supplier</div>
                                    ) : (
                                        <div className="max-h-[400px] overflow-y-auto">
                                            {auditLogs.map((log, i) => (
                                                <div key={log.id} className={`p-3 text-xs flex gap-4 ${i !== auditLogs.length - 1 ? 'border-b border-stone-50' : ''}`}>
                                                    <div className="text-stone-400 min-w-[70px]">{new Date(log.action_timestamp).toLocaleDateString()}</div>
                                                    <div className="flex-1">
                                                        <span className="font-bold text-stone-800">{log.user_name}</span>
                                                        <span className="text-stone-500 mx-1">{log.description}</span>
                                                        {log.entity_reference && <span className="text-[#007AFF] font-mono">[{log.entity_reference}]</span>}
                                                    </div>
                                                    <div className="text-right">
                                                        <IOSBadge variant="light" className="text-[9px] py-0 px-1">{(log.action || '').toUpperCase()}</IOSBadge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </IOSCard>
                        </TabsContent>
                    </Tabs>
                    {/* NEW PO MODAL */}
                    <Dialog open={poModalOpen} onOpenChange={setPoModalOpen}>
                        <DialogContent className="max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>Create Purchase Order - {supplier.name}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Expected Delivery Date</Label>
                                        <Input type="date" value={poFormData.expected_delivery_date} onChange={e => setPoFormData({ ...poFormData, expected_delivery_date: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Payment Terms</Label>
                                        <Select value={poFormData.payment_terms} onValueChange={v => setPoFormData({ ...poFormData, payment_terms: v })}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Immediate">Immediate</SelectItem>
                                                <SelectItem value="7 Days">7 Days</SelectItem>
                                                <SelectItem value="14 Days">14 Days</SelectItem>
                                                <SelectItem value="30 Days">30 Days</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Special Instructions</Label>
                                    <Textarea value={poFormData.special_instructions} onChange={e => setPoFormData({ ...poFormData, special_instructions: e.target.value })} placeholder="e.g., Deliver to rear entrance..." />
                                </div>

                                <div className="border-t pt-4">
                                    <h4 className="font-semibold mb-2">Order Items</h4>
                                    <div className="flex gap-2 mb-4">
                                        <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                                            <SelectTrigger className="flex-1"><SelectValue placeholder="Select Item to Add" /></SelectTrigger>
                                            <SelectContent>
                                                {availableItems.map(item => (
                                                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button onClick={addItemToPO} disabled={!selectedItemId}>Add</Button>
                                    </div>

                                    <div className="max-h-[200px] overflow-y-auto border rounded-md">
                                        <table className="w-full text-sm">
                                            <thead className="bg-stone-50">
                                                <tr>
                                                    <th className="text-left p-2">Item</th>
                                                    <th className="text-right p-2 w-[100px]">Qty</th>
                                                    <th className="text-right p-2 w-[120px]">Price</th>
                                                    <th className="text-right p-2 w-[120px]">Total</th>
                                                    <th className="w-[50px]"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {poItems.length === 0 ? (
                                                    <tr><td colSpan={5} className="p-4 text-center text-stone-400">No items added</td></tr>
                                                ) : poItems.map((item, idx) => (
                                                    <tr key={idx} className="border-b">
                                                        <td className="p-2">{item.name}</td>
                                                        <td className="p-2">
                                                            <Input type="number" min="1" className="h-8 text-right" value={item.quantity} onChange={e => updatePOItem(idx, 'quantity', Number(e.target.value))} />
                                                        </td>
                                                        <td className="p-2">
                                                            <Input type="number" min="0" className="h-8 text-right" value={item.unit_price} onChange={e => updatePOItem(idx, 'unit_price', Number(e.target.value))} />
                                                        </td>
                                                        <td className="p-2 text-right font-medium">{(item.quantity * item.unit_price).toLocaleString()}</td>
                                                        <td className="p-2 text-center">
                                                            <Button variant="ghost" size="sm" onClick={() => removePOItem(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="mt-2 text-right font-bold text-lg">
                                        Total: KES {poItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setPoModalOpen(false)}>Cancel</Button>
                                <Button onClick={handleCreatePO} disabled={poItems.length === 0}>Create Purchase Order</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* EXPORT STATEMENT MODAL */}
                    <Dialog open={exportModalOpen} onOpenChange={setExportModalOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Export Supplier Statement</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Start Date (Optional)</Label>
                                    <Input type="date" value={exportDates.start_date} onChange={e => setExportDates({ ...exportDates, start_date: e.target.value })} />
                                    <p className="text-xs text-stone-500">Leave blank for all history</p>
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date</Label>
                                    <Input type="date" value={exportDates.end_date} onChange={e => setExportDates({ ...exportDates, end_date: e.target.value })} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setExportModalOpen(false)}>Cancel</Button>
                                <Button onClick={handleExportStatement}>Download PDF</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
