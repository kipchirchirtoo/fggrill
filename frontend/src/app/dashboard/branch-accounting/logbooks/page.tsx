'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Calendar,
    Search,
    Filter,
    ClipboardCheck,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Eye
} from 'lucide-react';
import { cashierAPI, kyogongAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function BranchLogbooksPage() {
    const [loading, setLoading] = useState(true);
    const [logbooks, setLogbooks] = useState<any[]>([]);
    const [statusFilter, setStatusFilter] = useState('pending_audit'); // pending_audit, approved, all
    const [selectedLogbook, setSelectedLogbook] = useState<any>(null);
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditNotes, setAuditNotes] = useState('');
    const [action, setAction] = useState<'approve' | 'reject' | null>(null);

    // Helper to determine if the active branch is Kyogong
    const isKyogongBranch = () => {
        try {
            const branchStr = localStorage.getItem('activeBranch');
            if (branchStr) {
                const branch = JSON.parse(branchStr);
                return branch.name?.toLowerCase().includes('kyogong');
            }
        } catch (e) { }
        return false;
    };

    useEffect(() => {
        fetchLogbooks();
    }, [statusFilter]);

    const fetchLogbooks = async () => {
        setLoading(true);
        try {
            const branchId = localStorage.getItem('activeBranchId');
            if (!branchId) {
                toast.error('Branch ID not found');
                return;
            }

            const statusParam = statusFilter === 'all' ? undefined : statusFilter;
            const isKyogong = isKyogongBranch();

            const response = isKyogong
                ? await kyogongAPI.getShifts({ branch_id: branchId, status: statusParam })
                : await cashierAPI.getPendingLogbooks({ branch_id: branchId, status: statusParam });

            if (response.success) {
                setLogbooks(response.data);
            } else {
                toast.error(response.message || 'Failed to fetch logbooks');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error loading logbooks');
        } finally {
            setLoading(false);
        }
    };

    const handleAudit = async (decision: 'approve' | 'reject') => {
        if (!selectedLogbook) return;

        try {
            const isKyogong = isKyogongBranch();
            let response;

            if (isKyogong) {
                // kyogong uses flag instead of reject
                const kyogongAction = decision === 'reject' ? 'flag' : 'approve';
                response = await kyogongAPI.auditShift(selectedLogbook.id, kyogongAction, auditNotes);
            } else {
                response = await cashierAPI.auditLogbook(selectedLogbook.id, decision, auditNotes);
            }

            if (response.success) {
                toast.success(`Logbook ${decision}d successfully`);
                setIsAuditModalOpen(false);
                setSelectedLogbook(null);
                setAuditNotes('');
                fetchLogbooks(); // Refresh list
            } else {
                toast.error(response.message || 'Audit failed');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error submitting audit');
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Cashier Logbooks</h1>
                    <p className="text-muted-foreground">Review and audit daily cashier shift records.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search cashier..."
                            className="pl-8 w-[200px] lg:w-[300px]"
                        />
                    </div>
                    <select
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="pending_audit">Pending Audit</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="all">All Statuses</option>
                    </select>
                    <Button variant="outline" size="icon" onClick={fetchLogbooks}>
                        <Filter className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {logbooks.map((logbook) => {
                    const date = logbook.log_date || logbook.opened_at || logbook.shift_start;
                    const isKyogong = isKyogongBranch();
                    const statusText = isKyogong && logbook.status === 'closed' ? 'pending_audit' : logbook.status;
                    
                    const openingFloat = logbook.opening_cash_float ?? logbook.opening_float ?? 0;
                    const totalCash = logbook.cash_sales ?? logbook.total_cash_sales ?? logbook.total_cash ?? 0;
                    const totalMpesa = logbook.mpesa_sales ?? logbook.total_mpesa_sales ?? logbook.total_mpesa ?? 0;
                    const totalCard = logbook.card_sales ?? logbook.total_card_sales ?? logbook.total_swipe ?? 0;
                    const totalRevenue = logbook.total_sales ?? (totalCash + totalMpesa + totalCard);
                    
                    const variance = logbook.cash_variance ?? logbook.variance ?? 0;
                    
                    return (
                        <Card key={logbook.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => {
                            setSelectedLogbook(logbook);
                            setIsAuditModalOpen(true);
                        }}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    {date ? new Date(date).toLocaleDateString() : 'Unknown Date'}
                                </CardTitle>
                                {statusText === 'pending_audit' && <Badge variant="secondary">Pending</Badge>}
                                {statusText === 'approved' && <Badge className="bg-green-500">Approved</Badge>}
                                {(statusText === 'rejected' || statusText === 'flagged') && <Badge variant="destructive">{statusText === 'flagged' ? 'Flagged' : 'Rejected'}</Badge>}
                                {statusText === 'open' && <Badge variant="outline" className="text-blue-500 border-blue-500">Active</Badge>}
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 mt-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Cashier:</span>
                                        <span className="font-medium">{logbook.cashier?.first_name || logbook.cashier_name?.split(' ')[0]} {logbook.cashier?.last_name || ''}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">{isKyogong ? 'Point:' : 'Type:'}</span>
                                        <span className="capitalize">{logbook.sales_point?.name || logbook.type || 'General'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-muted-foreground">Total Revenue:</span>
                                        <span className="font-bold">
                                            {formatCurrency(totalRevenue)}
                                        </span>
                                    </div>
                                    {(variance !== 0) && (
                                        <div className={`flex items-center gap-2 text-xs font-medium mt-2 ${variance > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            <AlertCircle className="h-3 w-3" />
                                            Variance: {formatCurrency(variance)}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                {logbooks.length === 0 && !loading && (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                        No logbooks found matching criteria.
                    </div>
                )}
            </div>

            {/* Audit Modal */}
            <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Audit Logbook</DialogTitle>
                        <DialogDescription>
                            Review details for {selectedLogbook?.cashier?.first_name}'s shift on {new Date(selectedLogbook?.log_date).toLocaleDateString()}.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedLogbook && (() => {
                        const date = selectedLogbook.log_date || selectedLogbook.opened_at || selectedLogbook.shift_start;
                        const isKyogong = isKyogongBranch();
                        const statusText = isKyogong && selectedLogbook.status === 'closed' ? 'pending_audit' : selectedLogbook.status;
                        
                        const openingFloat = selectedLogbook.opening_cash_float ?? selectedLogbook.opening_float ?? 0;
                        const closingFloat = selectedLogbook.closing_float ?? selectedLogbook.actual_cash ?? 0;
                        const expectedFloat = selectedLogbook.expected_closing_amount ?? selectedLogbook.expected_closing_float ?? selectedLogbook.expected_cash ?? 0;
                        
                        const totalCash = selectedLogbook.cash_sales ?? selectedLogbook.total_cash_sales ?? selectedLogbook.total_cash ?? 0;
                        const totalMpesa = selectedLogbook.mpesa_sales ?? selectedLogbook.total_mpesa_sales ?? selectedLogbook.total_mpesa ?? 0;
                        const totalCard = selectedLogbook.card_sales ?? selectedLogbook.total_card_sales ?? selectedLogbook.total_swipe ?? 0;
                        const totalRevenue = selectedLogbook.total_sales ?? (totalCash + totalMpesa + totalCard);
                        
                        const creditCreated = selectedLogbook.total_credit_created ?? 0;
                        const creditPaid = selectedLogbook.total_credit_paid_cash ?? selectedLogbook.paid_bills_value ?? 0;
                        const variance = selectedLogbook.cash_variance ?? selectedLogbook.variance ?? 0;

                        return (
                            <div className="space-y-6">
                                {/* Summary Stats */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="p-3 border rounded-lg bg-gray-50">
                                        <div className="text-xs text-muted-foreground">Opening Float</div>
                                        <div className="font-semibold">{formatCurrency(openingFloat)}</div>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-gray-50">
                                        <div className="text-xs text-muted-foreground">Expected Cash</div>
                                        <div className="font-semibold">{formatCurrency(expectedFloat)}</div>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-blue-50 border-blue-100">
                                        <div className="text-xs text-blue-600">Actual Counted</div>
                                        <div className="font-semibold text-blue-700">{formatCurrency(closingFloat)}</div>
                                    </div>
                                    <div className="p-3 border rounded-lg bg-gray-50">
                                        <div className="text-xs text-muted-foreground">Total Revenue</div>
                                        <div className="font-semibold">
                                            {formatCurrency(totalRevenue)}
                                        </div>
                                    </div>
                                    <div className={`p-3 border rounded-lg ${variance !== 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                        <div className={`text-xs ${variance !== 0 ? 'text-red-600' : 'text-green-600'}`}>Variance</div>
                                        <div className={`font-semibold ${variance !== 0 ? 'text-red-700' : 'text-green-700'}`}>
                                            {formatCurrency(variance)}
                                        </div>
                                    </div>
                                </div>

                                {/* Revenue & Credit Breakdown */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="text-sm font-semibold mb-2">Revenue Breakdown</h3>
                                        <div className="space-y-2 text-sm border rounded-lg p-3 bg-white">
                                            <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                                                <span className="text-muted-foreground">Cash Sales</span>
                                                <span className="font-medium">{formatCurrency(totalCash)}</span>
                                            </div>
                                            <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                                                <span className="text-muted-foreground">M-Pesa Sales</span>
                                                <span className="font-medium">{formatCurrency(totalMpesa)}</span>
                                            </div>
                                            <div className="flex justify-between p-2 hover:bg-gray-50 rounded">
                                                <span className="text-muted-foreground">Card/Swipe</span>
                                                <span className="font-medium">{formatCurrency(totalCard)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold mb-2">Credit Activity</h3>
                                        <div className="space-y-2 text-sm border rounded-lg p-3 bg-white">
                                            <div className="flex justify-between p-2 hover:bg-orange-50 rounded">
                                                <span className="text-orange-600">Credit Bills Created</span>
                                                <span className="font-medium text-orange-700">{formatCurrency(creditCreated)}</span>
                                            </div>
                                            <div className="flex justify-between p-2 hover:bg-green-50 rounded">
                                                <span className="text-green-600">Credit Paid via Cash</span>
                                                <span className="font-medium text-green-700">{formatCurrency(creditPaid)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            {/* Logbook Lines (Credit/Unpaid/Paid) */}
                            {selectedLogbook.lines && selectedLogbook.lines.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">Recorded Bills</h3>
                                    <ScrollArea className="h-[200px] border rounded-md p-4">
                                        <div className="space-y-3">
                                            {selectedLogbook.lines.map((line: any) => (
                                                <div key={line.id} className="flex justify-between items-start pb-2 border-b last:border-0">
                                                    <div>
                                                        <div className="font-medium text-sm">{line.customer_name}</div>
                                                        <div className="text-xs text-muted-foreground capitalize">
                                                            {line.section.replace('_', ' ')} • {line.reference || 'No Ref'}
                                                        </div>
                                                    </div>
                                                    <div className="font-mono text-sm">
                                                        {formatCurrency(line.amount)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </div>
                            )}

                            {/* Notes */}
                            {selectedLogbook.notes && (
                                <div>
                                    <h3 className="text-sm font-semibold mb-1">Cashier Notes</h3>
                                    <p className="text-sm text-muted-foreground italic bg-secondary/30 p-2 rounded">
                                        "{selectedLogbook.notes}"
                                    </p>
                                </div>
                            )}

                            {/* Audit Decision */}
                            {selectedLogbook.status === 'pending_audit' && (
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="space-y-2">
                                        <Label>Audit Notes</Label>
                                        <Textarea
                                            placeholder="Add remarks about this audit..."
                                            value={auditNotes}
                                            onChange={(e) => setAuditNotes(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-3 justify-end">
                                        <Button variant="outline" onClick={() => setIsAuditModalOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={() => handleAudit('reject')}
                                        >
                                            <XCircle className="mr-2 h-4 w-4" />
                                            Reject Logbook
                                        </Button>
                                        <Button
                                            className="bg-green-600 hover:bg-green-700"
                                            onClick={() => handleAudit('approve')}
                                        >
                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                            Approve & Close
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
