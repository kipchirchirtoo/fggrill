'use strict';
'use client';

import React, { useState, useEffect } from 'react';
import {
    Loader2,
    Calendar,
    Search,
    Hotel,
    Utensils,
    CheckCircle2,
    XCircle,
    User,
    Phone,
    Mail,
    Clock,
    MapPin,
    ChevronRight,
    Filter,
    FileText,
    Download,
    Printer
} from 'lucide-react';
import { api } from '@/lib/api';
import { downloadInvoicePDF, printInvoicePDF } from '@/lib/invoice-pdf';
import { useAuth, UserRole } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';

export default function BookingsManagementPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST]}>
            <DashboardLayout>
                <BookingsManagementContent />
            </DashboardLayout>
        </ProtectedRoute>
    );
}

function BookingsManagementContent() {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('hotel');
    const [hotelBookings, setHotelBookings] = useState<any[]>([]);
    const [restaurantBookings, setRestaurantBookings] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'hotel') {
                const response = await api.bookings.getBookings();
                if (response.success) {
                    setHotelBookings(response.data);
                }
            } else if (activeTab === 'restaurant') {
                const response = await api.restaurant.getRestaurantReservations();
                if (response.success) {
                    setRestaurantBookings(response.data);
                }
            } else if (activeTab === 'invoices') {
                const response = await api.accounting.getInvoices();
                if (response.success) {
                    setInvoices(response.data);
                }
            }
        } catch (error) {
            console.error('Error fetching bookings:', error);
            toast.error('Failed to load bookings');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async (id: string) => {
        try {
            let response;
            if (activeTab === 'hotel') {
                // Assuming there's a confirm endpoint or update status
                response = await api.bookings.updateBooking(id, { status: 'confirmed' });
            } else {
                response = await api.restaurant.confirmRestaurantReservation(id);
            }

            if (response.success) {
                toast.success('Booking confirmed');
                fetchData();
            } else {
                toast.error(response.message || 'Failed to confirm booking');
            }
        } catch (error) {
            console.error('Error confirming booking:', error);
            toast.error('Action failed');
        }
    };

    const handleCancel = async (id: string) => {
        try {
            let response;
            if (activeTab === 'hotel') {
                response = await api.bookings.cancelBooking(id, 'Cancelled by Branch Accountant');
            } else {
                response = await api.restaurant.cancelRestaurantReservation(id, 'Cancelled by Branch Accountant');
            }

            if (response.success) {
                toast.success('Booking cancelled');
                fetchData();
            } else {
                toast.error(response.message || 'Failed to cancel booking');
            }
        } catch (error) {
            console.error('Error cancelling booking:', error);
            toast.error('Action failed');
        }
    };

    const filteredHotelBookings = hotelBookings.filter(b => {
        const searchStr = searchQuery.toLowerCase();
        const guestName = (b.guest_name || '').toLowerCase();
        const matchesSearch = guestName.includes(searchStr) || (b.room_number || '').includes(searchStr);
        const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const filteredRestaurantBookings = restaurantBookings.filter(b => {
        const searchStr = searchQuery.toLowerCase();
        const guestName = (b.guest_name || b.customer_name || '').toLowerCase();
        const matchesSearch = guestName.includes(searchStr);
        const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const filteredInvoices = invoices.filter(inv => {
        const searchStr = searchQuery.toLowerCase();
        const matchesSearch =
            inv.invoice_number?.toLowerCase().includes(searchStr) ||
            inv.customer?.customer_name?.toLowerCase().includes(searchStr);
        return matchesSearch;
    });

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Booking Management</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Manage and confirm hotel and restaurant reservations.</p>
                </div>
            </div>

            <Tabs defaultValue="hotel" className="w-full" onValueChange={setActiveTab}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
                        <TabsTrigger value="hotel" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Hotel className="w-4 h-4 mr-2" />
                            Hotel Bookings
                        </TabsTrigger>
                        <TabsTrigger value="restaurant" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Utensils className="w-4 h-4 mr-2" />
                            Restaurant
                        </TabsTrigger>
                        <TabsTrigger value="invoices" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Invoices
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search guest or room..."
                                className="pl-9 bg-white dark:bg-slate-950"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <TabsContent value="hotel" className="mt-0">
                    <BookingList
                        type="hotel"
                        records={filteredHotelBookings}
                        loading={loading}
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                    />
                </TabsContent>

                <TabsContent value="restaurant" className="mt-0">
                    <BookingList
                        type="restaurant"
                        records={filteredRestaurantBookings}
                        loading={loading}
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                    />
                </TabsContent>

                <TabsContent value="invoices" className="mt-0">
                    <InvoiceList
                        records={filteredInvoices}
                        loading={loading}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function BookingList({ type, records, loading, onConfirm, onCancel }: {
    type: 'hotel' | 'restaurant',
    records: any[],
    loading: boolean,
    onConfirm: (id: string) => void,
    onCancel: (id: string) => void
}) {
    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    if (records.length === 0) return (
        <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No {type} bookings found</h3>
                <p className="text-slate-500 max-w-xs mt-1">There are no bookings matching your criteria.</p>
            </CardContent>
        </Card>
    );

    return (
        <div className="grid grid-cols-1 gap-4">
            {records.map((record) => (
                <Card key={record.id} className="overflow-hidden hover:border-indigo-200 transition-colors">
                    <div className="flex flex-col md:flex-row md:items-center p-4 gap-4">
                        <div className="flex items-center gap-3 min-w-[200px]">
                            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <User className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {type === 'hotel' ? record.guest_name : (record.guest_name || record.customer_name)}
                                </p>
                                <div className="flex items-center text-xs text-slate-500 mt-0.5">
                                    <Phone className="w-3 h-3 mr-1" />
                                    {record.guest_phone || record.phone || 'N/A'}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">
                                    {type === 'hotel' ? 'Room' : 'Table/Guests'}
                                </p>
                                <p className="text-sm">
                                    {type === 'hotel' ? record.room_number : `${record.table_number || 'TBD'} (${record.number_of_guests || record.guests} guests)`}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase font-semibold">
                                    {type === 'hotel' ? 'Check-in' : 'Date/Time'}
                                </p>
                                <p className="text-sm">
                                    {type === 'hotel'
                                        ? format(new Date(record.check_in), 'MMM dd, yyyy')
                                        : format(new Date(record.reservation_date), 'MMM dd, yyyy HH:mm')}
                                </p>
                            </div>
                            <div className="hidden md:block">
                                <p className="text-xs text-slate-500 uppercase font-semibold">Status</p>
                                <Badge
                                    variant="secondary"
                                    className={getStatusStyles(record.status)}
                                >
                                    {record.status}
                                </Badge>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 justify-end">
                            {record.status === 'pending' && (
                                <Button
                                    size="sm"
                                    onClick={() => onConfirm(record.id)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm
                                </Button>
                            )}
                            {['pending', 'confirmed'].includes(record.status) && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onCancel(record.id)}
                                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                    <XCircle className="w-4 h-4 mr-1" /> Cancel
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

function getStatusStyles(status: string) {
    switch (status.toLowerCase()) {
        case 'confirmed':
            return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        case 'pending':
            return 'bg-amber-50 text-amber-700 border-amber-100';
        case 'cancelled':
            return 'bg-rose-50 text-rose-700 border-rose-100';
        default:
            return 'bg-slate-50 text-slate-700 border-slate-100';
    }
}

function InvoiceList({ records, loading }: { records: any[], loading: boolean }) {
    if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    if (records.length === 0) return (
        <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-slate-400" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No invoices found</h3>
                <p className="text-slate-500 max-w-xs mt-1">There are no invoices matching your criteria.</p>
            </CardContent>
        </Card>
    );

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'unpaid': return 'bg-rose-50 text-rose-700 border-rose-100';
            case 'draft': return 'bg-slate-50 text-slate-700 border-slate-100';
            default: return 'bg-blue-50 text-blue-700 border-blue-100';
        }
    };

    return (
        <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                        <th className="px-6 py-4 font-semibold">Invoice #</th>
                        <th className="px-6 py-4 font-semibold">Customer</th>
                        <th className="px-6 py-4 font-semibold">Date</th>
                        <th className="px-6 py-4 font-semibold text-right">Amount</th>
                        <th className="px-6 py-4 font-semibold text-center">Status</th>
                        <th className="px-6 py-4 font-semibold text-center">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {records.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 font-medium text-indigo-600 dark:text-indigo-400">{inv.invoice_number}</td>
                            <td className="px-6 py-4">
                                <div className="font-medium text-slate-900 dark:text-slate-100">{inv.customer?.customer_name || 'N/A'}</div>
                                <div className="text-xs text-slate-500">{inv.customer?.email}</div>
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{inv.invoice_date ? format(new Date(inv.invoice_date), 'MMM dd, yyyy') : 'N/A'}</td>
                            <td className="px-6 py-4 text-right font-medium text-slate-900 dark:text-slate-100">KES {(inv.total_amount || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 text-center">
                                <Badge variant="secondary" className={getStatusColor(inv.status)}>
                                    {inv.status}
                                </Badge>
                            </td>
                            <td className="px-6 py-4 text-center">
                                <div className="flex justify-center gap-2">
                                    <button
                                        onClick={() => downloadInvoicePDF(inv)}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                                        title="Download PDF"
                                    >
                                        <Download className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => printInvoicePDF(inv)}
                                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                        title="Print"
                                    >
                                        <Printer className="h-4 w-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
