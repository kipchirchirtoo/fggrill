'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Calculator, Plus, Search, Scale,
    ArrowRight, AlertCircle, Edit2, Trash2, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

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

    // Delete confirmation
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

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
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="page-title">Food Control & Yields</h1>
                            <p className="page-subtitle">Production standards and yield monitoring</p>
                        </div>
                        {isManager && (
                            <button className="btn-primary" onClick={openCreateModal}>
                                <Plus className="h-4 w-4" />
                                <span>Add New Standard</span>
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
