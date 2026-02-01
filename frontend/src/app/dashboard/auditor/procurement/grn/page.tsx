'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    ShieldCheck, CheckCircle2, RefreshCw, Eye, Check, X,
    AlertCircle, Package, Truck, Search, Filter, Warehouse,
    Info, AlertTriangle, Scale
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { api } from '@/lib/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

interface GRN {
    id: string;
    grn_number: string;
    po_id: string;
    supplier_id: string;
    supplier?: { name: string; supplier_code: string };
    status: string;
    delivery_note_number?: string;
    received_date: string;
    received_by_user?: { first_name: string; last_name: string };
    inspection_notes?: string;
    quality_status: string;
    total_items: number;
    items: any[];
}

export default function AuditorGRNApprovalPage() {
    const { user } = useAuth();
    const [grns, setGrns] = useState<GRN[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
    const [selectedGRN, setSelectedGRN] = useState<GRN | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        fetchPendingGRNs();
    }, []);

    const fetchPendingGRNs = async () => {
        setIsLoading(true);
        try {
            // Fetch only submitted GRNs requiring approval
            const response = await api.procurement.getGRNs('submitted');
            if (response.success) {
                setGrns(response.data || []);
            }
        } catch (error) {
            toast.error('Failed to load pending GRNs');
        } finally {
            setIsLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!selectedGRN) return;
        setIsProcessing(true);
        try {
            const response = await api.procurement.approveGRN(selectedGRN.id);
            if (response.success) {
                toast.success('GRN approved. Inventory updated and GRNI recorded.');
                setIsApproveModalOpen(false);
                fetchPendingGRNs();
            }
        } catch (error) {
            toast.error('Failed to approve GRN');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReject = async (reason: string) => {
        if (!selectedGRN) return;
        try {
            const response = await api.procurement.cancelGRN(selectedGRN.id);
            if (response.success) {
                toast.success('GRN rejected');
                setIsApproveModalOpen(false);
                fetchPendingGRNs();
            }
        } catch (error) {
            toast.error('Failed to reject GRN');
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <ShieldCheck className="h-7 w-7 text-amber-600" />
                            GRN Verification Queue
                        </h1>
                        <p className="text-stone-500 text-sm">Review and approve received goods to update inventory and financial records</p>
                    </div>
                    <Button variant="outline" onClick={fetchPendingGRNs} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Info Card */}
                <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4 flex items-start gap-4">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-semibold">Auditor Responsibility</p>
                            <p className="mt-1">Approving a GRN is a financial event. It updates physical stock levels and creates a Goods Received Not Invoiced (GRNI) liability in the ledger. Please ensure all quantities and conditions match the physical counts reported by storekeeping.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* List Card */}
                <Card className="bg-white border-stone-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-stone-50 border-b">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg">Pending Approvals</CardTitle>
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 font-bold">
                                {grns.length} Awaiting Verification
                            </Badge>
                        </div>
                    </CardHeader>
                    {isLoading ? (
                        <div className="p-12 text-center text-stone-500">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-stone-200" />
                            <p>Fetching pending GRNs...</p>
                        </div>
                    ) : grns.length === 0 ? (
                        <div className="p-12 text-center text-stone-500">
                            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-emerald-100" />
                            <p className="text-lg font-medium text-stone-900">Queue Clear</p>
                            <p className="text-sm">All received goods have been verified.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>GRN Number</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Delivery Note</TableHead>
                                    <TableHead>Received Date</TableHead>
                                    <TableHead>Quality Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {grns.map((grn) => (
                                    <TableRow key={grn.id} className="hover:bg-stone-50/50">
                                        <td className="font-mono text-sm font-bold">{grn.grn_number}</td>
                                        <td>
                                            <div className="font-medium text-stone-900">{grn.supplier?.name}</div>
                                            <div className="text-xs text-stone-500">{grn.supplier?.supplier_code}</div>
                                        </td>
                                        <td className="text-sm text-stone-600">{grn.delivery_note_number || 'N/A'}</td>
                                        <td className="text-sm text-stone-600">{formatDate(grn.received_date)}</td>
                                        <td>
                                            <Badge variant="outline" className={
                                                grn.quality_status === 'passed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                    grn.quality_status === 'conditional' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                        'bg-rose-50 text-rose-700 border-rose-100'
                                            }>
                                                {grn.quality_status.toUpperCase()}
                                            </Badge>
                                        </td>
                                        <td className="text-right">
                                            <Button size="sm" onClick={() => { setSelectedGRN(grn); setIsApproveModalOpen(true); }} className="bg-stone-800 hover:bg-stone-700">
                                                View & Verify
                                            </Button>
                                        </td>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </Card>

                {/* Approval Dialog */}
                <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <div className="flex justify-between items-center">
                                <DialogTitle className="flex items-center gap-2">
                                    <Warehouse className="h-5 w-5 text-amber-600" />
                                    GRN Verification: {selectedGRN?.grn_number}
                                </DialogTitle>
                                <Badge className="bg-amber-100 text-amber-700">SUBMITTED</Badge>
                            </div>
                        </DialogHeader>

                        {selectedGRN && (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-4 border-y">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Supplier</p>
                                        <p className="text-sm font-semibold">{selectedGRN.supplier?.name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Received By</p>
                                        <p className="text-sm font-semibold">{selectedGRN.received_by_user?.first_name} {selectedGRN.received_by_user?.last_name}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Received Date</p>
                                        <p className="text-sm font-semibold">{formatDate(selectedGRN.received_date)}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Delivery Note</p>
                                        <p className="text-sm font-semibold">{selectedGRN.delivery_note_number || 'N/A'}</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold flex items-center gap-2 italic">
                                            <Package className="h-4 w-4" /> Item Detail Verification
                                        </h3>
                                    </div>
                                    <div className="border rounded-lg overflow-hidden">
                                        <Table>
                                            <TableHeader className="bg-stone-50">
                                                <TableRow>
                                                    <TableHead>Item Name</TableHead>
                                                    <TableHead className="text-right">Ordered</TableHead>
                                                    <TableHead className="text-right">Received</TableHead>
                                                    <TableHead className="text-right text-rose-600">Shortage</TableHead>
                                                    <TableHead className="text-right text-rose-600">Damaged</TableHead>
                                                    <TableHead>Condition</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedGRN.items?.map((item, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="font-medium text-xs">{item.item?.item_name || `Item ${idx + 1}`}</TableCell>
                                                        <TableCell className="text-right text-xs">{item.ordered_quantity}</TableCell>
                                                        <TableCell className="text-right text-xs font-bold">{item.received_quantity}</TableCell>
                                                        <TableCell className="text-right text-xs text-rose-600 font-medium">
                                                            {item.short_quantity > 0 ? `-${item.short_quantity}` : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs text-rose-600 font-medium">
                                                            {item.damaged_quantity > 0 ? item.damaged_quantity : '-'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="text-[10px] py-0 border-stone-100">
                                                                {item.item_condition || 'GOOD'}
                                                            </Badge>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>

                                {selectedGRN.inspection_notes && (
                                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-100">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Storekeeper Inspection Notes</p>
                                        <p className="text-sm text-stone-700 italic">"{selectedGRN.inspection_notes}"</p>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                                    <div>
                                        <p className="text-sm font-bold text-amber-900">Ledger Impact Confirmation</p>
                                        <p className="text-xs text-amber-700">Approving this will debit Inventory and credit the GRNI Control Account for the accepted items.</p>
                                    </div>
                                </div>

                                <DialogFooter className="flex justify-between sm:justify-between items-center pt-4 border-t">
                                    <Button variant="ghost" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => handleReject('Audit failure')}>
                                        <X className="h-4 w-4 mr-2" /> Reject GRN
                                    </Button>
                                    <div className="flex gap-3">
                                        <Button variant="outline" onClick={() => setIsApproveModalOpen(false)}>Close</Button>
                                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove} disabled={isProcessing}>
                                            {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                                            Approve & Post to Ledger
                                        </Button>
                                    </div>
                                </DialogFooter>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </ProtectedRoute>
    );
}
