import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { migratePendingBills } from '../jobs/migrate-pending-bills.job';
import { paymentVerificationService } from '../services/payment.verification.service';
import { mpesaService } from '../services/mpesa.service';
import notificationService from '../services/notification.service';
import { deductIngredientsForItem } from './kitchen/recipes.controller';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';
import axios from 'axios';
import { PYTHON_SERVICE_URL } from '../config/pythonService';

/**
 * Get Bill Details by Booking ID (or Barcode)
 */
export const getBillDetails = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { bookingId } = req.params;

        if (!bookingId) {
            throw new AppError('ID is required', 400);
        }

        const searchId = bookingId.toUpperCase();

        // Check if it's an accounting invoice (starts with INV)
        if (searchId.startsWith('INV')) {
            // First check accounting_ar_invoices
            const { data: arInvoice, error: arError } = await supabase
                .from('accounting_ar_invoices')
                .select(`
                    *,
                    customer:accounting_customers(id, customer_name, email, phone)
                `)
                .eq('invoice_number', searchId)
                .single();

            if (!arError && arInvoice) {
                res.json({
                    success: true,
                    data: {
                        type: 'invoice',
                        source: 'accounting',
                        invoice: {
                            id: arInvoice.id,
                            invoice_number: arInvoice.invoice_number,
                            customer_name: arInvoice.customer?.customer_name || 'Walk-in',
                            status: arInvoice.status,
                            items: (arInvoice.items || []).map((item: any) => ({
                                name: item.description || item.item_name || 'Item',
                                quantity: item.quantity || item.qty || 1,
                                price: item.unit_price || item.unitPrice || 0,
                                total: item.total_amount || item.totalAmount || 0
                            }))
                        },
                        financials: {
                            total_amount: arInvoice.total_amount,
                            amount_paid: Number(arInvoice.total_amount) - Number(arInvoice.balance),
                            balance: arInvoice.balance,
                            currency: 'KES'
                        },
                        payment_status: arInvoice.status === 'paid' ? 'paid' : (arInvoice.balance < arInvoice.total_amount ? 'partial' : 'unpaid')
                    }
                });
                return;
            }

            // If not found in accounting, check finance_invoices
            const { data: finInvoice, error: finError } = await supabase
                .from('finance_invoices')
                .select('*')
                .eq('invoice_number', searchId)
                .single();

            if (finInvoice) {
                res.json({
                    success: true,
                    data: {
                        type: 'invoice',
                        source: 'finance',
                        invoice: {
                            id: finInvoice.id,
                            invoice_number: finInvoice.invoice_number,
                            customer_name: finInvoice.customer_name || 'Walk-in',
                            status: finInvoice.status,
                            items: [] // finance_invoices might need a joined query for items if detail is needed
                        },
                        financials: {
                            total_amount: finInvoice.total_amount,
                            amount_paid: finInvoice.paid_amount || 0,
                            balance: Number(finInvoice.total_amount) - Number(finInvoice.paid_amount || 0),
                            currency: 'KES'
                        },
                        payment_status: finInvoice.status === 'paid' ? 'paid' : (finInvoice.paid_amount > 0 ? 'partial' : 'unpaid')
                    }
                });
                return;
            }

            throw new AppError('Invoice not found in any ledger', 404);
        }

        // Check if it's a hotel reservation (starts with HTL)
        if (searchId.startsWith('HTL')) {
            let hotelQuery = supabase
                .from('reservations')
                .select(`
                    *,
                    room:rooms(room_number, branch_id)
                `)
                .eq('confirmation_number', searchId);

            const { data: reservation, error: resError } = await hotelQuery.single();

            if (resError || !reservation) {
                throw new AppError('Hotel reservation not found', 404);
            }

            const totalAmount = parseFloat(reservation.total_amount || 0);
            const paidAmount = parseFloat(reservation.amount_paid || reservation.deposit_amount || 0);
            const balance = totalAmount - paidAmount;

            res.json({
                success: true,
                data: {
                    type: 'hotel',
                    source: 'reservations',
                    booking: {
                        id: reservation.id,
                        order_number: reservation.confirmation_number,
                        guest_name: reservation.guest_name || 'Guest',
                        room_number: reservation.room?.room_number || reservation.room_number,
                        status: reservation.status,
                        check_in: reservation.check_in_date || reservation.check_in,
                        check_out: reservation.check_out_date || reservation.check_out,
                        items: [{
                            name: `Accommodation Services (${reservation.room_type || 'Room'})`,
                            quantity: 1,
                            price: totalAmount,
                            total: totalAmount
                        }]
                    },
                    financials: {
                        total_amount: totalAmount,
                        amount_paid: paidAmount,
                        balance: balance,
                        currency: 'KES'
                    },
                    payment_status: balance <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid')
                }
            });
            return;
        }

        // Check if it's a restaurant order (starts with ORD)
        if (searchId.startsWith('ORD')) {
            // Fetch restaurant order details
            let restaurantQuery = supabase
                .from('restaurant_orders')
                .select(`
                    *,
                    items:restaurant_order_items(
                        *,
                        menu_item:restaurant_menu_items(name)
                    )
                `)
                .or(`order_number.eq.${searchId},order_number.eq.${searchId + ' '}`);

            // Branch isolation
            restaurantQuery = applyBranchFilter(restaurantQuery, req);

            const { data: order, error: orderError } = await restaurantQuery.single();

            if (orderError || !order) {
                throw new AppError('Restaurant order not found', 404);
            }

            res.json({
                success: true,
                data: {
                    type: 'restaurant',
                    order: {
                        id: order.id,
                        order_number: order.order_number,
                        order_type: order.order_type,
                        table_number: order.table_number,
                        room_number: order.room_number,
                        guest_name: order.guest_name || 'Walk-in',
                        status: order.status,
                        items: order.items?.map((item: any) => ({
                            name: item.menu_item?.name || 'Unknown Item',
                            quantity: item.quantity,
                            price: item.unit_price,
                            total: item.total_price
                        }))
                    },
                    financials: {
                        total_amount: order.total_amount,
                        amount_paid: order.payment_status === 'paid' ? order.total_amount : 0,
                        balance: order.payment_status === 'paid' ? 0 : order.total_amount,
                        currency: 'KES'
                    },
                    payment_status: order.payment_status
                }
            });
            return;
        }

        // Check if it's a bar order (starts with BAR)
        if (searchId.startsWith('BAR')) {
            // Fetch bar order details
            let barQuery = supabase
                .from('bar_orders')
                .select(`
                    *,
                    items:bar_order_items(*)
                `)
                .or(`order_number.eq.${searchId},order_number.eq.${searchId + ' '}`);

            // Branch isolation
            barQuery = applyBranchFilter(barQuery, req);

            const { data: order, error: orderError } = await barQuery.single();

            if (orderError || !order) {
                throw new AppError('Bar order not found', 404);
            }

            // Fetch payments for bar order
            const { data: payments } = await supabase
                .from('payments')
                .select('*')
                .eq('bar_order_id', order.id)
                .eq('status', 'completed');

            const amountPaid = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
            const balance = order.total - amountPaid;

            res.json({
                success: true,
                data: {
                    type: 'bar',
                    order: {
                        id: order.id,
                        order_number: order.order_number,
                        order_type: order.order_type,
                        table_number: order.seat_number, // bar uses seat_number
                        room_number: order.room_number,
                        guest_name: order.guest_name || 'Walk-in',
                        status: order.status,
                        items: order.items?.map((item: any) => ({
                            name: item.drink_name,
                            quantity: item.quantity,
                            price: item.unit_price,
                            total: item.total_price
                        }))
                    },
                    financials: {
                        total_amount: order.total,
                        amount_paid: amountPaid,
                        balance: balance,
                        currency: 'KES'
                    },
                    payment_status: order.payment_status,
                    payments: payments
                }
            });
            return;
        }

        // Check if it's a Kyogong Shift Transaction (SPA, EXEC, SPORTS, REC, etc.)
        // Pattern: PREFIX-DATE-RANDOM
        const kyogongPattern = /^[A-Z]+-\d{8}-\d{4}$/;
        if (kyogongPattern.test(searchId) || searchId.includes('-202')) {
            let kyogongQuery = supabase
                .from('shift_transactions')
                .select(`
                    *,
                    items:shift_transaction_items(*),
                    branch:branches(name)
                `)
                .eq('transaction_number', searchId);

            kyogongQuery = applyBranchFilter(kyogongQuery, req);

            const { data: tx, error: txError } = await kyogongQuery.single();

            if (!txError && tx) {
                res.json({
                    success: true,
                    data: {
                        type: 'kyogong',
                        order: {
                            id: tx.id,
                            order_number: tx.transaction_number,
                            guest_name: tx.customer_name || 'Walk-in',
                            status: tx.status,
                            service_category: tx.service_category,
                            items: tx.items?.map((item: any) => ({
                                name: item.item_name,
                                quantity: item.quantity,
                                price: item.unit_price,
                                total: item.total_price
                            }))
                        },
                        financials: {
                            total_amount: tx.total_amount,
                            amount_paid: tx.payment_method === 'BILL' ? 0 : tx.total_amount,
                            balance: tx.payment_method === 'BILL' ? tx.total_amount : 0,
                            currency: 'KES'
                        },
                        payment_status: tx.payment_method === 'BILL' ? 'unpaid' : 'paid'
                    }
                });
                return;
            }
        }

        // Check if it's a Conference Invoice (starts with CNF)
        if (searchId.startsWith('CNF')) {
            const { data: booking, error: bookingError } = await supabase
                .from('conference_hall_bookings')
                .select('*')
                .eq('invoice_number', searchId)
                .single();

            if (!bookingError && booking) {
                const balance = booking.total_amount - (booking.amount_paid || 0);
                
                res.json({
                    success: true,
                    data: {
                        type: 'conference',
                        booking: {
                            id: booking.id,
                            invoice_number: booking.invoice_number,
                            company_name: booking.company_name || booking.customer_name,
                            contact_person: booking.contact_person,
                            phone: booking.customer_phone,
                            email: booking.customer_email,
                            start_date: booking.start_date,
                            end_date: booking.end_date,
                            status: booking.payment_status,
                            items: [] // Conference bookings typically don't have line items
                        },
                        financials: {
                            total_amount: booking.total_amount,
                            amount_paid: booking.amount_paid || 0,
                            balance: balance,
                            currency: 'KES'
                        },
                        payment_status: booking.payment_status
                    }
                });
                return;
            }
        }

        // Check if it's a POS transaction (starts with CS)
        if (searchId.startsWith('CS')) {
            const cleanId = searchId.startsWith('CS-') ? searchId : `CS-${searchId.slice(2)}`;

            let posQuery = supabase
                .from('pos_transactions')
                .select(`
                    *,
                    items:pos_transaction_items(
                        *,
                        product:restaurant_menu_items(name)
                    )
                `)
                .eq('transaction_ref', searchId);

            posQuery = applyBranchFilter(posQuery, req);

            let { data: finalTx, error: txError } = await posQuery.single();

            // If not found by searchId, try cleanId if they differ
            if ((txError || !finalTx) && cleanId !== searchId) {
                let cleanIdQuery = supabase
                    .from('pos_transactions')
                    .select('*, items:pos_transaction_items(*, product:restaurant_menu_items(name))')
                    .eq('transaction_ref', cleanId);

                cleanIdQuery = applyBranchFilter(cleanIdQuery, req);
                const { data: tx2 } = await cleanIdQuery.single();
                finalTx = tx2;
            }

            if (!finalTx) {
                throw new AppError('POS Transaction not found', 404);
            }

            res.json({
                success: true,
                data: {
                    type: 'pos',
                    order: {
                        id: finalTx.id,
                        order_number: finalTx.transaction_ref,
                        guest_name: finalTx.customer_name || 'Walk-in',
                        status: finalTx.status,
                        items: finalTx.items?.map((item: any) => ({
                            name: item.product?.name || 'Unknown Item',
                            quantity: item.qty,
                            price: item.unit_price,
                            total: item.line_total
                        }))
                    },
                    financials: {
                        total_amount: finalTx.total_amount,
                        amount_paid: finalTx.status === 'PAID' ? finalTx.total_amount : 0,
                        balance: finalTx.status === 'PAID' ? 0 : finalTx.total_amount,
                        currency: 'KES'
                    },
                    payment_status: finalTx.status.toLowerCase()
                }
            });
            return;
        }

        // Check if it's an unpaid bill from other streams (CON, POL, CWS)
        const otherPrefixes = ['CON', 'POL', 'CWS', 'BILL'];
        const billPrefix = otherPrefixes.find(p => searchId.startsWith(p));

        if (billPrefix) {
            let query = supabase
                .from('unpaid_bills')
                .select('*')
                .eq('bill_number', searchId);

            query = applyBranchFilter(query, req);

            const { data: bill, error: billError } = await query.single();

            if (billError || !bill) {
                throw new AppError('Bill not found', 404);
            }

            res.json({
                success: true,
                data: {
                    type: 'unpaid_bill',
                    bill_type: bill.bill_type,
                    revenue_type: bill.revenue_type || bill.bill_type,
                    bill: {
                        id: bill.id,
                        bill_number: bill.bill_number,
                        customer_name: bill.customer_name,
                        room_number: bill.room_number,
                        status: bill.status,
                        due_date: bill.due_date,
                        remarks: bill.remarks
                    },
                    financials: {
                        total_amount: bill.total_amount,
                        amount_paid: bill.paid_amount || 0,
                        balance: bill.balance_amount || (bill.total_amount - (bill.paid_amount || 0)),
                        currency: 'KES'
                    }
                }
            });
            return;
        }

        // Check if it's a hotel booking by confirmation number (starts with HTL)
        if (searchId.startsWith('HTL')) {
            let query = supabase
                .from('reservations')
                .select(`
                    *,
                    room:rooms!room_id(number, branch_id, type:room_types(name, price))
                `)
                .eq('confirmation_number', searchId);

            // Branch isolation via room join
            query = applyBranchFilter(query, req, 'room.branch_id');

            const { data: booking, error: bookingError } = await query.single();

            if (!bookingError && booking) {
                await fetchHotelBillResponse(booking, res);
                return;
            }
        }

        // If not a prefix match, try UUID directly or Room Number fallback
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId);

        if (isUUID) {
            // 1. Check if it's a hotel reservation
            let hotelQuery = supabase
                .from('reservations')
                .select(`
                    *,
                    room:rooms!room_id(number, branch_id, type:room_types(name, price))
                `)
                .eq('id', bookingId);

            hotelQuery = applyBranchFilter(hotelQuery, req, 'room.branch_id');

            const { data: booking, error: bookingError } = await hotelQuery.maybeSingle(); // Changed to maybeSingle to avoid 404 throw early
            if (!bookingError && booking) {
                await fetchHotelBillResponse(booking, res);
                return;
            }

            // 2. Check shift_transactions (Kyogong)
            let kyogongQuery = supabase
                .from('shift_transactions')
                .select('*, items:shift_transaction_items(*), branch:branches(name)')
                .eq('id', bookingId);

            kyogongQuery = applyBranchFilter(kyogongQuery, req);
            const { data: tx } = await kyogongQuery.maybeSingle();
            if (tx) {
                res.json({
                    success: true,
                    data: {
                        type: 'kyogong',
                        order: {
                            id: tx.id,
                            order_number: tx.transaction_number,
                            guest_name: tx.customer_name || 'Walk-in',
                            status: tx.status,
                            service_category: tx.service_category,
                            items: tx.items?.map((item: any) => ({
                                name: item.item_name,
                                quantity: item.quantity,
                                price: item.unit_price,
                                total: item.total_price
                            }))
                        },
                        financials: {
                            total_amount: tx.total_amount,
                            amount_paid: tx.payment_method === 'BILL' ? 0 : tx.total_amount,
                            balance: tx.payment_method === 'BILL' ? tx.total_amount : 0,
                            currency: 'KES'
                        },
                        payment_status: tx.payment_method === 'BILL' ? 'unpaid' : 'paid'
                    }
                });
                return;
            }

            // 3. Check unpaid_bills (Manual)
            let billQuery = supabase.from('unpaid_bills').select('*').eq('id', bookingId);
            if (req.user?.branch_id) billQuery = billQuery.eq('branch_id', req.user.branch_id);
            const { data: bill } = await billQuery.maybeSingle();
            if (bill) {
                res.json({
                    success: true,
                    data: {
                        type: 'unpaid_bill',
                        bill_type: bill.bill_type,
                        revenue_type: bill.revenue_type || bill.bill_type,
                        bill: {
                            id: bill.id,
                            bill_number: bill.bill_number,
                            customer_name: bill.customer_name,
                            room_number: bill.room_number,
                            status: bill.status,
                            due_date: bill.due_date,
                            remarks: bill.remarks
                        },
                        financials: {
                            total_amount: bill.total_amount,
                            amount_paid: bill.paid_amount || 0,
                            balance: bill.balance_amount || (bill.total_amount - (bill.paid_amount || 0)),
                            currency: 'KES'
                        }
                    }
                });
                return;
            }

            // 4. Check accounting_ar_invoices
            const { data: arInvoice, error: arInvoiceError } = await supabase.from('accounting_ar_invoices')
                .select('*, customer:accounting_customers(id, customer_name, email, phone)')
                .eq('id', bookingId).maybeSingle();
            
            if (arInvoiceError) {
              console.error('Database error:', arInvoiceError);
              throw arInvoiceError;
            }
            if (arInvoice) {
                res.json({
                    success: true,
                    data: {
                        type: 'invoice',
                        source: 'accounting',
                        invoice: {
                            id: arInvoice.id,
                            invoice_number: arInvoice.invoice_number,
                            customer_name: arInvoice.customer?.customer_name || 'Walk-in',
                            status: arInvoice.status,
                            items: (arInvoice.items || []).map((item: any) => ({
                                name: item.description || item.item_name || 'Item',
                                quantity: item.quantity || item.qty || 1,
                                price: item.unit_price || item.unitPrice || 0,
                                total: item.total_amount || item.totalAmount || 0
                            }))
                        },
                        financials: {
                            total_amount: arInvoice.total_amount,
                            amount_paid: Number(arInvoice.total_amount) - Number(arInvoice.balance),
                            balance: arInvoice.balance,
                            currency: 'KES'
                        },
                        payment_status: arInvoice.status === 'paid' ? 'paid' : (arInvoice.balance < arInvoice.total_amount ? 'partial' : 'unpaid')
                    }
                });
                return;
            }

            // 5. Check finance_invoices
            const { data: finInvoice, error: finInvoiceError } = await supabase.from('finance_invoices').select('*').eq('id', bookingId).maybeSingle();
            if (finInvoiceError) {
              console.error('Database error:', finInvoiceError);
              throw finInvoiceError;
            }
            if (finInvoice) {
                res.json({
                    success: true,
                    data: {
                        type: 'invoice',
                        source: 'finance',
                        invoice: {
                            id: finInvoice.id,
                            invoice_number: finInvoice.invoice_number,
                            customer_name: finInvoice.customer_name || 'Walk-in',
                            status: finInvoice.status,
                            items: []
                        },
                        financials: {
                            total_amount: finInvoice.total_amount,
                            amount_paid: finInvoice.paid_amount || 0,
                            balance: Number(finInvoice.total_amount) - Number(finInvoice.paid_amount || 0),
                            currency: 'KES'
                        },
                        payment_status: finInvoice.status === 'paid' ? 'paid' : (finInvoice.paid_amount > 0 ? 'partial' : 'unpaid')
                    }
                });
                return;
            }
        }

        // Fallback: Check if it's a Room Number for an active (checked-in) booking
        let roomQuery = supabase
            .from('reservations')
            .select(`
                *,
                room:rooms!room_id!inner(number, branch_id, type:room_types(name, price))
            `)
            .eq('room.number', bookingId)
            .eq('status', 'checked_in');

        if (req.user?.branch_id) {
            roomQuery = roomQuery.eq('room.branch_id', req.user.branch_id);
        }

        const { data: roomBooking, error: roomError } = await roomQuery.maybeSingle();

        if (roomBooking) {
            await fetchHotelBillResponse(roomBooking, res);
            return;
        }

        throw new AppError('Bill or Booking not found', 404);

    } catch (error) {
        next(error);
    }
};

