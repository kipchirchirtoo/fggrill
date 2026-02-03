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
import { Search, Filter, Loader2, ClipboardList, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface UsageEntry {
    id: string;
    item_name: string;
    item_sku: string;
    quantity: number;
    unit_of_measure: string;
    usage_type: string;
    usage_date: string;
    shift: string;
    notes?: string;
    branch_id: number;
    branch?: { name: string };
    created_at: string;
}

export default function AuditorKitchenUsagePage() {
    const [entries, setEntries] = useState<UsageEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsage();
    }, [typeFilter]);

    const fetchUsage = async () => {
        try {
            setLoading(true);
            const response = await api.kitchen.getUsageEntries();
            if (response.success) {
                setEntries(response.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch usage:', error);
        } finally {
            setLoading(false);
        }
    };

    const getUsageBadge = (type: string) => {
        const styles: Record<string, string> = {
            STAFF_MEAL: 'bg-blue-100 text-blue-700',
            COMPLIMENTARY: 'bg-green-100 text-green-700',
            TEST: 'bg-amber-100 text-amber-700',
            OTHER: 'bg-stone-100 text-stone-700'
        };
        const style = styles[type] || 'bg-stone-100 text-stone-700';
        return <Badge variant="outline" className={`${style} border-transparent uppercase text-[10px]`}>{type.replace('_', ' ')}</Badge>;
    };

    const filteredEntries = entries.filter(entry =>
        (entry.item_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.item_sku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.branch?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).filter(entry =>
        typeFilter === 'all' || entry.usage_type === typeFilter
    );

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-stone-900 font-display">Kitchen Usage Oversight</h1>
                    <p className="text-stone-500 mt-2 font-medium">Analyze manual kitchen usage entries across all branches.</p>
                </div>
                <Button
                    variant="outline"
                    onClick={fetchUsage}
                    disabled={loading}
                    className="border-stone-200 hover:bg-stone-50 text-stone-700 font-semibold shadow-sm"
                >
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                    <Input
                        placeholder="Search by Item, SKU or Branch..."
                        className="pl-10 border-stone-200 focus:ring-stone-500/10 focus:border-stone-500 rounded-xl"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[180px] border-stone-200 rounded-xl font-medium text-stone-700">
                        <Filter className="h-4 w-4 mr-2 text-stone-400" />
                        <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-stone-200">
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="STAFF_MEAL">Staff Meal</SelectItem>
                        <SelectItem value="COMPLIMENTARY">Complimentary</SelectItem>
                        <SelectItem value="TEST">Test Cooking</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card className="border-stone-200/60 shadow-md shadow-stone-200/30 rounded-2xl overflow-hidden">
                <CardHeader className="bg-stone-50/50 border-b border-stone-100 pb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-[17px] font-bold text-stone-900 font-display">Usage Records</CardTitle>
                            <CardDescription className="text-stone-500 font-medium">
                                {filteredEntries.length} entries found across your branches
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center items-center py-24">
                            <Loader2 className="h-10 w-10 animate-spin text-stone-300" />
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="text-center py-24 text-stone-400">
                            <ClipboardList className="h-16 w-16 mx-auto mb-4 opacity-10" />
                            <p className="text-lg font-medium">No usage entries found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-stone-50/50 hover:bg-stone-50/50 border-b border-stone-100">
                                        <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-stone-500">Date</TableHead>
                                        <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-stone-500">Branch</TableHead>
                                        <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-stone-500">Item</TableHead>
                                        <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-stone-500">Type</TableHead>
                                        <TableHead className="py-4 px-6 text-right text-[11px] font-black uppercase tracking-wider text-stone-500">Quantity</TableHead>
                                        <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-stone-500">Shift</TableHead>
                                        <TableHead className="py-4 px-6 text-[11px] font-black uppercase tracking-wider text-stone-500">Notes</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredEntries.map((entry) => (
                                        <TableRow key={entry.id} className="hover:bg-stone-50/30 transition-colors border-b border-stone-100/50 last:border-0">
                                            <TableCell className="py-4 px-6 text-stone-600 font-bold text-[13px]">
                                                {format(new Date(entry.usage_date), 'MMM d, yyyy')}
                                            </TableCell>
                                            <TableCell className="py-4 px-6">
                                                <Badge variant="outline" className="bg-stone-100/50 text-stone-700 border-stone-200 font-bold px-2 py-0.5 rounded-md">
                                                    {entry.branch?.name || `Branch #${entry.branch_id}`}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-4 px-6">
                                                <p className="font-bold text-[14px] text-stone-900 antialiased">{entry.item_name}</p>
                                                <p className="text-[10px] text-stone-400 font-black font-mono tracking-tighter uppercase">{entry.item_sku}</p>
                                            </TableCell>
                                            <TableCell className="py-4 px-6">{getUsageBadge(entry.usage_type)}</TableCell>
                                            <TableCell className="py-4 px-6 text-right font-black text-stone-900 font-variant-numeric text-[15px]">
                                                {entry.quantity} <span className="text-[10px] text-stone-400 font-bold uppercase">{entry.unit_of_measure}</span>
                                            </TableCell>
                                            <TableCell className="py-4 px-6 capitalize text-stone-500 font-bold italic text-[12px] opacity-70">
                                                {entry.shift?.toLowerCase()}
                                            </TableCell>
                                            <TableCell className="py-4 px-6 max-w-[200px] truncate text-stone-500 text-[12px] font-medium italic">
                                                {entry.notes || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
