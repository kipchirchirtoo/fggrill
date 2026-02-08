'use client';

import { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, Calendar, CheckSquare, AlertTriangle, ShieldCheck, ArrowRight, FileText, Info, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';
import { toast } from 'sonner';

interface PeriodTask {
    id: string;
    task: string;
    completed: boolean;
    assignedTo: string;
}

export default function PeriodManagement() {
    const { activeBranchId } = useBranch();
    const [periodStatus, setPeriodStatus] = useState<'open' | 'closed' | 'locked'>('open');
    const [currentPeriod, setCurrentPeriod] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    // Note: Pre-closing tasks are hardcoded for now
    // TODO: Future enhancement - fetch tasks from database
    const [tasks, setTasks] = useState<PeriodTask[]>([
        { id: '1', task: 'Finalize all room billings', completed: true, assignedTo: 'Reception Lead' },
        { id: '2', task: 'Complete month-end physical stock count', completed: true, assignedTo: 'Branch Accountant' },
        { id: '3', task: 'Reconcile all M-Pesa settlements', completed: true, assignedTo: 'Branch Accountant' },
        { id: '4', task: 'Submit all operational expenses', completed: false, assignedTo: 'Operations Mgr' },
        { id: '5', task: 'Approve pending journal entries', completed: false, assignedTo: 'Auditor' },
    ]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.accounting.getFiscalPeriods(activeBranchId || undefined);
            if (response.success) {
                const active = response.data?.find((p: any) => p.status === 'open');
                setCurrentPeriod(active || response.data?.[0]);
                if (active) setPeriodStatus(active.status);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to load fiscal periods');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const completedTasks = tasks.filter(t => t.completed).length;
    const allCompleted = completedTasks === tasks.length;

    const handleClosePeriod = async () => {
        if (!allCompleted) {
            toast.error('Please complete all pre-closing tasks first');
            return;
        }
        if (!currentPeriod) return;

        try {
            const response = await api.accounting.closePeriod(currentPeriod.id, {
                closing_date: new Date().toISOString()
            });
            if (response.success) {
                toast.success('Period closed successfully. Pending final auditor lock.');
                fetchData();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to close period');
        }
    };

    const handleToggleTask = (id: string) => {
        setTasks(prev => prev.map(t =>
            t.id === id ? { ...t, completed: !t.completed } : t
        ));
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[18px] font-bold text-stone-900">Period Management</h2>
                    <p className="text-[12px] text-stone-500">Manage fiscal periods and month-end closing procedures</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        className="btn-secondary h-9 w-9 p-0 flex items-center justify-center mr-2"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="flex items-center gap-3 p-1 bg-stone-100 rounded-lg">
                        <button className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all ${periodStatus === 'open' ? 'bg-white shadow text-emerald-600' : 'text-stone-400'}`}>OPEN</button>
                        <button className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all ${periodStatus === 'closed' ? 'bg-white shadow text-amber-600' : 'text-stone-400'}`}>CLOSED</button>
                        <button className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all ${periodStatus === 'locked' ? 'bg-white shadow text-rose-600' : 'text-stone-400'}`}>LOCKED</button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Status Card */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card-elevated p-6 border-l-4 border-l-stone-900">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-4">
                                <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
                            </div>
                        ) : (
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-2xl bg-stone-100 flex items-center justify-center">
                                        <Calendar className="h-6 w-6 text-stone-900" />
                                    </div>
                                    <div>
                                        <h3 className="text-[16px] font-bold text-stone-900">
                                            Current Period: {currentPeriod?.name || 'Loading...'}
                                        </h3>
                                        <p className="text-[12px] text-stone-500 font-medium">
                                            {currentPeriod?.fiscal_year ? `Fiscal Year: ${currentPeriod.fiscal_year} • ` : ''}
                                            {currentPeriod?.end_date ? `Ends on ${new Date(currentPeriod.end_date).toLocaleDateString()}` : 'No active period'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`px-3 py-1 border rounded-full text-[11px] font-bold uppercase ${periodStatus === 'open' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                        periodStatus === 'closed' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                            'bg-stone-50 text-stone-500 border-stone-100'
                                        }`}>
                                        {periodStatus}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Checklist */}
                    <div className="card-elevated p-0 overflow-hidden">
                        <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
                            <h3 className="text-[14px] font-bold text-stone-900 flex items-center gap-2">
                                <CheckSquare className="h-4 w-4 text-stone-500" />
                                Pre-Closing Checklist
                            </h3>
                            <span className="text-[11px] font-bold text-stone-500">{completedTasks} / {tasks.length} COMPLETED</span>
                        </div>
                        <div className="divide-y divide-stone-100">
                            {tasks.map((task) => (
                                <div key={task.id} className="p-4 flex items-center justify-between hover:bg-stone-50/50 transition-colors">
                                    <div className="flex items-top gap-3">
                                        <button
                                            onClick={() => handleToggleTask(task.id)}
                                            className={`mt-0.5 h-5 w-5 rounded border flex items-center justify-center transition-all ${task.completed ? 'bg-stone-900 border-stone-900 text-white' : 'border-stone-300 bg-white'
                                                }`}
                                        >
                                            {task.completed && <ShieldCheck className="h-3.5 w-3.5" />}
                                        </button>
                                        <div>
                                            <p className={`text-[13px] font-bold transition-all ${task.completed ? 'text-stone-400 line-through' : 'text-stone-900'}`}>{task.task}</p>
                                            <p className="text-[11px] text-stone-400">Assigned to: {task.assignedTo}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <button className="text-[12px] font-bold text-stone-400 hover:text-stone-900 flex items-center gap-1">
                                            Details <ArrowRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Closing Actions Panel */}
                <div className="space-y-4">
                    <div className="card-elevated p-6 space-y-4">
                        <h3 className="text-[15px] font-bold text-stone-900">Closing Actions</h3>
                        <p className="text-[12px] text-stone-500 leading-relaxed">
                            Closing a period prevents any new transactions from being recorded for that date range. This action is reversible by an Auditor.
                        </p>

                        {!allCompleted && (
                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                                    {tasks.length - completedTasks} tasks are still pending. Reconciliations must be 100% matched before final close.
                                </p>
                            </div>
                        )}

                        <button
                            onClick={handleClosePeriod}
                            disabled={!allCompleted || isLoading || periodStatus !== 'open'}
                            className={`w-full py-3 rounded-xl font-bold text-[13px] transition-all flex items-center justify-center gap-2 ${allCompleted && periodStatus === 'open'
                                ? 'bg-stone-900 text-white hover:bg-stone-800 shadow-lg'
                                : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                                }`}
                        >
                            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                            {periodStatus === 'open' ? 'Close Period' : `Period ${periodStatus.toUpperCase()}`}
                        </button>

                        <button className="w-full py-3 border border-stone-200 rounded-xl font-bold text-[13px] text-stone-600 hover:bg-stone-50 flex items-center justify-center gap-2">
                            <FileText className="h-4 w-4" />
                            Generate Closing Report
                        </button>
                    </div>

                    <div className="card-elevated p-5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
                        <div className="flex items-center gap-2 mb-2">
                            <Info className="h-4 w-4 text-blue-200" />
                            <p className="text-[13px] font-bold uppercase tracking-wider">Accounting Rule</p>
                        </div>
                        <p className="text-[11px] text-blue-100 leading-relaxed font-medium">
                            Once a period is "Locked" by the Auditor, even the General Manager cannot reopen it without an official Audit Request submitted to the System Admin.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
