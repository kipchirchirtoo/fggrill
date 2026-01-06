import { useState, useEffect } from 'react';
import { History, Search, Filter, ArrowUpRight, ArrowDownLeft, Database, User, Terminal, Calendar, RefreshCw, CheckCircle2, XCircle, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { auditAPI } from '@/lib/api';

export default function AuditLogViewer() {
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<any[]>([]);

    const fetchLogs = async () => {
        setIsLoading(true);
        const res = await auditAPI.getAuditTrail();
        if (res.success) {
            setLogs(res.data || []);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log =>
        log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entity_id?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getImpactStyles = (impact: string) => {
        switch (impact) {
            case 'high': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'medium': return 'bg-amber-50 text-amber-700 border-amber-100';
            default: return 'bg-stone-50 text-stone-600 border-stone-100';
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'APPROVE': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
            case 'REJECT': return <XCircle className="h-4 w-4 text-rose-500" />;
            case 'CREATE': return <PlusCircle className="h-4 w-4 text-blue-500" />;
            default: return <Terminal className="h-4 w-4 text-stone-400" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-[18px] font-bold text-stone-900 flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Financial Audit Trail
                    </h2>
                    <p className="text-[12px] text-stone-500 font-medium tracking-tight">Immutable log of all financial modifications and approvals</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Filter by user or ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-stone-100 border border-stone-200 rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-stone-400 w-64"
                        />
                    </div>
                    <button onClick={fetchLogs} className="p-2 bg-stone-100 border border-stone-200 rounded-xl hover:bg-stone-200 transition-colors">
                        <RefreshCw className={`h-4 w-4 text-stone-600 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button className="p-2 bg-stone-100 border border-stone-200 rounded-xl hover:bg-stone-200 transition-colors">
                        <Filter className="h-4 w-4 text-stone-600" />
                    </button>
                </div>
            </div>

            <div className="card-elevated p-0 overflow-hidden font-mono">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-stone-50 border-b border-stone-100">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Timestamp</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Operator</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Entity</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Action</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Impact</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-stone-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-[12px] text-stone-600 font-medium">
                                            <Calendar className="h-3.5 w-3.5 text-stone-300" />
                                            {log.timestamp}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-[12px] text-stone-800 font-bold">
                                            <div className="h-6 w-6 rounded-full bg-stone-200 flex items-center justify-center shrink-0">
                                                <User className="h-3 w-3 text-stone-500" />
                                            </div>
                                            {log.user}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-[12px] font-bold text-stone-900 leading-none">{log.entityType}</p>
                                        <p className="text-[10px] text-stone-400 mt-1 uppercase tracking-tighter">ID: {log.entityId}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest ${log.action === 'APPROVE' ? 'bg-emerald-100 text-emerald-700' :
                                            log.action === 'REJECT' ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-700'
                                            }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${getImpactStyles(log.impact)}`}>
                                            {log.impact}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <p className="text-[12px] text-stone-600 max-w-xs truncate ml-auto">{log.description}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="flex items-center justify-center py-6">
                <button className="text-[12px] font-bold text-stone-400 hover:text-stone-900 flex items-center gap-2">
                    Load More Entries <ArrowDownLeft className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

