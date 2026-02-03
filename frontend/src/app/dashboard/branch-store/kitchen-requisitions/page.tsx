'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Check, X, Search, Filter, Loader2, Package, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface RequisitionItem {
    id: string;
    item_sku: string;
    item_name: string;
    unit: string;
    quantity_requested: number;
    quantity_fulfilled?: number;
}

interface Requisition {
    id: string;
    requisition_number: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FULFILLED' | 'PARTIALLY_FULFILLED';
    requested_by_name: string;
    request_date: string;
    needed_by_date?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    reason?: string;
    items: RequisitionItem[];
    rejection_reason?: string;
}

export default function KitchenRequisitionsPage() {
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Fulfillment State
    const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
    const [fulfillmentItems, setFulfillmentItems] = useState<Record<string, number>>({});
    const [isFulfillDialogOpen, setIsFulfillDialogOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Rejection State
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Escalation State
    const [isEscalateDialogOpen, setIsEscalateDialogOpen] = useState(false);

    // Recipes for Purpose tracking
    const [recipes, setRecipes] = useState<any[]>([]);
    const [fulfillmentPurpose, setFulfillmentPurpose] = useState<Record<string, { menu_item_id?: number; recipe_id?: number }>>({});

    useEffect(() => {
        fetchRequisitions();
    }, [statusFilter]);

    const fetchRequisitions = async () => {
        try {
            setLoading(true);
            const data = await api.store.getKitchenRequisitions({
                status: statusFilter !== 'all' ? statusFilter : undefined
            });
            setRequisitions(data || []);

            // Fetch recipes for purpose selection
            const recipesRes = await api.kitchen.getRecipes();
            if (recipesRes.success) setRecipes(recipesRes.data);
        } catch (error) {
            console.error('Failed to fetch requisitions:', error);
            toast.error('Failed to load kitchen requisitions');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenFulfill = (req: Requisition) => {
        setSelectedRequisition(req);
        // Initialize fulfillment quantities with requested quantities
        const initialQuantities: Record<string, number> = {};
        req.items.forEach(item => {
            initialQuantities[item.id] = item.quantity_requested;
        });
        setFulfillmentItems(initialQuantities);
        setIsFulfillDialogOpen(true);
    };

    const handleFulfillSubmit = async () => {
        if (!selectedRequisition) return;

        try {
            setSubmitting(true);
            const itemsToFulfill = selectedRequisition.items.map(item => ({
                item_id: item.id,
                quantity: fulfillmentItems[item.id] || 0,
                menu_item_id: fulfillmentPurpose[item.id]?.menu_item_id,
                recipe_id: fulfillmentPurpose[item.id]?.recipe_id
            }));

            await api.store.fulfillKitchenRequisition(selectedRequisition.id, itemsToFulfill);

            toast.success('Requisition fulfilled successfully');
            setIsFulfillDialogOpen(false);
            fetchRequisitions();
        } catch (error) {
            console.error('Fulfillment error:', error);
            toast.error('Failed to fulfill requisition');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenReject = (req: Requisition) => {
        setSelectedRequisition(req);
        setRejectionReason('');
        setIsRejectDialogOpen(true);
    };

    const handleRejectSubmit = async () => {
        if (!selectedRequisition) return;
        if (!rejectionReason.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
        }

        try {
            setSubmitting(true);
            await api.store.rejectKitchenRequisition(selectedRequisition.id, rejectionReason);

            toast.success('Requisition rejected');
            setIsRejectDialogOpen(false);
            fetchRequisitions();
        } catch (error) {
            console.error('Rejection error:', error);
            toast.error('Failed to reject requisition');
        } finally {
            setSubmitting(false);
        }
    };

    const handleOpenEscalate = (req: Requisition) => {
        setSelectedRequisition(req);
        setIsEscalateDialogOpen(true);
    };

    const handleEscalateSubmit = async () => {
        if (!selectedRequisition) return;

        try {
            setSubmitting(true);
            // Create a stock request for central store using the same items
            const stockRequestData = {
                items: selectedRequisition.items.map(item => ({
                    item_sku: item.item_sku,
                    requested_quantity: item.quantity_requested
                })),
                request_type: 'ROUTINE',
                priority: selectedRequisition.priority === 'URGENT' ? 'URGENT' : 'NORMAL',
                reason: `Escalated from Kitchen Requisition: ${selectedRequisition.requisition_number}`
            };

            await api.store.createStockRequest(stockRequestData);

            toast.success('Escalated to Central Store. Auditor notified.');
            setIsEscalateDialogOpen(false);
            // Optionally update the status of the local requisition or add a note
        } catch (error) {
            console.error('Escalation error:', error);
            toast.error('Failed to escalate request');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
            case 'APPROVED': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Approved</Badge>;
            case 'FULFILLED': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Fulfilled</Badge>;
            case 'PARTIALLY_FULFILLED': return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">Partially Fulfilled</Badge>;
            case 'REJECTED': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case 'URGENT': return <Badge variant="destructive" className="animate-pulse">URGENT</Badge>;
            case 'HIGH': return <Badge className="bg-orange-500 hover:bg-orange-600">High</Badge>;
            case 'MEDIUM': return <Badge className="bg-blue-500 hover:bg-blue-600">Medium</Badge>;
            default: return <Badge variant="secondary">Low</Badge>;
        }
    };

    const filteredRequisitions = requisitions.filter(req =>
        req.requisition_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.requested_by_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Kitchen Requisitions</h1>
                    <p className="text-muted-foreground mt-2">Manage incoming stock requests from kitchen operations.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchRequisitions} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Loader2 className="h-4 w-4 mr-2" />}
                        Refresh
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by ID or requester..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="FULFILLED">Fulfilled</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle>Requisitions Queue</CardTitle>
                    <CardDescription>
                        {filteredRequisitions.length} requests found
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : filteredRequisitions.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            <p>No requisitions found matching your criteria.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Req ID</TableHead>
                                    <TableHead>Requested By</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Priority</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequisitions.map((req) => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-medium">{req.requisition_number}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span>{req.requested_by_name}</span>
                                                {req.needed_by_date && (
                                                    <span className="text-xs text-muted-foreground">Due: {format(new Date(req.needed_by_date), 'MMM d')}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{format(new Date(req.request_date), 'MMM d, yyyy')}</TableCell>
                                        <TableCell>{getPriorityBadge(req.priority)}</TableCell>
                                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                                        <TableCell>{req.items.length} items</TableCell>
                                        <TableCell className="text-right">
                                            {(req.status === 'PENDING' || req.status === 'APPROVED' || req.status === 'PARTIALLY_FULFILLED') && (
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600" onClick={() => handleOpenReject(req)}>
                                                        Reject
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => handleOpenEscalate(req)}>
                                                        Escalate
                                                    </Button>
                                                    <Button size="sm" onClick={() => handleOpenFulfill(req)}>
                                                        Fulfill
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Fulfill Dialog */}
            <Dialog open={isFulfillDialogOpen} onOpenChange={setIsFulfillDialogOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Fulfill Requisition: {selectedRequisition?.requisition_number}</DialogTitle>
                        <DialogDescription>
                            Review requested items and specify quantity to issue.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRequisition && (
                        <div className="mt-4">
                            <div className="bg-muted/50 p-4 rounded-lg mb-4 text-sm">
                                <p className="font-semibold mb-1">Reason for Request:</p>
                                <p className="text-muted-foreground">{selectedRequisition.reason || 'No specific reason provided.'}</p>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Unit</TableHead>
                                        <TableHead className="text-right">Requested</TableHead>
                                        <TableHead>Purpose (Menu Item)</TableHead>
                                        <TableHead className="text-right w-[120px]">Issue Qty</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedRequisition.items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.item_name}</TableCell>
                                            <TableCell>{item.unit}</TableCell>
                                            <TableCell className="text-right">{item.quantity_requested}</TableCell>
                                            <TableCell>
                                                <Select
                                                    onValueChange={(val) => {
                                                        const recipe = recipes.find(r => r.id === parseInt(val));
                                                        setFulfillmentPurpose({
                                                            ...fulfillmentPurpose,
                                                            [item.id]: { menu_item_id: recipe?.menu_item_id, recipe_id: recipe?.id }
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[180px] h-8 text-xs italic">
                                                        <SelectValue placeholder="Select Purpose..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {recipes.map(r => (
                                                            <SelectItem key={r.id} value={r.id.toString()}>{r.menu_item_name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    className="text-right"
                                                    value={fulfillmentItems[item.id] || ''}
                                                    onChange={(e) => setFulfillmentItems({
                                                        ...fulfillmentItems,
                                                        [item.id]: parseFloat(e.target.value) || 0
                                                    })}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsFulfillDialogOpen(false)}>Cancel</Button>
                        <Button variant="secondary" onClick={() => {
                            setIsFulfillDialogOpen(false);
                            if (selectedRequisition) handleOpenEscalate(selectedRequisition);
                        }}>
                            Insufficient Stock? Escalate
                        </Button>
                        <Button onClick={handleFulfillSubmit} disabled={submitting}>
                            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Confirm Fulfillment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reject Requisition</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to reject this requisition? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <label className="text-sm font-medium mb-2 block">Reason for Rejection</label>
                        <Input
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="e.g., Out of stock, Duplicate request..."
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleRejectSubmit} disabled={submitting}>
                            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Reject Request
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Escalate Dialog */}
            <Dialog open={isEscalateDialogOpen} onOpenChange={setIsEscalateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Escalate to Central Store</DialogTitle>
                        <DialogDescription>
                            This will create a new stock request for the Central Store with all items in this requisition. The Auditor will need to approve it.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedRequisition && (
                        <div className="py-4">
                            <p className="text-sm font-medium mb-2">Items to be requested:</p>
                            <ul className="text-sm text-muted-foreground space-y-1 bg-stone-50 p-3 rounded-lg border border-stone-100 italic">
                                {selectedRequisition.items.map(item => (
                                    <li key={item.id}>• {item.item_name} ({item.quantity_requested} {item.unit})</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEscalateDialogOpen(false)}>Cancel</Button>
                        <Button variant="default" className="bg-orange-600 hover:bg-orange-700" onClick={handleEscalateSubmit} disabled={submitting}>
                            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Confirm Escalation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
