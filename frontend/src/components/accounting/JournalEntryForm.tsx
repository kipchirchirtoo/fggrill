import { useState, useEffect } from 'react';
import { Plus, Trash2, Calculator, Save, AlertCircle, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { accountingAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';

interface JournalLine {
    id: string;
    accountId: string;
    accountName: string;
    description: string;
    debit: number;
    credit: number;
}

export default function JournalEntryForm() {
    const { activeBranchId } = useBranch();
    const [isLoading, setIsLoading] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [lines, setLines] = useState<JournalLine[]>([
        { id: '1', accountId: '', accountName: '', description: '', debit: 0, credit: 0 },
        { id: '2', accountId: '', accountName: '', description: '', debit: 0, credit: 0 },
    ]);
    const [header, setHeader] = useState({
        date: new Date().toISOString().split('T')[0],
        reference: `JE-${Date.now().toString().slice(-6)}`,
        notes: ''
    });

    useEffect(() => {
        const fetchAccounts = async () => {
            const res = await accountingAPI.getChartOfAccounts({ branch_id: activeBranchId });
            if (res.success) {
                setAccounts(res.data || []);
            }
        };
        fetchAccounts();
    }, [activeBranchId]);

    const totalDebit = lines.reduce((acc, line) => acc + line.debit, 0);
    const totalCredit = lines.reduce((acc, line) => acc + line.credit, 0);
    const balanced = totalDebit === totalCredit && totalDebit > 0;

    const addLine = () => {
        setLines([...lines, { id: Math.random().toString(), accountId: '', accountName: '', description: '', debit: 0, credit: 0 }]);
    };

    const removeLine = (id: string) => {
        if (lines.length <= 2) return;
        setLines(lines.filter(l => l.id !== id));
    };

    const updateLine = (id: string, field: keyof JournalLine, value: any) => {
        setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
    };

    const handlePost = async () => {
        if (!balanced) {
            toast.error('Entry must be balanced (Total Debits = Total Credits)');
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                entry_date: header.date,
                reference_number: header.reference,
                description: header.notes,
                branch_id: activeBranchId,
                lines: lines.map(l => ({
                    account_id: l.accountId,
                    description: l.description,
                    debit: l.debit,
                    credit: l.credit
                }))
            };

            const res = await accountingAPI.createComprehensiveJournal(payload);
            if (res.success) {
                toast.success('Journal entry posted successfully');
                // Reset form
                setLines([
                    { id: '1', accountId: '', accountName: '', description: '', debit: 0, credit: 0 },
                    { id: '2', accountId: '', accountName: '', description: '', debit: 0, credit: 0 },
                ]);
                setHeader({
                    ...header,
                    reference: `JE-${Date.now().toString().slice(-6)}`,
                    notes: ''
                });
            } else {
                toast.error(res.message || 'Failed to post entry');
            }
        } catch (error) {
            toast.error('An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[18px] font-bold text-stone-900 flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5" />
                        New Journal Entry
                    </h2>
                    <p className="text-[12px] text-stone-500">Record a double-entry bookkeeping transaction</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn-secondary">Cancel</button>
                    <button
                        onClick={handlePost}
                        disabled={!balanced || isLoading}
                        className={`btn-primary flex items-center gap-2 ${balanced && !isLoading ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-400 cursor-not-allowed'}`}
                    >
                        {isLoading ? (
                            <Plus className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {isLoading ? 'Posting...' : 'Post Entry'}
                    </button>
                </div>
            </div>

            <div className="card-elevated p-8">
                {/* Header Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 pb-10 border-b border-stone-100">
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-500 uppercase">Entry Date</label>
                        <input
                            type="date"
                            value={header.date}
                            onChange={e => setHeader({ ...header, date: e.target.value })}
                            className="w-full p-2.5 bg-stone-50 border border-stone-100 rounded-lg text-[13px] outline-none focus:border-stone-900"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-500 uppercase">Reference #</label>
                        <input
                            type="text"
                            value={header.reference}
                            onChange={e => setHeader({ ...header, reference: e.target.value })}
                            className="w-full p-2.5 bg-stone-50 border border-stone-100 rounded-lg text-[13px] font-bold outline-none focus:border-stone-900"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-stone-500 uppercase">Description / Notes</label>
                        <input
                            type="text"
                            placeholder="Internal notes..."
                            value={header.notes}
                            onChange={e => setHeader({ ...header, notes: e.target.value })}
                            className="w-full p-2.5 bg-stone-50 border border-stone-100 rounded-lg text-[13px] outline-none"
                        />
                    </div>
                </div>

                {/* Lines Section */}
                <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-4 pb-4 border-b border-stone-100">
                        <div className="col-span-4 text-[11px] font-bold text-stone-400 uppercase">Account</div>
                        <div className="col-span-3 text-[11px] font-bold text-stone-400 uppercase">Description (Optional)</div>
                        <div className="col-span-2 text-[11px] font-bold text-stone-400 uppercase text-right">Debit</div>
                        <div className="col-span-2 text-[11px] font-bold text-stone-400 uppercase text-right">Credit</div>
                        <div className="col-span-1"></div>
                    </div>

                    <div className="space-y-3">
                        {lines.map((line) => (
                            <div key={line.id} className="grid grid-cols-12 gap-4 items-center group">
                                <div className="col-span-4">
                                    <select
                                        value={line.accountId}
                                        onChange={e => updateLine(line.id, 'accountId', e.target.value)}
                                        className="w-full p-2.5 bg-stone-50 border border-transparent rounded-lg text-[13px] font-medium outline-none hover:bg-white hover:border-stone-200 focus:bg-white focus:border-stone-900 transition-all"
                                    >
                                        <option value="">Select Account...</option>
                                        {accounts.map(account => (
                                            <option key={account.id} value={account.id}>
                                                {account.code} - {account.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-3">
                                    <input
                                        type="text"
                                        placeholder="Memo..."
                                        value={line.description}
                                        onChange={e => updateLine(line.id, 'description', e.target.value)}
                                        className="w-full p-2.5 bg-transparent border-b border-stone-50 text-[13px] outline-none group-hover:border-stone-200 focus:border-stone-900"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <input
                                        type="number"
                                        value={line.debit || ''}
                                        onChange={e => updateLine(line.id, 'debit', parseFloat(e.target.value) || 0)}
                                        className="w-full p-2.5 bg-stone-50 border border-transparent rounded-lg text-right text-[13px] font-bold focus:bg-white focus:border-stone-900"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <input
                                        type="number"
                                        value={line.credit || ''}
                                        onChange={e => updateLine(line.id, 'credit', parseFloat(e.target.value) || 0)}
                                        className="w-full p-2.5 bg-stone-50 border border-transparent rounded-lg text-right text-[13px] font-bold focus:bg-white focus:border-stone-900"
                                    />
                                </div>
                                <div className="col-span-1 text-right">
                                    <button onClick={() => removeLine(line.id)} className="p-2 text-stone-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={addLine}
                        className="flex items-center gap-2 py-3 px-4 border-2 border-dashed border-stone-100 rounded-xl text-[12px] font-bold text-stone-400 hover:text-stone-900 hover:border-stone-300 transition-all"
                    >
                        <Plus className="h-4 w-4" />
                        Add Row
                    </button>
                </div>

                {/* Totals Section */}
                <div className="mt-10 pt-10 border-t border-stone-100">
                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-7 flex items-center">
                            {!balanced && totalDebit > 0 && (
                                <div className="flex items-center gap-2 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="text-[11px] font-bold uppercase">UNBALANCED: Difference of KES {(totalDebit - totalCredit).toLocaleString()}</span>
                                </div>
                            )}
                            {balanced && (
                                <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="text-[11px] font-bold uppercase">Entry is Balanced</span>
                                </div>
                            )}
                        </div>
                        <div className="col-span-2 text-right">
                            <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Total Debit</p>
                            <p className="text-[16px] font-bold text-stone-900">KES {totalDebit.toLocaleString()}</p>
                        </div>
                        <div className="col-span-2 text-right">
                            <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Total Credit</p>
                            <p className="text-[16px] font-bold text-stone-900">KES {totalCredit.toLocaleString()}</p>
                        </div>
                        <div className="col-span-1"></div>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3">
                <Calculator className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                    <p className="text-[12px] text-blue-900 font-bold mb-1">Bookkeeping Rule</p>
                    <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                        Standard double-entry accounting requires that total debits must equal total credits. This ensures that the fundamental accounting equation (Assets = Liabilities + Equity) remains in balance.
                    </p>
                </div>
            </div>
        </div>
    );
}
