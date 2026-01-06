'use client';

import { useState } from 'react';
import { useBranch } from '@/lib/branch-context';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/minimal/button';
import { IOSCard } from '@/components/ui/ios-card';
import {
    ClipboardList, Plus, Search, Calendar,
    MapPin, CheckCircle2, Clock, AlertTriangle
} from 'lucide-react';

export default function StockTakePage() {
    const { activeBranch } = useBranch();
    const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

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
                        <Button className="btn-primary">
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
                                Completed
                            </button>
                        </div>
                    </div>

                    {/* Content Placeholder */}
                    <IOSCard className="p-12 text-center border-stone-200 border-dashed bg-stone-50/50">
                        <ClipboardList className="h-12 w-12 text-stone-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-stone-900">No stock takes found</h3>
                        <p className="text-stone-500 text-sm mt-1 max-w-sm mx-auto">
                            There are no {activeTab} stock take sessions for this branch. Start a new session to audit current inventory levels.
                        </p>
                        <Button variant="outline" className="mt-6">
                            Refresh List
                        </Button>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
