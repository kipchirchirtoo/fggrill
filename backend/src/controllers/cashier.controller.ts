import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { paymentVerificationService } from '../services/payment.verification.service';

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

        // Check if it's a restaurant order (starts with ORD)
        if (bookingId.startsWith('ORD')) {
            // Fetch restaurant order details
            let query = supabase
                .from('restaurant_orders')
                .select(`
                    *,
                    items:restaurant_order_items(
                        *,
                        menu_item:restaurant_menu_items(name)
                    )
                `)
                .eq('order_number', bookingId);

            // Branch isolation
            if (req.user?.branch_id) {
                query = query.eq('branch_id', req.user.branch_id);
            }

            const { data: order, error: orderError } = await query.single();

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
        if (bookingId.startsWith('BAR')) {
            // Fetch bar order details
            let query = supabase
                .from('bar_orders')
                .select(`
                    *,
                    items:bar_order_items(*)
                `)
                .eq('order_number', bookingId);

            // Branch isolation
            if (req.user?.branch_id) {
                query = query.eq('branch_id', req.user.branch_id);
            }

            const { data: order, error: orderError } = await query.single();

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

        // Otherwise assume it's a hotel booking (UUID)
        // Fetch booking details with guest info
        let query = supabase
            .from('reservations')
            .select(`
        *,
        room:rooms(number, type:room_types(name, price))
      `)
            .eq('id', bookingId);

        // Branch isolation
        if (req.user?.branch_id) {
            query = query.eq('branch_id', req.user.branch_id);
        }

        const { data: booking, error: bookingError } = await query.single();

        if (bookingError || !booking) {
            throw new AppError('Booking not found', 404);
        }

        // Fetch payments
        const { data: payments, error: paymentsError } = await supabase
            .from('payments')
            .select('*')
            .eq('booking_id', bookingId);

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
                    guest_name: booking.guest_name,
                    guest_phone: booking.guest_phone,
                    room_number: booking.room?.number,
                    room_type: booking.room?.type?.name,
                    check_in: booking.check_in,
                    check_out: booking.check_out,
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

    } catch (error) {
        next(error);
    }
};

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
                } else if (totalPaid > 0) {
                    await supabase
                        .from('restaurant_orders')
                        .update({
                            payment_status: 'partial'
                        })
                        .eq('id', order.id);
                }
            }

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
                            payment_status: 'paid'
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

            res.json({
                success: true,
                message: 'Bar payment processed successfully',
                data: payment
            });
            return;
        }

        // Otherwise assume it's a hotel booking (UUID)
        // 1. Record Payment in Database
        const isVerifiedMethod = method === 'cash';
        const initialStatus = isVerifiedMethod ? 'completed' : 'pending';

        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                booking_id: bookingId,
                amount: amount,
                currency: 'KES',
                payment_method: method,
                status: initialStatus,
                reference: paymentRef,
                metadata: {
                    processed_by: 'cashier',
                    processed_at: new Date().toISOString(),
                    verification_required: !isVerifiedMethod
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
                .eq('id', bookingId)
                .single();

            const { data: allPayments } = await supabase
                .from('payments')
                .select('amount')
                .eq('booking_id', bookingId)
                .eq('status', 'completed');

            const totalPaid = allPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

            if (booking && totalPaid >= booking.total_amount) {
                await supabase
                    .from('reservations')
                    .update({
                        payment_status: 'paid',
                        deposit_paid: true
                    })
                    .eq('id', bookingId);
            }
        }

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
                        .update({ payment_status: 'paid' })
                        .eq('id', payment.bar_order_id);
                } else if (totalPaid > 0) {
                    await supabase
                        .from('bar_orders')
                        .update({ payment_status: 'partial' })
                        .eq('id', payment.bar_order_id);
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
