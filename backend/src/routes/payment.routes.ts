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
router.post('/booking/initiate', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
      const email = (req as any).user.email;
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
