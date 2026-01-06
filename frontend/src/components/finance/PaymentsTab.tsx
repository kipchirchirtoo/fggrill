import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IOSButton } from '@/components/ui/ios-button';
import { Scan, Banknote, Clock, ArrowUpRight, CheckCircle2, AlertCircle } from 'lucide-react';

export const PaymentsTab = () => {
    const [view, setView] = useState<'verification' | 'deposits' | 'reconciliation'>('verification');

    return (
        <div className="space-y-6">
            {/* Sub-navigation */}
            <div className="flex gap-2">
                <Button
                    variant={view === 'verification' ? 'default' : 'outline'}
                    onClick={() => setView('verification')}
                    className={view === 'verification' ? 'bg-stone-900 text-white' : ''}
                >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Verification Queue
                </Button>
                <Button
                    variant={view === 'deposits' ? 'default' : 'outline'}
                    onClick={() => setView('deposits')}
                    className={view === 'deposits' ? 'bg-stone-900 text-white' : ''}
                >
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Bank Deposits
                </Button>
                <Button
                    variant={view === 'reconciliation' ? 'default' : 'outline'}
                    onClick={() => setView('reconciliation')}
                    className={view === 'reconciliation' ? 'bg-stone-900 text-white' : ''}
                >
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Reconciliation
                </Button>
            </div>

            {view === 'verification' && (
                <>
                    <Card className="border-none shadow-sm">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-bold">Payment Verification Queue</CardTitle>
                                <CardDescription>Confirm M-Pesa and Banking payments pushed by cashiers</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="divide-y divide-stone-100">
                                {[
                                    { id: '1', type: 'mpesa', amount: 5400, ref: 'RCK1234567', cashier: 'Main Cashier', time: '10 mins ago' },
                                    { id: '2', type: 'bank', amount: 12500, ref: 'BANK-TRANSFER-990', cashier: 'Resto Cashier', time: '25 mins ago' },
                                ].map((pmt) => (
                                    <div key={pmt.id} className="py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-full ${pmt.type === 'mpesa' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                                {pmt.type === 'mpesa' ? <Scan className="h-5 w-5" /> : <Banknote className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-stone-900">{pmt.type.toUpperCase()} Payment - KES {pmt.amount.toLocaleString()}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs text-stone-500 font-mono">{pmt.ref}</span>
                                                    <span className="text-[10px] text-stone-300">•</span>
                                                    <span className="text-xs text-stone-500">{pmt.cashier}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-stone-400 flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> {pmt.time}
                                            </span>
                                            <IOSButton size="sm" className="bg-stone-900 text-white">Confirm</IOSButton>
                                            <Button variant="ghost" size="sm" className="text-rose-600">Reject</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-none shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold">M-Pesa Till Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                                        <span className="text-xs text-stone-500">Till #889900</span>
                                        <span className="font-bold text-stone-900">KES 45,600</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                                        <span className="text-xs text-stone-500">Till #112233</span>
                                        <span className="font-bold text-stone-900">KES 12,400</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold">Banking Summary</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                                        <span className="text-xs text-stone-500">KCB Bank</span>
                                        <span className="font-bold text-stone-900">KES 89,000</span>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                                        <span className="text-xs text-stone-500">Equity Bank</span>
                                        <span className="font-bold text-stone-900">KES 34,200</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

            {view === 'deposits' && (
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Bank Deposits</CardTitle>
                            <CardDescription>Record cash deposits to bank accounts</CardDescription>
                        </div>
                        <IOSButton size="sm" className="bg-stone-900 text-white" leftIcon={<ArrowUpRight />}>Record Deposit</IOSButton>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-12 text-stone-500">
                            <Banknote className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>No recent deposits found.</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {view === 'reconciliation' && (
                <Card className="border-none shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Reconciliation</CardTitle>
                        <CardDescription>Match system records with bank statements</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center py-12 text-stone-500">
                            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>All accounts are reconciled.</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
