import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Scale, Plus, FileText } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { accountingAPI } from '@/lib/api';
import { toast } from 'sonner';

export const AccountingTab = () => {
    const [view, setView] = useState<'overview' | 'coa' | 'journals'>('overview');
    const [journalEntries, setJournalEntries] = useState<any[]>([]);
    const [chartOfAccounts, setChartOfAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (view === 'journals') {
            fetchJournalEntries();
        } else if (view === 'coa') {
            fetchChartOfAccounts();
        }
    }, [view]);

    const fetchJournalEntries = async () => {
        try {
            const response = await accountingAPI.getJournalEntries();
            if (response.success) {
                setJournalEntries(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching journal entries:', error);
            toast.error('Failed to load journal entries');
        }
    };

    const fetchChartOfAccounts = async () => {
        try {
            const response = await accountingAPI.getChartOfAccounts();
            if (response.success) {
                setChartOfAccounts(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching chart of accounts:', error);
            // Use fallback data
            setChartOfAccounts([
                { account_code: '1000', account_name: 'Cash and Cash Equivalents', account_type: 'asset' },
                { account_code: '2000', account_name: 'Accounts Payable', account_type: 'liability' },
                { account_code: '4000', account_name: 'Room Revenue', account_type: 'revenue' },
                { account_code: '5000', account_name: 'Cost of Goods Sold', account_type: 'expense' },
            ]);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex gap-2">
                <Button
                    variant={view === 'overview' ? 'default' : 'outline'}
                    onClick={() => setView('overview')}
                    className={view === 'overview' ? 'bg-stone-900 text-white' : ''}
                >
                    Overview
                </Button>
                <Button
                    variant={view === 'coa' ? 'default' : 'outline'}
                    onClick={() => setView('coa')}
                    className={view === 'coa' ? 'bg-stone-900 text-white' : ''}
                >
                    Chart of Accounts
                </Button>
                <Button
                    variant={view === 'journals' ? 'default' : 'outline'}
                    onClick={() => setView('journals'}
                    className={view === 'journals' ? 'bg-stone-900 text-white' : ''}
                >
                    Journal Entries
                </Button>
            </div>

            {view === 'overview' && (
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Accounting Tools</CardTitle>
                            <CardDescription>Manage journals, ledgers, and accounts</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="bg-stone-50 border-none cursor-pointer hover:bg-stone-100 transition-colors" onClick={() => setView('journals')}>
                                <CardContent className="p-6 flex flex-col items-center text-center">
                                    <BookOpen className="h-8 w-8 text-stone-400 mb-3" />
                                    <h3 className="font-bold text-stone-900">Journal Entries</h3>
                                    <p className="text-sm text-stone-500 mt-1 mb-4">Record manual journal entries</p>
                                    <Button variant="outline" className="w-full bg-white">View Journals</Button>
                                </CardContent>
                            </Card>
                            <Card className="bg-stone-50 border-none cursor-pointer hover:bg-stone-100 transition-colors" onClick={() => setView('coa')}>
                                <CardContent className="p-6 flex flex-col items-center text-center">
                                    <Scale className="h-8 w-8 text-stone-400 mb-3" />
                                    <h3 className="font-bold text-stone-900">Chart of Accounts</h3>
                                    <p className="text-sm text-stone-500 mt-1 mb-4">Manage general ledger accounts</p>
                                    <Button variant="outline" className="w-full bg-white">View Accounts</Button>
                                </CardContent>
                            </Card>
                        </div>
                    </CardContent>
                </Card>
            )}

            {view === 'coa' && (
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Chart of Accounts</CardTitle>
                            <CardDescription>General Ledger Accounts</CardDescription>
                        </div>
                        <IOSButton size="sm" className="bg-stone-900 text-white" leftIcon={<Plus />}>New Account</IOSButton>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {chartOfAccounts.length > 0 ? (
                                chartOfAccounts.map((account: any) => (
                                    <div key={account.account_code} className="p-3 border rounded-lg bg-stone-50 flex justify-between items-center">
                                        <div>
                                            <h4 className="font-bold text-sm text-stone-900">{account.account_code} - {account.account_name}</h4>
                                            <p className="text-xs text-stone-500 capitalize">{account.account_type}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-stone-500">
                                    <p>Loading chart of accounts...</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {view === 'journals' && (
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Journal Entries</CardTitle>
                            <CardDescription>Manual General Journal Entries</CardDescription>
                        </div>
                        <IOSButton size="sm" className="bg-stone-900 text-white" leftIcon={<Plus />}>New Journal Entry</IOSButton>
                    </CardHeader>
                    <CardContent>
                        {journalEntries.length > 0 ? (
                            <div className="space-y-2">
                                {journalEntries.map((entry: any) => (
                                    <div key={entry.id} className="p-4 border rounded-lg hover:bg-stone-50 transition-colors">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-sm text-stone-900">{entry.reference}</p>
                                                <p className="text-xs text-stone-500 mt-1">{entry.description}</p>
                                                <p className="text-xs text-stone-400 mt-1">{entry.date}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-stone-900">KES {entry.amount?.toLocaleString() || 0}</p>
                                                <p className="text-xs text-stone-500 mt-1">{entry.status || 'Draft'}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-stone-500">
                                <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                <p>No journal entries found for this period.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
