'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { branchOperationsAPI } from '@/lib/branch-api';
import { systemAPI } from '@/lib/api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Trophy, TrendingUp, Users, Calendar, Award, Plus, Filter, Search, DollarSign, Star, RefreshCw, User, Download } from 'lucide-react';
import { reportsAPI } from '@/lib/api';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';

interface StaffPerformance {
    staff_id: string;
    name: string;
    role: string;
    department: string;
    branch_id: number;
    metrics: {
        totalSales: number;
        totalTips: number;
        presentDays: number;
        avgRating: number;
    };
}

export default function PerformanceReviewPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [performance, setPerformance] = useState<StaffPerformance[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [branches, setBranches] = useState<any[]>([]);
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const handleExportPDF = async () => {
        try {
            if (filteredPerformance.length === 0) {
                toast.error('No data to export');
                return;
            }

            // Prepare the data to send directly to PDF generator
            const reportData = {
                period: {
                    month: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
                    year: year
                },
                branch: selectedBranch === 'all' ? 'All Branches' : branches.find(b => b.id === Number(selectedBranch))?.name || 'Unknown',
                staff_performance: filteredPerformance.map((staff, index) => ({
                    rank: index + 1,
                    name: staff.name,
                    role: staff.role,
                    department: staff.department,
                    total_sales: staff.metrics.totalSales,
                    total_tips: staff.metrics.totalTips,
                    present_days: staff.metrics.presentDays,
                    avg_rating: staff.metrics.avgRating
                })),
                summary: {
                    total_staff: filteredPerformance.length,
                    total_sales: filteredPerformance.reduce((sum, s) => sum + s.metrics.totalSales, 0),
                    total_tips: filteredPerformance.reduce((sum, s) => sum + s.metrics.totalTips, 0),
                    avg_attendance: filteredPerformance.reduce((sum, s) => sum + s.metrics.presentDays, 0) / filteredPerformance.length
                }
            };
            
            // Send with data at the top level and useRealData: false
            const blob = await reportsAPI.exportPdf('staff_performance', {
                month,
                year,
                branch_id: selectedBranch === 'all' ? undefined : Number(selectedBranch),
                useRealData: false,
                data: reportData
            });
            
            if (blob && blob instanceof Blob && blob.size > 0) {
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `staff_performance_${year}_${String(month).padStart(2, '0')}.pdf`;
                
                document.body.appendChild(a);
                a.click();
                
                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
                
                toast.success('PDF downloaded successfully');
            } else {
                throw new Error('Received empty or invalid PDF file');
            }
        } catch (error: any) {
            console.error('PDF export error:', error);
            toast.error(error.message || 'Failed to export PDF');
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    useEffect(() => {
        fetchPerformance();
    }, [month, year, selectedBranch]);

    const fetchBranches = async () => {
        try {
            const response = await systemAPI.getBranches();
            if (response.success) {
                setBranches(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching branches:', error);
        }
    };

    const fetchPerformance = async () => {
        setIsLoading(true);
        try {
            const branchId = selectedBranch === 'all' ? undefined : Number(selectedBranch);
            const response = await branchOperationsAPI.getStaffPerformance({ month, year }, branchId);
            if (response.success) {
                setPerformance(response.data || []);
            }
        } catch (error) {
            toast.error('Failed to load performance data');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenAdj = (staff: StaffPerformance) => {
        // Redirect to adjustments page with pre-filled data
        const params = new URLSearchParams({
            staff_id: staff.staff_id,
            staff_name: staff.name,
            tab: 'increase',
            type: 'addition',
            category: 'allowance',
            reason: 'Good performance'
        });
        router.push(`/dashboard/hr/adjustments?${params.toString()}`);
    };

    const filteredPerformance = performance.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.role.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Filters */}
                    <IOSCard className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                            <div>
                                <Label>Branch</Label>
                                <select
                                    value={selectedBranch}
                                    onChange={(e) => setSelectedBranch(e.target.value)}
                                    className="w-full h-10 px-3 rounded-ios-lg border border-stone-200 mt-1"
                                >
                                    <option value="all">All Branches</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label>Period</Label>
                                <div className="flex space-x-2 mt-1">
                                    <select
                                        value={month}
                                        onChange={(e) => setMonth(Number(e.target.value))}
                                        className="w-full h-10 px-3 rounded-ios-lg border border-stone-200"
                                    >
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <option key={i + 1} value={i + 1}>
                                                {new Date(0, i).toLocaleString('default', { month: 'long' })}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={year}
                                        onChange={(e) => setYear(Number(e.target.value))}
                                        className="w-full h-10 px-3 rounded-ios-lg border border-stone-200"
                                    >
                                        {[2024, 2025, 2026].map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="relative">
                                <Label>Search</Label>
                                <div className="relative mt-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <Input
                                        placeholder="Search staff..."
                                        className="pl-9"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                </div>
                            </div>
                            <IOSButton onClick={fetchPerformance} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                                Refresh
                            </IOSButton>
                            <IOSButton
                                variant="secondary"
                                onClick={handleExportPDF}
                                leftIcon={<Download className="h-4 w-4" />}
                                disabled={isLoading || filteredPerformance.length === 0}
                            >
                                Export PDF
                            </IOSButton>
                        </div>
                    </IOSCard>

                    {/* Top 3 Podium */}
                    {!isLoading && filteredPerformance.length >= 3 && (
                        <div className="grid grid-cols-3 gap-4 items-end pt-8 pb-4">
                            {/* 2nd Place */}
                            <div className="flex flex-col items-center">
                                <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-2 border-2 border-slate-300 relative">
                                    <div className="absolute -top-2 -right-2 bg-slate-400 text-white h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">2</div>
                                    <User className="text-slate-500 h-8 w-8" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-sm">{filteredPerformance[1].name}</p>
                                    <p className="text-[10px] text-stone-500 uppercase">{filteredPerformance[1].role}</p>
                                    <div className="bg-slate-50 px-2 py-1 rounded-full mt-1 border border-slate-200">
                                        <p className="text-xs font-bold text-slate-700">KES {filteredPerformance[1].metrics.totalSales.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 1st Place */}
                            <div className="flex flex-col items-center">
                                <div className="h-24 w-24 rounded-full bg-amber-50 flex items-center justify-center mb-2 border-4 border-amber-300 relative shadow-lg shadow-amber-100">
                                    <div className="absolute -top-4 bg-amber-400 text-white h-10 w-10 rounded-full flex items-center justify-center shadow-md">
                                        <Trophy className="h-6 w-6" />
                                    </div>
                                    <User className="text-amber-600 h-10 w-10" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-base">{filteredPerformance[0].name}</p>
                                    <p className="text-[11px] text-stone-500 uppercase font-medium">{filteredPerformance[0].role}</p>
                                    <div className="bg-amber-100 px-4 py-2 rounded-full mt-2 border border-amber-200 shadow-sm">
                                        <p className="text-sm font-black text-amber-800">KES {filteredPerformance[0].metrics.totalSales.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 3rd Place */}
                            <div className="flex flex-col items-center">
                                <div className="h-14 w-14 rounded-full bg-orange-50 flex items-center justify-center mb-2 border-2 border-orange-200 relative">
                                    <div className="absolute -top-2 -right-2 bg-orange-300 text-white h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold">3</div>
                                    <User className="text-orange-500 h-7 w-7" />
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-sm tracking-tight">{filteredPerformance[2].name}</p>
                                    <p className="text-[10px] text-stone-500 uppercase">{filteredPerformance[2].role}</p>
                                    <div className="bg-orange-50 px-2 py-1 rounded-full mt-1 border border-orange-100">
                                        <p className="text-xs font-bold text-orange-700">KES {filteredPerformance[2].metrics.totalSales.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Performance Table */}
                    <IOSCard>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-4 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Rank</th>
                                        <th className="px-4 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Staff Member</th>
                                        <th className="px-4 py-4 text-center text-[11px] font-bold text-stone-400 uppercase tracking-wider">Sales (KES)</th>
                                        <th className="px-4 py-4 text-center text-[11px] font-bold text-stone-400 uppercase tracking-wider">Tips</th>
                                        <th className="px-4 py-4 text-center text-[11px] font-bold text-stone-400 uppercase tracking-wider">Attendance</th>
                                        <th className="px-4 py-4 text-center text-[11px] font-bold text-stone-400 uppercase tracking-wider">Rating</th>
                                        <th className="px-4 py-4 text-right text-[11px] font-bold text-stone-400 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-12 text-center text-stone-400">
                                                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                                                Loading performance metrics...
                                            </td>
                                        </tr>
                                    ) : filteredPerformance.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-12 text-center text-stone-400">
                                                No performance records found for this period.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPerformance.map((staff, index) => (
                                            <tr key={staff.staff_id} className="hover:bg-stone-50/50 transition-colors">
                                                <td className="px-4 py-4">
                                                    <div className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs ${index === 0 ? 'bg-amber-100 text-amber-700' :
                                                        index === 1 ? 'bg-slate-100 text-slate-700' :
                                                            index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-stone-100 text-stone-500'
                                                        }`}>
                                                        {index + 1}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center">
                                                        <div className="h-9 w-9 rounded-xl bg-stone-100 flex items-center justify-center mr-3">
                                                            <User className="h-5 w-5 text-stone-400" />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-stone-800">{staff.name}</p>
                                                            <p className="text-[10px] text-stone-400 uppercase tracking-tight">{staff.role}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <p className="font-black text-stone-700">KES {staff.metrics.totalSales.toLocaleString()}</p>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <p className="text-xs text-green-600 font-bold">+{staff.metrics.totalTips.toLocaleString()}</p>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <p className="font-bold text-stone-700">{staff.metrics.presentDays} days</p>
                                                        <div className="w-16 h-1 bg-stone-100 rounded-full mt-1 overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500"
                                                                style={{ width: `${Math.min((staff.metrics.presentDays / 26) * 100, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <div className="flex items-center justify-center text-amber-400">
                                                        <Star className="h-3 w-3 fill-current mr-1" />
                                                        <span className="font-bold text-stone-700">{staff.metrics.avgRating.toFixed(1)}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <IOSButton
                                                        size="sm"
                                                        variant="secondary"
                                                        className="bg-green-50 text-green-700 hover:bg-green-100"
                                                        leftIcon={<Award className="h-3 w-3" />}
                                                        onClick={() => handleOpenAdj(staff)}
                                                    >
                                                        Reward
                                                    </IOSButton>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
