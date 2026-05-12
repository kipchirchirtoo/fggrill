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
    Plus,
    Building2
} from 'lucide-react';
import { api, conferenceAPI, accountingAPI, cateringAPI } from '@/lib/api';
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
import { CreateInvoiceModal } from '@/components/dashboard/branch/CreateInvoiceModal';
import { Invoice } from '@/lib/api/types';

export default function BookingsInvoicesPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.RECEPTIONIST]}>
            <DashboardLayout>
                <BookingsInvoicesContent />
            </DashboardLayout>
        </ProtectedRoute>
    );
}

function BookingsInvoicesContent() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('hotel');
    const [hotelBookings, setHotelBookings] = useState<any[]>([]);
    const [restaurantBookings, setRestaurantBookings] = useState<any[]>([]);
    const [conferenceBookings, setConferenceBookings] = useState<any[]>([]);
    const [cateringBookings, setCateringBookings] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createType, setCreateType] = useState<'conference' | 'hotel' | 'restaurant' | 'guest' | 'general' | null>(null);
    const [isExporting, setIsExporting] = useState<string | null>(null);

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
            } else if (activeTab === 'catering') {
                const userRole = user?.role?.toLowerCase() || '';
                const canAccessCatering = ['receptionist', 'branch_manager', 'super_admin'].includes(userRole);
                if (canAccessCatering) {
                    try {
                        const response = await cateringAPI.getBookings();
                        if (response.success) {
                            setCateringBookings(response.data);
                        }
                    } catch (e) {
                        console.warn('Catering API access denied or failed:', e);
                    }
                }
            } else if (activeTab === 'invoices') {
                await fetchInvoices();
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const fetchInvoices = async () => {
        try {
            const response = await api.accounting.getInvoices();
            const conferenceResponse = await api.conference.getBookings({ 
                branch_id: activeBranchId,
                status: 'confirmed' 
            });
            
            let allInvoices: any[] = [];
            
            if (response.success) {
                const mappedData = response.data.map((inv: any) => ({
                    ...inv,
                    subtotal: inv.subtotal || inv.total_amount || 0,
                    vat_amount: inv.vat_amount || 0
                }));
                allInvoices = [...allInvoices, ...mappedData];
            }
            
            if (conferenceResponse.success) {
                const conferenceInvoices = conferenceResponse.data.map((booking: any) => ({
                    id: booking.id,
                    invoice_number: booking.invoice_number || `CNF-${booking.id.slice(0, 8)}`,
                    customer_name: booking.company_name || booking.customer_name,
                    customer_email: booking.customer_email,
                    customer: {
                        id: booking.id,
                        customer_name: booking.company_name || booking.customer_name,
                        email: booking.customer_email,
                        phone: booking.customer_phone
                    },
                    invoice_date: booking.created_at || booking.start_date,
                    due_date: booking.end_date || booking.start_date,
                    total_amount: booking.total_amount,
                    subtotal: booking.total_amount,
                    vat_amount: 0,
                    status: booking.payment_status === 'paid' ? 'paid' : 
                            booking.payment_status === 'partial' ? 'partial' : 'unpaid',
                    type: 'CONFERENCE' as const,
                    items: [],
                    notes: `Conference: ${booking.start_date} to ${booking.end_date}`,
                    branch_id: booking.branch_id
                }));
                allInvoices = [...allInvoices, ...conferenceInvoices];
            }
            
            if (activeBranchId) {
                allInvoices = allInvoices.filter(inv => inv.branch_id === activeBranchId);
            }
            
            setInvoices(allInvoices);
        } catch (error) {
            console.error('Error fetching invoices:', error);
            toast.error('Failed to load invoices');
        }
    };

    const handleConfirm = async (id: string) => {
        try {
            let response;
            if (activeTab === 'hotel') {
                response = await api.bookings.updateBooking(id, { status: 'confirmed' });
            } else if (activeTab === 'catering') {
                response = await cateringAPI.updateBooking(id, { booking_status: 'confirmed' });
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
            } else if (activeTab === 'catering') {
                response = await cateringAPI.cancelBooking(id);
            } else {
                response = await api.restaurant.cancelRestaurantReservation(id);
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

    const handleCreate = (type: 'conference' | 'hotel' | 'restaurant' | 'guest' | 'general') => {
        setCreateType(type);
        setShowCreateModal(true);
    };

    const handleCreateSuccess = () => {
        fetchInvoices();
        toast.success("Invoice created and sent to Auditor");
        setShowCreateModal(false);
    };

    const handleDownload = async (inv: Invoice) => {
        setIsExporting(inv.id);
        const toastId = toast.loading(`Generating PDF for ${inv.invoice_number}...`);
        try {
            await downloadInvoicePDF(inv);
            toast.success("Invoice downloaded", { id: toastId });
        } catch (error: any) {
            console.error('Download failed:', error);
            toast.error(error.message || "Failed to download invoice", { id: toastId });
        } finally {
            setIsExporting(null);
        }
    };

    const handlePrint = async (inv: Invoice) => {
        setIsExporting(inv.id);
        const toastId = toast.loading(`Preparing print for ${inv.invoice_number}...`);
        try {
            await printInvoicePDF(inv);
            toast.success("Print dialog opened", { id: toastId });
        } catch (error: any) {
            console.error('Print failed:', error);
            toast.error(error.message || "Failed to print invoice", { id: toastId });
        } finally {
            setIsExporting(null);
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

    const filteredCateringBookings = cateringBookings.filter(b => {
        const searchStr = searchQuery.toLowerCase();
        const customerName = (b.customer_name || '').toLowerCase();
        const bookingNumber = (b.booking_number || '').toLowerCase();
        const matchesSearch = customerName.includes(searchStr) || bookingNumber.includes(searchStr);
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
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Bookings & Invoices</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Manage reservations and billing in one place.</p>
                </div>
            </div>

            <Tabs defaultValue="hotel" className="w-full" onValueChange={setActiveTab}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
                        <TabsTrigger value="hotel" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Hotel className="w-4 h-4 mr-2" />
                            Hotel
                        </TabsTrigger>
                        <TabsTrigger value="restaurant" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Utensils className="w-4 h-4 mr-2" />
                            Restaurant
                        </TabsTrigger>
                        <TabsTrigger value="conference" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Users className="w-4 h-4 mr-2" />
                            Conference
                        </TabsTrigger>
                        <TabsTrigger value="catering" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <Utensils className="w-4 h-4 mr-2" />
                            Catering
                        </TabsTrigger>
                        <TabsTrigger value="invoices" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Invoices
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        {activeTab === 'invoices' && (
                            <div className="flex flex-wrap gap-2 mr-2">
                                <Button size="sm" onClick={() => handleCreate('conference')} className="bg-blue-600 hover:bg-blue-700">
                                    <Building2 className="w-4 h-4 mr-1" /> Conference
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleCreate('hotel')}>
                                    <Hotel className="w-4 h-4 mr-1" /> Hotel
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleCreate('restaurant')}>
                                    <Utensils className="w-4 h-4 mr-1" /> Restaurant
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleCreate('guest')}>
                                    <User className="w-4 h-4 mr-1" /> Other
                                </Button>
                            </div>
                        )}
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search..."
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
                        onInvoiceGenerated={fetchData}
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

                <TabsContent value="catering" className="mt-0">
                    <BookingList
                        type="catering"
                        records={filteredCateringBookings}
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
                        onDownload={handleDownload}
                        onPrint={handlePrint}
                        isExporting={isExporting}
                    />
                </TabsContent>
            </Tabs>

            <CreateInvoiceModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                type={createType}
                onSuccess={handleCreateSuccess}
            />
        </div>
    );
}

function BookingList({ type, records, loading, onConfirm, onCancel, onInvoiceGenerated }: {
    type: 'hotel' | 'restaurant' | 'conference' | 'catering',
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
                        description: type === 'catering' 
                            ? `Catering Service - ${record.event_type || 'Event'} (${record.num_guests || 0} guests)` 
                            : `${type.toUpperCase()} Booking - ${record.room_number || record.table_number || record.conference_hall_id || 'N/A'}`,
                        quantity: 1,
                        unit_price: record.total_amount || 0,
                        total: record.total_amount || 0
                    }
                ],
                type: type === 'conference' ? 'CONFERENCE' : type === 'catering' ? 'CATERING' : 'GENERAL',
                hotel_booking_id: type === 'hotel' ? record.id : null,
                restaurant_reservation_id: type === 'restaurant' ? record.id : null,
                conference_hall_id: type === 'conference' ? record.conference_hall_id : null,
                conference_start_date: type === 'conference' ? record.start_date : null,
                conference_end_date: type === 'conference' ? record.end_date : null,
                catering_booking_id: type === 'catering' ? record.id : null
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
                                        {type === 'hotel' ? 'Room' : type === 'restaurant' ? 'Table/Guests' : type === 'catering' ? 'Event/Guests' : 'Hall'}
                                    </p>
                                    <p className="text-sm">
                                        {type === 'hotel' 
                                            ? record.room_number 
                                            : type === 'restaurant' 
                                                ? `${record.table_number || 'TBD'} (${record.party_size || record.guests} guests)`
                                                : type === 'catering'
                                                    ? `${record.event_type || 'Event'} (${record.num_guests || 0} guests)`
                                                    : (record.conference_hall?.name || 'Hall' )}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 uppercase font-semibold">
                                        {type === 'hotel' ? 'Check-in' : type === 'restaurant' ? 'Date/Time' : type === 'catering' ? 'Event Date' : 'Start Date'}
                                    </p>
                                    <p className="text-sm">
                                        {type === 'hotel'
                                            ? (record.check_in_date ? format(new Date(record.check_in_date), 'MMM dd, yyyy') : 'N/A')
                                            : type === 'restaurant'
                                                ? `${format(new Date(record.reservation_date), 'MMM dd, yyyy')} ${record.reservation_time || ''}`
                                                : type === 'catering'
                                                    ? `${record.event_date ? format(new Date(record.event_date), 'MMM dd, yyyy') : 'N/A'} ${record.event_time || ''}`
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
                                    <Eye className="w-4 h-4 mr-1" /> View
                                </Button>
                                {(record.status === 'pending' || record.booking_status === 'pending') && (
                                    <Button
                                        size="sm"
                                        onClick={() => onConfirm(record.id)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-1" /> Confirm
                                    </Button>
                                )}
                                {(['pending', 'confirmed'].includes(record.status) || ['pending', 'confirmed'].includes(record.booking_status)) && (
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
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function InvoiceList({ records, loading, onDownload, onPrint, isExporting }: {
    records: Invoice[],
    loading: boolean,
    onDownload: (inv: Invoice) => void,
    onPrint: (inv: Invoice) => void,
    isExporting: string | null
}) {
    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'paid': return 'text-green-600 bg-green-50 border-green-200';
            case 'unpaid': return 'text-red-600 bg-red-50 border-red-200';
            case 'draft': return 'text-gray-600 bg-gray-50 border-gray-200';
            default: return 'text-blue-600 bg-blue-50 border-blue-200';
        }
    };

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

    return (
        <Card>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3">Invoice #</th>
                            <th className="px-6 py-3">Customer</th>
                            <th className="px-6 py-3">Date</th>
                            <th className="px-6 py-3 text-right">Amount</th>
                            <th className="px-6 py-3 text-center">Status</th>
                            <th className="px-6 py-3 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {records.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-medium text-blue-600">{inv.invoice_number}</td>
                                <td className="px-6 py-4">
                                    <div className="font-medium">{inv.customer?.customer_name || 'N/A'}</div>
                                    <div className="text-xs text-slate-500">{inv.customer?.email}</div>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-right font-medium">KES {inv.total_amount.toLocaleString()}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(inv.status)}`}>
                                        {inv.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center gap-2">
                                        <button
                                            onClick={() => onDownload(inv)}
                                            disabled={isExporting !== null}
                                            className={`p-1.5 rounded-md transition-colors ${isExporting === inv.id ? 'text-blue-400 bg-blue-50' : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
                                            title="Download PDF"
                                        >
                                            <Download className={`h-4 w-4 ${isExporting === inv.id ? 'animate-pulse' : ''}`} />
                                        </button>
                                        <button
                                            onClick={() => onPrint(inv)}
                                            disabled={isExporting !== null}
                                            className={`p-1.5 rounded-md transition-colors ${isExporting === inv.id ? 'text-amber-400 bg-amber-50' : 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'}`}
                                            title="Print"
                                        >
                                            <Printer className={`h-4 w-4 ${isExporting === inv.id ? 'animate-pulse' : ''}`} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function getStatusStyles(status: string) {
    switch (status?.toLowerCase()) {
        case 'confirmed':
            return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'pending':
            return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'cancelled':
            return 'bg-rose-100 text-rose-700 border-rose-200';
        case 'completed':
            return 'bg-blue-100 text-blue-700 border-blue-200';
        default:
            return 'bg-slate-100 text-slate-700 border-slate-200';
    }
}
