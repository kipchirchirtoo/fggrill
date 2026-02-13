'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import {
    Loader2,
    CheckCircle2,
    XCircle,
    Search,
    Filter,
    Utensils,
    Trash2,
    AlertCircle,
    Clock,
    ChevronRight,
    ClipboardList,
    FileText,
    Download,
    Printer
} from 'lucide-react';
import { api, kitchenAPI } from '@/lib/api';
import { downloadInvoicePDF, printInvoicePDF } from '@/lib/invoice-pdf';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
    DialogBody,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function FoodControlReviewPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <FoodControlReviewContent />
            </DashboardLayout>
        </ProtectedRoute>
    );
}

function FoodControlReviewContent() {
    const { activeBranchId } = useBranch();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('wastage');
    const [wastageRecords, setWastageRecords] = useState<any[]>([]);
    const [usageEntries, setUsageEntries] = useState<any[]>([]);
    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [invoices, setInvoices] = useState<any[]>([]);

    useEffect(() => {
        if (activeBranchId) {
            fetchData();
        }
    }, [activeTab, activeBranchId]);

    const fetchData = async () => {
        if (!activeBranchId) return;
        setLoading(true);
        try {
            if (activeTab === 'wastage') {
                const response = await kitchenAPI.getWastageRecords(activeBranchId);
                if (response.success) {
                    // Filter for pending review or reviewed (to show history)
                    setWastageRecords(response.data.filter((r: any) => r.status === 'pending_review'));
                }
            } else if (activeTab === 'usage') {
                const response = await kitchenAPI.getUsageEntries(activeBranchId);
                if (response.success) {
                    setUsageEntries(response.data.filter((r: any) => r.status === 'pending_review'));
                }
            } else if (activeTab === 'invoices') {
                const response = await api.accounting.getInvoices();
                if (response.success) {
                    setInvoices(response.data);
                }
            }
        } catch (error) {
            console.error('Error fetching food control records:', error);
            toast.error('Failed to load records');
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async () => {
        if (!selectedItem) return;

        try {
            let response;
            if (activeTab === 'wastage') {
                response = await kitchenAPI.reviewWastage(selectedItem.id, reviewNotes);
            } else {
                response = await kitchenAPI.reviewUsage(selectedItem.id, reviewNotes);
            }

            if (response.success) {
                toast.success(`${activeTab === 'wastage' ? 'Wastage' : 'Usage'} record reviewed`);
                setIsReviewModalOpen(false);
                setSelectedItem(null);
                setReviewNotes('');
                fetchData();
            } else {
                toast.error(response.message || 'Failed to review record');
            }
        } catch (error) {
            console.error('Error reviewing record:', error);
            toast.error('Action failed');
        }
    };

    const filteredRecords = (
        activeTab === 'wastage' ? wastageRecords :
            activeTab === 'usage' ? usageEntries :
                invoices
    ).filter(item => {
        const searchStr = searchQuery.toLowerCase();

        if (activeTab === 'invoices') {
            return (
                (item.invoice_number?.toLowerCase().includes(searchStr)) ||
                (item.customer?.customer_name?.toLowerCase().includes(searchStr))
            );
        }

        return (
            (item.item_sku?.toLowerCase().includes(searchStr)) ||
            (item.reason?.toLowerCase().includes(searchStr)) ||
            (item.item_name?.toLowerCase().includes(searchStr))
        );
    });

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Food Control Review</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Review kitchen wastage and usage records before audit.</p>
                </div>
                <div className="flex items-center gap-2">
                    <IOSBadge variant="outline" className="px-3 py-1 bg-amber-50 text-amber-700 border-amber-200">
                        {filteredRecords.length} Pending Review
                    </IOSBadge>
                </div>
            </div>

            <Tabs defaultValue="wastage" className="w-full" onValueChange={setActiveTab}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
                        <TabsTrigger value="wastage" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Kitchen Wastage
                        </TabsTrigger>
                        <TabsTrigger value="usage" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Utensils className="w-4 h-4 mr-2" />
                            Store Usage
                        </TabsTrigger>
                        <TabsTrigger value="invoices" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Invoices
                        </TabsTrigger>
                    </TabsList>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search records..."
                            className="pl-9 bg-white dark:bg-slate-950"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <TabsContent value="wastage" className="mt-0">
                    <WastageList
                        records={filteredRecords}
                        loading={loading}
                        onReview={(item) => {
                            setSelectedItem(item);
                            setIsReviewModalOpen(true);
                        }}
                    />
                </TabsContent>

                <TabsContent value="usage" className="mt-0">
                    <UsageList
                        records={filteredRecords}
                        loading={loading}
                        onReview={(item) => {
                            setSelectedItem(item);
                            setIsReviewModalOpen(true);
                        }}
                    />
                </TabsContent>

                <TabsContent value="invoices" className="mt-0">
                    <InvoiceList
                        records={filteredRecords}
                        loading={loading}
                    />
                </TabsContent>
            </Tabs>

            {/* Review Modal */}
            <Dialog open={isReviewModalOpen} onOpenChange={setIsReviewModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-indigo-600" />
                            Review {activeTab === 'wastage' ? 'Wastage' : 'Usage'} Record
                        </DialogTitle>
                        <DialogDescription>
                            Confirm the details of this kitchen record before finalizing for audit.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogBody>
                        {selectedItem && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6 p-5 bg-slate-50 dark:bg-slate-900 rounded-ios-lg border border-slate-200 dark:border-slate-800">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Item Identity</p>
                                        <p className="font-bold text-lg text-slate-900 dark:text-slate-100">{selectedItem.item_sku || 'N/A'}</p>
                                        <p className="text-sm text-slate-500 mt-0.5">{selectedItem.item_name || 'Generic Item'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Recorded Quantity</p>
                                        <p className="font-bold text-lg text-slate-900 dark:text-slate-100">
                                            {selectedItem.quantity} <span className="text-sm font-medium text-slate-500">{selectedItem.unit_of_measure}</span>
                                        </p>
                                        <IOSBadge variant="light" className="mt-1 bg-amber-50 text-amber-700 border-amber-100">
                                            Pending Review
                                        </IOSBadge>
                                    </div>
                                    <div className="col-span-2 border-t border-slate-200 dark:border-slate-700 pt-4">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            Source Reason / Notes
                                        </p>
                                        <div className="p-3 bg-white dark:bg-slate-950 rounded-lg border border-slate-100 dark:border-slate-800 italic text-slate-700 dark:text-slate-300">
                                            "{selectedItem.reason || selectedItem.notes || 'No reason provided'}"
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        Reviewer Observations
                                        <span className="text-xs font-normal text-slate-400">(Optional but recommended)</span>
                                    </label>
                                    <Textarea
                                        placeholder="Add any observations, discrepancies, or notes for the upcoming audit..."
                                        value={reviewNotes}
                                        onChange={(e) => setReviewNotes(e.target.value)}
                                        className="min-h-[120px] rounded-ios-lg border-slate-200 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        )}
                    </DialogBody>

                    <DialogFooter>
                        <IOSButton variant="outline" onClick={() => setIsReviewModalOpen(false)}>Close</IOSButton>
                        <IOSButton
                            onClick={handleReview}
                            leftIcon={<CheckCircle2 className="h-4 w-4" />}
                        >
                            Mark as Reviewed
                        </IOSButton>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function WastageList({ records, loading, onReview }: { records: any[], loading: boolean, onReview: (item: any) => void }) {
    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    if (records.length === 0) return (
        <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <ClipboardList className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No pending wastage records</h3>
                <p className="text-slate-500 max-w-xs mt-1">All kitchen wastage recordings have been reviewed or none exist yet.</p>
            </CardContent>
        </Card>
    );

    return (
        <div className="grid grid-cols-1 gap-4">
            {records.map((record) => (
                <Card key={record.id} className="overflow-hidden hover:border-indigo-200 transition-colors">
                    <div className="flex items-center p-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{record.item_sku}</p>
                                <div className="flex items-center text-xs text-slate-500 mt-0.5">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {format(new Date(record.created_at), 'MMM dd, yyyy HH:mm')}
                                </div>
                            </div>
                            <div>
                                <IOSBadge variant="light" className="bg-rose-50 text-rose-700 border-rose-100">
                                    {record.quantity} {record.unit_of_measure}
                                </IOSBadge>
                            </div>
                            <div className="col-span-1 md:col-span-1">
                                <p className="text-xs text-slate-500 uppercase font-semibold">Reason</p>
                                <p className="text-sm truncate max-w-[200px]">{record.reason || 'N/A'}</p>
                            </div>
                            <div className="flex justify-end pr-2">
                                <IOSButton variant="outline" size="sm" onClick={() => onReview(record)} className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                                    Review <ChevronRight className="ml-2 w-4 h-4" />
                                </IOSButton>
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

function UsageList({ records, loading, onReview }: { records: any[], loading: boolean, onReview: (item: any) => void }) {
    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    if (records.length === 0) return (
        <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Utensils className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No pending usage records</h3>
                <p className="text-slate-500 max-w-xs mt-1">All kitchen usage recordings have been reviewed or none exist yet.</p>
            </CardContent>
        </Card>
    );

    return (
        <div className="grid grid-cols-1 gap-4">
            {records.map((record) => (
                <Card key={record.id} className="overflow-hidden hover:border-indigo-200 transition-colors">
                    <div className="flex items-center p-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                            <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{record.item_sku}</p>
                                <div className="flex items-center text-xs text-slate-500 mt-0.5">
                                    <Clock className="w-3 h-3 mr-1" />
                                    {format(new Date(record.created_at), 'MMM dd, yyyy HH:mm')}
                                </div>
                            </div>
                            <div>
                                <IOSBadge variant="light" className="bg-emerald-50 text-emerald-700 border-emerald-100">
                                    {record.quantity} {record.unit_of_measure || 'units'}
                                </IOSBadge>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">Responsible</p>
                                <p className="text-sm truncate">{record.chef_on_duty || 'Kitchen Team'}</p>
                            </div>
                            <div className="flex justify-end pr-2">
                                <IOSButton variant="outline" size="sm" onClick={() => onReview(record)} className="border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                                    Review <ChevronRight className="ml-2 w-4 h-4" />
                                </IOSButton>
                            </div>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}
function InvoiceList({ records, loading }: { records: any[], loading: boolean }) {
    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    if (records.length === 0) return (
        <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No invoices found</h3>
                <p className="text-slate-500 max-w-xs mt-1">There are no invoices matching your criteria.</p>
            </CardContent>
        </Card>
    );

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'paid': return 'text-green-600 bg-green-50 border-green-200';
            case 'unpaid': return 'text-red-600 bg-red-50 border-red-200';
            case 'draft': return 'text-gray-600 bg-gray-50 border-gray-200';
            default: return 'text-blue-600 bg-blue-50 border-blue-200';
        }
    };

    return (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-ios-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                        <th className="px-6 py-4 font-semibold">Invoice #</th>
                        <th className="px-6 py-4 font-semibold">Customer</th>
                        <th className="px-6 py-4 font-semibold">Date</th>
                        <th className="px-6 py-4 font-semibold text-right">Amount</th>
                        <th className="px-6 py-4 font-semibold text-center">Status</th>
                        <th className="px-6 py-4 font-semibold text-center">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {records.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">{inv.invoice_number}</td>
                            <td className="px-6 py-4">
                                <div className="font-medium text-slate-900 dark:text-slate-100">{inv.customer?.customer_name || 'N/A'}</div>
                                <div className="text-xs text-slate-500">{inv.customer?.email}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{inv.invoice_date ? format(new Date(inv.invoice_date), 'MMM dd, yyyy') : 'N/A'}</td>
                            <td className="px-6 py-4 text-right font-medium text-slate-900 dark:text-slate-100">KES {(inv.total_amount || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(inv.status)}`}>
                                    {inv.status}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button
                                        onClick={() => downloadInvoicePDF(inv)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                        title="Download PDF"
                                    >
                                        <Download className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => printInvoicePDF(inv)}
                                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                        title="Print"
                                    >
                                        <Printer className="h-4 w-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
