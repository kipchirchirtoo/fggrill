'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/minimal/button';
import { IOSCard } from '@/components/ui/ios-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    ClipboardList, Plus, Search, Calendar,
    CheckCircle2, AlertTriangle, Loader2
} from 'lucide-react';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';

interface StockTake {
    id: string;
    stock_take_number: string;
    status: string;
    take_type: string;
    start_date: string;
    end_date?: string;
    notes?: string;
}

export default function StockTakePage() {
    const { activeBranch } = useBranch();
    const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
    const [isNewTakeModalOpen, setIsNewTakeModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [takes, setTakes] = useState<StockTake[]>([]);
    const [formData, setFormData] = useState({
        take_type: 'FULL',
        notes: ''
    });

    const fetchStockTakes = async () => {
        try {
            setLoading(true);
            const res = await storeAPI.getStockTakes();
            if (res.success && res.data) {
                setTakes(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch stock takes:', error);
            toast.error('Failed to load stock takes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStockTakes();
    }, []);

    const handleCreateStockTake = async () => {
        if (!activeBranch?.id) return;

        try {
            setLoading(true);
            const res = await storeAPI.createStockTake({
                branch_id: activeBranch.id,
                take_type: formData.take_type,
                notes: formData.notes
            });

            if (res.success) {
                toast.success('Stock take started successfully');
                setIsNewTakeModalOpen(false);
                fetchStockTakes();
                setFormData({ take_type: 'FULL', notes: '' });
            }
        } catch (error) {
            console.error('Failed to start stock take:', error);
            toast.error('Failed to start stock take');
        } finally {
            setLoading(false);
        }
    };

    const filteredTakes = takes.filter(take => {
        if (activeTab === 'pending') {
            return ['DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW'].includes(take.status);
        }
        return ['COMPLETED', 'APPROVED', 'REJECTED'].includes(take.status);
    });

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Stock Taking</h1>
                            <p className="text-stone-500 text-sm mt-0.5">Manage inventory counts and audits for <span className="font-semibold">{activeBranch?.name}</span></p>
                        </div>
                        <Button className="btn-primary" onClick={() => setIsNewTakeModalOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            New Stock Take
                        </Button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <input
                                type="text"
                                placeholder="Search stock take records..."
                                className="w-full h-10 pl-9 pr-4 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                            />
                        </div>
                        <div className="flex bg-stone-100 p-1 rounded-xl shrink-0">
                            <button
                                onClick={() => setActiveTab('pending')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'pending' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                            >
                                Pending
                            </button>
                            <button
                                onClick={() => setActiveTab('completed')}
                                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'completed' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                            >
                                History
                            </button>
                        </div>
                    </div>

                    {/* List Content */}
                    {loading && takes.length === 0 ? (
                        <div className="flex justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
                        </div>
                    ) : filteredTakes.length > 0 ? (
                        <div className="grid gap-3">
                            {filteredTakes.map((take) => (
                                <IOSCard key={take.id} className="p-4 flex items-center justify-between hover:bg-stone-50 transition-colors cursor-pointer border-stone-200">
                                    <div className="flex items-center gap-4">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${activeTab === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                            }`}>
                                            <ClipboardList className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-stone-900">{take.stock_take_number}</h4>
                                            <p className="text-xs text-stone-500 flex items-center gap-2">
                                                <span>{take.take_type}</span>
                                                <span>•</span>
                                                <Calendar className="h-3 w-3" />
                                                {new Date(take.start_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${take.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                                                take.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                                                    'bg-stone-100 text-stone-700'
                                            }`}>
                                            {take.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </IOSCard>
                            ))}
                        </div>
                    ) : (
                        <IOSCard className="p-12 text-center border-stone-200 border-dashed bg-stone-50/50">
                            <ClipboardList className="h-12 w-12 text-stone-300 mx-auto mb-4" />
                            <h3 className="text-lg font-semibold text-stone-900">No stock takes found</h3>
                            <p className="text-stone-500 text-sm mt-1 max-w-sm mx-auto">
                                There are no {activeTab} stock take sessions for this branch. Start a new session to audit current inventory levels.
                            </p>
                            <Button variant="outline" className="mt-6" onClick={() => setIsNewTakeModalOpen(true)}>
                                Start New Session
                            </Button>
                        </IOSCard>
                    )}

                    {/* Create Modal */}
                    <Dialog open={isNewTakeModalOpen} onOpenChange={setIsNewTakeModalOpen}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Start New Stock Take</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Type</label>
                                    <select
                                        className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                                        value={formData.take_type}
                                        onChange={(e) => setFormData({ ...formData, take_type: e.target.value })}
                                    >
                                        <option value="FULL">Full Audit (All Items)</option>
                                        <option value="PARTIAL">Partial Audit (Selected Categories)</option>
                                        <option value="SPOT_CHECK">Spot Check</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-stone-700">Notes</label>
                                    <textarea
                                        className="w-full h-24 px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 resize-none"
                                        placeholder="E.g., End of month audit..."
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setIsNewTakeModalOpen(false)} disabled={loading}>Cancel</Button>
                                <Button className="btn-primary" onClick={handleCreateStockTake} disabled={loading}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                    Start Session
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
