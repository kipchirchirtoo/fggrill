import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { paystackService } from '../services/paystack.service';
import { mpesaService } from '../services/mpesa.service';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import { protect as authenticate } from '../middleware/auth';

const router = express.Router();

// M-Pesa STK Push callback
router.post('/mpesa/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { Body } = req.body;

    logger.info('M-Pesa STK Push callback received:', JSON.stringify(Body));

    const { stkCallback } = Body;
    const { CheckoutRequestID, ResultCode, ResultDesc } = stkCallback;

    // Update payment record in database
    if (ResultCode === 0) {
      // Payment successful
      const { CallbackMetadata } = stkCallback;
      const metadata = CallbackMetadata.Item;

      const amount = metadata.find((item: any) => item.Name === 'Amount')?.Value;
      const mpesaReceiptNumber = metadata.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value;
      const phoneNumber = metadata.find((item: any) => item.Name === 'PhoneNumber')?.Value;

      await supabase
        .from('payments')
        .update({
          status: 'completed',
          payment_reference: mpesaReceiptNumber,
          completed_at: new Date().toISOString()
        })
        .eq('checkout_request_id', CheckoutRequestID);

      logger.info(`M-Pesa payment successful: ${mpesaReceiptNumber}`);
    } else {
      // Payment failed
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          error_message: ResultDesc
        })
        .eq('checkout_request_id', CheckoutRequestID);

      logger.error(`M-Pesa payment failed: ${ResultDesc}`);
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    logger.error('M-Pesa callback error:', error);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// M-Pesa timeout callback
router.post('/mpesa/timeout', async (req: Request, res: Response) => {
  try {
    logger.info('M-Pesa timeout:', JSON.stringify(req.body));
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    logger.error('M-Pesa timeout error:', error);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// M-Pesa result callback (for B2C)
router.post('/mpesa/result', async (req: Request, res: Response) => {
  try {
    const { Result } = req.body;

    logger.info('M-Pesa B2C result received:', JSON.stringify(Result));

    const { ResultCode, ResultDesc, ConversationID, OriginatorConversationID } = Result;

    if (ResultCode === 0) {
      // Payment successful
      await supabase
        .from('payroll_records')
        .update({
          payment_status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('payment_reference', ConversationID);

      logger.info(`M-Pesa B2C payment successful: ${ConversationID}`);
    } else {
      // Payment failed
      await supabase
        .from('payroll_records')
        .update({
          payment_status: 'failed',
          payment_error: ResultDesc,
          updated_at: new Date().toISOString()
        })
        .eq('payment_reference', ConversationID);

      logger.error(`M-Pesa B2C payment failed: ${ResultDesc}`);
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    logger.error('M-Pesa result callback error:', error);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
});

// Paystack webhook
router.post('/paystack/webhook', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-paystack-signature'] as string;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature (implement in production)
    // const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(payload).digest('hex');
    // if (hash !== signature) {
    //   return res.status(400).send('Invalid signature');
    // }

    const event = req.body;

    logger.info('Paystack webhook received:', event.event);

    switch (event.event) {
      case 'charge.success':
        // Handle successful payment
        await supabase
          .from('payments')
          .update({
            status: 'completed',
            payment_reference: event.data.reference,
            completed_at: new Date().toISOString()
          })
          .eq('reference', event.data.reference);
        break;

      case 'transfer.success':
        // Handle successful transfer (payroll)
        await supabase
          .from('payroll_records')
          .update({
            payment_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('payment_reference', event.data.transfer_code);
        break;

      case 'transfer.failed':
        // Handle failed transfer
        await supabase
          .from('payroll_records')
          .update({
            payment_status: 'failed',
            payment_error: event.data.reason,
            updated_at: new Date().toISOString()
          })
          .eq('payment_reference', event.data.transfer_code);
        break;
    }

    res.status(200).send('OK');
  } catch (error) {
    logger.error('Paystack webhook error:', error);
    res.status(200).send('OK');
  }
});

// Initiate booking payment (STK Push)
router.post('/booking/initiate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId, phoneNumber, amount, paymentMethod } = req.body;

    let result;
    let checkoutRequestId;
    let reference;

    if (paymentMethod === 'mpesa') {
      result = await mpesaService.stkPush(
        phoneNumber,
        amount,
        `BOOKING-${bookingId}`,
        'Room booking payment'
      );
      checkoutRequestId = result.CheckoutRequestID;
      reference = result.MerchantRequestID;
    } else if (paymentMethod === 'paystack') {
      // For public bookings, we might not have req.user. 
      // We should get email from the booking's guest or pass it in body.
      // For now, let's assume email is passed or fetch it.
      // Simplified: Require email in body for public paystack or fetch booking.

      // Fetch booking to get guest email if not provided
      const { data: booking } = await supabase
        .from('reservations')
        .select('guest:guests(email)')
        .eq('id', bookingId)
        .single();

      const guestEmail = Array.isArray(booking?.guest)
        ? booking?.guest[0]?.email
        : (booking?.guest as any)?.email;

      const email = req.body.email || guestEmail || 'guest@famousgate.com';

      result = await paystackService.initializeTransaction(
        email,
        amount,
        `BOOKING-${bookingId}`,
        { bookingId, type: 'booking' }
      );
      reference = result.data.reference;
    }

    // Store payment record
    await supabase
      .from('payments')
      .insert({
        booking_id: bookingId,
        amount,
        payment_method: paymentMethod,
        checkout_request_id: checkoutRequestId,
        reference,
        status: 'pending',
        created_at: new Date().toISOString()
      });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Create folio payment intent
router.post('/folio/intent', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { folioId, amount, paymentMethod = 'card', guestId } = req.body;

    if (!folioId || !amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Folio ID and valid amount required' });
      return;
    }

    const intentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store payment intent
    const { data, error } = await supabase
      .from('payments')
      .insert({
        reference: intentId,
        folio_id: folioId,
        guest_id: guestId,
        amount,
        payment_method: paymentMethod,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      logger.error('Failed to create payment intent:', error);
      res.status(500).json({ success: false, message: 'Failed to create payment' });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        paymentIntentId: intentId,
        clientSecret: `${intentId}_secret_${Math.random().toString(36).substr(2, 16)}`,
        amount,
        status: 'pending'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Confirm folio payment
router.post('/folio/confirm/:paymentIntentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentIntentId } = req.params;

    // Get payment record
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*, folio:folios(id, balance)')
      .eq('reference', paymentIntentId)
      .single();

    if (fetchError || !payment) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }

    if (payment.status !== 'pending') {
      res.status(400).json({ success: false, message: `Cannot confirm payment with status: ${payment.status}` });
      return;
    }

    // Mock payment processing (95% success rate)
    const success = Math.random() > 0.05;
    const newStatus = success ? 'completed' : 'failed';

    // Update payment status
    await supabase
      .from('payments')
      .update({
        status: newStatus,
        completed_at: success ? new Date().toISOString() : null,
        error_message: success ? null : 'Payment declined'
      })
      .eq('reference', paymentIntentId);

    if (success && payment.folio_id) {
      // Add transaction to folio
      await supabase.from('folio_transactions').insert({
        folio_id: payment.folio_id,
        type: 'payment',
        description: `Payment via ${payment.payment_method}`,
        amount: payment.amount,
        payment_method: payment.payment_method,
        reference_number: paymentIntentId,
        created_by: (req as any).user?.id,
        created_at: new Date().toISOString()
      });

      // Update folio balance
      const currentBalance = payment.folio?.balance || 0;
      await supabase
        .from('folios')
        .update({
          balance: currentBalance - payment.amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.folio_id);

      logger.info(`Payment ${paymentIntentId} succeeded, folio ${payment.folio_id} updated`);
    }

    res.json({
      success: true,
      data: {
        paymentIntentId,
        status: newStatus,
        message: success ? 'Payment successful' : 'Payment failed'
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get folio payment history
router.get('/folio/:folioId/history', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { folioId } = req.params;

    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('folio_id', folioId)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch payments' });
      return;
    }

    res.json({ success: true, data: payments });
  } catch (error) {
    next(error);
  }
});

// Query payment status
router.get('/status/:reference', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reference } = req.params;

    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('reference', reference)
      .single();

    if (error || !payment) {
      res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    next(error);
  }
});

export default router;
