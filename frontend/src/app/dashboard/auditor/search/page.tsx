'use client';

import { Search, FileText, User, ShoppingCart, Hotel, CreditCard, Receipt, DollarSign, Package, Calendar, MapPin, Clock, ExternalLink, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { searchAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';

interface SearchResult {
    type: 'staff' | 'order' | 'guest' | 'transaction' | 'receipt' | 'booking' | 'payment' | 'bill';
    id: string;
    title: string;
    subtitle: string;
    metadata: Record<string, any>;
}

import { useState } from 'react';

export default function UniversalSearchPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);

    const handleSearch = async () => {
        if (!query.trim()) {
            toast.error('Please enter a search term');
            return;
        }

        if (query.trim().length < 2) {
            toast.error('Search query must be at least 2 characters');
            return;
        }

        setIsSearching(true);
        setResults([]);
        setSelectedResult(null);

        try {
            const response = await searchAPI.universalSearch(query.trim());

            if (response.success && response.data) {
                setResults(response.data);
                if (response.data.length === 0) {
                    toast.info('No results found');
                }
            } else {
                toast.error('Search failed');
            }
        } catch (error: any) {
            console.error('Search error:', error);
            toast.error(error.message || 'Search failed');
        } finally {
            setIsSearching(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'staff': return <User className="h-5 w-5" />;
            case 'order': return <ShoppingCart className="h-5 w-5" />;
            case 'guest': return <Hotel className="h-5 w-5" />;
            case 'transaction': return <CreditCard className="h-5 w-5" />;
            case 'receipt': return <Receipt className="h-5 w-5" />;
            case 'booking': return <Calendar className="h-5 w-5" />;
            case 'payment': return <DollarSign className="h-5 w-5" />;
            case 'bill': return <FileText className="h-5 w-5" />;
            default: return <Package className="h-5 w-5" />;
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'staff': return 'bg-blue-100 text-blue-700';
            case 'order': return 'bg-purple-100 text-purple-700';
            case 'guest': return 'bg-green-100 text-green-700';
            case 'transaction': return 'bg-amber-100 text-amber-700';
            case 'receipt': return 'bg-rose-100 text-rose-700';
            case 'booking': return 'bg-indigo-100 text-indigo-700';
            case 'payment': return 'bg-emerald-100 text-emerald-700';
            case 'bill': return 'bg-orange-100 text-orange-700';
            default: return 'bg-stone-100 text-stone-700';
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-8 pb-12">
                    {/* Header */}
                    <div className="page-header flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-lg">
                                <Shield className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="page-title text-stone-900">Universal Search</h1>
                                <p className="page-subtitle">Cross-entity system intelligence and audit retrieval</p>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="card-elevated p-6 bg-white border border-stone-100 shadow-sm">
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                    placeholder="Search by reference, staff name, M-Pesa code, order ID..."
                                    className="w-full pl-12 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-[14px] font-medium text-stone-900 focus:ring-2 focus:ring-stone-900 focus:bg-white outline-none transition-all"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                disabled={isSearching}
                                className="btn-primary px-8 h-12 flex items-center justify-center gap-2 shadow-lg shadow-stone-900/10 min-w-[140px]"
                            >
                                {isSearching ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Searching...</span>
                                    </>
                                ) : (
                                    <>
                                        <Search className="h-4 w-4" />
                                        <span>Run Search</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Search Tips */}
                        <div className="mt-4 p-3 bg-stone-50 border border-stone-100 rounded-lg">
                            <p className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
                                <strong className="text-stone-900 mr-2">Search Domains:</strong>
                                Operations, Finance, Human Resources, Guest Relations, Inventory
                            </p>
                        </div>
                    </div>

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Results List */}
                            <div className="lg:col-span-1 space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="text-[13px] font-black text-stone-400 uppercase tracking-[0.2em]">Match Summary ({results.length})</h3>
                                </div>
                                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                                    {results.map((result) => (
                                        <button
                                            key={result.id}
                                            onClick={() => setSelectedResult(result)}
                                            className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 shadow-sm ${selectedResult?.id === result.id
                                                ? 'border-stone-900 bg-stone-900 text-white shadow-stone-900/20'
                                                : 'border-stone-100 hover:border-stone-300 bg-white text-stone-900'
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${selectedResult?.id === result.id ? 'bg-white/10' : getTypeColor(result.type)}`}>
                                                    {getIcon(result.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[14px] font-bold truncate ${selectedResult?.id === result.id ? 'text-white' : 'text-stone-900'}`}>{result.title}</p>
                                                    <p className={`text-[11px] truncate opacity-60 ${selectedResult?.id === result.id ? 'text-white' : 'text-stone-500'}`}>{result.subtitle}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${selectedResult?.id === result.id ? 'bg-white/20 text-white' : 'bg-stone-50 text-stone-400'}`}>
                                                            {result.type}
                                                        </span>
                                                        <span className="text-[10px] font-mono opacity-40">#{result.id.slice(0, 8)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Details Panel */}
                            <div className="lg:col-span-2">
                                {selectedResult ? (
                                    <div className="card-elevated p-8 space-y-8 bg-white border border-stone-100 shadow-xl shadow-stone-900/5">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner ${getTypeColor(selectedResult.type)}`}>
                                                    {React.cloneElement(getIcon(selectedResult.type) as React.ReactElement, { className: "h-6 w-6" })}
                                                </div>
                                                <div>
                                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400 mb-1 block">{selectedResult.type} PROFILE</span>
                                                    <h3 className="text-2xl font-black text-stone-900 tracking-tight">{selectedResult.title}</h3>
                                                    <p className="text-[14px] text-stone-500 font-medium">{selectedResult.subtitle}</p>
                                                </div>
                                            </div>
                                            <button className="btn-secondary h-11 px-4 text-[11px] font-black uppercase tracking-widest flex items-center gap-2 border-2 hover:bg-stone-50">
                                                <ExternalLink className="h-4 w-4" />
                                                Full Inspection
                                            </button>
                                        </div>

                                        {/* Metadata Grid */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {Object.entries(selectedResult.metadata).map(([key, value]) => (
                                                <div key={key} className="p-4 bg-stone-50 rounded-2xl border border-stone-100/50 group hover:border-stone-900/10 transition-colors">
                                                    <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1.5 opacity-60">
                                                        {key.replace(/_/g, ' ')}
                                                    </p>
                                                    <p className="text-[15px] font-bold text-stone-900">{String(value)}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Audit Trail Section */}
                                        <div className="pt-8 border-t border-stone-100">
                                            <h4 className="text-[12px] font-black text-stone-400 uppercase tracking-[0.2em] mb-6">Security Context</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="flex items-center gap-4 p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/50">
                                                    <div className="p-2 bg-white rounded-xl text-emerald-600 shadow-sm border border-emerald-50">
                                                        <Clock className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-bold text-stone-900">Ingested Date</p>
                                                        <p className="text-[11px] text-emerald-700 font-medium">Record persistent in system</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 p-4 bg-blue-50/30 rounded-2xl border border-blue-100/50">
                                                    <div className="p-2 bg-white rounded-xl text-blue-600 shadow-sm border border-blue-50">
                                                        <MapPin className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-bold text-stone-900">Entity Location</p>
                                                        <p className="text-[11px] text-blue-700 font-medium">Main Operational Node</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="card-elevated p-20 text-center bg-stone-50 border-dashed border-2 border-stone-200 opacity-60">
                                        <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-stone-200 mx-auto mb-4 shadow-sm">
                                            <FileText className="h-8 w-8" />
                                        </div>
                                        <h4 className="text-[16px] font-bold text-stone-400">Inspector Panel</h4>
                                        <p className="text-[13px] text-stone-400 max-w-xs mx-auto mt-2">Select a result from the search queue to perform a deep-dive security inspection</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!isSearching && results.length === 0 && query === '' && (
                        <div className="py-20 flex flex-col items-center justify-center text-center">
                            <div className="w-24 h-24 bg-stone-50 rounded-[40px] flex items-center justify-center text-stone-200 mb-6 border border-stone-100">
                                <Search className="h-10 w-10" />
                            </div>
                            <h3 className="text-xl font-black text-stone-900 mb-2">Centralized Intelligence</h3>
                            <p className="text-[14px] text-stone-500 max-w-md mx-auto font-medium">
                                Perform a global cross-reference search across all operational nodes and financial records.
                            </p>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