/**
 * Helper to fetch payments and return hotel bill response
 */
async function fetchHotelBillResponse(booking: any, res: Response): Promise<void> {
    // Fetch payments
    const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('booking_id', booking.id);

    if (paymentsError) {
        throw new AppError('Error fetching payments', 500);
    }

    // Calculate financials
    const totalAmount = booking.total_amount;
    const amountPaid = payments?.reduce((sum, p) => sum + (p.status === 'completed' ? Number(p.amount) : 0), 0) || 0;
    const balance = totalAmount - amountPaid;

    // Perform strict verification on all completed payments
    const verifications = [];
    if (payments) {
        for (const payment of payments) {
            if (payment.status === 'completed') {
                const result = await paymentVerificationService.verifyTransaction(payment.reference, Number(payment.amount));
                verifications.push({
                    reference: payment.reference,
                    amount: payment.amount,
                    verified: result.isValid,
                    message: result.message
                });
            }
        }
    }

    res.json({
        success: true,
        data: {
            type: 'hotel',
            booking: {
                id: booking.id,
                confirmation_number: booking.confirmation_number,
                guest_name: booking.guest_name,
                guest_phone: booking.guest_phone,
                room_number: booking.room?.number,
                room_type: booking.room?.type?.name,
                check_in: booking.check_in_date,
                check_out: booking.check_out_date,
                status: booking.status
            },
            financials: {
                total_amount: totalAmount,
                amount_paid: amountPaid,
                balance: balance,
                currency: 'KES'
            },
            payments: payments,
            verifications: verifications
        }
    });
}

/**
 * Links a completed payment to the cashier's active shift log (fire-and-forget)
 */
async function linkPaymentToActiveShift(
    cashierId: string,
    paymentId: string,
    paymentRef: string,
    paymentMethod: string,
    amount: number
): Promise<void> {
    try {
        const { data: shift } = await supabase
            .from('cashier_shift_logs')
            .select('id')
            .eq('cashier_id', cashierId)
            .eq('status', 'open')
            .single();

        if (!shift) return;

        const { error } = await supabase.from('cashier_shift_transactions').insert({
            shift_id: shift.id,
            transaction_id: paymentId,
            transaction_ref: paymentRef,
            payment_method: paymentMethod?.toUpperCase(),
            amount,
            transaction_time: new Date().toISOString()
        });


        if (error) {


          console.error('Database error:', error);


          throw error;


        }
    } catch {
        // Non-critical — don't fail the payment if shift linking fails
    }
}

/**
 * Process Manual/Cash Payment
 */
