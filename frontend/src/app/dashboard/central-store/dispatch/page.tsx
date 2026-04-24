'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { Truck, RefreshCw, Printer, User, Navigation, Package, CheckCircle2, ChevronRight, MapPin, Calendar, ArrowRight, Clipboard, Download, Filter, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { printDispatchPDF, exportDeliveredReportPDF } from '@/lib/dispatch-pdf';

interface DispatchItem { id: string; item_sku: string; item_name: string; quantity: number; unit: string; }
interface Vehicle { id: string; registration_number: string; model: string; }
interface Driver { id: string; name: string; license_number: string; }
interface DispatchNote {
    id: string;
    dispatch_number: string;
    status: string;
    to_branch_name: string;
    to_branch?: { name: string };
    created_at: string;
    confirmed_at?: string;
    delivered_at?: string;
    dispatched_at?: string;
    items: DispatchItem[];
    vehicle_registration?: string;
    vehicle_number?: string;
    driver_name?: string;
}

export default function DispatchPage() {
    const [dispatches, setDispatches] = useState<DispatchNote[]>([]);
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusTab, setStatusTab] = useState<'READY' | 'IN_TRANSIT' | 'DELIVERED'>('READY');
    const [selectedDispatch, setSelectedDispatch] = useState<DispatchNote | null>(null);
    const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
    const [dispatchFormData, setDispatchFormData] = useState({ vehicle_id: '', driver_id: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPrinting, setIsPrinting] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // DELIVERED tab filters
    const [filterDate, setFilterDate] = useState('');
    const [filterBranch, setFilterBranch] = useState('');

    // Map our UI tab to actual DB status (DELIVERED tab shows CONFIRMED + DELIVERED + DISPUTED)
    const getApiStatus = (tab: string) => {
        if (tab === 'DELIVERED') return 'CONFIRMED';
        return tab;
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const apiStatus = getApiStatus(statusTab);
            const [readyRes, vehiclesRes, driversRes] = await Promise.all([
                storeAPI.getDispatchHistory(apiStatus),
                storeAPI.getVehicles(),
                storeAPI.getDrivers()
            ]);

            if (readyRes.success) {
                let data = readyRes.data || [];
                // For DELIVERED tab, also include DELIVERED and DISPUTED statuses
                if (statusTab === 'DELIVERED') {
                    const [deliveredRes, disputedRes] = await Promise.all([
                        storeAPI.getDispatchHistory('DELIVERED'),
                        storeAPI.getDispatchHistory('DISPUTED'),
                    ]);
                    if (deliveredRes.success) data = [...data, ...(deliveredRes.data || [])];
                    if (disputedRes.success) data = [...data, ...(disputedRes.data || [])];
                    // De-duplicate by id
                    const seen = new Set<string>();
                    data = data.filter((d: DispatchNote) => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });
                }
                setDispatches(data);
            }
            if (vehiclesRes.success) setVehicles(vehiclesRes.data || []);
            if (driversRes.success) setDrivers(driversRes.data || []);
        } catch (error) { console.error('Error:', error); }
        finally { setIsLoading(false); }
    }, [statusTab]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Client-side filtering for DELIVERED tab
    const filteredDispatches = useMemo(() => {
        if (statusTab !== 'DELIVERED') return dispatches;
        let result = [...dispatches];

        if (filterDate) {
            result = result.filter(d => {
                const date = d.confirmed_at || d.delivered_at || d.dispatched_at || d.created_at;
                return date?.startsWith(filterDate);
            });
        }

        if (filterBranch) {
            const term = filterBranch.toLowerCase();
            result = result.filter(d => {
                const name = (d.to_branch_name || d.to_branch?.name || '').toLowerCase();
                return name.includes(term);
            });
        }

        return result;
    }, [dispatches, statusTab, filterDate, filterBranch]);

    // Unique branch names for datalist
    const branchNames = useMemo(() => {
        return [...new Set(dispatches.map(d => d.to_branch_name || d.to_branch?.name || '').filter(Boolean))];
    }, [dispatches]);

    const handleOpenDispatch = (dispatch: DispatchNote) => {
        setSelectedDispatch(dispatch);
        setDispatchFormData({ vehicle_id: '', driver_id: '' });
        setDispatchModalOpen(true);
    };

    const handleConfirmDispatch = async () => {
        if (!selectedDispatch || !dispatchFormData.vehicle_id || !dispatchFormData.driver_id) {
            toast.error('Select vehicle and driver');
            return;
        }
        setIsSubmitting(true);
        try {
            const response = await storeAPI.dispatchItems(selectedDispatch.id, dispatchFormData);
            if (response.success) {
                toast.success('Dispatched successfully');
                setDispatchModalOpen(false);
                setStatusTab('IN_TRANSIT');
                fetchData();
            } else {
                toast.error(response.message || 'Failed to dispatch');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const printDeliveryNote = async (dispatch: DispatchNote) => {
        setIsPrinting(dispatch.id);
        try {
            await printDispatchPDF(dispatch as any);
            toast.success('Professional PDF generated successfully');
        } catch (error: any) {
            toast.error(error.message || 'Error occurred during PDF generation');
        } finally {
            setIsPrinting(null);
        }
    };

    const handleExportDeliveredReport = async () => {
        if (filteredDispatches.length === 0) {
            toast.error('No dispatches to export');
            return;
        }
        setIsExporting(true);
        try {
            await exportDeliveredReportPDF(filteredDispatches, {
                from_date: filterDate || undefined,
                branch_name: filterBranch || undefined,
            });
            toast.success('Delivered dispatches report downloaded');
        } catch (error: any) {
            toast.error('Failed to generate report');
            console.error(error);
        } finally {
            setIsExporting(false);
        }
    };

    const getStatusBadgeClass = (status: string) => {
        if (status === 'CONFIRMED') return 'bg-emerald-100 text-emerald-700';
        if (status === 'DISPUTED') return 'bg-red-100 text-red-600';
        if (status === 'IN_TRANSIT') return 'bg-stone-900 text-white';
        return 'bg-stone-200 text-stone-600';
    };

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.CENTRAL_STOREKEEPER,
            UserRole.SUPER_ADMIN,
            UserRole.GENERAL_MANAGER,
            UserRole.CENTRAL_OPERATIONS_MANAGER,
            UserRole.AUDITOR
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Dispatch & Logistics</h1>
                            <p className="text-stone-500 mt-0.5">Manage branch deliveries and fleet transport tracking</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchData}
                                disabled={isLoading}
                                className="btn-secondary"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <div className="flex p-1 bg-stone-100 rounded-lg">
                                {(['READY', 'IN_TRANSIT', 'DELIVERED'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setStatusTab(tab)}
                                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wider transition-all ${statusTab === tab
                                            ? 'bg-white text-stone-900 shadow-sm'
                                            : 'text-stone-400 hover:text-stone-600'
                                            }`}
                                    >
                                        {tab.replace('_', ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* DELIVERED tab filters */}
                    {statusTab === 'DELIVERED' && (
                        <div className="flex flex-col sm:flex-row gap-3 p-4 bg-white border border-stone-100 rounded-xl shadow-sm">
                            <div className="flex items-center gap-2 flex-1">
                                <Calendar className="h-4 w-4 text-stone-300 shrink-0" />
                                <input
                                    type="date"
                                    value={filterDate}
                                    onChange={e => setFilterDate(e.target.value)}
                                    className="w-full text-sm border-0 focus:outline-none text-stone-700 bg-transparent"
                                    placeholder="Filter by date"
                                />
                                {filterDate && (
                                    <button onClick={() => setFilterDate('')} className="text-stone-300 hover:text-stone-500 text-xs font-bold">✕</button>
                                )}
                            </div>
                            <div className="h-px sm:h-auto sm:w-px bg-stone-100" />
                            <div className="flex items-center gap-2 flex-1">
                                <Search className="h-4 w-4 text-stone-300 shrink-0" />
                                <input
                                    type="text"
                                    list="branches-list"
                                    value={filterBranch}
                                    onChange={e => setFilterBranch(e.target.value)}
                                    placeholder="Filter by branch..."
                                    className="w-full text-sm border-0 focus:outline-none text-stone-700 bg-transparent"
                                />
                                <datalist id="branches-list">
                                    {branchNames.map(b => <option key={b} value={b} />)}
                                </datalist>
                                {filterBranch && (
                                    <button onClick={() => setFilterBranch('')} className="text-stone-300 hover:text-stone-500 text-xs font-bold">✕</button>
                                )}
                            </div>
                            <div className="h-px sm:h-auto sm:w-px bg-stone-100" />
                            <button
                                onClick={handleExportDeliveredReport}
                                disabled={isExporting || filteredDispatches.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white text-[12px] font-bold rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                            >
                                {isExporting ? (
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Download className="h-3.5 w-3.5" />
                                )}
                                {isExporting ? 'Exporting...' : `Export PDF (${filteredDispatches.length})`}
                            </button>
                        </div>
                    )}

                    {/* Content */}
                    {isLoading ? (
                        <div className="py-20 text-center text-stone-300">Synchronizing fleet logs...</div>
                    ) : filteredDispatches.length === 0 ? (
                        <div className="bg-white border border-stone-100 p-24 text-center flex flex-col items-center rounded-lg">
                            <Truck className="h-12 w-12 text-stone-100 mb-4" />
                            <h3 className="text-lg font-medium text-stone-400">Queue Clear</h3>
                            <p className="text-stone-300 text-sm">
                                {statusTab === 'DELIVERED'
                                    ? 'No delivered shipments found for the selected filters.'
                                    : `No shipments currently in ${statusTab.toLowerCase()} status.`}
                            </p>
                            {statusTab === 'DELIVERED' && (filterDate || filterBranch) && (
                                <button
                                    onClick={() => { setFilterDate(''); setFilterBranch(''); }}
                                    className="mt-4 text-xs text-stone-400 underline"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredDispatches.map((dispatch) => (
                                <div key={dispatch.id} className="bg-white border border-stone-100 rounded-lg shadow-sm overflow-hidden flex flex-col lg:flex-row transition-all hover:border-stone-200">
                                    <div className="p-6 lg:w-72 bg-stone-50/50 lg:border-r border-stone-100">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">DN Ref: {dispatch.dispatch_number}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${getStatusBadgeClass(dispatch.status)}`}>
                                                {dispatch.status === 'CONFIRMED' ? 'DELIVERED' : dispatch.status}
                                            </span>
                                        </div>
                                        <h3 className="text-xl font-bold text-stone-900 uppercase tracking-tight">{dispatch.to_branch_name || dispatch.to_branch?.name}</h3>
                                        <div className="mt-4 space-y-2.5">
                                            <div className="flex items-center gap-3 text-stone-500 text-[13px]">
                                                <Calendar className="h-4 w-4 text-stone-300" />
                                                <span>{new Date(dispatch.confirmed_at || dispatch.created_at).toLocaleDateString()}</span>
                                            </div>
                                            {(dispatch.vehicle_registration || dispatch.vehicle_number) && (
                                                <div className="flex items-center gap-3 text-stone-500 text-[13px]">
                                                    <Truck className="h-4 w-4 text-stone-300" />
                                                    <span className="font-medium text-stone-700">{dispatch.vehicle_registration || dispatch.vehicle_number}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-6 flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4">Shipment Contents</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {(dispatch.items || []).slice(0, 6).map((item, index) => (
                                                <div key={item.item_sku ?? `item-${index}`} className="flex items-center justify-between p-2.5 rounded-md border border-stone-100 bg-stone-50/30">
                                                    <span className="text-[12px] font-medium text-stone-800 truncate pr-2">{item.item_name}</span>
                                                    <span className="text-[11px] font-bold text-stone-400 shrink-0">{item.quantity} {item.unit}</span>
                                                </div>
                                            ))}
                                            {(dispatch.items?.length || 0) > 6 && (
                                                <div className="p-2.5 text-[11px] text-stone-400 italic">
                                                    + {(dispatch.items?.length || 0) - 6} more items...
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="p-6 lg:w-64 bg-stone-50/20 flex flex-col justify-center gap-2 border-t lg:border-t-0 lg:border-l border-stone-100">
                                        {statusTab === 'READY' ? (
                                            <button onClick={() => handleOpenDispatch(dispatch)} className="w-full h-11 bg-stone-900 text-white text-[13px] font-bold rounded-lg hover:bg-stone-800 transition-colors flex items-center justify-center gap-2">
                                                <span>Proceed to Transit</span>
                                                <ArrowRight className="h-4 w-4" />
                                            </button>
                                        ) : (
                                            <div className="p-3 bg-white border border-stone-100 rounded-lg space-y-2">
                                                <div className="flex items-center gap-2 text-[12px] text-stone-500 font-medium">
                                                    <User className="h-3.5 w-3.5 text-stone-300" />
                                                    <span className="truncate">{dispatch.driver_name || 'Assigned Driver'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[12px] text-stone-500 font-medium">
                                                    <Navigation className="h-3.5 w-3.5 text-stone-300" />
                                                    <span className="truncate">{dispatch.vehicle_registration || dispatch.vehicle_number || 'Assigned Fleet'}</span>
                                                </div>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => printDeliveryNote(dispatch)}
                                            disabled={isPrinting === dispatch.id}
                                            className="w-full h-11 bg-white border border-stone-200 text-stone-600 text-[13px] font-bold rounded-lg hover:bg-stone-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isPrinting === dispatch.id ? (
                                                <RefreshCw className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Printer className="h-4 w-4" />
                                            )}
                                            <span>{isPrinting === dispatch.id ? 'Generating...' : 'Print Note'}</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Dispatch Modal */}
                <Dialog open={dispatchModalOpen} onOpenChange={setDispatchModalOpen}>
                    <DialogContent className="max-w-md bg-white border-none shadow-2xl p-0 overflow-hidden rounded-xl">
                        <div className="bg-stone-900 p-6 text-white">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-semibold flex items-center gap-3">
                                    <Navigation className="h-5 w-5 text-stone-400" />
                                    Logistic Assignment
                                </DialogTitle>
                                <p className="text-stone-400 text-[12px] mt-1">Assign transport for <strong>{selectedDispatch?.dispatch_number}</strong></p>
                            </DialogHeader>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">Select Vehicle</label>
                                <select
                                    className="w-full h-11 px-4 bg-stone-50 border border-stone-100 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-stone-300"
                                    value={dispatchFormData.vehicle_id}
                                    onChange={(e) => setDispatchFormData({ ...dispatchFormData, vehicle_id: e.target.value })}
                                >
                                    <option value="">Choose vehicle...</option>
                                    {vehicles.map(v => (
                                        <option key={v.id} value={v.id}>{v.registration_number} — {v.model}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">Assign Driver</label>
                                <select
                                    className="w-full h-11 px-4 bg-stone-50 border border-stone-100 rounded-lg text-sm font-medium focus:outline-none focus:ring-1 focus:ring-stone-300"
                                    value={dispatchFormData.driver_id}
                                    onChange={(e) => setDispatchFormData({ ...dispatchFormData, driver_id: e.target.value })}
                                >
                                    <option value="">Choose driver...</option>
                                    {drivers.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="p-6 bg-stone-50 border-t border-stone-100 flex justify-end gap-2">
                            <button onClick={() => setDispatchModalOpen(false)} className="btn-secondary">Cancel</button>
                            <button
                                onClick={handleConfirmDispatch}
                                disabled={!dispatchFormData.vehicle_id || !dispatchFormData.driver_id || isSubmitting}
                                className={`h-10 px-5 rounded-lg text-sm font-bold shadow-sm transition-colors ${(!dispatchFormData.vehicle_id || !dispatchFormData.driver_id)
                                    ? 'bg-stone-200 text-stone-400'
                                    : 'bg-stone-900 text-white hover:bg-stone-800'
                                    }`}
                            >
                                {isSubmitting ? 'Processing...' : 'Confirm Dispatch'}
                            </button>
                        </div>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
