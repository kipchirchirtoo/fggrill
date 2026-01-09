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

// ============================================
// UNPAID BILLS MANAGEMENT
// ============================================

/**
 * Get all unpaid bills
 */
export const getUnpaidBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, status, customer_type, bill_type } = req.query;

        let query = supabase
            .from('unpaid_bills')
            .select('*')
            .order('bill_date', { ascending: false });

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (status) {
            query = query.eq('status', status);
        } else {
            // By default, exclude paid bills
            query = query.neq('status', 'paid');
        }

        if (customer_type) {
            query = query.eq('customer_type', customer_type as string);
        }

        if (bill_type) {
            query = query.eq('bill_type', bill_type as string);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            message: 'Unpaid bills retrieved successfully',
            data
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
            remarks
        } = req.body;

        // Generate bill number
        const { data: billNumberData } = await supabase
            .rpc('generate_bill_number');

        const bill_number = billNumberData || `BILL${Date.now()}`;

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

        // Update bill
        const { data: updatedBill, error: updateError } = await supabase
            .from('unpaid_bills')
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

// ============================================
// CREDIT BILLS MANAGEMENT
// ============================================

/**
 * Get all credit bills
 */
export const getCreditBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { branch_id, staff_id, status, approval_status } = req.query;

        let query = supabase
            .from('credit_bills')
            .select('*')
            .order('credit_date', { ascending: false });

        if (branch_id) {
            query = query.eq('branch_id', branch_id as string);
        }

        if (staff_id) {
            query = query.eq('staff_id', staff_id as string);
        }

        if (status) {
            query = query.eq('status', status as string);
        }

        if (approval_status) {
            query = query.eq('approval_status', approval_status as string);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            message: 'Credit bills retrieved successfully',
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
 * Approve/reject credit bill
 */
export const approveCreditBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { id } = req.params;
        const { approval_status } = req.body;

        const { data, error } = await supabase
            .from('credit_bills')
            .update({
                approval_status,
                approved_by: req.user?.id,
                approved_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: `Credit bill ${approval_status} successfully`,
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

        if (branch_id) {
            query = query.eq('branch_id', branch_id as string);
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

        // Get today's transactions
        const { data: transactions } = await supabase
            .from('cashier_transactions')
            .select('*')
            .eq('branch_id', branch_id as string)
            .gte('transaction_date', today);

        // Get unpaid bills
        const { count: unpaidCount } = await supabase
            .from('unpaid_bills')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', branch_id as string)
            .eq('status', 'unpaid');

        // Get pending credit bills
        const { count: pendingCreditsCount } = await supabase
            .from('credit_bills')
            .select('*', { count: 'exact', head: true })
            .eq('branch_id', branch_id as string)
            .eq('approval_status', 'pending');

        // Get active shift
        const { data: activeShift } = await supabase
            .from('cashier_shifts')
            .select('*')
            .eq('cashier_id', req.user?.id)
            .eq('status', 'open')
            .single();

        const todayRevenue = transactions?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

        res.json({
            success: true,
            message: 'Cashier statistics retrieved successfully',
            data: {
                todayTransactions: transactions?.length || 0,
                todayRevenue,
                unpaidBills: unpaidCount || 0,
                pendingCreditApprovals: pendingCreditsCount || 0,
                activeShift
            }
        });
    } catch (error) {
        next(error);
    }
};