export const processCashierPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { bookingId, amount, method, reference } = req.body;

        if (!bookingId || !amount || !method) {
            throw new AppError('ID, amount, and method are required', 400);
        }

        const paymentRef = reference || `CASH-${Date.now()}`;

        // Check if it's an invoice (starts with INV)
        if (bookingId.startsWith('INV')) {
            // 1. Try fetching from accounting_ar_invoices first
            const { data: arInvoice, error: arError } = await supabase
                .from('accounting_ar_invoices')
                .select('id, total_amount, balance')
                .eq('invoice_number', bookingId)
                .single();

            let targetInvoice = null;
            let invoiceSource = '';

            if (!arError && arInvoice) {
                targetInvoice = arInvoice;
                invoiceSource = 'accounting';
            } else {
                // 2. Try fetching from finance_invoices
                const { data: finInvoice, error: finError } = await supabase
                    .from('finance_invoices')
                    .select('id, total_amount, paid_amount')
                    .eq('invoice_number', bookingId)
                    .single();

                if (finInvoice) {
                    // Normalize to common format for payment recording
                    targetInvoice = {
                        id: finInvoice.id,
                        total_amount: finInvoice.total_amount,
                        balance: Number(finInvoice.total_amount) - Number(finInvoice.paid_amount || 0)
                    };
                    invoiceSource = 'finance';
                }
            }

            if (!targetInvoice) {
                throw new AppError('Invoice not found in any ledger', 404);
            }

            // 3. Record Payment in Database
            const isVerifiedMethod = method === 'cash';
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            const paymentPayload: any = {
                amount: amount,
                currency: 'KES',
                payment_method: method,
                status: initialStatus,
                reference: paymentRef,
                metadata: {
                    processed_by: 'cashier',
                    cashier_id: req.user?.id,
                    processed_at: new Date().toISOString(),
                    invoice_number: bookingId,
                    invoice_source: invoiceSource,
                    verification_required: !isVerifiedMethod
                }
            };

            // Link to the correct ID column based on source
            if (invoiceSource === 'accounting') {
                paymentPayload.invoice_id = targetInvoice.id;
            } else {
                paymentPayload.bill_id = targetInvoice.id;
            }

            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert(paymentPayload)
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 4. Update Invoice Balance (Only if payment is completed)
            if (initialStatus === 'completed') {
                const currentBalance = Number(targetInvoice.balance);
                const paymentAmount = Number(amount);
                const newBalance = Math.max(0, currentBalance - paymentAmount);
                const isPaid = newBalance <= 0;
                const newStatus = isPaid ? 'paid' : 'partial';

                if (invoiceSource === 'accounting') {
                    const { error: invError } = await supabase
                        .from('accounting_ar_invoices')
                        .update({
                            balance: newBalance,
                            status: newStatus,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', targetInvoice.id);
                    if (invError) throw new AppError(`Failed to update AR invoice balance: ${invError.message}`, 500);
                } else {
                    const currentPaid = Number(targetInvoice.total_amount) - currentBalance;
                    const newPaidAmount = currentPaid + paymentAmount;
                    const { error: finError } = await supabase
                        .from('finance_invoices')
                        .update({
                            paid_amount: newPaidAmount,
                            status: newStatus,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', targetInvoice.id);
                    if (finError) throw new AppError(`Failed to update finance invoice status: ${finError.message}`, 500);
                }

                // Record cashier transaction
                const { error } = await supabase.from('cashier_transactions').insert({
                    transaction_number: `PAY-${Date.now()}`,
                    branch_id: req.user?.branch_id,
                    cashier_id: req.user?.id,
                    transaction_type: 'payment',
                    revenue_type: 'INVOICE_SETTLEMENT',
                    reference_type: invoiceSource === 'accounting' ? 'invoice' : 'finance_invoice',
                    reference_id: targetInvoice.id,
                    payment_method: method,
                    amount: amount,
                    customer_name: 'Invoice Customer'
                });

                if (error) {

                  console.error('Database error:', error);

                  throw error;

                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'Invoice payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a conference booking (starts with CNF)
        if (bookingId.startsWith('CNF')) {
            // 1. Fetch the conference booking by invoice_number
            const { data: booking, error: bookingError } = await supabase
                .from('conference_hall_bookings')
                .select('id, total_amount, amount_paid, branch_id, customer_name')
                .eq('invoice_number', bookingId)
                .single();

            if (bookingError || !booking) {
                throw new AppError('Conference booking not found', 404);
            }

            // 2. Record Payment in Database
            const isVerifiedMethod = method === 'cash';
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    conference_booking_id: booking.id,
                    amount: amount,
                    currency: 'KES',
                    payment_method: method,
                    status: initialStatus,
                    reference: paymentRef,
                    metadata: {
                        processed_by: 'cashier',
                        cashier_id: req.user?.id,
                        processed_at: new Date().toISOString(),
                        invoice_number: bookingId,
                        verification_required: !isVerifiedMethod
                    }
                })
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 3. Update Conference Booking Status (Only if payment is completed)
            if (initialStatus === 'completed') {
                const currentPaid = Number(booking.amount_paid || 0);
                const paymentAmount = Number(amount);
                const totalAmount = Number(booking.total_amount);

                const newPaidAmount = currentPaid + paymentAmount;
                const newBalance = Math.max(0, totalAmount - newPaidAmount);
                const isPaid = newBalance <= 0;
                const newStatus = isPaid ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'pending');

                const { error: updateError } = await supabase
                    .from('conference_hall_bookings')
                    .update({
                        amount_paid: newPaidAmount,
                        payment_status: newStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', booking.id);

                if (updateError) throw new AppError(`Failed to update conference booking status: ${updateError.message}`, 500);

                // Record cashier transaction
                const { error } = await supabase.from('cashier_transactions').insert({
                    transaction_number: `CNF-${bookingId}`,
                    branch_id: booking.branch_id || req.user?.branch_id,
                    cashier_id: req.user?.id,
                    transaction_type: 'payment',
                    revenue_type: 'CONFERENCE',
                    reference_type: 'conference_booking',
                    reference_id: booking.id,
                    payment_method: method,
                    amount: amount,
                    customer_name: booking.customer_name || 'Conference Client'
                });

                if (error) {

                  console.error('Database error:', error);

                  throw error;

                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'Conference payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a restaurant order
        if (bookingId.startsWith('ORD')) {
            // 1. Fetch the order ID (UUID) from order number
            const { data: order, error: orderError } = await supabase
                .from('restaurant_orders')
                .select('id, total_amount')
                .eq('order_number', bookingId)
                .single();

            if (orderError || !order) {
                throw new AppError('Restaurant order not found', 404);
            }

            // 2. Record Payment in Database
            const isVerifiedMethod = method === 'cash';
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    restaurant_order_id: order.id,
                    amount: amount,
                    currency: 'KES',
                    payment_method: method,
                    status: initialStatus,
                    reference: paymentRef,
                    metadata: {
                        processed_by: 'cashier',
                        cashier_id: req.user?.id,
                        processed_at: new Date().toISOString(),
                        order_number: bookingId,
                        verification_required: !isVerifiedMethod
                    }
                })
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 3. Update Restaurant Order Status (Only if payment is completed)
            if (initialStatus === 'completed') {
                // Re-fetch all COMPLETED payments for this order to check balance
                const { data: allPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('restaurant_order_id', order.id)
                    .eq('status', 'completed');

                const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

                if (totalPaid >= order.total_amount) {
                    await supabase
                        .from('restaurant_orders')
                        .update({
                            payment_status: 'paid',
                            status: 'delivered'
                        })
                        .eq('id', order.id);

                    // Auto-deduct ingredients
                    try {
                        const { data: orderWithItems } = await supabase
                            .from('restaurant_orders')
                            .select('*, items:restaurant_order_items(*)')
                            .eq('id', order.id)
                            .single();

                        if (orderWithItems && orderWithItems.items) {
                            for (const item of orderWithItems.items) {
                                await deductIngredientsForItem({
                                    order_id: orderWithItems.id,
                                    menu_item_id: item.menu_item_id,
                                    quantity: item.quantity,
                                    branch_id: orderWithItems.branch_id,
                                    user_id: req.user?.id
                                });
                            }
                            logger.info(`Ingredients auto-deducted for restaurant order ${orderWithItems.order_number}`);
                        }
                    } catch (deductError) {
                        logger.error(`Error in auto-deduction for restaurant order ${order.id}:`, deductError);
                    }
                } else if (totalPaid > 0) {
                    await supabase
                        .from('restaurant_orders')
                        .update({
                            payment_status: 'partial'
                        })
                        .eq('id', order.id);
                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'Restaurant payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a bar order
        if (bookingId.startsWith('BAR')) {
            // 1. Fetch the order ID (UUID) from order number
            const { data: order, error: orderError } = await supabase
                .from('bar_orders')
                .select('id, total')
                .eq('order_number', bookingId)
                .single();

            if (orderError || !order) {
                throw new AppError('Bar order not found', 404);
            }

            // 2. Record Payment in Database
            const isVerifiedMethod = method === 'cash';
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    bar_order_id: order.id,
                    amount: amount,
                    currency: 'KES',
                    payment_method: method,
                    status: initialStatus,
                    reference: paymentRef,
                    metadata: {
                        processed_by: 'cashier',
                        cashier_id: req.user?.id,
                        processed_at: new Date().toISOString(),
                        order_number: bookingId,
                        verification_required: !isVerifiedMethod
                    }
                })
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 3. Update Bar Order Status (Only if payment is completed)
            if (initialStatus === 'completed') {
                // Re-fetch all COMPLETED payments for this order to check balance
                const { data: allPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('bar_order_id', order.id)
                    .eq('status', 'completed');

                const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

                if (totalPaid >= order.total) {
                    await supabase
                        .from('bar_orders')
                        .update({
                            payment_status: 'paid',
                            status: 'completed'
                        })
                        .eq('id', order.id);
                } else if (totalPaid > 0) {
                    await supabase
                        .from('bar_orders')
                        .update({
                            payment_status: 'partial'
                        })
                        .eq('id', order.id);
                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'Bar payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a POS transaction
        if (bookingId.startsWith('CS-')) {
            // 1. Fetch the transaction from ref
            const { data: transaction, error: txError } = await supabase
                .from('pos_transactions')
                .select('*')
                .eq('transaction_ref', bookingId)
                .single();

            if (txError || !transaction) {
                throw new AppError('POS transaction not found', 404);
            }

            const isVerifiedMethod = method === 'cash';
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            // 2. Record Payment in Database
            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    pos_transaction_id: transaction.id,
                    amount: amount,
                    currency: 'KES',
                    payment_method: method,
                    status: initialStatus,
                    reference: paymentRef,
                    metadata: {
                        processed_by: 'cashier',
                        cashier_id: req.user?.id,
                        processed_at: new Date().toISOString(),
                        transaction_ref: bookingId
                    }
                })
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 3. Update Transaction Status if completed
            if (initialStatus === 'completed') {
                await supabase
                    .from('pos_transactions')
                    .update({
                        status: 'PAID',
                        payment_method: method.toUpperCase(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', transaction.id);

                // Record legacy transaction for logbook
                const { error } = await supabase.from('cashier_transactions').insert({
                    transaction_number: `POS-${transaction.transaction_ref}`,
                    branch_id: transaction.branch_id,
                    cashier_id: req.user?.id,
                    transaction_type: 'payment',
                    revenue_type: 'POS_SALE',
                    reference_type: 'pos_transaction',
                    reference_id: transaction.id,
                    payment_method: method,
                    amount: amount,
                    customer_name: transaction.customer_name
                });

                if (error) {

                  console.error('Database error:', error);

                  throw error;

                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'POS payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a Kyogong Shift Transaction
        const kyogongPattern = /^[A-Z]+-\d{8}-\d{4}$/;
        if (kyogongPattern.test(bookingId.toString()) || bookingId.toString().includes('-202')) {
            const { data: transaction, error: txError } = await supabase
                .from('shift_transactions')
                .select('*')
                .eq('transaction_number', bookingId)
                .single();

            if (!txError && transaction) {
                const isVerifiedMethod = method === 'cash';
                const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

                // 2. Record Payment
                const { data: payment, error: paymentError } = await supabase
                    .from('payments')
                    .insert({
                        kyogong_transaction_id: transaction.id, // We need to ensure this column exists or use metadata
                        amount: amount,
                        currency: 'KES',
                        payment_method: method,
                        status: initialStatus,
                        reference: paymentRef,
                        metadata: {
                            processed_by: 'cashier',
                            cashier_id: req.user?.id,
                            processed_at: new Date().toISOString(),
                            transaction_number: bookingId,
                            source: 'kyogong'
                        }
                    })
                    .select()
                    .single();

                if (paymentError) {
                    throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
                }

                if (initialStatus === 'completed') {
                    // Update Kyogong transaction status
                    await supabase
                        .from('shift_transactions')
                        .update({
                            payment_method: method.toUpperCase(),
                            cash_amount: method === 'cash' ? amount : 0,
                            mpesa_amount: method === 'mpesa' ? amount : 0,
                            card_amount: method === 'card' ? amount : 0
                        })
                        .eq('id', transaction.id);

                    // Record cashier transaction
                    const { error } = await supabase.from('cashier_transactions').insert({
                        transaction_number: `KYG-${transaction.transaction_number}`,
                        branch_id: transaction.branch_id,
                        cashier_id: req.user?.id,
                        transaction_type: 'payment',
                        revenue_type: 'KYOGONG_SALE',
                        reference_type: 'kyogong_transaction',
                        reference_id: transaction.id,
                        payment_method: method,
                        amount: amount,
                        customer_name: transaction.customer_name || 'Walk-in'
                    });

                    if (error) {

                      console.error('Database error:', error);

                      throw error;

                    }
                }

                await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
                res.json({
                    success: true,
                    message: 'Kyogong payment processed successfully',
                    data: payment
                });
                return;
            }
        }

        // Check if it's an unpaid bill (starts with BILL, CON, POL, CWS)
        const otherPrefixes = ['CON', 'POL', 'CWS', 'BILL'];
        const billPrefix = otherPrefixes.find(p => bookingId.toString().startsWith(p));

        if (billPrefix) {
            // 1. Fetch the bill
            const { data: bill, error: billError } = await supabase
                .from('unpaid_bills')
                .select('*')
                .eq('bill_number', bookingId)
                .single();

            if (billError || !bill) {
                throw new AppError('Bill not found', 404);
            }

            const isVerifiedMethod = method === 'cash';
            const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

            // 2. Record Payment in Database
            const { data: payment, error: paymentError } = await supabase
                .from('payments')
                .insert({
                    bill_id: bill.id,
                    amount: amount,
                    currency: 'KES',
                    payment_method: method,
                    status: initialStatus,
                    reference: paymentRef,
                    metadata: {
                        processed_by: 'cashier',
                        cashier_id: req.user?.id,
                        processed_at: new Date().toISOString(),
                        bill_number: bookingId,
                        bill_type: bill.bill_type
                    }
                })
                .select()
                .single();

            if (paymentError) {
                throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
            }

            // 3. Update Bill status and balance if completed
            if (initialStatus === 'completed') {
                const currentPaid = Number(bill.paid_amount || 0);
                const paymentAmount = Number(amount);
                const totalAmount = Number(bill.total_amount);

                const newPaidAmount = currentPaid + paymentAmount;
                const newBalance = Math.max(0, totalAmount - newPaidAmount);
                const newStatus = newBalance <= 0 ? 'paid' : 'partial';

                const { error: updateError } = await supabase
                    .from('unpaid_bills')
                    .update({
                        paid_amount: newPaidAmount,
                        balance_amount: newBalance,
                        status: newStatus,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', bill.id);

                if (updateError) throw new AppError(`Failed to update bill status: ${updateError.message}`, 500);

                // Record cashier transaction
                const { error } = await supabase.from('cashier_transactions').insert({
                    transaction_number: `BILL-${bill.bill_number}`,
                    branch_id: bill.branch_id,
                    cashier_id: req.user?.id,
                    transaction_type: 'payment',
                    revenue_type: bill.revenue_type || 'GENERAL_SERVICE',
                    reference_type: 'unpaid_bill',
                    reference_id: bill.id,
                    payment_method: method,
                    amount: amount,
                    customer_name: bill.customer_name
                });

                if (error) {

                  console.error('Database error:', error);

                  throw error;

                }
            }

            await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
            res.json({
                success: true,
                message: 'Bill payment processed successfully',
                data: payment
            });
            return;
        }

        // Check if it's a hotel booking (starts with HTL)
        let resolvedBookingId = bookingId;
        if (bookingId.toString().startsWith('HTL')) {
            const { data: resv, error: resvError } = await supabase
                .from('reservations')
                .select('id')
                .eq('confirmation_number', bookingId)
                .single();

            if (resvError || !resv) {
                throw new AppError('Hotel reservation not found', 404);
            }
            resolvedBookingId = resv.id;
        }

        // 1. Record Payment in Database
        const isVerifiedMethod = method === 'cash';
        const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                booking_id: resolvedBookingId,
                amount: amount,
                currency: 'KES',
                payment_method: method,
                status: initialStatus,
                reference: paymentRef,
                metadata: {
                    processed_by: 'cashier',
                    cashier_id: req.user?.id,
                    processed_at: new Date().toISOString(),
                    verification_required: !isVerifiedMethod,
                    original_id: bookingId
                }
            })
            .select()
            .single();

        if (paymentError) {
            throw new AppError(`Payment recording failed: ${paymentError.message}`, 500);
        }

        // 2. Update Booking Status (if fully paid and payment is completed)
        if (initialStatus === 'completed') {
            const { data: booking } = await supabase
                .from('reservations')
                .select('total_amount')
                .eq('id', resolvedBookingId)
                .single();

            const { data: allPayments } = await supabase
                .from('payments')
                .select('amount')
                .eq('booking_id', resolvedBookingId)
                .eq('status', 'completed');

            const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

            if (booking && totalPaid >= booking.total_amount) {
                await supabase
                    .from('reservations')
                    .update({
                        payment_status: 'paid',
                        deposit_paid: true
                    })
                    .eq('id', resolvedBookingId);
            }
        }

        await linkPaymentToActiveShift(req.user?.id!, payment.id, paymentRef, method, Number(amount));
        res.json({
            success: true,
            message: 'Hotel payment processed successfully',
            data: payment
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Verify a pending payment
 */
export const verifyPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { paymentId } = req.params;
        const { status, notes } = req.body; // status: 'completed' or 'failed'

        if (!paymentId || !status) {
            throw new AppError('Payment ID and status are required', 400);
        }

        if (!['completed', 'failed'].includes(status)) {
            throw new AppError('Invalid status. Must be completed or failed', 400);
        }

        // 1. Get current payment
        const { data: payment, error: fetchError } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();

        if (fetchError || !payment) {
            throw new AppError('Payment not found', 404);
        }

        if (payment.status === 'completed') {
            throw new AppError('Payment is already verified', 400);
        }

        // 2. Update payment status
        const { data: updatedPayment, error: updateError } = await supabase
            .from('payments')
            .update({
                status: status,
                metadata: {
                    ...payment.metadata,
                    verified_by: req.user?.id,
                    verified_at: new Date().toISOString(),
                    verification_notes: notes
                },
                updated_at: new Date().toISOString()
            })
            .eq('id', paymentId)
            .select()
            .single();

        if (updateError) {
            throw new AppError(`Verification failed: ${updateError.message}`, 500);
        }

        // 3. If verified (completed), update related entity status
        if (status === 'completed') {
            // Hotel Booking
            if (payment.booking_id) {
                const { data: booking } = await supabase
                    .from('reservations')
                    .select('total_amount')
                    .eq('id', payment.booking_id)
                    .single();

                const { data: allPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('booking_id', payment.booking_id)
                    .eq('status', 'completed');

                const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

                if (booking && totalPaid >= booking.total_amount) {
                    await supabase
                        .from('reservations')
                        .update({
                            payment_status: 'paid',
                            deposit_paid: true
                        })
                        .eq('id', payment.booking_id);
                }
            }
            // Restaurant Order
            else if (payment.restaurant_order_id) {
                const { data: order } = await supabase
                    .from('restaurant_orders')
                    .select('total_amount')
                    .eq('id', payment.restaurant_order_id)
                    .single();

                const { data: allPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('restaurant_order_id', payment.restaurant_order_id)
                    .eq('status', 'completed');

                const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

                if (order && totalPaid >= order.total_amount) {
                    await supabase
                        .from('restaurant_orders')
                        .update({ payment_status: 'paid', status: 'delivered' })
                        .eq('id', payment.restaurant_order_id);
                } else if (totalPaid > 0) {
                    await supabase
                        .from('restaurant_orders')
                        .update({ payment_status: 'partial' })
                        .eq('id', payment.restaurant_order_id);
                }
            }
            // Bar Order
            else if (payment.bar_order_id) {
                const { data: order } = await supabase
                    .from('bar_orders')
                    .select('total')
                    .eq('id', payment.bar_order_id)
                    .single();

                const { data: allPayments } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('bar_order_id', payment.bar_order_id)
                    .eq('status', 'completed');

                const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

                if (order && totalPaid >= order.total) {
                    await supabase
                        .from('bar_orders')
                        .update({
                            payment_status: 'paid',
                            status: 'completed'
                        })
                        .eq('id', payment.bar_order_id);
                } else if (totalPaid > 0) {
                    await supabase
                        .from('bar_orders')
                        .update({ payment_status: 'partial' })
                        .eq('id', payment.bar_order_id);
                }
            }
            // POS Transaction
            else if (payment.pos_transaction_id) {
                await supabase
                    .from('pos_transactions')
                    .update({ status: 'PAID' })
                    .eq('id', payment.pos_transaction_id);
            }
            // Kyogong Transaction
            else if (payment.kyogong_transaction_id) {
                const method = payment.payment_method?.toLowerCase() || 'cash';
                await supabase
                    .from('shift_transactions')
                    .update({
                        payment_method: method.toUpperCase(),
                        cash_amount: method === 'cash' ? payment.amount : 0,
                        mpesa_amount: method === 'mpesa' ? payment.amount : 0,
                        card_amount: method === 'card' ? payment.amount : 0,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', payment.kyogong_transaction_id);
            }
            // Accounting AR Invoice
            else if (payment.invoice_id) {
                const { data: inv } = await supabase
                    .from('accounting_ar_invoices')
                    .select('total_amount, balance')
                    .eq('id', payment.invoice_id)
                    .single();

                if (inv) {
                    const currentBalance = Number(inv.balance);
                    const paymentAmount = Number(payment.amount);
                    const newBalance = Math.max(0, currentBalance - paymentAmount);

                    const { error: arError } = await supabase
                        .from('accounting_ar_invoices')
                        .update({
                            balance: newBalance,
                            status: newBalance <= 0 ? 'paid' : 'partial',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', payment.invoice_id);
                    if (arError) throw new AppError(`Failed to update AR invoice status: ${arError.message}`, 500);
                }
            }
            // Unpaid Bill or Finance Invoice
            else if (payment.bill_id) {
                // Try finance_invoices first
                const { data: finInv } = await supabase
                    .from('finance_invoices')
                    .select('total_amount, paid_amount')
                    .eq('id', payment.bill_id)
                    .single();

                if (finInv) {
                    const currentPaid = Number(finInv.paid_amount || 0);
                    const paymentAmount = Number(payment.amount);
                    const totalAmount = Number(finInv.total_amount);
                    const newPaid = currentPaid + paymentAmount;

                    const { error: finError } = await supabase
                        .from('finance_invoices')
                        .update({
                            paid_amount: newPaid,
                            status: newPaid >= totalAmount ? 'paid' : 'partial',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', payment.bill_id);
                    if (finError) throw new AppError(`Failed to update finance invoice status: ${finError.message}`, 500);
                } else {
                    // Try unpaid_bills
                    const { data: bill } = await supabase
                        .from('unpaid_bills')
                        .select('total_amount, paid_amount')
                        .eq('id', payment.bill_id)
                        .single();

                    if (bill) {
                        const currentPaid = Number(bill.paid_amount || 0);
                        const paymentAmount = Number(payment.amount);
                        const totalAmount = Number(bill.total_amount);

                        const newPaidAmount = currentPaid + paymentAmount;
                        const newBalance = Math.max(0, totalAmount - newPaidAmount);

                        const { error: billError } = await supabase
                            .from('unpaid_bills')
                            .update({
                                paid_amount: newPaidAmount,
                                balance_amount: newBalance,
                                status: newBalance <= 0 ? 'paid' : 'partial',
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', payment.bill_id);
                        if (billError) throw new AppError(`Failed to update bill status: ${billError.message}`, 500);
                    }
                }
            }
        }

        res.json({
            success: true,
            message: `Payment ${status} successfully`,
            data: updatedPayment
        });

    } catch (error) {
        next(error);
    }
};

// ============================================
// UNPAID BILLS MANAGEMENT
// ============================================

/**
 * Get all unpaid bills
 */
export const getUnpaidBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, status, customer_type, bill_type } = req.query;

        const userRole = (req.user as any)?.role?.toLowerCase() || '';
        const isGlobal = isGlobalRole(userRole);

        // Prioritize branch_id from query only if global
        let queryBranchId = branch_id ? parseInt(branch_id as string) : null;
        let effectiveBranchId = isGlobal ? queryBranchId : ((req.user as any)?.branch_id || 1);

        // Define roles that should see EVERYTHING (Hotel, Invoices, All Branches potentially)
        // Usually, these roles only see "Everything in THEIR branch" unless they are super_admin.
        const fullAccessRoles = [
            'super_admin', 'general_manager', 'accountant', 'branch_accountant',
            'auditor', 'receptionist', 'front_desk_supervisor', 'kyogong_reception_cashier'
        ];

        const hasFullAccess = fullAccessRoles.includes(userRole);

        // Fetch Unpaid POS Shift Transactions (Kyogong)
        // EVERYONE sees these if they match the branch
        let shiftQuery = supabase
            .from('shift_transactions')
            .select(`
                *,
                branch:branches!shift_transactions_branch_id_fkey(name)
            `)
            .eq('payment_method', 'BILL')
            .eq('is_voided', false)
            .order('created_at', { ascending: false });

        if (effectiveBranchId) {
            shiftQuery = shiftQuery.eq('branch_id', effectiveBranchId);
        }

        const { data: shiftTransactions, error: shiftError } = await shiftQuery;
        if (shiftError) throw shiftError;

        // Map Kyogong bills (shift_transactions) to unpaid_bills format
        const mappedKyogong = (shiftTransactions || []).map(tx => ({
            id: tx.id,
            bill_number: tx.transaction_number,
            bill_date: tx.created_at,
            source_type: 'KYOGONG',
            customer_name: tx.customer_name || 'Guest',
            total_amount: tx.total_amount,
            paid_amount: 0,
            balance_amount: tx.total_amount,
            status: 'unpaid',
            branch_name: tx.branch?.name,
            description: `POS Transaction: ${tx.service_category || 'Items'}`,
            is_kyogong: true
        }));

        let combinedData: any[] = [...mappedKyogong];

        // ONLY full access roles see the rest (Hotel, Invoices, Manual Bills)
        if (hasFullAccess) {
            // Fetch Manual Unpaid Bills
            let query = supabase
                .from('unpaid_bills')
                .select('*')
                .order('bill_date', { ascending: false });

            if (effectiveBranchId) {
                query = query.eq('branch_id', effectiveBranchId);
            }

            if (status) {
                query = query.eq('status', status);
            } else {
                query = query.neq('status', 'paid');
            }

            if (customer_type) {
                query = query.eq('customer_type', customer_type as string);
            }

            if (bill_type) {
                query = query.eq('bill_type', bill_type as string);
            }

            const { data: unpaidBills, error: billsError } = await query;
            if (billsError) throw billsError;

            // Fetch Unpaid Hotel Reservations
            // Hotel reservations might have `branch_id = null`, but the attached room has the real branch.
            // We must query the rooms table to filter correctly.
            let hotelQuery = supabase
                .from('reservations')
                .select(`
                    *,
                    room:rooms!inner(branch_id)
                `)
                .in('status', ['confirmed', 'checked_in'])
                .order('created_at', { ascending: false });

            if (effectiveBranchId) {
                // Filter by the joined room's branch_id
                hotelQuery = hotelQuery.eq('room.branch_id', effectiveBranchId);
            }

            const { data: hotelReservations, error: hotelError } = await hotelQuery;
            if (hotelError) throw hotelError;

            // Map Hotel Reservations to unpaid_bills format
            const mappedHotel = (hotelReservations || []).map(resv => ({
                id: resv.id,
                bill_number: resv.confirmation_number,
                branch_id: resv.room?.branch_id,
                bill_type: 'hotel',
                customer_name: resv.guest_name,
                total_amount: resv.total_amount,
                paid_amount: resv.advance_payment || 0,
                balance_amount: Number(resv.total_amount) - Number(resv.advance_payment || 0),
                bill_date: resv.created_at,
                status: resv.status,
                is_hotel: true
            })).filter(h => h.balance_amount > 0);

            // Fetch Unpaid Finance Invoices
            let financeInvoiceQuery = supabase
                .from('finance_invoices')
                .select('*')
                .neq('status', 'paid')
                .order('created_at', { ascending: false });

            if (effectiveBranchId) {
                financeInvoiceQuery = financeInvoiceQuery.eq('branch_id', effectiveBranchId);
            }

            const { data: financeInvoices } = await financeInvoiceQuery;

            // Map Finance Invoices
            const mappedFinance = (financeInvoices || []).map(inv => ({
                id: inv.id,
                bill_number: inv.invoice_number,
                branch_id: inv.branch_id,
                bill_type: 'finance_invoice',
                customer_name: inv.customer_name || 'Guest',
                total_amount: inv.total_amount,
                paid_amount: inv.paid_amount || 0,
                balance_amount: Number(inv.total_amount) - Number(inv.paid_amount || 0),
                bill_date: inv.created_at,
                status: inv.status,
                is_invoice: true
            }));

            // Fetch Unpaid Accounting AR Invoices
            let arInvoiceQuery = supabase
                .from('accounting_ar_invoices')
                .select('*')
                .neq('status', 'paid')
                .order('created_at', { ascending: false });

            const { data: arInvoices, error: arInvoiceError } = await arInvoiceQuery;
            if (arInvoiceError) throw arInvoiceError;

            // Map AR Invoices
            const mappedAR = (arInvoices || []).map(inv => ({
                id: inv.id,
                bill_number: inv.invoice_number,
                branch_id: inv.branch_id,
                bill_type: 'ar_invoice',
                customer_name: inv.notes || 'AR Invoice',
                total_amount: inv.total_amount,
                paid_amount: Number(inv.total_amount) - Number(inv.balance),
                balance_amount: inv.balance,
                bill_date: inv.created_at,
                status: inv.status,
                is_invoice: true
            }));

            // Combine all full access data
            combinedData = [
                ...combinedData,
                ...(unpaidBills || []),
                ...mappedHotel,
                ...mappedFinance,
                ...mappedAR
            ];
        }

        // Sort final combined data
        combinedData.sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime());


        res.json({
            success: true,
            message: 'Unpaid bills retrieved successfully',
            data: combinedData
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create unpaid bill
 */
export const createUnpaidBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            branch_id,
            bill_type,
            reference_type,
            reference_id,
            customer_type,
            customer_id,
            customer_name,
            room_number,
            waiter_id,
            total_amount,
            payment_terms,
            due_date,
            remarks,
            items
        } = req.body;

        // Generate bill number
        const { data: billNumberData } = await supabase
            .rpc('generate_bill_number');

        const bill_number = billNumberData || `BILL${Date.now()}`;
        const normalizedBillNumber = String(bill_number).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const scan_reference = `CCB-${normalizedBillNumber}`;

        const { data, error } = await supabase
            .from('unpaid_bills')
            .insert({
                bill_number,
                branch_id,
                bill_type,
                reference_type,
                reference_id,
                customer_type,
                customer_id,
                customer_name,
                room_number,
                waiter_id,
                total_amount,
                balance_amount: total_amount,
                payment_terms,
                due_date,
                remarks,
                items: items || [],
                scan_reference,
                status: 'unpaid',
                created_by: req.user?.id
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Unpaid bill created successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Record payment for unpaid bill
 */
export const recordBillPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { payment_amount, payment_method, payment_reference } = req.body;

        // Fetch current bill
        const { data: bill, error: fetchError } = await supabase
            .from('unpaid_bills')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!bill) {
            throw new AppError('Bill not found', 404);
        }

        // Calculate new paid amount
        const new_paid_amount = (bill.paid_amount || 0) + payment_amount;
        const new_balance = bill.total_amount - new_paid_amount;

        // Update bill — mark as paid when balance reaches zero
        const isFullyPaid = new_balance <= 0;
        const { data: updatedBill, error: updateError } = await supabase
            .from('unpaid_bills')
            .update({
                paid_amount: new_paid_amount,
                balance_amount: Math.max(0, new_balance),
                ...(isFullyPaid ? { status: 'paid', paid_at: new Date().toISOString() } : {})
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Record cashier transaction
        const { data: transactionData } = await supabase
            .rpc('generate_cashier_transaction_number');

        const transaction_number = transactionData || `CT${Date.now()}`;

        await supabase
            .from('cashier_transactions')
            .insert({
                transaction_number,
                branch_id: bill.branch_id,
                cashier_id: req.user?.id,
                transaction_type: 'payment',
                revenue_type: bill.bill_type,
                reference_type: 'unpaid_bill',
                reference_id: bill.id,
                payment_method,
                amount: payment_amount,
                payment_reference,
                customer_name: bill.customer_name
            });

        res.json({
            success: true,
            message: 'Payment recorded successfully',
            data: updatedBill
        });
    } catch (error) {
        next(error);
    }
};

export const downloadCustomerCreditInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            throw new AppError('Bill id is required', 400);
        }

        const { data: bill, error: fetchError } = await supabase
            .from('unpaid_bills')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !bill) {
            throw new AppError('Customer credit bill not found', 404);
        }

        let branchName: string | null = null;
        let branchLocation: string | null = null;

        if (bill.branch_id) {
            const { data: branch } = await supabase
                .from('branches')
                .select('name, location, address')
                .eq('id', bill.branch_id)
                .maybeSingle();

            if (branch) {
                branchName = branch.name || null;
                branchLocation = branch.location || branch.address || null;
            }
        }

        const itemsArray = Array.isArray(bill.items) ? bill.items : [];

        const normalizedItems = itemsArray.map((item: any, index: number) => {
            const quantity = Number(item?.quantity ?? item?.qty ?? 0) || 0;
            const unitPrice = Number(item?.unitPrice ?? item?.unit_price ?? item?.price ?? 0) || 0;
            const total = Number(item?.total ?? item?.total_amount ?? quantity * unitPrice) || 0;

            return {
                description: item?.description || item?.name || `Item ${index + 1}`,
                quantity,
                unit_price: unitPrice,
                total
            };
        });

        const invoiceNumber = bill.bill_number || bill.id;
        const formatDate = (value?: string | null) => {
            if (!value) return undefined;
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return undefined;
            return parsed.toISOString().split('T')[0];
        };

        const invoicePayload = {
            invoice_number: invoiceNumber,
            invoice_date: formatDate(bill.bill_date) || new Date().toISOString().split('T')[0],
            due_date: formatDate(bill.due_date),
            status: (bill.status || 'pending').toUpperCase(),
            customer_name: bill.customer_name || 'Customer',
            customer_address: branchName ? `${branchName}${branchLocation ? ' • ' + branchLocation : ''}` : 'FamousGate Hotels',
            customer_phone: bill.customer_phone || '',
            items: normalizedItems,
            tax_rate: Number(bill.tax_rate || 0) || 0,
            notes: bill.remarks || 'Thank you for your business.',
            terms: bill.payment_terms || 'Payment due upon receipt.',
            reference_code: bill.scan_reference || invoiceNumber
        };

        const pythonResponse = await axios.post(
            `${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf`,
            {
                reportType: 'invoice',
                data: invoicePayload,
                filters: {
                    branch_name: branchName || undefined,
                    branch_id: bill.branch_id || undefined,
                    bill_number: bill.bill_number || undefined,
                    scan_reference: bill.scan_reference || undefined
                },
                useRealData: false
            },
            { responseType: 'arraybuffer' }
        );

        const filename = `${invoiceNumber || 'Invoice'}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.from(pythonResponse.data).length.toString());
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(Buffer.from(pythonResponse.data));
    } catch (error: any) {
        if (axios.isAxiosError(error)) {
            logger.error('Failed to generate branded invoice PDF', error);
            return next(new AppError('Unable to generate invoice PDF at this time', 502));
        }
        next(error);
    }
};

export const downloadCustomerCreditOutstandingReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id: branchIdParam, search: searchParam } = req.query;
        const userBranchId = (req.user as any)?.branch_id;

        let branchId: number | null = null;
        if (branchIdParam) {
            const parsed = parseInt(branchIdParam as string, 10);
            if (!Number.isNaN(parsed)) {
                branchId = parsed;
            }
        } else if (userBranchId) {
            branchId = Number(userBranchId);
        }

        if (!branchId) {
            throw new AppError('Branch id is required to generate the report', 400);
        }

        const searchTerm = (searchParam as string)?.trim().toLowerCase() || '';

        const { data: branch } = await supabase
            .from('branches')
            .select('name, location, address')
            .eq('id', branchId)
            .maybeSingle();

        const { data: billsData, error: billsError } = await supabase
            .from('unpaid_bills')
            .select('*')
            .eq('branch_id', branchId)
            .neq('status', 'paid')
            .order('bill_date', { ascending: false });

        if (billsError) throw billsError;

        const relevantBills = (billsData || []).filter((bill: any) => {
            if (!bill) return false;
            if (bill.source_type === 'KYOGONG') return false;
            const refType = (bill.reference_type || '').toLowerCase();
            const allowed = !refType || refType === 'branch_customer_credit';
            if (!allowed) return false;
            if (!searchTerm) return true;
            const billNumber = (bill.bill_number || '').toLowerCase();
            const customerName = (bill.customer_name || '').toLowerCase();
            const referenceCode = (bill.scan_reference || '').toLowerCase();
            return (
                customerName.includes(searchTerm) ||
                billNumber.includes(searchTerm) ||
                referenceCode.includes(searchTerm)
            );
        });

        if (!relevantBills.length) {
            throw new AppError('No outstanding customer credit bills found for the selected branch', 404);
        }

        const formatDate = (value?: string | null) => {
            if (!value) return null;
            const parsed = new Date(value);
            if (Number.isNaN(parsed.getTime())) return null;
            return parsed.toISOString().split('T')[0];
        };

        const normalizedBills = relevantBills.map((bill: any, index: number) => {
            const itemsArray = Array.isArray(bill.items) ? bill.items : [];
            const normalizedItems = itemsArray.map((item: any, itemIndex: number) => {
                const quantity = Number(item?.quantity ?? item?.qty ?? 0) || 0;
                const unitPrice = Number(item?.unitPrice ?? item?.unit_price ?? item?.price ?? 0) || 0;
                const total = Number(item?.total ?? item?.total_amount ?? quantity * unitPrice) || 0;

                return {
                    position: itemIndex + 1,
                    description: item?.description || item?.name || `Item ${itemIndex + 1}`,
                    quantity,
                    unit_price: unitPrice,
                    total,
                };
            });

            const paidAmount = Number(bill.paid_amount || 0);
            const totalAmount = Number(bill.total_amount || 0);
            const balanceAmount = Number(bill.balance_amount ?? totalAmount - paidAmount);

            return {
                position: index + 1,
                customer_name: bill.customer_name || 'Customer',
                invoice_number: bill.bill_number || bill.id,
                reference_code: bill.scan_reference || bill.bill_number || bill.id,
                status: (bill.status || 'pending').toUpperCase(),
                bill_date: formatDate(bill.bill_date) || formatDate(bill.created_at),
                due_date: formatDate(bill.due_date),
                payment_terms: bill.payment_terms || 'N/A',
                outstanding_amount: balanceAmount,
                total_amount: totalAmount,
                paid_amount: paidAmount,
                customer_phone: bill.customer_phone || null,
                remarks: bill.remarks || null,
                items: normalizedItems,
            };
        });

        const totalOutstanding = normalizedBills.reduce((sum, bill) => sum + (bill.outstanding_amount || 0), 0);
        const totalAmount = normalizedBills.reduce((sum, bill) => sum + (bill.total_amount || 0), 0);
        const uniqueCustomers = new Set(normalizedBills.map(bill => bill.customer_name || bill.invoice_number)).size;

        const payload = {
            generated_at: new Date().toISOString(),
            branch: {
                name: branch?.name || `Branch ${branchId}`,
                location: branch?.location || branch?.address || null,
            },
            summary: {
                total_bills: normalizedBills.length,
                unique_customers: uniqueCustomers,
                total_outstanding: totalOutstanding,
                total_amount: totalAmount,
            },
            bills: normalizedBills,
        };

        const pythonResponse = await axios.post(
            `${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf`,
            {
                reportType: 'customer_credit_outstanding',
                data: payload,
                filters: {
                    branch_id: branchId,
                    branch_name: branch?.name || undefined,
                    total_bills: payload.summary.total_bills,
                },
                useRealData: false,
            },
            { responseType: 'arraybuffer' }
        );

        const filename = `Outstanding_Customer_Credits_${new Date().toISOString().split('T')[0]}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.from(pythonResponse.data).length.toString());
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(Buffer.from(pythonResponse.data));
    } catch (error) {
        if (axios.isAxiosError(error)) {
            logger.error('Failed to generate outstanding customer credit PDF', error);
            return next(new AppError('Unable to generate outstanding credits PDF at this time', 502));
        }
        next(error);
    }
};

/**
 * Accountant/Auditor confirm unpaid bill
 */
export const confirmUnpaidBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { role } = req.body; // 'accountant' or 'auditor'

        // 1. Fetch current bill
        const { data: bill, error: fetchError } = await supabase
            .from('unpaid_bills')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !bill) {
            throw new AppError('Bill not found', 404);
        }

        const updateData: any = {};
        if (role === 'accountant') {
            if (bill.accountant_confirmed_at) {
                throw new AppError('Bill already confirmed by accountant', 400);
            }
            updateData.accountant_confirmed_at = new Date().toISOString();
            updateData.accountant_id = req.user?.id;
        } else if (role === 'auditor') {
            if (bill.auditor_confirmed_at) {
                throw new AppError('Bill already confirmed by auditor', 400);
            }
            // Optional: require accountant confirmation first
            // if (!bill.accountant_confirmed_at) throw new AppError('Accountant confirmation required first', 400);

            updateData.auditor_confirmed_at = new Date().toISOString();
            updateData.auditor_id = req.user?.id;
        } else {
            throw new AppError('Invalid role for confirmation. Use accountant or auditor', 400);
        }

        const { data, error } = await supabase
            .from('unpaid_bills')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: `Bill confirmed by ${role} successfully`,
            data
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// CREDIT BILLS MANAGEMENT
// ============================================

/**
 * Get all credit bills
 */
export const getCreditBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, staff_id, status, approval_status, bill_type } = req.query;
        console.log('GET /api/cashier/credit-bills - Executing raw SQL fix');

        let queryStr = 'SELECT * FROM public.credit_bills WHERE 1=1';
        const params: any[] = [];

        const isGlobal = isGlobalRole(req.user?.role);
        const effectiveBranchId = isGlobal ? 
            (branch_id ? parseInt(branch_id as string) : null) : 
            req.user?.branch_id;

        if (effectiveBranchId) {
            params.push(effectiveBranchId);
            queryStr += ` AND branch_id = $${params.length}`;
        }

        if (staff_id) {
            params.push(staff_id as string);
            queryStr += ` AND staff_id = $${params.length}`;
        }

        if (status) {
            params.push(status as string);
            queryStr += ` AND status = $${params.length}`;
        }

        if (approval_status) {
            params.push(approval_status as string);
            queryStr += ` AND approval_status = $${params.length}`;
        }

        if (bill_type) {
            params.push(bill_type as string);
            queryStr += ` AND bill_type = $${params.length}`;
        }

        queryStr += ' ORDER BY credit_date DESC';
        const { rows } = await db.query(queryStr, params);

        res.json({
            success: true,
            message: 'Credit bills retrieved successfully',
            data: rows
        });
    } catch (error) {
        console.error('Error in getCreditBills (Raw SQL fix):', error);
        next(error);
    }
};

/**
 * Get all loans (bill_type = 'loan')
 */
export const getLoans = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, staff_id, status } = req.query;

        let query = supabase
            .from('credit_bills')
            .select('*')
            .eq('bill_type', 'loan')
            .order('credit_date', { ascending: false });

        query = applyBranchFilter(query, req);
        const isGlobal = isGlobalRole(req.user?.role);

        if (isGlobal && branch_id) {
            query = query.eq('branch_id', parseInt(branch_id as string));
        }

        if (staff_id) {
            query = query.eq('staff_id', staff_id as string);
        }

        if (status) {
            query = query.eq('status', status as string);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            message: 'Loans retrieved successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all salary advances (bill_type = 'advance' or 'salary_advance')
 */
export const getAdvances = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, staff_id, status } = req.query;

        let query = supabase
            .from('credit_bills')
            .select('*')
            .or('bill_type.eq.advance,bill_type.eq.salary_advance')
            .order('credit_date', { ascending: false });

        query = applyBranchFilter(query, req);
        const isGlobal = isGlobalRole(req.user?.role);

        if (isGlobal && branch_id) {
            query = query.eq('branch_id', parseInt(branch_id as string));
        }

        if (staff_id) {
            query = query.eq('staff_id', staff_id as string);
        }

        if (status) {
            query = query.eq('status', status as string);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            message: 'Salary advances retrieved successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Create credit bill
 */
export const createCreditBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            branch_id,
            staff_id,
            staff_name,
            employee_id,
            department,
            bill_type,
            reference_type,
            reference_id,
            total_amount,
            due_date,
            payment_method,
            deduction_months,
            remarks
        } = req.body;

        // Calculate monthly deduction
        const monthly_deduction = total_amount / (deduction_months || 1);

        // Generate credit number
        const { data: creditNumberData } = await supabase
            .rpc('generate_credit_number');

        const credit_number = creditNumberData || `CR${Date.now()}`;

        const { data, error } = await supabase
            .from('credit_bills')
            .insert({
                credit_number,
                branch_id,
                staff_id,
                staff_name,
                employee_id,
                department,
                bill_type,
                reference_type,
                reference_id,
                total_amount,
                balance_amount: total_amount,
                due_date,
                payment_method,
                deduction_months: deduction_months || 1,
                monthly_deduction,
                remarks,
                status: 'active',
                approval_status: 'pending',
                created_by: req.user?.id
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Credit bill created successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Accountant/Auditor confirm credit bill
 */
export const confirmCreditBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { role } = req.body; // 'accountant' or 'auditor'

        // 1. Fetch current credit bill
        const { data: bill, error: fetchError } = await supabase
            .from('credit_bills')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !bill) {
            throw new AppError('Credit bill not found', 404);
        }

        const updateData: any = {};
        if (role === 'accountant') {
            if (bill.accountant_confirmed_at) {
                throw new AppError('Credit bill already confirmed by accountant', 400);
            }
            updateData.accountant_confirmed_at = new Date().toISOString();
            updateData.accountant_id = req.user?.id;
        } else if (role === 'auditor') {
            if (bill.auditor_confirmed_at) {
                throw new AppError('Credit bill already confirmed by auditor', 400);
            }
            // if (!bill.accountant_confirmed_at) throw new AppError('Accountant confirmation required first', 400);

            updateData.auditor_confirmed_at = new Date().toISOString();
            updateData.auditor_id = req.user?.id;

            // If both are confirmed, we could optionally update approval_status to 'confirmed'
            if (bill.accountant_confirmed_at) {
                updateData.approval_status = 'confirmed';
            }
        } else {
            throw new AppError('Invalid role for confirmation', 400);
        }

        const { data, error } = await supabase
            .from('credit_bills')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: `Credit bill confirmed by ${role} successfully`,
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Record credit bill payment
 */
export const recordCreditPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { payment_amount, payment_method, payment_reference } = req.body;

        // Fetch current credit bill
        const { data: credit, error: fetchError } = await supabase
            .from('credit_bills')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!credit) {
            throw new AppError('Credit bill not found', 404);
        }

        // Calculate new paid amount
        const new_paid_amount = (credit.paid_amount || 0) + payment_amount;
        const new_balance = credit.total_amount - new_paid_amount;

        // Update credit bill
        const { data: updatedCredit, error: updateError } = await supabase
            .from('credit_bills')
            .update({
                paid_amount: new_paid_amount,
                balance_amount: new_balance
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Record cashier transaction
        const { data: transactionData } = await supabase
            .rpc('generate_cashier_transaction_number');

        const transaction_number = transactionData || `CT${Date.now()}`;

        await supabase
            .from('cashier_transactions')
            .insert({
                transaction_number,
                branch_id: credit.branch_id,
                cashier_id: req.user?.id,
                transaction_type: 'payment',
                revenue_type: 'staff_credit',
                reference_type: 'credit_bill',
                reference_id: credit.id,
                payment_method,
                amount: payment_amount,
                payment_reference,
                customer_name: credit.staff_name
            });

        res.json({
            success: true,
            message: 'Credit payment recorded successfully',
            data: updatedCredit
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// CASHIER SHIFTS
// ============================================

/**
 * Get cashier shifts
 */
export const getCashierShifts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, cashier_id, status, shift_date } = req.query;

        let query = supabase
            .from('cashier_shifts')
            .select('*')
            .order('shift_date', { ascending: false });

        query = applyBranchFilter(query, req);
        const isGlobal = isGlobalRole(req.user?.role);

        if (isGlobal && branch_id) {
            query = query.eq('branch_id', parseInt(branch_id as string));
        }

        if (cashier_id) {
            query = query.eq('cashier_id', cashier_id as string);
        }

        if (status) {
            query = query.eq('status', status as string);
        }

        if (shift_date) {
            query = query.eq('shift_date', shift_date as string);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            message: 'Cashier shifts retrieved successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Start cashier shift
 */
export const startShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, opening_float } = req.body;

        // Check if cashier already has an open shift
        const { data: existingShift } = await supabase
            .from('cashier_shifts')
            .select('*')
            .eq('cashier_id', req.user?.id)
            .eq('status', 'open')
            .single();

        if (existingShift) {
            throw new AppError('You already have an open shift', 400);
        }

        // Generate shift number
        const { data: shiftNumberData } = await supabase
            .rpc('generate_shift_number');

        const shift_number = shiftNumberData || `SH${Date.now()}`;

        const { data, error } = await supabase
            .from('cashier_shifts')
            .insert({
                shift_number,
                branch_id,
                cashier_id: req.user?.id,
                opening_float: opening_float || 0,
                start_time: new Date().toISOString(),
                status: 'open'
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Shift started successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Close cashier shift
 */
export const closeShift = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { closing_float, actual_cash, remarks } = req.body;

        // Fetch shift
        const { data: shift, error: fetchError } = await supabase
            .from('cashier_shifts')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!shift) {
            throw new AppError('Shift not found', 404);
        }

        // Get all transactions for this shift
        const { data: transactions } = await supabase
            .from('cashier_transactions')
            .select('*')
            .eq('shift_id', id);

        // Calculate totals
        const total_cash = transactions?.filter(t => t.payment_method === 'cash')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

        const total_mpesa = transactions?.filter(t => t.payment_method === 'mpesa')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

        const total_card = transactions?.filter(t => t.payment_method === 'card')
            .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

        const total_revenue = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

        const expected_cash = shift.opening_float + total_cash;
        const cash_variance = actual_cash - expected_cash;

        // Update shift
        const { data, error } = await supabase
            .from('cashier_shifts')
            .update({
                end_time: new Date().toISOString(),
                closing_float,
                expected_cash,
                actual_cash,
                cash_variance,
                total_transactions: transactions?.length || 0,
                total_cash_in: total_cash,
                total_mpesa_in: total_mpesa,
                total_card_in: total_card,
                total_revenue,
                remarks,
                status: 'closed'
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Trigger automatic migration of unpaid bills for this branch
        try {
            await migratePendingBills(shift.branch_id);
        } catch (migErr) {
            logger.error(`Error triggering pending bills migration on shift close:`, migErr);
            // Don't fail the whole request if migration fails
        }

        // Check for unresolved kitchen variances for this shift/date
        // Variance is unresolved if variance != 0 and reason_id is null
        const { data: unresolvedVariances } = await supabase
            .from('kitchen_daily_variance')
            .select('*')
            .eq('branch_id', shift.branch_id)
            .eq('variance_date', shift.shift_date)
            .is('reason_id', null)
            .neq('variance', 0);

        if (unresolvedVariances && unresolvedVariances.length > 0) {
            throw new AppError(`Cannot close shift: ${unresolvedVariances.length} kitchen items have variances without reasons.`, 400);
        }

        res.json({
            success: true,
            message: 'Shift closed successfully',
            data
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get cashier dashboard statistics
 */
export const getCashierStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id } = req.query;
        const today = new Date().toISOString().split('T')[0];

        const isGlobal = isGlobalRole(req.user?.role);
        const effectiveBranchId = isGlobal && branch_id ? parseInt(branch_id as string) : req.user?.branch_id;

        // Get today's transactions
        let txQuery = supabase
            .from('cashier_transactions')
            .select('*')
            .gte('transaction_date', today);
        if (effectiveBranchId) txQuery = txQuery.eq('branch_id', effectiveBranchId);
        const { data: transactions } = await txQuery;

        // Get unpaid bills
        let unpaidQuery = supabase
            .from('unpaid_bills')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'unpaid');
        if (effectiveBranchId) unpaidQuery = unpaidQuery.eq('branch_id', effectiveBranchId);
        const { count: unpaidCount } = await unpaidQuery;

        // Get pending credit bills
        let creditQuery = supabase
            .from('credit_bills')
            .select('*', { count: 'exact', head: true })
            .eq('approval_status', 'pending');
        if (effectiveBranchId) creditQuery = creditQuery.eq('branch_id', effectiveBranchId);
        const { count: pendingCreditsCount } = await creditQuery;

        // Get active shift
        const { data: activeShift } = await supabase
            .from('cashier_shifts')
            .select('*')
            .eq('cashier_id', req.user?.id)
            .eq('status', 'open')
            .single();

        const todayRevenue = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

        // Get revenue breakdown by type
        const revenueByType: Record<string, number> = {};
        transactions?.forEach(t => {
            const type = t.revenue_type || 'other';
            revenueByType[type] = (revenueByType[type] || 0) + parseFloat(t.amount);
        });

        res.json({
            success: true,
            message: 'Cashier statistics retrieved successfully',
            data: {
                todayTransactions: transactions?.length || 0,
                todayRevenue,
                revenueBreakdown: revenueByType,
                unpaidBills: unpaidCount || 0,
                pendingCreditApprovals: pendingCreditsCount || 0,
                activeShift
            }
        });
    } catch (error) {
        next(error);
    }
};

// ============================================
// CASHIER LOGBOOK
// ============================================

/**
 * Get today's logbook for a specific type (reception/bar)
 */
export const getCashierLogbookToday = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { type } = req.query;
        const branch_id = req.headers['x-branch-id'];

        const isGlobal = isGlobalRole(req.user?.role);
        const effectiveBranchId = isGlobal && branch_id ? branch_id : req.user?.branch_id;

        if (!type || !effectiveBranchId) {
            throw new AppError('Type and Branch ID are required', 400);
        }

        const today = new Date().toISOString().split('T')[0];

        // 1. Try to fetch existing logbook for today
        const { data: logbook, error: fetchError } = await supabase
            .from('cashier_logbooks')
            .select(`
                *,
                credit_bills:cashier_logbook_lines(*),
                unpaid_bills:cashier_logbook_lines(*),
                paid_bills:cashier_logbook_lines(*)
            `)
            .eq('branch_id', effectiveBranchId)
            .eq('type', type)
            .eq('log_date', today)
            .single();

        if (logbook) {
            // Filter lines by section (the nested select above gets all lines for all 3 aliases if not filtered)
            // Actually supabase nested select doesn't filter by sub-criteria easily without JS filtering here
            const allLines = logbook.credit_bills || [];
            res.json({
                success: true,
                data: {
                    ...logbook,
                    credit_bills: allLines.filter((l: any) => l.section === 'credit_bill'),
                    unpaid_bills: allLines.filter((l: any) => l.section === 'unpaid_bill'),
                    paid_bills: allLines.filter((l: any) => l.section === 'paid_bill')
                }
            });
            return;
        }

        // 2. If not found, calculate initial data from today's transactions
        // Get total sales, mpesa, swipe for today's transactions in this branch/type
        // Note: For 'bar' type, we look at bar-related transactions. For 'reception', hotel-related.
        // For simplicity now, we aggregate by branch and optionally type if transactions are tagged.
        const { data: stats, error: statsError } = await supabase
            .from('cashier_transactions')
            .select('amount, payment_method')
            .eq('branch_id', effectiveBranchId)
            .gte('created_at', `${today}T00:00:00Z`)
            .lte('created_at', `${today}T23:59:59Z`);

        const sales_breakdown: Record<string, number> = {};
        let total_mpesa = 0;
        let total_swipe = 0;

        stats?.forEach(tx => {
            if (tx.payment_method?.toLowerCase() === 'mpesa') total_mpesa += Number(tx.amount);
            if (tx.payment_method?.toLowerCase() === 'swipe' || tx.payment_method?.toLowerCase() === 'card') total_swipe += Number(tx.amount);
        });

        res.json({
            success: true,
            data: {
                opening_float: 0,
                closing_float: 0,
                sales_breakdown,
                total_mpesa,
                total_swipe,
                notes: '',
                credit_bills: [],
                unpaid_bills: [],
                paid_bills: []
            }
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Save or Update cashier logbook
 */
export const saveCashierLogbook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const {
            id, type, opening_float, closing_float, sales_breakdown,
            total_mpesa, total_swipe, notes, status,
            credit_bills, unpaid_bills, paid_bills
        } = req.body;
        const branch_id = req.headers['x-branch-id'];
        const cashier_id = req.user?.id;

        if (!type || !branch_id || !cashier_id) {
            throw new AppError('Type, Branch ID and Cashier are required', 400);
        }

        const today = new Date().toISOString().split('T')[0];

        // If updating existing logbook, check if it's approved
        if (id) {
            const { data: existing, error: checkError } = await supabase
                .from('cashier_logbooks')
                .select('status')
                .eq('id', id)
                .single();

            if (checkError) throw checkError;

            if (existing?.status === 'approved') {
                throw new AppError('Cannot edit an approved logbook', 403);
            }
        }

        // 1. Upsert the main logbook record
        const { data: logbook, error: logbookError } = await supabase
            .from('cashier_logbooks')
            .upsert({
                id: id || undefined,
                branch_id,
                cashier_id,
                type,
                log_date: today,
                opening_float,
                closing_float,
                sales_breakdown,
                total_mpesa,
                total_swipe,
                notes,
                status: status || 'open',
                updated_at: new Date()
            })
            .select()
            .single();

        if (logbookError) throw logbookError;

        // 2. Clear and recreate lines (simple replacement strategy)
        if (logbook.id) {
            const { error } = await supabase.from('cashier_logbook_lines').delete().eq('logbook_id', logbook.id);
            if (error) {
              console.error('Database error:', error);
              throw error;
            }

            const allLines = [
                ...(credit_bills || []).map((l: any) => ({ ...l, logbook_id: logbook.id, section: 'credit_bill' })),
                ...(unpaid_bills || []).map((l: any) => ({ ...l, logbook_id: logbook.id, section: 'unpaid_bill' })),
                ...(paid_bills || []).map((l: any) => ({ ...l, logbook_id: logbook.id, section: 'paid_bill' }))
            ].map(({ id, ...line }) => line); // Remove temp IDs if any

            if (allLines.length > 0) {
                const { error: linesError } = await supabase
                    .from('cashier_logbook_lines')
                    .insert(allLines);
                if (linesError) throw linesError;
            }

            // 3. Sync Credit Bills to 'staff_credit_bills' for Payroll
            // We want to ensure these are recorded in the payroll system
            if (credit_bills && Array.isArray(credit_bills)) {
                for (const bill of credit_bills) {
                    if (bill.staff_id && Number(bill.amount) > 0) {
                        try {
                            // Link to source logbook to allow payroll to check if logbook is approved/reconciled
                            const { data: existing } = await supabase
                                .from('staff_credit_bills')
                                .select('id')
                                .eq('staff_id', bill.staff_id)
                                .eq('bill_date', today)
                                .eq('amount', bill.amount)
                                .eq('source_logbook_id', logbook.id)
                                .maybeSingle();

                            if (!existing) {
                                const { error } = await supabase.from('staff_credit_bills').insert({
                                    staff_id: bill.staff_id,
                                    amount: bill.amount,
                                    bill_date: today,
                                    description: `Cashier Logbook Credit (${type}): ${bill.customer_name || 'Staff'} - ${bill.reference || 'No Ref'}`,
                                    status: 'pending',
                                    source_logbook_id: logbook.id
                                });

                                if (error) {

                                  console.error('Database error:', error);

                                  throw error;

                                }
                            }
                        } catch (err) {
                            console.error('Failed to sync credit bill to payroll:', err);
                        }
                    }
                }
            }
        }

        res.json({
            success: true,
            message: 'Logbook saved successfully',
            data: logbook
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Submit cashier logbook for audit
 */
export const submitLogbookForAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const cashier_id = req.user?.id;

        if (!id || !cashier_id) {
            throw new AppError('Logbook ID and Cashier ID are required', 400);
        }

        // Verify the logbook belongs to the cashier
        const { data: logbook, error: fetchError } = await supabase
            .from('cashier_logbooks')
            .select('*')
            .eq('id', id)
            .eq('cashier_id', cashier_id)
            .single();

        if (fetchError || !logbook) {
            throw new AppError('Logbook not found or access denied', 404);
        }

        if (logbook.status !== 'open') {
            throw new AppError('Only open logbooks can be submitted for audit', 400);
        }

        // Update status to pending_audit
        const { data: updated, error: updateError } = await supabase
            .from('cashier_logbooks')
            .update({
                status: 'pending_audit',
                submitted_at: new Date(),
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Notify Auditor and Accountant — scoped to the cashier's branch
        const cashierBranchId = req.user?.branch_id;
        const notificationData = {
            type: 'warning' as const,
            category: 'audit',
            priority: 'medium' as const,
            branchId: cashierBranchId,
            actionUrl: `/dashboard/auditor/financial-verification`,
            metadata: { logbook_id: id, type: 'cashier_logbook', cashier_id }
        };

        // 1. Notify Auditor
        notificationService.notifyRole('auditor', 'Cashier Logbook Submission', `Cashier logbook for ${logbook.type} has been submitted for audit.`, notificationData)
            .catch(e => logger.error('Failed to notify auditor of logbook submission', e));

        // 2. Notify Accountant
        notificationService.notifyRole('branch_accountant', 'Cashier Logbook Submission', `Cashier logbook for ${logbook.type} has been submitted for review.`, notificationData)
            .catch(e => logger.error('Failed to notify accountant of logbook submission', e));

        res.json({
            success: true,
            message: 'Logbook submitted for audit successfully',
            data: updated
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Get logbooks pending audit (for auditors)
 */
export const getLogbooksForAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const branch_id = req.headers['x-branch-id'];
        const { status = 'pending_audit', from_date, to_date } = req.query;

        let query = supabase
            .from('cashier_logbooks')
            .select(`
                *,
                branch:branches(id, name),
                cashier:users!cashier_id(id, first_name, last_name, email),
                lines:cashier_logbook_lines!logbook_id(id, section, customer_name, amount, reference)
            `)
            .eq('status', status)
            .order('log_date', { ascending: false });

        query = applyBranchFilter(query, req);
        const isGlobal = isGlobalRole(req.user?.role);

        if (isGlobal && branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (from_date) {
            query = query.gte('log_date', from_date);
        }

        if (to_date) {
            query = query.lte('log_date', to_date);
        }

        const { data: logbooks, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            data: logbooks
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Audit a logbook (approve or reject)
 */
export const auditLogbook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { action, notes } = req.body;
        const auditor_id = req.user?.id;

        if (!id || !auditor_id) {
            throw new AppError('Logbook ID and Auditor ID are required', 400);
        }

        if (!['approve', 'reject'].includes(action)) {
            throw new AppError('Action must be either "approve" or "reject"', 400);
        }

        // Verify the logbook is pending audit
        const { data: logbook, error: fetchError } = await supabase
            .from('cashier_logbooks')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !logbook) {
            throw new AppError('Logbook not found', 404);
        }

        if (logbook.status !== 'pending_audit') {
            throw new AppError('Only pending logbooks can be audited', 400);
        }

        // Update logbook with audit decision
        const { data: updated, error: updateError } = await supabase
            .from('cashier_logbooks')
            .update({
                status: action === 'approve' ? 'approved' : 'rejected',
                auditor_id,
                audited_at: new Date(),
                audit_notes: notes || null,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Notify Cashier
        if (updated && updated.cashier_id) {
            const resultTitle = action === 'approve' ? 'Logbook Approved' : 'Logbook Rejected';
            const resultMsg = action === 'approve'
                ? `Your cashier logbook for ${updated.type} has been approved.`
                : `Your cashier logbook for ${updated.type} was rejected. Reason: ${notes || 'No reason provided.'}`;

            notificationService.notifyUser(
                updated.cashier_id,
                resultTitle,
                resultMsg,
                {
                    type: action === 'approve' ? 'success' : 'error',
                    category: 'audit_result',
                    priority: action === 'approve' ? 'medium' : 'high',
                    metadata: { logbook_id: id, status: updated.status }
                }
            ).catch(e => logger.error(`Failed to notify cashier ${updated.cashier_id} of logbook audit result`, e));
        }

        res.json({
            success: true,
            message: `Logbook ${action}d successfully`,
            data: updated
        });

    } catch (error) {
        next(error);
    }
};

/**
 * POS: Create a new transaction
 */
export const createPOSTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { items, customer_name, customer_phone, branch_id, total_amount, tax_amount, discount_amount } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            throw new AppError('Items are required', 400);
        }

        // Generate unique transaction_ref: CS-{pos_id}-{ISOdate}-{random6}
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        const transaction_ref = `CS-${branch_id || '01'}-${dateStr}-${randomStr}`;

        // 1. Create transaction header
        const { data: transaction, error: txError } = await supabase
            .from('pos_transactions')
            .insert({
                transaction_ref,
                cashier_id: req.user?.id,
                branch_id: branch_id || req.user?.branch_id,
                total_amount,
                tax_amount: tax_amount || 0,
                discount_amount: discount_amount || 0,
                status: 'PENDING',
                customer_name,
                customer_phone
            })
            .select()
            .single();

        if (txError) throw txError;

        // 2. Create transaction items
        const itemRecords = items.map((item: any) => ({
            transaction_id: transaction.id,
            product_id: item.product_id,
            qty: item.qty,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount || 0,
            tax_amount: item.tax_amount || 0,
            line_total: item.line_total
        }));

        const { error: itemsError } = await supabase
            .from('pos_transaction_items')
            .insert(itemRecords);

        if (itemsError) throw itemsError;

        res.status(201).json({
            success: true,
            data: {
                transaction_id: transaction.id,
                transaction_ref: transaction.transaction_ref,
                total_amount: transaction.total_amount
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * POS: Initiate Payment for a transaction
 */
export const initiatePOSTransactionPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { method, phone_number } = req.body;

        // 1. Fetch transaction
        const { data: transaction, error: txError } = await supabase
            .from('pos_transactions')
            .select('*')
            .eq('id', id)
            .single();

        if (txError || !transaction) {
            throw new AppError('Transaction not found', 404);
        }

        if (transaction.status === 'PAID') {
            throw new AppError('Transaction already paid', 400);
        }

        if (method === 'MPESA') {
            if (!phone_number) throw new AppError('Phone number required for M-Pesa', 400);

            // Trigger STK Push via payment controller logic or call payment service directly
            const description = `Payment for POS Ref: ${transaction.transaction_ref}`;
            const stkResponse = await mpesaService.stkPush(
                phone_number,
                transaction.total_amount,
                transaction.transaction_ref,
                description
            );

            // Store payment record
            await supabase
                .from('payments')
                .insert({
                    reference: stkResponse.CheckoutRequestID,
                    amount: transaction.total_amount,
                    currency: 'KES',
                    payment_method: 'mpesa',
                    status: 'pending',
                    pos_transaction_id: transaction.id,
                    metadata: {
                        phoneNumber: phone_number,
                        merchantRequestId: stkResponse.MerchantRequestID,
                        checkoutRequestId: stkResponse.CheckoutRequestID,
                        transaction_ref: transaction.transaction_ref
                    }
                });

            res.json({
                success: true,
                message: 'STK Push initiated'
            });
        } else if (method === 'MPESA_MANUAL') {
            const { reference } = req.body;
            if (!reference) throw new AppError('M-Pesa reference required', 400);

            // 1. Update Transaction
            await supabase
                .from('pos_transactions')
                .update({
                    status: 'PAID',
                    payment_method: 'MPESA',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            // 2. Record Payment
            const { error: paymentError } = await supabase.from('payments').insert({
                pos_transaction_id: transaction.id,
                amount: transaction.total_amount,
                currency: 'KES',
                payment_method: 'mpesa',
                status: 'completed',
                reference: reference,
                metadata: {
                    manual_entry: true,
                    transaction_ref: transaction.transaction_ref,
                    verified_at: new Date().toISOString()
                }
            });

            if (paymentError) {

              console.error('Database error:', paymentError);

              throw paymentError;

            }

            // 3. Record Logbook Transaction
            const { error: txnError } = await supabase.from('cashier_transactions').insert({
                transaction_number: `POS-${transaction.transaction_ref}`,
                branch_id: transaction.branch_id,
                cashier_id: req.user?.id || transaction.cashier_id,
                transaction_type: 'payment',
                revenue_type: 'POS_SALE',
                reference_type: 'pos_transaction',
                reference_id: transaction.id,
                payment_method: 'mpesa',
                amount: transaction.total_amount,
                customer_name: transaction.customer_name
            });

            if (txnError) {

              console.error('Database error:', txnError);

              throw txnError;

            }

            res.json({
                success: true,
                message: 'M-Pesa payment verified and transaction completed'
            });
        } else if (method === 'CASH') {
            // Cashier confirms amount received
            await supabase
                .from('pos_transactions')
                .update({
                    status: 'PAID',
                    payment_method: 'CASH',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            // Record legacy transaction
            const { error } = await supabase.from('cashier_transactions').insert({
                transaction_number: `POS-${transaction.transaction_ref}`,
                branch_id: transaction.branch_id,
                cashier_id: transaction.cashier_id,
                transaction_type: 'payment',
                revenue_type: 'POS_SALE',
                reference_type: 'pos_transaction',
                reference_id: transaction.id,
                payment_method: 'cash',
                amount: transaction.total_amount,
                customer_name: transaction.customer_name
            });

            if (error) {

              console.error('Database error:', error);

              throw error;

            }

            res.json({
                success: true,
                message: 'Cash payment confirmed'
            });
        } else {
            throw new AppError('Payment method not supported yet or in development', 400);
        }
    } catch (error) {
        next(error);
    }
};

/**
 * POS: Reconciliation Report
 */
export const getPOSReconciliation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { date, branch_id } = req.query;
        const targetDate = date ? (date as string) : new Date().toISOString().split('T')[0];

        const isGlobal = isGlobalRole(req.user?.role);
        const effectiveBranchId = isGlobal && branch_id ? parseInt(branch_id as string) : (req.user?.branch_id || 0);

        // 1. Get transactions for the day
        const { data: transactions, error: txError } = await supabase
            .from('pos_transactions')
            .select('*')
            .eq('branch_id', effectiveBranchId)
            .gte('created_at', `${targetDate}T00:00:00Z`)
            .lte('created_at', `${targetDate}T23:59:59Z`);

        if (txError) throw txError;

        // 2. Breakdown per method
        const totals: Record<string, { count: number, total: number }> = {
            CASH: { count: 0, total: 0 },
            MPESA: { count: 0, total: 0 },
            CARD: { count: 0, total: 0 },
            PENDING: { count: 0, total: 0 }
        };

        transactions?.forEach(tx => {
            if (tx.status === 'PAID') {
                const method = tx.payment_method || 'UNKNOWN';
                if (!totals[method]) totals[method] = { count: 0, total: 0 };
                totals[method].count++;
                totals[method].total += Number(tx.total_amount);
            } else if (tx.status === 'PENDING') {
                totals.PENDING.count++;
                totals.PENDING.total += Number(tx.total_amount);
            }
        });

        res.json({
            success: true,
            data: {
                date: targetDate,
                summary: totals,
                gross_total: Object.values(totals).reduce((sum, t) => sum + t.total, 0)
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all pending/unpaid restaurant and bar orders (waiter orders not yet collected)
 * GET /api/cashier/unpaid-orders
 */
export const getUnpaidWaiterOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userRole = (req.user as any)?.role?.toLowerCase() || '';
        const isGlobal = isGlobalRole(userRole);
        const queryBranchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;
        const effectiveBranchId = isGlobal ? queryBranchId : ((req.user as any)?.branch_id || null);

        // Fetch pending restaurant orders
        let restaurantQuery = supabase
            .from('restaurant_orders')
            .select(`
                id, order_number, status, payment_status,
                table_number, room_number, guest_name,
                total_amount, created_at, branch_id,
                waiter:users!created_by(id, first_name, last_name)
            `)
            .neq('payment_status', 'paid')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

        if (effectiveBranchId) restaurantQuery = restaurantQuery.eq('branch_id', effectiveBranchId);

        const { data: restaurantOrders, error: rErr } = await restaurantQuery;
        if (rErr && rErr.code !== '42703') throw rErr;

        // Fetch pending bar orders
        let barQuery = supabase
            .from('bar_orders')
            .select(`
                id, order_number, status, payment_status,
                seat_number, room_number, guest_name,
                total, created_at, branch_id,
                waiter:users!created_by(id, first_name, last_name)
            `)
            .eq('payment_status', 'pending')
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });

        if (effectiveBranchId) barQuery = barQuery.eq('branch_id', effectiveBranchId);

        const { data: barOrders, error: bErr } = await barQuery;
        if (bErr && bErr.code !== '42703') throw bErr;

        // Normalise into a common shape
        const mapped = [
            ...(restaurantOrders || []).map((o: any) => ({
                id: o.id,
                source: 'restaurant',
                order_number: o.order_number,
                location: o.table_number ? `Table ${o.table_number}` : o.room_number ? `Room ${o.room_number}` : '—',
                guest_name: o.guest_name || 'Walk-in',
                total_amount: Number(o.total_amount || 0),
                payment_status: o.payment_status,
                status: o.status,
                created_at: o.created_at,
                branch_id: o.branch_id,
                waiter: Array.isArray(o.waiter) ? o.waiter[0] : o.waiter
            })),
            ...(barOrders || []).map((o: any) => ({
                id: o.id,
                source: 'bar',
                order_number: o.order_number,
                location: o.seat_number ? `Seat ${o.seat_number}` : o.room_number ? `Room ${o.room_number}` : '—',
                guest_name: o.guest_name || 'Bar Customer',
                total_amount: Number(o.total || 0),
                payment_status: o.payment_status,
                status: o.status,
                created_at: o.created_at,
                branch_id: o.branch_id,
                waiter: Array.isArray(o.waiter) ? o.waiter[0] : o.waiter
            }))
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        res.json({ success: true, data: mapped });
    } catch (error) {
        next(error);
    }
};

/**
 * Mark a restaurant or bar order as fully paid
 * PATCH /api/cashier/unpaid-orders/:source/:id/pay
 */
export const markWaiterOrderPaid = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { source, id } = req.params;
        const { payment_method = 'cash' } = req.body;

        const table = source === 'restaurant' ? 'restaurant_orders' : 'bar_orders';
        const amountField = source === 'restaurant' ? 'total_amount' : 'total';

        const { data: order, error: fetchErr } = await supabase
            .from(table)
            .select(`id, ${amountField}, branch_id, order_number`)
            .eq('id', id)
            .single();

        if (fetchErr || !order) throw new AppError('Order not found', 404);

        const { error: updateErr } = await supabase
            .from(table)
            .update({ payment_status: 'paid', payment_method, status: 'completed' })
            .eq('id', id);

        if (updateErr) throw updateErr;

        // Record cashier transaction for audit trail
        try {
            const { data: txNumber } = await supabase.rpc('generate_cashier_transaction_number');
            await supabase.from('cashier_transactions').insert({
                transaction_number: txNumber || `CT${Date.now()}`,
                branch_id: order.branch_id,
                cashier_id: req.user?.id,
                transaction_type: 'payment',
                revenue_type: source === 'restaurant' ? 'restaurant' : 'bar',
                reference_type: table,
                reference_id: order.id,
                payment_method,
                amount: Number((order as any)[amountField] || 0),
                customer_name: order.order_number
            });
        } catch (txErr) {
            logger.warn('Could not record cashier transaction for order payment:', txErr);
        }

        res.json({ success: true, message: 'Order marked as paid' });
    } catch (error) {
        next(error);
    }
};
