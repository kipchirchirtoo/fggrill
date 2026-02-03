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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Search, Filter, Loader2, Package, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface RequisitionItem {
    id: string;
    item_name: string;
    unit: string;
    quantity_requested: number;
    quantity_fulfilled?: number;
    approved_quantity?: number;
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
    branch?: { name: string };
    branch_id: number;
}

export default function AuditorKitchenRequisitionsPage() {
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    useEffect(() => {
        fetchRequisitions();
    }, [statusFilter]);

    const fetchRequisitions = async () => {
        try {
            setLoading(true);
            const res = await api.store.getKitchenRequisitions({
                status: statusFilter !== 'all' ? statusFilter : undefined
            });
            if (res.success && Array.isArray(res.data)) {
                setRequisitions(res.data);
            } else {
                setRequisitions([]);
                if (res.message) {
                    console.error('API Error:', res.message);
                }
            }
        } catch (error) {
            console.error('Failed to fetch requisitions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = (req: Requisition) => {
        setSelectedRequisition(req);
        setIsDetailsOpen(true);
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

    const filteredRequisitions = requisitions.filter(req =>
        req.requisition_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.branch?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Kitchen Requisitions Oversight</h1>
                    <p className="text-muted-foreground mt-2">Monitor all kitchen requisition activity across branches.</p>
                </div>
                <Button variant="outline" onClick={fetchRequisitions} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Loader2 className="h-4 w-4 mr-2" />}
                    Refresh
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by ID or Branch..."
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
                    <CardTitle>Requisition Activity</CardTitle>
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
                            <p>No requisitions found.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Req ID</TableHead>
                                    <TableHead>Branch</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRequisitions.map((req) => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-medium">{req.requisition_number}</TableCell>
                                        <TableCell>{req.branch?.name || `Branch #${req.branch_id}`}</TableCell>
                                        <TableCell>{format(new Date(req.request_date), 'MMM d, yyyy')}</TableCell>
                                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                                        <TableCell>{req.items.length} items</TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="ghost" onClick={() => handleViewDetails(req)}>
                                                <Eye className="h-4 w-4 mr-2" />
                                                View
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Requisition Details: {selectedRequisition?.requisition_number}</DialogTitle>
                        <DialogDescription>
                            Branch: {selectedRequisition?.branch?.name} | Requested By: {selectedRequisition?.requested_by_name}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedRequisition && (
                        <div className="mt-4">
                            <div className="bg-muted/50 p-4 rounded-lg mb-4 text-sm grid grid-cols-2 gap-4">
                                <div>
                                    <p className="font-semibold text-muted-foreground">Reason</p>
                                    <p>{selectedRequisition.reason || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="font-semibold text-muted-foreground">Priority</p>
                                    <p>{selectedRequisition.priority}</p>
                                </div>
                            </div>

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item</TableHead>
                                        <TableHead>Unit</TableHead>
                                        <TableHead className="text-right">Requested</TableHead>
                                        <TableHead className="text-right">Fulfilled</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {selectedRequisition.items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.item_name}</TableCell>
                                            <TableCell>{item.unit}</TableCell>
                                            <TableCell className="text-right">{item.quantity_requested}</TableCell>
                                            <TableCell className="text-right">{item.quantity_fulfilled || 0}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
