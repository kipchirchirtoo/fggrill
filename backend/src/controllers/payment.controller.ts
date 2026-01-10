import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { mpesaService } from '../services/mpesa.service';
import { paystackService } from '../services/paystack.service';
import { logger } from '../utils/logger';
import { emailService } from '../services/email.service';

/**
 * Payment Controller
 * Handles payment processing for M-Pesa and Paystack
 */

/**
 * Helper function to send booking confirmation email after successful payment
 */
async function sendBookingConfirmationEmail(bookingId: string): Promise<void> {
  try {
    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from('reservations')
      .select(`
        *,
        guest:guests(*),
        room:rooms(room_number, room_type:room_types(name))
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      logger.error('Failed to fetch booking for email:', bookingError);
      return;
    }

    const guest = Array.isArray(booking.guest) ? booking.guest[0] : booking.guest;
    const room = Array.isArray(booking.room) ? booking.room[0] : booking.room;

    if (!guest || !guest.email) {
      logger.error('No guest email found for booking:', bookingId);
      return;
    }

    const bookingDetails = {
      id: booking.id,
      confirmation_number: booking.confirmation_number,
      guest_name: `${guest.first_name} ${guest.last_name}`,
      check_in: booking.check_in_date,
      check_out: booking.check_out_date,
      room_number: room?.room_number || 'TBA',
      room_type: room?.room_type?.name || 'Standard',
      adults: booking.adults,
      children: booking.children || 0,
      total_amount: booking.total_amount,
      special_requests: booking.special_requests,
      room_rate: booking.room_rate,
      subtotal: booking.subtotal,
      tax_amount: booking.tax_amount,
      service_charge: booking.service_charge,
      deposit_paid: true,
      payment_method: booking.payment_method
    };

    await emailService.sendBookingConfirmation(guest.email, bookingDetails);
    logger.info(`Booking confirmation email sent to ${guest.email} for booking ${bookingId}`);
  } catch (error) {
    logger.error('Error sending booking confirmation email:', error);
  }
}

/**
 * Shared helper to record accounting payments from gateways
 */
async function processAccountingPayment(
  type: 'invoice' | 'bill',
  id: string,
  amount: number,
  reference: string,
  method: string,
  notes?: string
): Promise<void> {
  try {
    const table = type === 'invoice' ? 'accounting_ar_invoices' : 'accounting_ap_bills';
    const idField = 'id';

    // 1. Get the document
    const { data: doc, error: docError } = await supabase
      .from(table)
      .select('*')
      .eq(idField, id)
      .single();

    if (docError || !doc) {
      logger.error(`Accounting ${type} not found: ${id}`);
      return;
    }

    // 2. Calculate new totals
    const paymentAmount = Number(amount);
    const newPaidAmount = (doc.paid_amount || 0) + paymentAmount;
    const newBalance = doc.total_amount - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partially_paid' : 'unpaid');

    // 3. Update document
    await supabase
      .from(table)
      .update({
        paid_amount: newPaidAmount,
        balance: newBalance,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq(idField, id);

    // 4. Record bank transaction
    // Find first active M-Pesa/Bank account
    const { data: bankAcc } = await supabase
      .from('accounting_bank_accounts')
      .select('*')
      .eq('account_type', method === 'mpesa' ? 'mpesa' : 'savings')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (bankAcc) {
      await supabase.from('accounting_bank_transactions').insert({
        bank_account_id: bankAcc.id,
        transaction_date: new Date().toISOString().split('T')[0],
        debit_amount: type === 'invoice' ? paymentAmount : 0,
        credit_amount: type === 'bill' ? paymentAmount : 0,
        reference: reference,
        description: notes || `Payment via ${method} for ${type} ${doc.invoice_number || doc.bill_number}`,
        reconciled: false
      });

      // Update balance
      const balanceChange = type === 'invoice' ? paymentAmount : -paymentAmount;
      await supabase.from('accounting_bank_accounts').update({
        current_balance: (bankAcc.current_balance || 0) + balanceChange,
        updated_at: new Date().toISOString()
      }).eq('id', bankAcc.id);
    }
  } catch (error) {
    logger.error(`Error in processAccountingPayment (${type}):`, error);
  }
}

interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  paymentMethod: string;
  folioId?: string;
  reservationId?: string;
  guestId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory store for demo (would be in database in production)
const paymentIntents: Map<string, PaymentIntent> = new Map();

/**
 * Create a payment intent
 */
export const createPaymentIntent = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { amount, currency = 'KES', paymentMethod, folioId, reservationId, guestId, metadata } = req.body;

    if (!amount || amount <= 0) {
      throw new AppError('Invalid payment amount', 400);
    }

    // Generate payment intent ID
    const intentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const paymentIntent: PaymentIntent = {
      id: intentId,
      amount,
      currency,
      status: 'pending',
      paymentMethod: paymentMethod || 'card',
      folioId,
      reservationId,
      guestId,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    paymentIntents.set(intentId, paymentIntent);

    // Log payment intent creation
    console.log(`[Payment] Created intent ${intentId} for ${amount} ${currency}`);

    res.status(201).json({
      success: true,
      data: {
        clientSecret: `${intentId}_secret_${Math.random().toString(36).substr(2, 16)}`,
        paymentIntentId: intentId,
        amount,
        currency,
        status: paymentIntent.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm/Process a payment
 */
export const confirmPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { paymentIntentId } = req.params;
    const { paymentMethodDetails } = req.body;

    const paymentIntent = paymentIntents.get(paymentIntentId);
    if (!paymentIntent) {
      throw new AppError('Payment intent not found', 404);
    }

    if (paymentIntent.status !== 'pending') {
      throw new AppError(`Payment cannot be confirmed. Current status: ${paymentIntent.status}`, 400);
    }

    // Simulate payment processing
    paymentIntent.status = 'processing';
    paymentIntent.updatedAt = new Date();

    // Mock async processing (simulate gateway delay)
    setTimeout(async () => {
      // 95% success rate for demo
      const success = Math.random() > 0.05;
      paymentIntent.status = success ? 'succeeded' : 'failed';
      paymentIntent.updatedAt = new Date();

      if (success && paymentIntent.folioId) {
        // Record payment in folio transactions
        try {
          await supabase.from('folio_transactions').insert({
            folio_id: paymentIntent.folioId,
            type: 'payment',
            description: `Payment via ${paymentIntent.paymentMethod}`,
            amount: paymentIntent.amount,
            payment_method: paymentIntent.paymentMethod,
            reference_number: paymentIntent.id,
            created_by: req.user?.id,
          });

          // Update folio balance
          const { data: folio } = await supabase
            .from('folios')
            .select('balance')
            .eq('id', paymentIntent.folioId)
            .single();

          if (folio) {
            await supabase
              .from('folios')
              .update({
                balance: (folio.balance || 0) - paymentIntent.amount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', paymentIntent.folioId);
          }

          console.log(`[Payment] Payment ${paymentIntent.id} succeeded, folio updated`);
        } catch (err) {
          console.error('[Payment] Failed to update folio:', err);
        }
      }
    }, 1500);

    res.json({
      success: true,
      data: {
        paymentIntentId: paymentIntent.id,
        status: 'processing',
        message: 'Payment is being processed',
      },
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Cancel a payment intent
 */
export const cancelPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { paymentIntentId } = req.params;

    const paymentIntent = paymentIntents.get(paymentIntentId);
    if (!paymentIntent) {
      throw new AppError('Payment intent not found', 404);
    }

    if (paymentIntent.status === 'succeeded') {
      throw new AppError('Cannot cancel a succeeded payment. Use refund instead.', 400);
    }

    paymentIntent.status = 'cancelled';
    paymentIntent.updatedAt = new Date();

    res.json({
      success: true,
      data: {
        paymentIntentId: paymentIntent.id,
        status: 'cancelled',
        message: 'Payment has been cancelled',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process M-Pesa payment (Kenya mobile money)
 */
export const initiateMpesaPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { phoneNumber, amount, bookingId, invoiceId, billId, accountReference } = req.body;

    if (!phoneNumber || !amount) {
      throw new AppError('Phone number and amount are required', 400);
    }

    // Generate unique account reference
    const reference = accountReference || `FGH-${bookingId || Date.now()}`;
    const description = `Payment for booking ${reference}`;

    // Call actual M-Pesa STK Push
    const stkResponse = await mpesaService.stkPush(
      phoneNumber,
      amount,
      reference,
      description
    );

    // Store payment record in database
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        reference: stkResponse.CheckoutRequestID,
        amount,
        currency: 'KES',
        payment_method: 'mpesa',
        status: 'pending',
        booking_id: bookingId,
        invoice_id: invoiceId,
        bill_id: billId,
        metadata: {
          phoneNumber,
          merchantRequestId: stkResponse.MerchantRequestID,
          checkoutRequestId: stkResponse.CheckoutRequestID
        }
      })
      .select()
      .single();

    if (error) {
      logger.error('Error storing payment record:', error);
      throw new AppError('Failed to store payment record', 500);
    }

    logger.info(`M-Pesa STK Push initiated: ${stkResponse.CheckoutRequestID}`);

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        checkoutRequestId: stkResponse.CheckoutRequestID,
        merchantRequestId: stkResponse.MerchantRequestID,
        message: stkResponse.CustomerMessage || 'STK push sent to customer phone. Please complete payment on your phone.',
        status: 'pending'
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * M-Pesa callback (called by M-Pesa gateway)
 */
export const mpesaCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { Body } = req.body;

    // Parse M-Pesa callback format
    const stkCallback = Body?.stkCallback;
    const resultCode = stkCallback?.ResultCode;
    const resultDesc = stkCallback?.ResultDesc;
    const checkoutRequestId = stkCallback?.CheckoutRequestID;
    const merchantRequestId = stkCallback?.MerchantRequestID;

    logger.info(`M-Pesa Callback received: ${resultCode} - ${resultDesc}`);

    // Find payment record
    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*')
      .eq('reference', checkoutRequestId)
      .single();

    if (findError || !payment) {
      logger.error('Payment not found for checkout request:', checkoutRequestId);
      res.json({ ResultCode: 1, ResultDesc: 'Payment not found' });
      return;
    }

    let status = 'failed';
    let metadata = payment.metadata || {};

    if (resultCode === '0') {
      // Payment successful
      status = 'completed';

      // Extract payment details from callback
      const callbackMetadata = stkCallback?.CallbackMetadata?.Item || [];
      const paymentDetails: any = {};

      callbackMetadata.forEach((item: any) => {
        switch (item.Name) {
          case 'Amount':
            paymentDetails.amount = item.Value;
            break;
          case 'MpesaReceiptNumber':
            paymentDetails.mpesaReceiptNumber = item.Value;
            break;
          case 'TransactionDate':
            paymentDetails.transactionDate = item.Value;
            break;
          case 'PhoneNumber':
            paymentDetails.phoneNumber = item.Value;
            break;
        }
      });

      metadata = { ...metadata, ...paymentDetails };
    } else {
      // Payment failed
      metadata.failureReason = resultDesc;
    }

    // Update payment status
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status,
        metadata,
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      logger.error('Error updating payment status:', updateError);
    }

    // If payment successful and has booking_id, update booking status and send email
    if (status === 'completed' && payment.booking_id) {
      await supabase
        .from('reservations')
        .update({
          deposit_paid: true,
          deposit_paid_at: new Date().toISOString(),
          status: 'confirmed'
        })
        .eq('id', payment.booking_id);

      // Send booking confirmation email
      await sendBookingConfirmationEmail(payment.booking_id);

      // Record payment in folio
      try {
        const { Folio } = await import('../models/Folio');
        const folio = await Folio.findByReservationId(payment.booking_id);
        if (folio) {
          await folio.addTransaction({
            type: 'payment',
            category: 'Accommodation',
            amount: payment.amount,
            description: `M-Pesa Payment (${metadata.mpesaReceiptNumber || 'Success'})`,
            referenceNumber: payment.reference,
            performedBy: 'SYSTEM'
          });
          logger.info(`Folio transaction added for M-Pesa booking ${payment.booking_id}`);
        }
      } catch (folioErr) {
        logger.error('Failed to update folio after M-Pesa payment:', folioErr);
      }
    }

    // If payment successful and has invoice_id, update invoice
    if (status === 'completed' && payment.invoice_id) {
      await processAccountingPayment(
        'invoice',
        payment.invoice_id,
        payment.amount,
        metadata.mpesaReceiptNumber || payment.reference,
        'mpesa',
        `M-Pesa payment received. Receipt: ${metadata.mpesaReceiptNumber || 'N/A'}`
      );
    }

    // If payment successful and has bill_id, update bill
    if (status === 'completed' && payment.bill_id) {
      await processAccountingPayment(
        'bill',
        payment.bill_id,
        payment.amount,
        metadata.mpesaReceiptNumber || payment.reference,
        'mpesa',
        `M-Pesa payment made. Receipt: ${metadata.mpesaReceiptNumber || 'N/A'}`
      );
    }

    logger.info(`Payment ${payment.id} updated to status: ${status}`);

    res.json({
      ResultCode: 0,
      ResultDesc: 'Callback processed successfully',
    });
  } catch (error) {
    logger.error('Error processing M-Pesa callback:', error);
    res.json({
      ResultCode: 1,
      ResultDesc: 'Callback processing failed',
    });
  }
};

/**
 * Initiate Paystack payment
 */
export const initiatePaystackPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, amount, bookingId, invoiceId, billId, metadata } = req.body;

    if (!email || !amount) {
      throw new AppError('Email and amount are required', 400);
    }

    // Generate unique reference
    const reference = `FGH-${bookingId || Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Build callback URL with booking ID
    const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/booking/confirmation?bookingId=${bookingId}&reference=${reference}`;

    // Initialize Paystack transaction
    const paystackResponse = await paystackService.initializeTransaction(
      email,
      amount,
      reference,
      { bookingId, ...metadata },
      callbackUrl
    );

    // Store payment record in database
    const { data: payment, error } = await supabase
      .from('payments')
      .insert({
        reference: paystackResponse.data.reference,
        amount,
        currency: 'KES',
        payment_method: 'paystack',
        status: 'pending',
        booking_id: bookingId,
        invoice_id: invoiceId,
        bill_id: billId,
        metadata: {
          email,
          authorization_url: paystackResponse.data.authorization_url,
          access_code: paystackResponse.data.access_code
        }
      })
      .select()
      .single();

    if (error) {
      logger.error('Error storing Paystack payment record:', error);
      throw new AppError('Failed to store payment record', 500);
    }

    logger.info(`Paystack transaction initialized: ${paystackResponse.data.reference}`);

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        reference: paystackResponse.data.reference,
        authorization_url: paystackResponse.data.authorization_url,
        access_code: paystackResponse.data.access_code,
        message: 'Payment initialized. Redirect user to authorization URL.',
        status: 'pending'
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Paystack webhook handler
 */
export const paystackWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { event, data } = req.body;

    logger.info(`Paystack webhook received: ${event}`);

    if (event === 'charge.success') {
      const reference = data.reference;

      // Find payment record
      const { data: payment, error: findError } = await supabase
        .from('payments')
        .select('*')
        .eq('reference', reference)
        .single();

      if (findError || !payment) {
        logger.error('Payment not found for reference:', reference);
        res.status(404).json({ message: 'Payment not found' });
        return;
      }

      // Verify transaction with Paystack
      const verificationResponse = await paystackService.verifyTransaction(reference);

      if (verificationResponse.status && verificationResponse.data.status === 'success') {
        // Update payment status
        const { error: updateError } = await supabase
          .from('payments')
          .update({
            status: 'completed',
            metadata: {
              ...payment.metadata,
              gateway_response: verificationResponse.data.gateway_response,
              paid_at: verificationResponse.data.paid_at,
              channel: verificationResponse.data.channel,
              fees: verificationResponse.data.fees,
              authorization: verificationResponse.data.authorization
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id);

        if (updateError) {
          logger.error('Error updating Paystack payment status:', updateError);
        }

        // If payment successful and has booking_id, update booking status and send email
        if (payment.booking_id) {
          await supabase
            .from('reservations')
            .update({
              deposit_paid: true,
              deposit_paid_at: new Date().toISOString(),
              status: 'confirmed'
            })
            .eq('id', payment.booking_id);

          // Send booking confirmation email
          await sendBookingConfirmationEmail(payment.booking_id);

          // Record payment in folio
          try {
            const { Folio } = await import('../models/Folio');
            const folio = await Folio.findByReservationId(payment.booking_id);
            if (folio) {
              await folio.addTransaction({
                type: 'payment',
                category: 'Accommodation',
                amount: payment.amount,
                description: `Paystack Card Payment`,
                referenceNumber: payment.reference,
                performedBy: 'SYSTEM'
              });
              logger.info(`Folio transaction added for Paystack booking ${payment.booking_id}`);
            }
          } catch (folioErr) {
            logger.error('Failed to update folio after Paystack payment:', folioErr);
          }
        }

        // If payment successful and has invoice_id, update invoice
        if (payment.invoice_id) {
          await processAccountingPayment(
            'invoice',
            payment.invoice_id,
            payment.amount,
            payment.reference,
            'paystack',
            `Paystack payment received. Ref: ${payment.reference}`
          );
        }

        // If payment successful and has bill_id, update bill
        if (payment.bill_id) {
          await processAccountingPayment(
            'bill',
            payment.bill_id,
            payment.amount,
            payment.reference,
            'paystack',
            `Paystack payment made. Ref: ${payment.reference}`
          );
        }

        logger.info(`Paystack payment ${payment.id} completed successfully`);
      }
    }

    res.status(200).json({ message: 'Webhook processed successfully' });
  } catch (error) {
    logger.error('Error processing Paystack webhook:', error);
    res.status(500).json({ message: 'Webhook processing failed' });
  }
};

/**
 * Verify Paystack payment
 */
import { paymentVerificationService } from '../services/payment.verification.service';

/**
 * Verify Paystack payment
 */
export const verifyPaystackPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reference } = req.params;

    // Verify with Paystack
    const verificationResponse = await paystackService.verifyTransaction(reference);

    // Find payment record
    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*')
      .eq('reference', reference)
      .single();

    if (findError || !payment) {
      throw new AppError('Payment not found', 404);
    }

    let status = 'failed';
    if (verificationResponse.status && verificationResponse.data.status === 'success') {
      status = 'completed';

      // Update payment status if not already updated
      if (payment.status !== 'completed') {
        await supabase
          .from('payments')
          .update({
            status: 'completed',
            metadata: {
              ...payment.metadata,
              gateway_response: verificationResponse.data.gateway_response,
              paid_at: verificationResponse.data.paid_at,
              channel: verificationResponse.data.channel,
              fees: verificationResponse.data.fees
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', payment.id);

        // Update booking status and send email
        if (payment.booking_id) {
          await supabase
            .from('reservations')
            .update({
              deposit_paid: true,
              deposit_paid_at: new Date().toISOString()
            })
            .eq('id', payment.booking_id);

          // Send booking confirmation email
          await sendBookingConfirmationEmail(payment.booking_id);
        }
      }
    }

    // Perform strict verification
    const strictVerification = await paymentVerificationService.verifyTransaction(
      reference,
      verificationResponse.data.amount / 100
    );

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        reference,
        status,
        amount: verificationResponse.data.amount / 100, // Convert from kobo
        gateway_response: verificationResponse.data.gateway_response,
        paid_at: verificationResponse.data.paid_at,
        strict_verification: strictVerification
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Strict Payment Verification Endpoint
 */
export const verifyStrictPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reference, expectedAmount } = req.body;

    if (!reference || !expectedAmount) {
      throw new AppError('Reference and expected amount are required', 400);
    }

    const verificationResult = await paymentVerificationService.verifyTransaction(reference, expectedAmount);

    res.json({
      success: verificationResult.isValid,
      message: verificationResult.message,
      data: verificationResult.details
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unified booking payment initiation
 */
export const initiateBookingPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bookingId, phoneNumber, email, amount, paymentMethod } = req.body;

    if (!bookingId || !amount || !paymentMethod) {
      throw new AppError('Booking ID, amount, and payment method are required', 400);
    }

    if (paymentMethod === 'mpesa') {
      if (!phoneNumber) {
        throw new AppError('Phone number is required for M-Pesa payments', 400);
      }

      // Delegate to M-Pesa handler
      req.body = { phoneNumber, amount, bookingId };
      return initiateMpesaPayment(req, res, next);
    } else if (paymentMethod === 'paystack') {
      if (!email) {
        throw new AppError('Email is required for Paystack payments', 400);
      }

      // Delegate to Paystack handler
      req.body = { email, amount, bookingId };
      return initiatePaystackPayment(req, res, next);
    } else {
      throw new AppError('Unsupported payment method', 400);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment status
 */
export const getPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { paymentId } = req.params;

    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      throw new AppError('Payment not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: payment.id,
        reference: payment.reference,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        payment_method: payment.payment_method,
        booking_id: payment.booking_id,
        metadata: payment.metadata,
        created_at: payment.created_at,
        updated_at: payment.updated_at
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment history for a folio
 */
export const getFolioPayments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { folioId } = req.params;

    const { data: transactions, error } = await supabase
      .from('folio_transactions')
      .select('*')
      .eq('folio_id', folioId)
      .eq('type', 'payment')
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError('Failed to fetch payment history', 500);
    }

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};
