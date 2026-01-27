'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSInput } from '@/components/ui/ios-input';
import { IOSBadge } from '@/components/ui/ios-badge';
import {
    Calculator, Plus, Search, Scale,
    ArrowRight, Info, AlertCircle, ChefHat
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

    // Calculator State
    const [selectedRule, setSelectedRule] = useState<YieldRule | null>(null);
    const [calcQuantity, setCalcQuantity] = useState<string>('');
    const [calcResult, setCalcResult] = useState<number | null>(null);

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
                <div className="space-y-6 max-w-7xl mx-auto pb-20">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-tight">
                                Food Control & Yields
                            </h1>
                            <p className="text-stone-500 text-sm mt-1">
                                Portions production standards and yield monitoring
                            </p>
                        </div>
                        {isManager && (
                            <IOSButton leftIcon={<Plus className="h-4 w-4" />}>
                                Add New Standard
                            </IOSButton>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Yield Calculator */}
                        <div className="lg:col-span-1 border-stone-100">
                            <IOSCard className="p-6 h-full border-none shadow-premium bg-gradient-to-br from-indigo-50/50 to-white">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="h-10 w-10 rounded-xl bg-indigo-500 flex items-center justify-center">
                                        <Calculator className="h-5 w-5 text-white" />
                                    </div>
                                    <h2 className="text-lg font-bold text-stone-900">Yield Calculator</h2>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">
                                            Select Raw Ingredient
                                        </label>
                                        <select
                                            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
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
                                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">
                                                Quantity ({selectedRule.raw_unit})
                                            </label>
                                            <div className="relative">
                                                <IOSInput
                                                    type="number"
                                                    placeholder={`Enter ${selectedRule.raw_unit}...`}
                                                    value={calcQuantity}
                                                    onChange={(e) => setCalcQuantity(e.target.value)}
                                                    className="pr-16"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                                                    {selectedRule.raw_unit}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <IOSButton
                                            fullWidth
                                            onClick={handleCalculate}
                                            disabled={!selectedRule || !calcQuantity}
                                            variant="primary"
                                            className="bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                                        >
                                            Calculate Yield
                                        </IOSButton>
                                    </div>

                                    {calcResult !== null && selectedRule && (
                                        <div className="mt-8 p-6 rounded-2xl bg-white border border-indigo-100 shadow-premium animate-in zoom-in-95 duration-500">
                                            <p className="text-center text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">
                                                Expected Output
                                            </p>
                                            <div className="flex flex-col items-center">
                                                <span className="text-4xl font-extrabold text-indigo-600 tracking-tighter">
                                                    {calcResult}
                                                </span>
                                                <span className="text-sm font-medium text-stone-500 mt-1 uppercase tracking-wider">
                                                    {selectedRule.produced_item_name}
                                                </span>
                                            </div>

                                            <div className="mt-6 pt-6 border-t border-stone-50 flex items-center justify-between text-[11px]">
                                                <div className="text-stone-400">Ratio Standard</div>
                                                <div className="font-bold text-stone-900">
                                                    {selectedRule.raw_quantity} {selectedRule.raw_unit} : {selectedRule.produced_portions} Portions
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </IOSCard>
                        </div>

                        {/* Rules Table */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <IOSInput
                                        placeholder="Search rules (e.g. Beef, Chapati...)"
                                        className="pl-10"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-stone-500 bg-stone-100 px-3 py-2 rounded-full">
                                    <Scale className="h-3.5 w-3.5" />
                                    {rules.length} Active Rules
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                {isLoading ? (
                                    [1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-20 rounded-2xl bg-stone-100 animate-pulse" />
                                    ))
                                ) : filteredRules.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 bg-stone-50 rounded-3xl border border-dashed border-stone-200">
                                        <div className="h-16 w-16 rounded-full bg-stone-100 flex items-center justify-center mb-4">
                                            <AlertCircle className="h-8 w-8 text-stone-300" />
                                        </div>
                                        <p className="text-stone-500 font-medium tracking-tight">No yield rules found matching your search</p>
                                    </div>
                                ) : (
                                    filteredRules.map((rule) => (
                                        <IOSCard key={rule.id} className="p-0 overflow-hidden hover:shadow-premium transition-shadow group">
                                            <div className="flex items-stretch h-20">
                                                <div className="w-2 bg-indigo-500" />
                                                <div className="flex-1 flex items-center px-6">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-bold text-stone-900">{rule.raw_item_name}</h3>
                                                            <ArrowRight className="h-3.5 w-3.5 text-stone-300" />
                                                            <span className="text-sm font-medium text-indigo-600 uppercase tracking-tight">
                                                                {rule.produced_item_name}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
                                                            <span className="flex items-center gap-1">
                                                                <Scale className="h-3 w-3" />
                                                                Standard Rule: {rule.raw_quantity} {rule.raw_unit} yields {rule.produced_portions} portions
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 px-4 border-l border-stone-50 ml-4">
                                                        <div className="text-right">
                                                            <div className="text-[10px] font-bold text-stone-400 uppercase tracking-widest leading-none mb-1">
                                                                Ratio
                                                            </div>
                                                            <div className="text-sm font-bold text-stone-900 tabular-nums">
                                                                1:{(rule.produced_portions / rule.raw_quantity).toFixed(1)}
                                                            </div>
                                                        </div>
                                                        <IOSButton
                                                            variant="secondary"
                                                            size="sm"
                                                            className="rounded-full h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => {
                                                                setSelectedRule(rule);
                                                                setCalcQuantity(rule.raw_quantity.toString());
                                                                handleCalculate();
                                                            }}
                                                        >
                                                            <Calculator className="h-4 w-4" />
                                                        </IOSButton>
                                                    </div>
                                                </div>
                                            </div>
                                        </IOSCard>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Pro Tips Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
                        <section className="bg-stone-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-2xl">
                            <div className="relative z-10">
                                <ChefHat className="h-10 w-10 text-indigo-400 mb-6" />
                                <h3 className="text-xl font-bold mb-3 tracking-tight">Kitchen Compliance</h3>
                                <p className="text-stone-400 text-sm leading-relaxed mb-6">
                                    Yield controls ensure that every raw ingredient transition to a final portion is tracked.
                                    Deviations of more than <span className="text-white font-bold">5%</span> must be logged with a variance reason.
                                </p>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-xs font-medium text-stone-300">
                                        <div className="h-5 w-5 rounded-full bg-stone-800 flex items-center justify-center text-indigo-400 font-bold">1</div>
                                        Verify raw weight before processing
                                    </div>
                                    <div className="flex items-center gap-3 text-xs font-medium text-stone-300">
                                        <div className="h-5 w-5 rounded-full bg-stone-800 flex items-center justify-center text-indigo-400 font-bold">2</div>
                                        Count final portions using standard scoops/plates
                                    </div>
                                    <div className="flex items-center gap-3 text-xs font-medium text-stone-300">
                                        <div className="h-5 w-5 rounded-full bg-stone-800 flex items-center justify-center text-indigo-400 font-bold">3</div>
                                        Report excess wastage immediately
                                    </div>
                                </div>
                            </div>
                            <div className="absolute top-[-20%] right-[-10%] h-64 w-64 bg-indigo-500/10 blur-[100px] rounded-full" />
                        </section>

                        <section className="bg-white border border-stone-200 rounded-3xl p-8 shadow-sm">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                                    <Info className="h-6 w-6 text-amber-600" />
                                </div>
                                <h3 className="text-xl font-bold text-stone-900 tracking-tight">Profitability Impact</h3>
                            </div>
                            <div className="space-y-6">
                                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-100 italic text-stone-600 text-sm">
                                    "Accurate yield control is the difference between a profitable kitchen and one that leaks revenue through uncontrolled portions."
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-2xl bg-green-50/50 flex flex-col items-center">
                                        <div className="text-2xl font-bold text-green-600 tracking-tight">-12%</div>
                                        <div className="text-[10px] font-bold text-stone-400 uppercase">Wastage Reduction</div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-indigo-50/50 flex flex-col items-center">
                                        <div className="text-2xl font-bold text-indigo-600 tracking-tight">+8%</div>
                                        <div className="text-[10px] font-bold text-stone-400 uppercase">Portion Accuracy</div>
                                    </div>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
