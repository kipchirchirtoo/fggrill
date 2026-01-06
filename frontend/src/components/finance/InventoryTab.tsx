import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Plus, Box } from 'lucide-react';

interface InventoryTabProps {
    stockTakes: any[];
    branchStock?: any[];
    onNew: () => void;
}

export const InventoryTab = ({ stockTakes, branchStock = [], onNew }: InventoryTabProps) => {
    const totalValue = branchStock.reduce((acc, item) => acc + (item.quantity * (item.unit_cost || item.cost_price || 0)), 0);
    const lowStockCount = branchStock.filter(item => item.quantity <= (item.min_stock || 0)).length;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-none shadow-sm bg-stone-900 text-white">
                    <CardContent className="p-5">
                        <p className="text-stone-400 text-sm font-medium">Total Stock Value</p>
                        <p className="text-2xl font-bold mt-1">KES {totalValue.toLocaleString()}</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardContent className="p-5">
                        <p className="text-stone-500 text-sm font-medium">Items in Stock</p>
                        <p className="text-2xl font-bold mt-1 text-stone-900">{branchStock.length}</p>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm">
                    <CardContent className="p-5">
                        <p className="text-stone-500 text-sm font-medium">Low Stock Alerts</p>
                        <p className={`text-2xl font-bold mt-1 ${lowStockCount > 0 ? 'text-rose-600' : 'text-stone-900'}`}>{lowStockCount}</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold">Branch Stock Taking</CardTitle>
                        <CardDescription>Record and verify physical stock levels</CardDescription>
                    </div>
                    <IOSButton size="sm" className="bg-stone-900 text-white" leftIcon={<Plus />} onClick={onNew}>New Stock Take</IOSButton>
                </CardHeader>
                <CardContent>
                    {stockTakes.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Type</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Notes</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {stockTakes.map((take) => (
                                        <tr key={take.id} className="hover:bg-stone-50 transition-colors">
                                            <td className="px-4 py-4 text-sm text-stone-900">{new Date(take.created_at).toLocaleDateString()}</td>
                                            <td className="px-4 py-4 text-sm text-stone-900 capitalize">{take.take_type?.toLowerCase()}</td>
                                            <td className="px-4 py-4">
                                                <IOSBadge className={take.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                                                    {take.status}
                                                </IOSBadge>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-stone-500 truncate max-w-xs">{take.notes || '-'}</td>
                                            <td className="px-4 py-4 text-right">
                                                <Button variant="ghost" size="sm" onClick={() => { }}>
                                                    {take.status === 'OPEN' ? 'Continue' : 'View'}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-stone-500">
                            <Box className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>No active stock take sessions found.</p>
                            <p className="text-xs mt-1">Start a new session to record physical counts.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
