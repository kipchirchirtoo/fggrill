'use client';

import { useState } from 'react';
import { Search, FileText, User, ShoppingCart, Hotel, CreditCard, Receipt, DollarSign, Package, Calendar, MapPin, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { searchAPI } from '@/lib/api';

interface SearchResult {
    type: 'staff' | 'order' | 'guest' | 'transaction' | 'receipt' | 'booking' | 'payment' | 'bill';
    id: string;
    title: string;
    subtitle: string;
    metadata: Record<string, any>;
}

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
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-[20px] font-bold text-stone-900">Universal Search</h1>
                <p className="text-[12px] text-stone-500">Search across all system entities - staff, orders, guests, transactions, and more</p>
            </div>

            {/* Search Bar */}
            <div className="card-elevated p-6">
                <div className="flex gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-stone-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Search by reference number, staff name, M-Pesa code, order ID, guest name..."
                            className="w-full pl-12 pr-4 py-3 border border-stone-200 rounded-xl text-[14px] focus:ring-2 focus:ring-stone-900 focus:border-stone-900 outline-none"
                        />
                    </div>
                    <button
                        onClick={handleSearch}
                        disabled={isSearching}
                        className="btn-primary px-8 py-3 bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50"
                    >
                        {isSearching ? 'Searching...' : 'Search'}
                    </button>
                </div>

                {/* Search Tips */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-[11px] text-blue-700 font-medium">
                        <strong>Search Tips:</strong> You can search by reference numbers, staff names, M-Pesa transaction codes, order IDs, guest names, receipt numbers, booking IDs, and more.
                    </p>
                </div>
            </div>

            {/* Results */}
            {results.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Results List */}
                    <div className="lg:col-span-1 space-y-3">
                        <h3 className="text-[14px] font-bold text-stone-900">Results ({results.length})</h3>
                        <div className="space-y-2">
                            {results.map((result) => (
                                <button
                                    key={result.id}
                                    onClick={() => setSelectedResult(result)}
                                    className={`w-full text-left p-4 rounded-xl border transition-all ${selectedResult?.id === result.id
                                        ? 'border-stone-900 bg-stone-50'
                                        : 'border-stone-200 hover:border-stone-300 bg-white'
                                        }`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${getTypeColor(result.type)}`}>
                                            {getIcon(result.type)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-bold text-stone-900 truncate">{result.title}</p>
                                            <p className="text-[11px] text-stone-500 truncate">{result.subtitle}</p>
                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getTypeColor(result.type)}`}>
                                                {result.type}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Details Panel */}
                    <div className="lg:col-span-2">
                        {selectedResult ? (
                            <div className="card-elevated p-6 space-y-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${getTypeColor(selectedResult.type)}`}>
                                            {getIcon(selectedResult.type)}
                                        </div>
                                        <div>
                                            <h3 className="text-[16px] font-bold text-stone-900">{selectedResult.title}</h3>
                                            <p className="text-[12px] text-stone-500">{selectedResult.subtitle}</p>
                                        </div>
                                    </div>
                                    <button className="btn-secondary flex items-center gap-2">
                                        <ExternalLink className="h-4 w-4" />
                                        <span>Open Full Page</span>
                                    </button>
                                </div>

                                {/* Metadata Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    {Object.entries(selectedResult.metadata).map(([key, value]) => (
                                        <div key={key} className="p-3 bg-stone-50 rounded-lg">
                                            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                                                {key.replace(/_/g, ' ')}
                                            </p>
                                            <p className="text-[13px] font-bold text-stone-900">{value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Audit Trail Section */}
                                <div className="border-t border-stone-200 pt-6">
                                    <h4 className="text-[14px] font-bold text-stone-900 mb-4">Audit Trail</h4>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg">
                                            <Clock className="h-4 w-4 text-stone-400 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-[12px] font-bold text-stone-900">Created</p>
                                                <p className="text-[11px] text-stone-500">2024-01-15 10:30 AM • By Admin User</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg">
                                            <MapPin className="h-4 w-4 text-stone-400 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-[12px] font-bold text-stone-900">Branch</p>
                                                <p className="text-[11px] text-stone-500">Main Branch (ID: 2)</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="card-elevated p-12 text-center">
                                <FileText className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                                <p className="text-[13px] text-stone-500">Select a result to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isSearching && results.length === 0 && query === '' && (
                <div className="card-elevated p-12 text-center">
                    <Search className="h-16 w-16 text-stone-300 mx-auto mb-4" />
                    <h3 className="text-[16px] font-bold text-stone-900 mb-2">Start Searching</h3>
                    <p className="text-[13px] text-stone-500 max-w-md mx-auto">
                        Enter any reference number, name, or identifier to search across all system entities
                    </p>
                </div>
            )}
        </div>
    );
}
