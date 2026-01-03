import express from 'express';
import {
  initiateBookingPayment,
  initiateMpesaPayment,
  initiatePaystackPayment,
  mpesaCallback,
  paystackWebhook,
  verifyPaystackPayment,
  getPaymentStatus,
  createPaymentIntent,
  confirmPayment,
  cancelPayment,
  getFolioPayments,
  verifyStrictPayment
} from '../controllers/payment.controller';
import { protect as authenticate } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

const router = express.Router();

// =====================================================
// WEBHOOK ROUTES (No authentication required)
// =====================================================

// M-Pesa STK Push callback
router.post('/mpesa/callback', mpesaCallback);

// M-Pesa timeout callback  
router.post('/mpesa/timeout', (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// M-Pesa result callback (for B2C)
router.post('/mpesa/result', (req, res) => {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// Paystack webhook
router.post('/paystack/webhook', paystackWebhook);

// Paystack callback (user redirect after payment)
router.get('/paystack/callback', async (req, res) => {
  try {
    const { reference, trxref } = req.query;
    const paymentReference = reference || trxref;

    if (!paymentReference) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/booking?error=no_reference`);
    }

    // Find payment record
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('reference', paymentReference)
      .single();

    if (payment && payment.booking_id) {
      // Redirect to confirmation page with booking ID
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/booking/confirmation?bookingId=${payment.booking_id}&reference=${paymentReference}`);
    } else {
      // Redirect to booking page with error
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/booking?error=payment_not_found`);
    }
  } catch (error) {
    logger.error('Error in Paystack callback:', error);
    return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3001'}/booking?error=callback_failed`);
  }
});

// =====================================================
// PAYMENT INITIATION ROUTES
// =====================================================

// Unified booking payment initiation
router.post('/booking/initiate', initiateBookingPayment);

// M-Pesa specific payment initiation
router.post('/mpesa/initiate', initiateMpesaPayment);

// Paystack specific payment initiation
router.post('/paystack/initiate', initiatePaystackPayment);

// =====================================================
// PAYMENT VERIFICATION ROUTES
// =====================================================

// Verify Paystack payment
router.get('/paystack/verify/:reference', verifyPaystackPayment);

// Get payment status by ID
router.get('/status/:paymentId', getPaymentStatus);

// Strict verification
router.post('/verify-strict', verifyStrictPayment);

// =====================================================
// LEGACY PAYMENT INTENT ROUTES (for folio payments)
// =====================================================

// Create payment intent
router.post('/intent', authenticate, createPaymentIntent);

// Confirm payment
router.post('/confirm/:paymentIntentId', authenticate, confirmPayment);

// Cancel payment
router.post('/cancel/:paymentIntentId', authenticate, cancelPayment);

// Get folio payment history
router.get('/folio/:folioId/history', authenticate, getFolioPayments);

export default router;
