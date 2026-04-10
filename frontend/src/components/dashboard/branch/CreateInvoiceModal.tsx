'use client';

import { useState } from 'react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { X, Plus, Trash2, Loader2, Hotel, Utensils } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { accountingAPI, conferenceAPI, bookingsAPI, restaurantAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';
import { useEffect } from 'react';
import { Calendar, Clock } from 'lucide-react';

interface CreateInvoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'conference' | 'hotel' | 'restaurant' | 'guest' | 'general' | null;
    onSuccess: () => void;
}

export function CreateInvoiceModal({ isOpen, onClose, type, onSuccess }: CreateInvoiceModalProps) {
    const { activeBranchId } = useBranch();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        customerName: '',
        customerEmail: '',
        date: new Date().toISOString().split('T')[0],
        dueDate: '',
        reference: '',
        notes: '',
        conference_hall_id: '',
        conference_start_date: '',
        conference_end_date: '',
        hotel_booking_id: '',
        restaurant_reservation_id: ''
    });

    const [halls, setHalls] = useState<any[]>([]);
    const [hotelBookings, setHotelBookings] = useState<any[]>([]);
    const [restaurantReservations, setRestaurantReservations] = useState<any[]>([]);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

    useEffect(() => {
        if (isOpen && activeBranchId) {
            if (type === 'conference') fetchHalls();
            if (type === 'hotel') fetchHotelBookings();
            if (type === 'restaurant') fetchRestaurantReservations();
        }
    }, [isOpen, type, activeBranchId]);

    const fetchHalls = async () => {
        try {
            const response = await conferenceAPI.getHalls(activeBranchId);
            if (response.success) setHalls(response.data);
        } catch (error) {
            console.error('Error fetching halls:', error);
        }
    };

    const fetchHotelBookings = async () => {
        try {
            const response = await bookingsAPI.getBookings(); // Note: Backend usually filters by branch
            if (response.success) {
                // Filter for checked-in or confirmed bookings that aren't invoiced yet
                setHotelBookings(response.data.filter((b: any) => !b.invoice_id));
            }
        } catch (error) {
            console.error('Error fetching hotel bookings:', error);
        }
    };

    const fetchRestaurantReservations = async () => {
        try {
            const response = await restaurantAPI.getRestaurantReservations();
            if (response.success) {
                setRestaurantReservations(response.data.filter((r: any) => !r.invoice_id));
            }
        } catch (error) {
            console.error('Error fetching restaurant reservations:', error);
        }
    };

    const checkAvailability = async (hallId: string, start: string, end: string) => {
        if (!hallId || !start || !end) return;
        setCheckingAvailability(true);
        try {
            const response = await conferenceAPI.checkAvailability(hallId, start, end);
            setIsAvailable(response.available);
            if (!response.available) {
                toast.error('This hall is already booked for the selected time range');
            }
        } catch (error) {
            console.error('Error checking availability:', error);
        } finally {
            setCheckingAvailability(false);
        }
    };

    const [items, setItems] = useState<{ description: string; quantity: number; unitPrice: number }[]>([
        { description: '', quantity: 1, unitPrice: 0 }
    ]);

    if (!isOpen || !type) return null;

    const handleAddItem = () => {
        setItems([...items, { description: '', quantity: 1, unitPrice: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: string, value: string | number) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.customerName) {
            toast.error('Customer name is required');
            return;
        }

        if (type === 'conference') {
            if (formData.conference_hall_id || formData.conference_start_date || formData.conference_end_date) {
                if (!formData.conference_hall_id || !formData.conference_start_date || !formData.conference_end_date) {
                    toast.error('To book a hall, please provide hall name, start and end dates');
                    return;
                }
                if (new Date(formData.conference_start_date) >= new Date(formData.conference_end_date)) {
                    toast.error('End date must be after start date');
                    return;
                }
            }
        }

        setLoading(true);

        try {
            // If it's a conference with hall booking, create conference booking first
            if (type === 'conference' && formData.conference_hall_id && formData.conference_start_date && formData.conference_end_date) {
                const conferenceBookingData = {
                    conference_hall_id: formData.conference_hall_id,
                    branch_id: activeBranchId,
                    company_name: formData.customerName,
                    customer_name: formData.customerName,
                    customer_email: formData.customerEmail,
                    customer_phone: '',
                    start_date: formData.conference_start_date,
                    end_date: formData.conference_end_date,
                    num_participants: 0,
                    amount_per_pax: 0,
                    meal_plan_details: [],
                    amenities_details: [],
                    program_schedule: [],
                    payment_mode: 'Invoice',
                    notes: formData.notes,
                    total_amount: calculateTotal()
                };

                const confResponse = await conferenceAPI.createBooking(conferenceBookingData);
                
                if (confResponse.success) {
                    toast.success(`Conference booking created with invoice ${confResponse.data.invoice_number || 'N/A'}`);
                    onSuccess();
                    onClose();
                    return;
                }
            }

            // Otherwise create accounting invoice
            const invoiceData = {
                branch_id: activeBranchId,
                type: type.toUpperCase(), // CONFERENCE, HOTEL, RESTAURANT, GUEST
                customer_name: formData.customerName,
                customer_email: formData.customerEmail,
                invoice_date: formData.date || new Date().toISOString().split('T')[0],
                due_date: formData.dueDate || formData.date || new Date().toISOString().split('T')[0],
                reference_number: formData.reference,
                notes: formData.notes,
                items: items,
                subtotal: calculateTotal(),
                tax_amount: 0,
                total_amount: calculateTotal(),
                status: 'DRAFT',
                conference_hall_id: formData.conference_hall_id || null,
                conference_start_date: formData.conference_start_date || null,
                conference_end_date: formData.conference_end_date || null,
                hotel_booking_id: formData.hotel_booking_id || null,
                restaurant_reservation_id: formData.restaurant_reservation_id || null
            };

            const response = await accountingAPI.createInvoice(invoiceData);

            if (response.success) {
                toast.success(`${type} Invoice created successfully`);
                onSuccess();
                onClose();
            } else {
                toast.error(response.message || 'Failed to create invoice');
            }
        } catch (error: any) {
            console.error('Invoice creation error:', error);
            toast.error(error.message || 'Failed to create invoice');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <IOSCard className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-0 animate-in fade-in zoom-in duration-200">
                <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-gray-100 bg-white/80 backdrop-blur-md">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 capitalize">New {type} Invoice</h2>
                        <p className="text-sm text-gray-500">Create a new invoice record</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Customer Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Customer / Org Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={formData.customerName}
                                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder={type === 'conference' ? 'Company Name' : 'Guest Name'}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Email (Optional)</label>
                            <input
                                type="email"
                                value={formData.customerEmail}
                                onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="email@example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Invoice Date</label>
                            <input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">External Reference</label>
                            <input
                                type="text"
                                value={formData.reference}
                                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                placeholder="PO Number / External Ref"
                            />
                        </div>
                    </div>

                    {/* Conference Specific Fields */}
                    {type === 'conference' && (
                        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> Conference Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Select Room/Hall (Optional)</label>
                                    <select
                                        value={formData.conference_hall_id}
                                        onChange={(e) => {
                                            setFormData({ ...formData, conference_hall_id: e.target.value });
                                            if (e.target.value && formData.conference_start_date && formData.conference_end_date) {
                                                checkAvailability(e.target.value, formData.conference_start_date, formData.conference_end_date);
                                            } else {
                                                setIsAvailable(null);
                                            }
                                        }}
                                        className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-white outline-none text-sm"
                                    >
                                        <option value="">No Hall (General Conference)</option>
                                        {halls.map(h => <option key={h.id} value={h.id}>{h.name} (Cap: {h.capacity})</option>)}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 font-semibold flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" /> Start Date & Time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.conference_start_date}
                                        onChange={(e) => {
                                            setFormData({ ...formData, conference_start_date: e.target.value });
                                            if (formData.conference_hall_id && e.target.value && formData.conference_end_date) {
                                                checkAvailability(formData.conference_hall_id, e.target.value, formData.conference_end_date);
                                            }
                                        }}
                                        className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 font-semibold flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" /> End Date & Time
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={formData.conference_end_date}
                                        onChange={(e) => {
                                            setFormData({ ...formData, conference_end_date: e.target.value });
                                            if (formData.conference_hall_id && formData.conference_start_date && e.target.value) {
                                                checkAvailability(formData.conference_hall_id, formData.conference_start_date, e.target.value);
                                            }
                                        }}
                                        className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    />
                                </div>
                            </div>
                            {halls.length === 0 && (
                                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 italic">
                                    Note: No conference halls are currently configured for this branch. You can still create a general conference invoice without a hall booking.
                                </p>
                            )}
                            {checkingAvailability && <p className="text-xs text-blue-600 animate-pulse">Checking room availability...</p>}
                            {isAvailable === true && <p className="text-xs text-green-600 font-medium">✓ Room is available for this time range</p>}
                            {isAvailable === false && <p className="text-xs text-red-600 font-medium flex items-center gap-1">✗ Already booked or occupied!</p>}
                        </div>
                    )}

                    {/* Hotel Specific Fields */}
                    {type === 'hotel' && (
                        <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-4">
                            <h3 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                <Hotel className="h-4 w-4" /> Hotel Booking Link
                            </h3>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Select Active Booking</label>
                                <select
                                    value={formData.hotel_booking_id}
                                    onChange={(e) => {
                                        const booking = hotelBookings.find(b => b.id === e.target.value);
                                        if (booking) {
                                            setFormData({
                                                ...formData,
                                                hotel_booking_id: e.target.value,
                                                customerName: booking.guest_name,
                                                customerEmail: booking.guest_email || '',
                                                reference: `Hotel Ref: ${booking.booking_number}`
                                            });
                                            setItems([{
                                                description: `Hotel Stay - Room ${booking.room_number}`,
                                                quantity: 1,
                                                unitPrice: booking.total_amount || 0
                                            }]);
                                        } else {
                                            setFormData({ ...formData, hotel_booking_id: '' });
                                        }
                                    }}
                                    className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-white outline-none text-sm"
                                >
                                    <option value="">-- Select a booking --</option>
                                    {hotelBookings.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.guest_name} - Room {b.room_number} ({format(new Date(b.check_in_date), 'MMM dd')} to {format(new Date(b.check_out_date), 'MMM dd')})
                                        </option>
                                    ))}
                                </select>
                                {hotelBookings.length === 0 && <p className="text-xs text-gray-500 italic">No uninvoiced bookings found.</p>}
                            </div>
                        </div>
                    )}

                    {/* Restaurant Specific Fields */}
                    {type === 'restaurant' && (
                        <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-4">
                            <h3 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                                <Utensils className="h-4 w-4" /> Restaurant Reservation Link
                            </h3>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Select Reservation</label>
                                <select
                                    value={formData.restaurant_reservation_id}
                                    onChange={(e) => {
                                        const res = restaurantReservations.find(r => r.id === e.target.value);
                                        if (res) {
                                            setFormData({
                                                ...formData,
                                                restaurant_reservation_id: e.target.value,
                                                customerName: res.guest_name || res.customer_name,
                                                customerEmail: res.guest_email || res.customer_email || '',
                                                reference: `Rest Ref: ${res.reservation_number || 'N/A'}`
                                            });
                                            setItems([{
                                                description: `Restaurant Dining - ${res.party_size || res.guests} guests`,
                                                quantity: 1,
                                                unitPrice: res.total_amount || 0
                                            }]);
                                        } else {
                                            setFormData({ ...formData, restaurant_reservation_id: '' });
                                        }
                                    }}
                                    className="w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 bg-white outline-none text-sm"
                                >
                                    <option value="">-- Select a reservation --</option>
                                    {restaurantReservations.map(r => (
                                        <option key={r.id} value={r.id}>
                                            {r.guest_name || r.customer_name} - {format(new Date(r.reservation_date), 'MMM dd')} {r.reservation_time}
                                        </option>
                                    ))}
                                </select>
                                {restaurantReservations.length === 0 && <p className="text-xs text-gray-500 italic">No uninvoiced reservations found.</p>}
                            </div>
                        </div>
                    )}

                    {/* Line Items */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-semibold text-gray-900">Line Items</h3>
                            <button type="button" onClick={handleAddItem} className="text-sm text-blue-600 font-medium hover:text-blue-700 flex items-center gap-1">
                                <Plus className="h-4 w-4" /> Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                                <div className="col-span-6">Description</div>
                                <div className="col-span-2 text-center">Qty</div>
                                <div className="col-span-3 text-right">Price</div>
                                <div className="col-span-1"></div>
                            </div>

                            {items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-start animate-in slide-in-from-left-2 duration-200">
                                    <div className="col-span-6">
                                        <input
                                            type="text"
                                            value={item.description}
                                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                            placeholder="Item description"
                                            className="w-full p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="number"
                                            min="1"
                                            value={item.quantity}
                                            onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                                            className="w-full p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-center"
                                        />
                                    </div>
                                    <div className="col-span-3">
                                        <input
                                            type="number"
                                            min="0"
                                            value={item.unitPrice}
                                            onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                                            className="w-full p-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm text-right"
                                        />
                                    </div>
                                    <div className="col-span-1 flex justify-center pt-2">
                                        {items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(index)}
                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-100">
                            <div className="bg-gray-50 px-4 py-2 rounded-lg text-right">
                                <p className="text-xs text-gray-500 uppercase font-bold">Total Amount</p>
                                <p className="text-xl font-bold text-gray-900">
                                    {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(calculateTotal())}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Internal Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm min-h-[80px]"
                            placeholder="Add any internal notes for the auditor..."
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <IOSButton type="button" variant="secondary" onClick={onClose} className="flex-1">
                            Cancel
                        </IOSButton>
                        <IOSButton type="submit" disabled={loading} className="flex-1">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Create Invoice
                        </IOSButton>
                    </div>
                </form>
            </IOSCard>
        </div>
    );
}
