'use client';

import { useState } from 'react';
import { useBranch } from '@/lib/branch-context';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/minimal/button';
import { IOSCard } from '@/components/ui/ios-card';
import {
    FileText, Plus, Search, Filter,
    ArrowUpRight, ArrowDownRight, DollarSign
} from 'lucide-react';

export default function InvoicesPage() {
    const { activeBranch } = useBranch();

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Invoices</h1>
                            <p className="text-stone-500 text-sm mt-0.5">Manage supplier invoices and billing for <span className="font-semibold">{activeBranch?.name}</span></p>
                        </div>
                        <Button className="btn-primary">
                            <Plus className="h-4 w-4 mr-2" />
                            Record Invoice
                        </Button>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <IOSCard className="p-4 flex items-center justify-between bg-emerald-50 border-emerald-100">
                            <div>
                                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Paid this month</p>
                                <p className="text-2xl font-bold text-emerald-900 mt-0.5">KES 0</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4 flex items-center justify-between bg-amber-50 border-amber-100">
                            <div>
                                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending Approval</p>
                                <p className="text-2xl font-bold text-amber-900 mt-0.5">0</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-amber-600" />
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4 flex items-center justify-between bg-rose-50 border-rose-100">
                            <div>
                                <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Overdue</p>
                                <p className="text-2xl font-bold text-rose-900 mt-0.5">KES 0</p>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-rose-100 flex items-center justify-center">
                                <AlertTriangle className="h-5 w-5 text-rose-600" />
                            </div>
                        </IOSCard>
                    </div>

                    {/* Filters */}
                    <div className="flex gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <input
                                type="text"
                                placeholder="Search invoices by number or supplier..."
                                className="w-full h-10 pl-9 pr-4 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                            />
                        </div>
                        <Button variant="outline" className="shrink-0 bg-white">
                            <Filter className="h-4 w-4 mr-2" />
                            Filter
                        </Button>
                    </div>

                    {/* List */}
                    <IOSCard className="overflow-hidden border-stone-200 shadow-sm">
                        <div className="text-center py-16">
                            <FileText className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                            <h3 className="text-stone-900 font-semibold">No invoices found</h3>
                            <p className="text-stone-500 text-sm mt-1">Start by recording a new supplier invoice.</p>
                        </div>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}

import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
