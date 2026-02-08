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
import { cashierAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function BranchLogbooksPage() {
    const [loading, setLoading] = useState(true);
    const [logbooks, setLogbooks] = useState<any[]>([]);
    const [statusFilter, setStatusFilter] = useState('pending_audit'); // pending_audit, approved, all
    const [selectedLogbook, setSelectedLogbook] = useState<any>(null);
    const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
    const [auditNotes, setAuditNotes] = useState('');
    const [action, setAction] = useState<'approve' | 'reject' | null>(null);

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

            const response = await cashierAPI.getPendingLogbooks({
                branch_id: branchId,
                status: statusFilter === 'all' ? undefined : statusFilter
            });

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
            const response = await cashierAPI.auditLogbook(selectedLogbook.id, decision, auditNotes);
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
                {logbooks.map((logbook) => (
                    <Card key={logbook.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => {
                        setSelectedLogbook(logbook);
                        setIsAuditModalOpen(true);
                    }}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">
                                {new Date(logbook.log_date).toLocaleDateString()}
                            </CardTitle>
                            {logbook.status === 'pending_audit' && <Badge variant="secondary">Pending</Badge>}
                            {logbook.status === 'approved' && <Badge className="bg-green-500">Approved</Badge>}
                            {logbook.status === 'rejected' && <Badge variant="destructive">Rejected</Badge>}
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 mt-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Cashier:</span>
                                    <span className="font-medium">{logbook.cashier?.first_name} {logbook.cashier?.last_name}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Type:</span>
                                    <span className="capitalize">{logbook.type}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Revenue:</span>
                                    <span className="font-bold">
                                        {formatCurrency(
                                            (logbook.total_cash || 0) +
                                            (logbook.total_mpesa || 0) +
                                            (logbook.total_swipe || 0)
                                        )}
                                    </span>
                                </div>
                                {(logbook.cash_variance !== 0) && (
                                    <div className="flex items-center gap-2 text-xs text-red-500 font-medium mt-2">
                                        <AlertCircle className="h-3 w-3" />
                                        Variance: {formatCurrency(logbook.cash_variance)}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
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

                    {selectedLogbook && (
                        <div className="space-y-6">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Opening Float</div>
                                    <div className="font-semibold">{formatCurrency(selectedLogbook.opening_float)}</div>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Closing Float</div>
                                    <div className="font-semibold">{formatCurrency(selectedLogbook.closing_float)}</div>
                                </div>
                                <div className="p-3 border rounded-lg">
                                    <div className="text-xs text-muted-foreground">Total Revenue</div>
                                    <div className="font-semibold">
                                        {formatCurrency((selectedLogbook.total_cash || 0) + (selectedLogbook.total_mpesa || 0) + (selectedLogbook.total_swipe || 0))}
                                    </div>
                                </div>
                                <div className={`p-3 border rounded-lg ${selectedLogbook.cash_variance !== 0 ? 'bg-red-50 border-red-200' : ''}`}>
                                    <div className="text-xs text-muted-foreground">Variance</div>
                                    <div className={`font-semibold ${selectedLogbook.cash_variance !== 0 ? 'text-red-600' : ''}`}>
                                        {formatCurrency(selectedLogbook.cash_variance)}
                                    </div>
                                </div>
                            </div>

                            {/* Revenue Breakdown */}
                            <div>
                                <h3 className="text-sm font-semibold mb-2">Revenue Breakdown</h3>
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div className="flex justify-between p-2 bg-secondary/50 rounded">
                                        <span>Cash</span>
                                        <span className="font-medium">{formatCurrency(selectedLogbook.total_cash)}</span>
                                    </div>
                                    <div className="flex justify-between p-2 bg-secondary/50 rounded">
                                        <span>M-Pesa</span>
                                        <span className="font-medium">{formatCurrency(selectedLogbook.total_mpesa)}</span>
                                    </div>
                                    <div className="flex justify-between p-2 bg-secondary/50 rounded">
                                        <span>Card/Swipe</span>
                                        <span className="font-medium">{formatCurrency(selectedLogbook.total_swipe)}</span>
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
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
