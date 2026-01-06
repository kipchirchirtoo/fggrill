import { useState, useEffect } from 'react';
import { Book, Plus, Search, MoreHorizontal, Settings, ShieldCheck, Tag, Box, RefreshCw } from 'lucide-react';
import { accountingAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';

export default function ChartOfAccounts() {
    const { activeBranchId } = useBranch();
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [accounts, setAccounts] = useState<any[]>([]);

    const fetchData = async () => {
        setIsLoading(true);
        const res = await accountingAPI.getChartOfAccounts({ branch_id: activeBranchId });
        if (res.success) {
            setAccounts(res.data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [activeBranchId]);

    const filteredAccounts = accounts.filter(acc =>
        acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.code.includes(searchTerm)
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[18px] font-bold text-stone-900 flex items-center gap-2">
                        <Book className="h-5 w-5" />
                        Chart of Accounts (CoA)
                    </h2>
                    <p className="text-[12px] text-stone-500">Manage your accounting codes and financial categories</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Search accounts..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-stone-100 border border-stone-200 rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-stone-950 w-64"
                        />
                    </div>
                    <button onClick={fetchData} className="btn-secondary">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button className="btn-primary bg-stone-900 text-white flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        New Account
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {['ASSETS', 'LIABILITIES', 'EQUITY', 'REVENUE', 'EXPENSES'].map((cat) => (
                    <div key={cat} className="card-elevated p-4 hover:shadow-md transition-all cursor-pointer">
                        <div className="flex items-center justify-between mb-3">
                            <Tag className="h-4 w-4 text-stone-300" />
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{cat}</span>
                        </div>
                        <p className="text-[18px] font-bold text-stone-900">{accounts.filter(a => (a.category_name || a.category) === cat).length}</p>
                        <p className="text-[10px] text-stone-500 font-medium">Account codes</p>
                    </div>
                ))}
            </div>

            <div className="card-elevated p-0 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-100">
                        <tr>
                            <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest w-24">Code</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Account Name</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Category</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Current Balance</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Status</th>
                            <th className="px-6 py-4 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                        {filteredAccounts.map((acc) => (
                            <tr key={acc.code} className="hover:bg-stone-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <span className="text-[12px] font-bold text-stone-900 bg-stone-100 px-2 py-1 rounded">
                                        {acc.code}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <p className="text-[14px] font-bold text-stone-900">{acc.name}</p>
                                    <p className="text-[10px] text-stone-400 font-medium">{acc.account_type || 'Standard Ledger'}</p>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${acc.category === 'ASSETS' ? 'bg-emerald-50 text-emerald-700' :
                                        acc.category === 'LIABILITIES' ? 'bg-rose-50 text-rose-700' :
                                            acc.category === 'REVENUE' ? 'bg-blue-50 text-blue-700' : 'bg-stone-100 text-stone-600'
                                        }`}>
                                        {acc.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <p className="text-[14px] font-bold text-stone-900">KES {Math.abs(acc.balance).toLocaleString()}</p>
                                    <p className="text-[10px] text-stone-400 font-medium uppercase">{acc.balance >= 0 ? 'DR' : 'CR'}</p>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex items-center justify-center gap-1.5 text-emerald-600">
                                        <ShieldCheck className="h-3.5 w-3.5" />
                                        <span className="text-[11px] font-bold">ACTIVE</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-stone-300 hover:text-stone-900 transition-colors">
                                        <MoreHorizontal className="h-5 w-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <Settings className="h-5 w-5 text-amber-600" />
                <p className="text-[12px] text-amber-900 font-medium">
                    System Admin Note: New accounts must follow the assigned code range for their category to ensure proper reporting consolidation.
                </p>
            </div>
        </div>
    );
}
