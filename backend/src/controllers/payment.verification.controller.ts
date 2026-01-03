import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { paymentVerificationService } from '../services/payment.verification.service';

/**
 * Verify a pending payment
 */
export const verifyPayment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { paymentId } = req.body;

        if (!paymentId) {
            throw new AppError('Payment ID is required', 400);
        }

        // 1. Fetch payment record
        const { data: payment, error: fetchError } = await supabase
            .from('payments')
            .select('*')
            .eq('id', paymentId)
            .single();

        if (fetchError || !payment) {
            throw new AppError('Payment not found', 404);
        }

        if (payment.status === 'completed') {
            res.json({ success: true, message: 'Payment already verified', data: payment });
            return;
        }

        // 2. Perform verification using the service
        // Note: For manual verification by cashier, we might just trust them if they click "Verify"
        // but let's use the service if it's an M-Pesa/Card transaction with a reference.
        const verificationResult = await paymentVerificationService.verifyTransaction(payment.reference, Number(payment.amount));

        if (!verificationResult.isValid) {
            // If it's a manual verification by cashier, we might want to allow it anyway if they have proof
            // For now, let's be strict.
            throw new AppError(`Verification failed: ${verificationResult.message}`, 400);
        }

        // 3. Update payment status to completed
        const { data: updatedPayment, error: updateError } = await supabase
            .from('payments')
            .update({
                status: 'completed',
                metadata: {
                    ...payment.metadata,
                    verified_at: new Date().toISOString(),
                    verified_by: (req as any).user?.id
                }
            })
            .eq('id', paymentId)
            .select()
            .single();

        if (updateError) {
            throw new AppError(`Failed to update payment status: ${updateError.message}`, 500);
        }

        // 4. Update Booking or Restaurant Order Status
        if (payment.restaurant_order_id) {
            // Update Restaurant Order
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
                    .update({
                        payment_status: 'paid',
                        status: 'delivered'
                    })
                    .eq('id', payment.restaurant_order_id);
            } else if (totalPaid > 0) {
                await supabase
                    .from('restaurant_orders')
                    .update({
                        payment_status: 'partial'
                    })
                    .eq('id', payment.restaurant_order_id);
            }
        } else if (payment.booking_id) {
            // Update Hotel Booking
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

        res.json({
            success: true,
            message: 'Payment verified and recorded successfully',
            data: updatedPayment
        });

    } catch (error) {
        next(error);
    }
};
