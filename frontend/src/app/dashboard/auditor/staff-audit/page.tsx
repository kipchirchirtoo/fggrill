'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, Calendar, FileText, Download, User, DollarSign, CreditCard, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/auth-context';

interface StaffAuditRecord {
    id: string;
    date: string;
    type: 'Credit Bill' | 'Advance' | 'Loan';
    amount: number;
    staff_name: string;
    staff_id: string;
    description: string;
    status: string;
    reference: string;
}

interface StaffSummary {
    staff_id: string;
    staff_name: string;
    total_credit_bills: number;
    total_advances: number;
    total_loans: number;
    outstanding_balance: number;
}

export default function StaffAuditPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [records, setRecords] = useState<StaffAuditRecord[]>([]);
    const [summary, setSummary] = useState<StaffSummary[]>([]);

    // Filters
    const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(new Date().getDate() - 30)), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [selectedStaff, setSelectedStaff] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'transactions' | 'summary'>('transactions');
    const [branches, setBranches] = useState<any[]>([]);
    const [staffList, setStaffList] = useState<any[]>([]);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchAuditData();
    }, [startDate, endDate, selectedBranch, selectedStaff]);

    const fetchInitialData = async () => {
        try {
            const [branchesRes, staffRes] = await Promise.all([
                api.finance.getBranches(),
                api.staff.getAll()
            ]);
            setBranches(branchesRes.data || []);
            setStaffList(staffRes.data || []);
        } catch (error) {
            console.error('Failed to load initial data:', error);
            toast.error('Failed to load filter options');
        }
    };

    const fetchAuditData = async () => {
        setIsLoading(true);
        try {
            const res = await api.audit.getStaffAudit({
                branch_id: selectedBranch !== 'all' ? selectedBranch : undefined,
                staff_id: selectedStaff !== 'all' ? selectedStaff : undefined,
                start_date: startDate,
                end_date: endDate
            });

            if (res.success) {
                setRecords(res.data);
                setSummary(res.summary);
            }
        } catch (error) {
            console.error('Failed to fetch staff audit:', error);
            toast.error('Failed to load staff audit data');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'paid':
            case 'approved':
            case 'active':
                return 'bg-green-100 text-green-800';
            case 'pending':
            case 'unpaid':
                return 'bg-yellow-100 text-yellow-800';
            case 'rejected':
            case 'defaulted':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
    };

    const totalCreditBills = summary.reduce((sum, item) => sum + item.total_credit_bills, 0);
    const totalAdvances = summary.reduce((sum, item) => sum + item.total_advances, 0);
    const totalLoans = summary.reduce((sum, item) => sum + item.total_loans, 0);

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Staff Audit</h1>
                            <p className="text-sm text-gray-500">Audit staff credit bills, advances, and loans</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setViewMode('transactions')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'transactions' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
                            >
                                Transactions
                            </button>
                            <button
                                onClick={() => setViewMode('summary')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'summary' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
                            >
                                Staff Summary
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                                <Download size={16} />
                                Export
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Credit Bills</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalCreditBills)}</p>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                                <CreditCard size={24} />
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Advances</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalAdvances)}</p>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
                                <Banknote size={24} />
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Loans</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(totalLoans)}</p>
                            </div>
                            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                                <DollarSign size={24} />
                            </div>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap gap-4 items-center">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-gray-400" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                            <span className="text-gray-400">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="h-6 w-px bg-gray-200 mx-2" />

                        <select
                            value={selectedBranch}
                            onChange={(e) => setSelectedBranch(e.target.value)}
                            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">All Branches</option>
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>

                        <select
                            value={selectedStaff}
                            onChange={(e) => setSelectedStaff(e.target.value)}
                            className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="all">All Staff</option>
                            {staffList.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.first_name} {s.last_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Content Table */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-12">
                                <Loader2 className="animate-spin text-blue-600" size={32} />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                {viewMode === 'transactions' ? (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-4">Date</th>
                                                <th className="px-6 py-4">Reference</th>
                                                <th className="px-6 py-4">Type</th>
                                                <th className="px-6 py-4">Staff Member</th>
                                                <th className="px-6 py-4">Description</th>
                                                <th className="px-6 py-4 text-right">Amount</th>
                                                <th className="px-6 py-4 text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {records.length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                                        No records found matching your filters.
                                                    </td>
                                                </tr>
                                            ) : (
                                                records.map((record) => (
                                                    <tr key={`${record.type}-${record.id}`} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 text-gray-900">{format(new Date(record.date), 'MMM d, yyyy')}</td>
                                                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">{record.reference}</td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                                ${record.type === 'Credit Bill' ? 'bg-blue-100 text-blue-800' :
                                                                    record.type === 'Advance' ? 'bg-purple-100 text-purple-800' :
                                                                        'bg-emerald-100 text-emerald-800'}`}>
                                                                {record.type}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 font-medium text-gray-900">{record.staff_name}</td>
                                                        <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{record.description}</td>
                                                        <td className="px-6 py-4 text-right font-medium text-gray-900">{formatCurrency(record.amount)}</td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}>
                                                                {record.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                ) : (
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                                            <tr>
                                                <th className="px-6 py-4">Staff Member</th>
                                                <th className="px-6 py-4 text-right">Credit Bills</th>
                                                <th className="px-6 py-4 text-right">Advances</th>
                                                <th className="px-6 py-4 text-right">Loans</th>
                                                <th className="px-6 py-4 text-right">Estimate Outstanding</th>
                                                <th className="px-6 py-4 text-right">Total Exposure</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {summary.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                                        No summary data available.
                                                    </td>
                                                </tr>
                                            ) : (
                                                summary.map((item) => (
                                                    <tr key={item.staff_id} className="hover:bg-gray-50">
                                                        <td className="px-6 py-4 font-medium text-gray-900">{item.staff_name}</td>
                                                        <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(item.total_credit_bills)}</td>
                                                        <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(item.total_advances)}</td>
                                                        <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(item.total_loans)}</td>
                                                        <td className="px-6 py-4 text-right font-medium text-orange-600">{formatCurrency(item.outstanding_balance)}</td>
                                                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                                                            {formatCurrency(item.total_credit_bills + item.total_advances + item.total_loans)}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
