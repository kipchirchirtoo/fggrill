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
    Printer,
    Eye,
    DollarSign,
    Users,
    Plus
} from 'lucide-react';
import { api, conferenceAPI, accountingAPI } from '@/lib/api';
import { downloadInvoicePDF, printInvoicePDF } from '@/lib/invoice-pdf';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
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
    const { activeBranchId } = useBranch();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('hotel');
    const [hotelBookings, setHotelBookings] = useState<any[]>([]);
    const [restaurantBookings, setRestaurantBookings] = useState<any[]>([]);
    const [conferenceBookings, setConferenceBookings] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        fetchData();
    }, [activeTab, activeBranchId]);

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
            } else if (activeTab === 'conference') {
                const response = await conferenceAPI.getBookings({ 
                    branch_id: activeBranchId,
                    status: 'confirmed' 
                });
                if (response.success) {
                    setConferenceBookings(response.data);
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
    
    const filteredConferenceBookings = conferenceBookings.filter(b => {
        const searchStr = searchQuery.toLowerCase();
        const guestName = (b.customer_name || '').toLowerCase();
        const matchesSearch = guestName.includes(searchStr);
        const matchesStatus = statusFilter === 'all' || b.booking_status === statusFilter;
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
                        <TabsTrigger value="conference" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Users className="w-4 h-4 mr-2" />
                            Conference
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
                        onInvoiceGenerated={fetchData}
                    />
                </TabsContent>

                <TabsContent value="conference" className="mt-0">
                    <BookingList
                        type="conference"
                        records={filteredConferenceBookings}
                        loading={loading}
                        onConfirm={handleConfirm}
                        onCancel={handleCancel}
                        onInvoiceGenerated={fetchData}
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

function BookingList({ type, records, loading, onConfirm, onCancel, onInvoiceGenerated }: {
    type: 'hotel' | 'restaurant' | 'conference',
    records: any[],
    loading: boolean,
    onConfirm: (id: string) => void,
    onCancel: (id: string) => void,
    onInvoiceGenerated?: () => void
}) {
    const [selectedBooking, setSelectedBooking] = useState<any>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [isInvoicing, setIsInvoicing] = useState(false);

    const handleViewDetails = (record: any) => {
        setSelectedBooking(record);
        setShowDetailsModal(true);
    };

    const handleGenerateInvoice = async (record: any) => {
        if (!confirm('Are you sure you want to generate an invoice for this booking?')) return;
        
        setIsInvoicing(true);
        try {
            const invoiceData = {
                customer_id: record.customer_id || record.guest_id, // Map from booking
                customer_name: record.customer_name || record.guest_name,
                customer_email: record.customer_email || record.guest_email || record.email,
                invoice_date: new Date().toISOString().split('T')[0],
                due_date: new Date().toISOString().split('T')[0],
                subtotal: record.total_amount || 0,
                tax_amount: 0,
                reference: `Booking Ref: ${record.booking_number || record.reservation_number || 'N/A'}`,
                notes: `Generated from ${type} booking.`,
                items: [
                    {
                        description: `${type.toUpperCase()} Booking - ${record.room_number || record.table_number || record.conference_hall_id || 'N/A'}`,
                        quantity: 1,
                        unit_price: record.total_amount || 0,
                        total: record.total_amount || 0
                    }
                ],
                type: type === 'conference' ? 'CONFERENCE' : 'GENERAL',
                hotel_booking_id: type === 'hotel' ? record.id : null,
                restaurant_reservation_id: type === 'restaurant' ? record.id : null,
                conference_hall_id: type === 'conference' ? record.conference_hall_id : null,
                conference_start_date: type === 'conference' ? record.start_date : null,
                conference_end_date: type === 'conference' ? record.end_date : null
            };

            const res = await accountingAPI.createInvoice(invoiceData);
            if (res.success) {
                toast.success('Invoice generated successfully');
                if (onInvoiceGenerated) onInvoiceGenerated();
            } else {
                toast.error(res.message || 'Failed to generate invoice');
            }
        } catch (error) {
            console.error('Error generating invoice:', error);
            toast.error('Failed to generate invoice');
        } finally {
            setIsInvoicing(false);
        }
    };

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
        <>
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
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <div className="flex items-center text-xs text-slate-500">
                                            <Phone className="w-3 h-3 mr-1" />
                                            {record.guest_phone || record.customer_phone || record.phone || 'N/A'}
                                        </div>
                                        {record.invoice_id && (
                                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-indigo-50 text-indigo-700 border-indigo-200">
                                                Invoiced
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-semibold">
                                        {type === 'hotel' ? 'Room' : type === 'restaurant' ? 'Table/Guests' : 'Hall'}
                                    </p>
                                    <p className="text-sm">
                                        {type === 'hotel' 
                                            ? record.room_number 
                                            : type === 'restaurant' 
                                                ? `${record.table_number || 'TBD'} (${record.party_size || record.guests} guests)`
                                                : (record.conference_hall?.name || 'Hall' )}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-semibold">
                                        {type === 'hotel' ? 'Check-in' : type === 'restaurant' ? 'Date/Time' : 'Start Date'}
                                    </p>
                                    <p className="text-sm">
                                        {type === 'hotel'
                                            ? (record.check_in_date ? format(new Date(record.check_in_date), 'MMM dd, yyyy') : 'N/A')
                                            : type === 'restaurant'
                                                ? `${format(new Date(record.reservation_date), 'MMM dd, yyyy')} ${record.reservation_time || ''}`
                                                : (record.start_date ? format(new Date(record.start_date), 'MMM dd, yyyy HH:mm') : 'N/A')}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-semibold">Amount</p>
                                    <p className="text-sm font-medium">KES {(record.total_amount || 0).toLocaleString()}</p>
                                </div>
                                <div className="hidden md:block">
                                    <p className="text-xs text-slate-500 uppercase font-semibold">Status</p>
                                    <Badge
                                        variant="secondary"
                                        className={getStatusStyles(record.status || record.booking_status)}
                                    >
                                        {record.status || record.booking_status}
                                    </Badge>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 justify-end">
                                {!record.invoice_id && (
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleGenerateInvoice(record)}
                                        disabled={isInvoicing}
                                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                                    >
                                        <Plus className="w-4 h-4 mr-1" /> Invoice
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleViewDetails(record)}
                                    className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                >
                                    <Eye className="w-4 h-4 mr-1" /> View Details
                                </Button>
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

            {/* Booking Details Modal */}
            <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle className="text-2xl font-bold uppercase">
                            {type} Booking Details
                        </DialogTitle>
                        <DialogDescription>
                            Complete information about this booking
                        </DialogDescription>
                    </DialogHeader>

                    {selectedBooking && (
                        <div className="space-y-6 py-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100 dark:scrollbar-thumb-slate-600 dark:scrollbar-track-slate-800">
                            {/* Guest Information */}
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <User className="w-5 h-5 text-indigo-600" />
                                    Guest Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-semibold">Name</p>
                                        <p className="text-sm font-medium">{selectedBooking.guest_name || selectedBooking.customer_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-semibold">Phone</p>
                                        <p className="text-sm">{selectedBooking.guest_phone || selectedBooking.customer_phone || selectedBooking.phone || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-semibold">Email</p>
                                        <p className="text-sm">{selectedBooking.guest_email || selectedBooking.customer_email || selectedBooking.email || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-semibold">ID Number</p>
                                        <p className="text-sm">{selectedBooking.id_number || selectedBooking.customer_id_number || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Booking Details */}
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    {type === 'hotel' ? <Hotel className="w-5 h-5 text-indigo-600" /> : <Utensils className="w-5 h-5 text-indigo-600" />}
                                    {type === 'hotel' ? 'Booking Details' : 'Reservation Details'}
                                </h3>
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                                    {type === 'hotel' ? (
                                        <>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Booking Number</p>
                                                <p className="text-sm font-medium">{selectedBooking.booking_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Room Number</p>
                                                <p className="text-sm">{selectedBooking.room_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Check-in</p>
                                                <p className="text-sm">{selectedBooking.check_in ? format(new Date(selectedBooking.check_in), 'MMM dd, yyyy') : 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Check-out</p>
                                                <p className="text-sm">{selectedBooking.check_out ? format(new Date(selectedBooking.check_out), 'MMM dd, yyyy') : 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Number of Guests</p>
                                                <p className="text-sm">{selectedBooking.number_of_guests || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Room Type</p>
                                                <p className="text-sm">{selectedBooking.room_type || 'N/A'}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Reservation Number</p>
                                                <p className="text-sm font-medium">{selectedBooking.reservation_number || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Party Size</p>
                                                <p className="text-sm">{selectedBooking.party_size || selectedBooking.number_of_guests || 'N/A'} guests</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Date</p>
                                                <p className="text-sm">{selectedBooking.reservation_date ? format(new Date(selectedBooking.reservation_date), 'MMM dd, yyyy') : 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Time</p>
                                                <p className="text-sm">{selectedBooking.reservation_time || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Table</p>
                                                <p className="text-sm">{selectedBooking.table_number || 'Not assigned'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Section Preference</p>
                                                <p className="text-sm">{selectedBooking.section_preference || 'None'}</p>
                                            </div>
                                        </>
                                    )}
                                    <div className="col-span-2">
                                        <p className="text-xs text-slate-500 uppercase font-semibold">Status</p>
                                        <Badge variant="secondary" className={getStatusStyles(selectedBooking.status || selectedBooking.booking_status)}>
                                            {selectedBooking.status || selectedBooking.booking_status || 'Unknown'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Information */}
                            {(selectedBooking.total_amount || selectedBooking.deposit_amount) && (
                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-indigo-600" />
                                        Payment Information
                                    </h3>
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                                        {selectedBooking.total_amount && (
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Total Amount</p>
                                                <p className="text-sm font-medium">KES {selectedBooking.total_amount.toLocaleString()}</p>
                                            </div>
                                        )}
                                        {selectedBooking.deposit_amount && (
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Deposit</p>
                                                <p className="text-sm">KES {selectedBooking.deposit_amount.toLocaleString()}</p>
                                            </div>
                                        )}
                                        {selectedBooking.payment_status && (
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Payment Status</p>
                                                <p className="text-sm">{selectedBooking.payment_status}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Special Requests */}
                            {(selectedBooking.special_requests || selectedBooking.special_occasion || selectedBooking.dietary_restrictions) && (
                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Additional Information</h3>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg space-y-3">
                                        {selectedBooking.special_occasion && (
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Special Occasion</p>
                                                <p className="text-sm">{selectedBooking.special_occasion}</p>
                                            </div>
                                        )}
                                        {selectedBooking.dietary_restrictions && (
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Dietary Restrictions</p>
                                                <p className="text-sm">{Array.isArray(selectedBooking.dietary_restrictions) ? selectedBooking.dietary_restrictions.join(', ') : selectedBooking.dietary_restrictions}</p>
                                            </div>
                                        )}
                                        {selectedBooking.special_requests && (
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-semibold">Special Requests</p>
                                                <p className="text-sm">{selectedBooking.special_requests}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Timestamps */}
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-indigo-600" />
                                    Timestamps
                                </h3>
                                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg text-xs">
                                    <div>
                                        <p className="text-slate-500 uppercase font-semibold">Created</p>
                                        <p>{selectedBooking.created_at ? format(new Date(selectedBooking.created_at), 'MMM dd, yyyy HH:mm') : 'N/A'}</p>
                                    </div>
                                    {selectedBooking.confirmed_at && (
                                        <div>
                                            <p className="text-slate-500 uppercase font-semibold">Confirmed</p>
                                            <p>{format(new Date(selectedBooking.confirmed_at), 'MMM dd, yyyy HH:mm')}</p>
                                        </div>
                                    )}
                                    {selectedBooking.cancelled_at && (
                                        <div>
                                            <p className="text-slate-500 uppercase font-semibold">Cancelled</p>
                                            <p>{format(new Date(selectedBooking.cancelled_at), 'MMM dd, yyyy HH:mm')}</p>
                                        </div>
                                    )}
                                    {selectedBooking.cancellation_reason && (
                                        <div className="col-span-2">
                                            <p className="text-slate-500 uppercase font-semibold">Cancellation Reason</p>
                                            <p>{selectedBooking.cancellation_reason}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function getStatusStyles(status: string) {
    if (!status) return 'bg-slate-50 text-slate-700 border-slate-100';
    
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
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="text-xs text-slate-500">{inv.customer?.email}</div>
                                    {inv.hotel_booking_id && (
                                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-blue-50 text-blue-700 border-blue-200">
                                            Hotel
                                        </Badge>
                                    )}
                                    {inv.restaurant_reservation_id && (
                                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-orange-50 text-orange-700 border-orange-200">
                                            Restaurant
                                        </Badge>
                                    )}
                                    {inv.type === 'CONFERENCE' && (
                                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-purple-50 text-purple-700 border-purple-200">
                                            Conference
                                        </Badge>
                                    )}
                                </div>
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
