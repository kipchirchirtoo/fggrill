'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Calculator, Plus, Search, Scale,
    ArrowRight, AlertCircle, Edit2, Trash2, Info,
    History, CheckCircle2, XCircle, LayoutGrid, ClipboardCheck, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { format } from 'date-fns';

interface YieldRule {
    id: number;
    raw_item_name: string;
    raw_quantity: number;
    raw_unit: string;
    produced_item_name: string;
    produced_portions: number;
}

export default function FoodControlsPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [rules, setRules] = useState<YieldRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const calculatorRef = useRef<HTMLDivElement>(null);

    // Calculator State
    const [selectedRule, setSelectedRule] = useState<YieldRule | null>(null);
    const [calcQuantity, setCalcQuantity] = useState<string>('');
    const [calcResult, setCalcResult] = useState<number | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingRule, setEditingRule] = useState<YieldRule | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        raw_item_name: '',
        raw_quantity: 0,
        raw_unit: 'kg',
        produced_item_name: '',
        produced_portions: 0
    });

    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // New State for Portions & Variance
    const [activeTab, setActiveTab] = useState<'rules' | 'portions' | 'variance' | 'reports'>('rules');
    const [portionStock, setPortionStock] = useState<any[]>([]);
    const [variances, setVariances] = useState<any[]>([]);
    const [varianceReasons, setVarianceReasons] = useState<any[]>([]);
    const [isReconciling, setIsReconciling] = useState(false);
    const [selectedVariance, setSelectedVariance] = useState<any | null>(null);
    const [varianceReasonId, setVarianceReasonId] = useState<string>('');
    const [varianceNotes, setVarianceNotes] = useState<string>('');
    const [isVarianceModalOpen, setIsVarianceModalOpen] = useState(false);
    const [reportData, setReportData] = useState<any>({ yield: [], loss: [], totalLoss: 0 });
    const [reportDates, setReportDates] = useState({
        start: format(new Date(), 'yyyy-MM-01'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get('tab');
        if (tab === 'portions' || tab === 'variance' || tab === 'rules') {
            setActiveTab(tab as any);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'rules') fetchRules();
        if (activeTab === 'portions') fetchPortionStock();
        if (activeTab === 'variance') {
            fetchVariances();
            fetchVarianceReasons();
        }
    }, [activeBranchId, activeTab]);

    const fetchPortionStock = async () => {
        if (!activeBranchId) return;
        setIsLoading(true);
        try {
            const response = await api.kitchen.getPortionStock(activeBranchId);
            if (response.success) setPortionStock(response.data);
        } catch (error) {
            console.error('Error fetching portions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchVariances = async () => {
        if (!activeBranchId) return;
        setIsLoading(true);
        try {
            const response = await api.kitchen.getDailyVariance({ branch_id: activeBranchId });
            if (response.success) setVariances(response.data);
        } catch (error) {
            console.error('Error fetching variances:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchVarianceReasons = async () => {
        try {
            const response = await api.kitchen.getVarianceReasons();
            if (response.success) setVarianceReasons(response.data);
        } catch (error) {
            console.error('Error fetching reasons:', error);
        }
    };

    const fetchReports = async () => {
        if (!activeBranchId) return;
        setIsLoading(true);
        try {
            const [yieldRes, lossRes] = await Promise.all([
                api.kitchen.getYieldReport({
                    branch_id: Number(activeBranchId),
                    start_date: reportDates.start,
                    end_date: reportDates.end
                }),
                api.kitchen.getLossReport({
                    branch_id: Number(activeBranchId),
                    start_date: reportDates.start,
                    end_date: reportDates.end
                })
            ]);
            setReportData({
                yield: yieldRes.data,
                loss: lossRes.data,
                totalLoss: lossRes.totalLoss || 0
            });
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'reports') fetchReports();
    }, [activeBranchId, activeTab, reportDates]);

    const handleSubmitVarianceReason = async () => {
        if (!selectedVariance || !varianceReasonId) return;
        setIsReconciling(true);
        try {
            await api.kitchen.submitVarianceReason(selectedVariance.id, {
                reason_id: parseInt(varianceReasonId),
                notes: varianceNotes
            });
            toast.success('Variance reason submitted');
            setIsVarianceModalOpen(false);
            fetchVariances();
        } catch (error: any) {
            toast.error(error.message || 'Submission failed');
        } finally {
            setIsReconciling(false);
        }
    };

    const handleApproveVariance = async (id: number, status: 'approved' | 'rejected') => {
        const notes = prompt(`Enter ${status} notes (optional):`) || '';
        try {
            await api.kitchen.approveVariance(id, { status, notes });
            toast.success(`Variance ${status}`);
            fetchVariances();
        } catch (error: any) {
            toast.error(error.message || 'Action failed');
        }
    };

    useEffect(() => {
        fetchRules();
    }, [activeBranchId]);

    const fetchRules = async () => {
        setIsLoading(true);
        try {
            const response = await api.kitchen.getFoodControls(activeBranchId || undefined);
            if (response.success) {
                setRules(response.data);
            }
        } catch (error) {
            console.error('Error fetching food controls:', error);
            toast.error('Failed to load food control rules');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCalculate = () => {
        if (!selectedRule || !calcQuantity) return;

        const rawQty = parseFloat(calcQuantity);
        if (isNaN(rawQty)) return;

        // Formula: (Input / Standard Raw) * Standard Portions
        const result = (rawQty / selectedRule.raw_quantity) * selectedRule.produced_portions;
        setCalcResult(Number(result.toFixed(2)));
    };

    const handleQuickCalculate = (rule: YieldRule) => {
        setSelectedRule(rule);
        setCalcQuantity(rule.raw_quantity.toString());
        const result = (rule.raw_quantity / rule.raw_quantity) * rule.produced_portions;
        setCalcResult(Number(result.toFixed(2)));

        // Scroll to calculator
        setTimeout(() => {
            calculatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    const openCreateModal = () => {
        setModalMode('create');
        setEditingRule(null);
        setFormData({
            raw_item_name: '',
            raw_quantity: 0,
            raw_unit: 'kg',
            produced_item_name: '',
            produced_portions: 0
        });
        setIsModalOpen(true);
    };

    const openEditModal = (rule: YieldRule) => {
        setModalMode('edit');
        setEditingRule(rule);
        setFormData({
            raw_item_name: rule.raw_item_name,
            raw_quantity: rule.raw_quantity,
            raw_unit: rule.raw_unit,
            produced_item_name: rule.produced_item_name,
            produced_portions: rule.produced_portions
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async () => {
        // Validation
        if (!formData.raw_item_name.trim()) {
            toast.error('Raw item name is required');
            return;
        }
        if (!formData.produced_item_name.trim()) {
            toast.error('Produced item name is required');
            return;
        }
        if (formData.raw_quantity <= 0) {
            toast.error('Raw quantity must be greater than 0');
            return;
        }
        if (formData.produced_portions <= 0) {
            toast.error('Produced portions must be greater than 0');
            return;
        }

        setIsSubmitting(true);
        try {
            if (modalMode === 'create') {
                const response = await api.kitchen.createFoodControl(formData);
                if (response.success) {
                    toast.success('Standard created');
                    setIsModalOpen(false);
                    fetchRules();
                }
            } else {
                const response = await api.kitchen.updateFoodControl(editingRule!.id, formData);
                if (response.success) {
                    toast.success('Standard updated');
                    setIsModalOpen(false);
                    fetchRules();
                }
            }
        } catch (error: any) {
            toast.error(error.message || 'Operation failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        setIsDeleting(true);
        try {
            const response = await api.kitchen.deleteFoodControl(id);
            if (response.success) {
                toast.success('Standard deleted');
                setDeleteConfirmId(null);
                fetchRules();
            }
        } catch (error: any) {
            toast.error(error.message || 'Delete failed');
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredRules = rules.filter(r =>
        r.raw_item_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.produced_item_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const isManager = user?.role === UserRole.SUPER_ADMIN ||
        user?.role === UserRole.GENERAL_MANAGER ||
        user?.role === UserRole.BRANCH_MANAGER;

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.KITCHEN,
            UserRole.KITCHEN_OPERATIONS,
            UserRole.SUPER_ADMIN,
            UserRole.GENERAL_MANAGER,
            UserRole.BRANCH_MANAGER
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Tabs */}
                    <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => setActiveTab('rules')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'rules' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                        >
                            <Scale className="h-4 w-4" />
                            Yield Standards
                        </button>
                        <button
                            onClick={() => setActiveTab('portions')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'portions' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                        >
                            <LayoutGrid className="h-4 w-4" />
                            Portion Stock
                        </button>
                        <button
                            onClick={() => setActiveTab('variance')}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'variance' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                        >
                            <ClipboardCheck className="h-4 w-4" />
                            Variance Reconciliation
                        </button>
                        <button
                            onClick={() => setActiveTab('reports' as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'reports' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                        >
                            <BarChart3 className={`h-4 w-4 ${activeTab === 'reports' ? 'text-stone-900' : ''}`} />
                            Reports
                        </button>
                    </div>

                    {activeTab === 'rules' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                            {/* Yield Calculator */}
                            <div className="lg:col-span-1" ref={calculatorRef}>
                                <div className="card-elevated p-5">
                                    <div className="flex items-center gap-3 mb-5">
                                        <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500">
                                            <Calculator className="h-5 w-5" />
                                        </div>
                                        <h2 className="text-[17px] font-semibold text-stone-900">Yield Calculator</h2>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="input-label">Select Ingredient</label>
                                            <select
                                                className="input-field"
                                                onChange={(e) => {
                                                    const rule = rules.find(r => r.id === parseInt(e.target.value));
                                                    setSelectedRule(rule || null);
                                                    setCalcResult(null);
                                                }}
                                                value={selectedRule?.id || ''}
                                            >
                                                <option value="">Choose an ingredient...</option>
                                                {rules.map(r => (
                                                    <option key={r.id} value={r.id}>{r.raw_item_name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {selectedRule && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="input-label">
                                                    Quantity ({selectedRule.raw_unit})
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        placeholder={`Enter ${selectedRule.raw_unit}...`}
                                                        value={calcQuantity}
                                                        onChange={(e) => setCalcQuantity(e.target.value)}
                                                        className="input-field pr-16"
                                                    />
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                                                        {selectedRule.raw_unit}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-2">
                                            <button
                                                className="btn-primary w-full"
                                                onClick={handleCalculate}
                                                disabled={!selectedRule || !calcQuantity}
                                            >
                                                Calculate Yield
                                            </button>
                                        </div>

                                        {calcResult !== null && selectedRule && (
                                            <div className="mt-6 p-5 rounded-lg bg-stone-50 border border-stone-100/50 text-center animate-in zoom-in-95 duration-200">
                                                <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                                                    Expected Output
                                                </p>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-3xl font-bold text-stone-800 tracking-tight">
                                                        {calcResult}
                                                    </span>
                                                    <span className="text-[13px] font-medium text-stone-500 mt-1">
                                                        {selectedRule.produced_item_name}
                                                    </span>
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-stone-200/50 flex items-center justify-between text-[12px]">
                                                    <div className="text-stone-500 font-medium">Standard Ratio</div>
                                                    <div className="font-semibold text-stone-700">
                                                        {selectedRule.raw_quantity} {selectedRule.raw_unit} : {selectedRule.produced_portions} Portions
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Rules Table */}
                            <div className="lg:col-span-2 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                        <input
                                            placeholder="Search rules..."
                                            className="input-field pl-10"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 text-[13px] font-medium text-stone-500 bg-stone-100 px-3 py-2 rounded-lg">
                                        <Scale className="h-4 w-4" />
                                        {rules.length} Rules
                                    </div>
                                    <button
                                        onClick={openCreateModal}
                                        disabled={(user?.role !== UserRole.SUPER_ADMIN && user?.role !== UserRole.BRANCH_MANAGER && user?.role !== UserRole.GENERAL_MANAGER)}
                                        className="btn-primary"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span className="hidden sm:inline">Add Standard</span>
                                        <span className="sm:hidden">Add</span>
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {isLoading ? (
                                        [1, 2, 3].map(i => (
                                            <div key={i} className="h-20 rounded-lg bg-stone-100 animate-pulse" />
                                        ))
                                    ) : filteredRules.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                                            <div className="h-12 w-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
                                                <AlertCircle className="h-6 w-6 text-stone-400" />
                                            </div>
                                            <p className="text-stone-500 font-medium">No yield rules found</p>
                                        </div>
                                    ) : (
                                        filteredRules.map((rule) => (
                                            <div key={rule.id} className="card-elevated p-4 hover:border-stone-300 transition-colors">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="h-10 w-1 rounded-full bg-stone-800" />
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h3 className="font-semibold text-stone-900">{rule.raw_item_name}</h3>
                                                                <ArrowRight className="h-3 w-3 text-stone-400" />
                                                                <span className="text-[13px] font-medium text-stone-600">
                                                                    {rule.produced_item_name}
                                                                </span>
                                                            </div>
                                                            <div className="text-[13px] text-stone-500">
                                                                {rule.raw_quantity} {rule.raw_unit} yields {rule.produced_portions} portions
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right hidden sm:block mr-2">
                                                            <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider mb-0.5">
                                                                Ratio
                                                            </div>
                                                            <div className="text-[13px] font-medium text-stone-900 tabular-nums">
                                                                1:{(rule.produced_portions / rule.raw_quantity).toFixed(1)}
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                className="btn-ghost p-2 h-8 w-8 rounded-lg"
                                                                onClick={() => handleQuickCalculate(rule)}
                                                                title="Quick calculate"
                                                            >
                                                                <Calculator className="h-4 w-4" />
                                                            </button>
                                                            {isManager && (
                                                                <>
                                                                    <button
                                                                        className="btn-ghost p-2 h-8 w-8 rounded-lg text-stone-500 hover:text-stone-900"
                                                                        onClick={() => openEditModal(rule)}
                                                                        title="Edit"
                                                                    >
                                                                        <Edit2 className="h-4 w-4" />
                                                                    </button>
                                                                    <button
                                                                        className="btn-ghost p-2 h-8 w-8 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700"
                                                                        onClick={() => setDeleteConfirmId(rule.id)}
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'portions' && (
                        <div className="card-elevated overflow-hidden animate-in fade-in duration-300">
                            <div className="p-5 border-b border-stone-100 flex items-center justify-between">
                                <h2 className="text-[17px] font-semibold text-stone-900">Virtual Portion Stock</h2>
                                <div className="text-xs text-stone-500 font-medium bg-stone-50 px-3 py-1.5 rounded-full border border-stone-100">
                                    Real-time expected levels based on yield rules
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-stone-50/50">
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider">Item / SKU</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider">Portion Name</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider text-right">Expected Balance</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider">Last Sync</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {portionStock.map((item) => (
                                            <tr key={item.id} className="hover:bg-stone-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="font-semibold text-stone-900">{item.item_sku}</div>
                                                </td>
                                                <td className="px-6 py-4 text-stone-600 font-medium">{item.portion_name}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`px-3 py-1.5 rounded-lg font-bold tabular-nums ${item.expected_balance > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                                                        {item.expected_balance}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-stone-400 text-sm">
                                                    {format(new Date(item.last_updated), 'MMM d, HH:mm')}
                                                </td>
                                            </tr>
                                        ))}
                                        {portionStock.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-stone-500">
                                                    No portions currently tracked. These are generated when raw materials are issued to the kitchen.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'variance' && (
                        <div className="card-elevated animate-in fade-in duration-300">
                            <div className="p-5 border-b border-stone-100">
                                <h2 className="text-[17px] font-semibold text-stone-900">Variance Reconciliation</h2>
                                <p className="text-[13px] text-stone-500 mt-0.5">Discrepancies between expected and actual closing stock</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-stone-50/50">
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider">Item</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider text-right">Exp vs Act</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider text-right">Variance</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider">Reason</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider text-right">Loss (KES)</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-4 text-[12px] font-semibold text-stone-500 uppercase tracking-wider text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {variances.map((v) => (
                                            <tr key={v.id} className="hover:bg-stone-50/50 transition-colors">
                                                <td className="px-6 py-4 text-stone-600 text-[13px]">
                                                    {format(new Date(v.variance_date), 'MMM d, yyyy')}
                                                </td>
                                                <td className="px-6 py-4 font-semibold text-stone-900">{v.item_name}</td>
                                                <td className="px-6 py-4 text-right tabular-nums text-[13px]">
                                                    {v.expected_closing} / {v.actual_closing}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`font-bold tabular-nums ${v.variance < 0 ? 'text-red-500' : 'text-stone-400'}`}>
                                                        {v.variance}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {v.reason?.reason ? (
                                                        <span className="text-[13px] font-medium text-stone-700">{v.reason.reason}</span>
                                                    ) : (
                                                        <span className="text-[12px] text-rose-500 font-semibold italic flex items-center gap-1">
                                                            <AlertCircle className="h-3 w-3" /> Reason Required
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums text-[13px] font-semibold text-rose-600">
                                                    KES {Math.abs(v.cost_value || 0).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {v.is_locked ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                                            <CheckCircle2 className="h-3 w-3" /> Approved
                                                        </span>
                                                    ) : v.reason_id ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                                            Pending Approval
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-1 rounded">
                                                            Action Required
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        {!v.is_locked && (
                                                            <button
                                                                className="btn-ghost p-1.5 h-8 w-8 rounded-lg text-stone-600 hover:text-stone-900"
                                                                onClick={() => {
                                                                    setSelectedVariance(v);
                                                                    setVarianceReasonId(v.reason_id?.toString() || '');
                                                                    setVarianceNotes(v.notes || '');
                                                                    setIsVarianceModalOpen(true);
                                                                }}
                                                                title="Set Reason"
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        {isManager && v.reason_id && !v.is_locked && (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    className="btn-ghost p-1.5 h-8 w-8 rounded-lg text-emerald-600 hover:bg-emerald-50"
                                                                    onClick={() => handleApproveVariance(v.id, 'approved')}
                                                                    title="Approve"
                                                                >
                                                                    <CheckCircle2 className="h-4 w-4" />
                                                                </button>
                                                                <button
                                                                    className="btn-ghost p-1.5 h-8 w-8 rounded-lg text-rose-600 hover:bg-rose-50"
                                                                    onClick={() => handleApproveVariance(v.id, 'rejected')}
                                                                    title="Reject"
                                                                >
                                                                    <XCircle className="h-4 w-4" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {variances.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-12 text-center text-stone-500">
                                                    No variance records found. These are generated during daily stock counts.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Create/Edit Modal */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="px-5 py-4 border-b border-stone-100 bg-stone-50/50">
                            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold text-stone-900">
                                <Scale className="h-5 w-5 text-stone-500" />
                                {modalMode === 'create' ? 'Add Yield Standard' : 'Edit Yield Standard'}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="overflow-y-auto px-5 py-5 flex-1 space-y-5">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-4">
                                    <h3 className="text-[12px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1">
                                        Raw Ingredient
                                    </h3>
                                    <div>
                                        <label className="input-label">Item Name</label>
                                        <input
                                            value={formData.raw_item_name}
                                            onChange={(e) => setFormData({ ...formData, raw_item_name: e.target.value })}
                                            placeholder="e.g., Raw Beef"
                                            className="input-field py-2 text-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="input-label">Qty</label>
                                            <input
                                                type="number"
                                                value={formData.raw_quantity}
                                                onChange={(e) => setFormData({ ...formData, raw_quantity: Number(e.target.value) })}
                                                placeholder="0"
                                                className="input-field py-2 text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="input-label">Unit</label>
                                            <select
                                                value={formData.raw_unit}
                                                onChange={(e) => setFormData({ ...formData, raw_unit: e.target.value })}
                                                className="input-field py-2 text-sm"
                                            >
                                                <option value="kg">kg</option>
                                                <option value="g">g</option>
                                                <option value="liters">liters</option>
                                                <option value="ml">ml</option>
                                                <option value="pieces">pcs</option>
                                                <option value="units">units</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-[12px] font-semibold uppercase tracking-wider text-stone-500 border-b border-stone-100 pb-1">
                                        Produced Output
                                    </h3>
                                    <div>
                                        <label className="input-label">Item Name</label>
                                        <input
                                            value={formData.produced_item_name}
                                            onChange={(e) => setFormData({ ...formData, produced_item_name: e.target.value })}
                                            placeholder="e.g., Beef Portions"
                                            className="input-field py-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="input-label">Portions</label>
                                        <input
                                            type="number"
                                            value={formData.produced_portions}
                                            onChange={(e) => setFormData({ ...formData, produced_portions: Number(e.target.value) })}
                                            placeholder="0"
                                            className="input-field py-2 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 rounded-lg bg-stone-50 border border-stone-100 flex items-start gap-2.5">
                                <Info className="h-4 w-4 text-stone-400 mt-0.5" />
                                <div className="text-[13px] text-stone-600">
                                    <span className="font-medium text-stone-800">Example:</span> If 5 kg of raw chicken produces 20 portions, enter: Raw Qty = 5, Unit = kg, Portions = 20
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 px-5 py-4 border-t border-stone-100 bg-stone-50/50">
                            <button
                                className="btn-secondary flex-1"
                                onClick={() => setIsModalOpen(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary flex-1"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Saving...' : 'Save Standard'}
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Variance Reason Modal */}
                <Dialog open={isVarianceModalOpen} onOpenChange={setIsVarianceModalOpen}>
                    <DialogContent className="max-w-md p-0 overflow-hidden">
                        <DialogHeader className="px-5 py-4 border-b border-stone-100 bg-stone-50/50">
                            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold text-stone-900">
                                <ClipboardCheck className="h-5 w-5 text-stone-500" />
                                Reconcile Variance
                            </DialogTitle>
                        </DialogHeader>

                        <div className="p-5 space-y-4">
                            {selectedVariance && (
                                <div className="p-3 rounded-lg bg-red-50 border border-red-100 mb-4">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-semibold text-red-900">{selectedVariance.item_name}</span>
                                        <span className="text-xs font-bold text-red-600">Variance: {selectedVariance.variance}</span>
                                    </div>
                                    <p className="text-[12px] text-red-700">
                                        Expected: {selectedVariance.expected_closing} | Actual: {selectedVariance.actual_closing}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="input-label">Variance Reason</label>
                                <select
                                    className="input-field"
                                    value={varianceReasonId}
                                    onChange={(e) => setVarianceReasonId(e.target.value)}
                                >
                                    <option value="">Select a reason...</option>
                                    {varianceReasons.map(r => (
                                        <option key={r.id} value={r.id}>{r.reason}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="input-label">Detailed Notes</label>
                                <textarea
                                    className="input-field min-h-[100px] py-2"
                                    placeholder="Explain the cause of this variance..."
                                    value={varianceNotes}
                                    onChange={(e) => setVarianceNotes(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 px-5 py-4 border-t border-stone-100 bg-stone-50/50">
                            <button
                                className="btn-secondary flex-1"
                                onClick={() => setIsVarianceModalOpen(false)}
                                disabled={isReconciling}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-primary flex-1"
                                onClick={handleSubmitVarianceReason}
                                disabled={isReconciling || !varianceReasonId}
                            >
                                {isReconciling ? 'Submitting...' : 'Submit Reason'}
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
                    <DialogContent className="max-w-sm p-6">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold text-red-600 mb-2">
                                <AlertCircle className="h-5 w-5" />
                                Delete Standard?
                            </DialogTitle>
                        </DialogHeader>
                        <div className="mb-6">
                            <p className="text-[14px] text-stone-600 leading-relaxed">
                                Are you sure you want to delete this yield standard? This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                className="btn-secondary flex-1"
                                onClick={() => setDeleteConfirmId(null)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-danger flex-1"
                                onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
