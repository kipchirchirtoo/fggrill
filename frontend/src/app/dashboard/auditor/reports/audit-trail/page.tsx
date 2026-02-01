'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Shield,
    Search,
    RefreshCw,
    Filter,
    Lock,
    History,
    Info,
    ChevronDown,
    User,
    Activity
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface AuditLog {
    id: string;
    action_type: string;
    entity_type: string;
    entity_id: string;
    user_id: string;
    user_name: string;
    user_role: string;
    details: any;
    ip_address?: string;
    created_at: string;
}

export default function AuditorAuditTrailPage() {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [entityFilter, setEntityFilter] = useState('');

    useEffect(() => {
        fetchAuditTrail();
    }, [entityFilter]);

    const fetchAuditTrail = async () => {
        setIsLoading(true);
        try {
            const response = await api.procurement.getAuditTrail(entityFilter);
            if (response.success) {
                setLogs(response.data || []);
            }
        } catch (error) {
            toast.error('Failed to load audit trail');
        } finally {
            setIsLoading(false);
        }
    };

    const getActionBadge = (action: string) => {
        switch (action?.toLowerCase()) {
            case 'approve': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 uppercase text-[10px]">Approve</Badge>;
            case 'reject': return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200 uppercase text-[10px]">Reject</Badge>;
            case 'submit': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 uppercase text-[10px]">Submit</Badge>;
            case 'process': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 uppercase text-[10px]">Process</Badge>;
            default: return <Badge variant="outline" className="uppercase text-[10px]">{action}</Badge>;
        }
    };

    const filteredLogs = logs.filter(log =>
        log.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Shield className="h-7 w-7 text-stone-800" />
                            Statutory Procurement Audit Trail
                        </h1>
                        <p className="text-stone-500 text-sm">Immutable ledger of all procurement actions, approvals, and financial commitments</p>
                    </div>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={fetchAuditTrail} disabled={isLoading}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Security Banner */}
                <div className="bg-stone-900 text-white rounded-lg p-4 flex items-center justify-between border border-stone-800 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-stone-800 rounded-full border border-stone-700">
                            <Lock className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-sm font-bold uppercase tracking-widest text-stone-400">Security: Write-Once Ledger</p>
                            <p className="text-xs text-stone-500">These logs are enforced by database Row-Level Security and cannot be modified or deleted by any user.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-900/50">
                        <Activity className="h-3 w-3 animate-pulse" /> SYSTEM INTEGRITY SECURE
                    </div>
                </div>

                {/* Filtering Header */}
                <Card className="bg-white border-stone-200 shadow-sm">
                    <CardContent className="p-4 flex flex-wrap items-center gap-4">
                        <div className="relative flex-1 min-w-[300px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <Input
                                placeholder="Search audit detail, reference ID, or user..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-10 border-stone-200"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-stone-400" />
                            <select
                                value={entityFilter}
                                onChange={(e) => setEntityFilter(e.target.value)}
                                className="h-10 border border-stone-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                            >
                                <option value="">All Entities</option>
                                <option value="PURCHASE_ORDER">Purchase Orders</option>
                                <option value="GRN">Goods Received Notes</option>
                                <option value="SUPPLIER_INVOICE">Supplier Invoices</option>
                                <option value="SUPPLIER_PAYMENT">Payments</option>
                            </select>
                        </div>
                    </CardContent>
                </Card>

                {/* Audit Log Table */}
                <Card className="bg-white border-stone-200 shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-stone-50">
                            <TableRow>
                                <TableHead className="w-[180px]">Timestamp</TableHead>
                                <TableHead>User / Role</TableHead>
                                <TableHead>Action</TableHead>
                                <TableHead>Entity</TableHead>
                                <TableHead>System Records & Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center">
                                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-200" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredLogs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center text-stone-400">
                                        No matching audit records found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLogs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-stone-50/50">
                                        <td className="text-[11px] font-mono text-stone-500">{formatDate(log.created_at)}</td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <div className="p-1 bg-stone-100 rounded text-stone-600"><User className="h-3 w-3" /></div>
                                                <div>
                                                    <p className="text-xs font-bold text-stone-900">{log.user_name}</p>
                                                    <p className="text-[9px] text-stone-400 font-bold uppercase tracking-tighter">{log.user_role}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>{getActionBadge(log.action_type)}</td>
                                        <td>
                                            <p className="text-[10px] font-bold text-stone-400 uppercase leading-none mb-1">{log.entity_type.replace('_', ' ')}</p>
                                            <p className="font-mono text-[11px] font-bold text-stone-800">{log.entity_id}</p>
                                        </td>
                                        <td className="max-w-md">
                                            <div className="bg-stone-50 p-2 rounded border border-stone-100 font-mono text-[10px] text-stone-600 overflow-hidden text-ellipsis whitespace-nowrap hover:whitespace-normal transition-all cursor-help">
                                                {JSON.stringify(log.details)}
                                            </div>
                                        </td>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Card>

                {/* Footer info */}
                <div className="flex items-center gap-2 text-stone-400 px-2">
                    <Info className="h-3 w-3" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">End of Statutory Transaction Register</p>
                </div>
            </div>
        </ProtectedRoute>
    );
}
