'use client';

import React, { useState, useEffect } from 'react';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { reportsAPI, reportsService } from '@/lib/api';
import { toast } from 'sonner';
import { Calendar, TrendingUp, DollarSign, ArrowLeft, RefreshCw, BarChart3, Users, Building2, FileDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { IOSBadge } from '@/components/ui/ios-badge';
import { IOSCard } from '@/components/ui/ios-card';

export default function ConferenceReportsPage() {
    const router = useRouter();
    const { activeBranchId } = useBranch();
    const [reportData, setReportData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // First day of current month
        end: new Date().toISOString().split('T')[0] // Today
    });

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const blob = await reportsService.exportBrandedPdf('conference_summary', {
                branch_id: activeBranchId,
                from_date: dateRange.start,
                to_date: dateRange.end
            });

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Conference_Report_${dateRange.start}_to_${dateRange.end}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();

            toast.success("Branded report generated successfully");
        } catch (e) {
            console.error(e);
            toast.error("Failed to export report");
        } finally {
            setIsExporting(false);
        }
    };

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            const res = await reportsAPI.getConferenceReport({
                branch_id: activeBranchId,
                from_date: dateRange.start,
                to_date: dateRange.end
            });

            if (res.success) {
                setReportData(res.data);
            } else {
                toast.error(res.message || "Failed to fetch report");
            }
        } catch (e) {
            console.error(e);
            toast.error("Error loading conference report");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [activeBranchId, dateRange]);

    const summary = reportData?.summary || {
        totalRevenue: 0,
        totalBookings: 0,
        totalPax: 0,
        avgRevenuePerBooking: 0
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <BranchAwareDashboardLayout
                title="Conference & Events Analytics"
                subtitle={`Performance summary from ${dateRange.start} to ${dateRange.end}`}
            >
                <div className="space-y-6">
                    {/* Header Controls */}
                    <div className="flex flex-col sm:flex-row justify-between gap-4 bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
                        <div className="flex items-center gap-2">
                            <button onClick={() => router.back()} className="p-2 hover:bg-stone-50 rounded-xl text-stone-500 transition-colors">
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                            <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-xl border border-stone-200">
                                <Calendar className="h-4 w-4 text-stone-400" />
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    className="bg-transparent text-[13px] font-bold text-stone-700 outline-none"
                                />
                                <span className="text-stone-300">to</span>
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    className="bg-transparent text-[13px] font-bold text-stone-700 outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExport}
                                disabled={isExporting || isLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[13px] font-bold transition-all shadow-md shadow-indigo-100"
                            >
                                {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                                Export Branded PDF
                            </button>
                            <button onClick={fetchReport} disabled={isLoading} className="p-2.5 bg-white hover:bg-stone-50 text-stone-600 rounded-xl border border-stone-200 transition-all shadow-sm">
                                <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                                <DollarSign className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Total Revenue</p>
                            <p className="text-2xl font-black text-stone-900">KES {summary.totalRevenue.toLocaleString()}</p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                                <BarChart3 className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Total Bookings</p>
                            <p className="text-2xl font-black text-stone-900">{summary.totalBookings}</p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                                <Users className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Total Participants</p>
                            <p className="text-2xl font-black text-stone-900">{summary.totalPax.toLocaleString()}</p>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
                            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
                                <TrendingUp className="h-5 w-5" />
                            </div>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-1">Avg Revenue / Booking</p>
                            <p className="text-2xl font-black text-stone-900">KES {summary.avgRevenuePerBooking.toLocaleString()}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Hall Performance */}
                        <div className="lg:col-span-1 space-y-4">
                            <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                <Building2 className="h-5 w-5 text-indigo-600" />
                                Performance by Hall
                            </h3>
                            <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
                                <div className="divide-y divide-stone-50">
                                    {(reportData?.hallBreakdown || []).length === 0 ? (
                                        <div className="p-8 text-center text-stone-400 text-sm">No hall data available</div>
                                    ) : (reportData.hallBreakdown || []).map((hall: any) => (
                                        <div key={hall.id} className="p-4 hover:bg-stone-50 transition-colors">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-bold text-stone-900">{hall.name}</p>
                                                    <p className="text-[10px] text-stone-500 uppercase font-black">{hall.bookings} Bookings • {hall.pax} PAX</p>
                                                </div>
                                                <p className="font-black text-indigo-600">KES {hall.revenue.toLocaleString()}</p>
                                            </div>
                                            <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                                                    style={{ width: `${(hall.revenue / summary.totalRevenue) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Recent Bookings Table */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="font-bold text-stone-800 flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-emerald-600" />
                                Recent Activity
                            </h3>
                            <IOSCard className="overflow-hidden border-none shadow-sm bg-white">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-stone-50 border-b border-stone-100">
                                            <tr>
                                                <th className="px-5 py-4 text-[11px] font-black text-stone-400 uppercase tracking-widest">Client / Company</th>
                                                <th className="px-5 py-4 text-[11px] font-black text-stone-400 uppercase tracking-widest">Date & Time</th>
                                                <th className="px-5 py-4 text-[11px] font-black text-stone-400 uppercase tracking-widest text-right">Revenue</th>
                                                <th className="px-5 py-4 text-[11px] font-black text-stone-400 uppercase tracking-widest text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {(reportData?.recentBookings || []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-5 py-12 text-center text-stone-400 italic text-sm">No activity recorded in this period</td>
                                                </tr>
                                            ) : (reportData.recentBookings || []).map((booking: any) => (
                                                <tr key={booking.id} className="hover:bg-stone-50 transition-colors group">
                                                    <td className="px-5 py-4">
                                                        <p className="font-bold text-stone-900 text-sm">{booking.company_name || booking.customer_name}</p>
                                                        <p className="text-[10px] text-stone-400 font-medium">{booking.hall?.name || 'Hall'}</p>
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <p className="text-sm font-bold text-stone-700">{new Date(booking.start_date).toLocaleDateString()}</p>
                                                        <p className="text-[10px] text-stone-400">{booking.num_participants} Participants</p>
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <p className="font-black text-stone-900">KES {booking.total_amount.toLocaleString()}</p>
                                                        <p className="text-[10px] text-emerald-600 font-bold">Paid: KES {(booking.amount_paid || 0).toLocaleString()}</p>
                                                    </td>
                                                    <td className="px-5 py-4 text-center">
                                                        <IOSBadge color={booking.payment_status === 'paid' ? 'success' : booking.payment_status === 'partial' ? 'info' : 'warning'}>
                                                            {booking.payment_status?.toUpperCase() || 'UNPAID'}
                                                        </IOSBadge>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </IOSCard>
                        </div>
                    </div>
                </div>
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}
