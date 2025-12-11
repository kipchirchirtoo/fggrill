import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

/**
 * Payment Controller
 * Mock payment gateway integration for hotel payments
 * In production, this would integrate with real payment providers (Stripe, M-Pesa, etc.)
 */

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
 * Get payment status
 */
export const getPaymentStatus = async (
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

    res.json({
      success: true,
      data: {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        paymentMethod: paymentIntent.paymentMethod,
        createdAt: paymentIntent.createdAt,
        updatedAt: paymentIntent.updatedAt,
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
    const { phoneNumber, amount, folioId, reservationId, accountReference } = req.body;

    if (!phoneNumber || !amount) {
      throw new AppError('Phone number and amount are required', 400);
    }

    // Validate phone number format (Kenyan)
    const phoneRegex = /^254[0-9]{9}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\D/g, ''))) {
      throw new AppError('Invalid phone number format. Use format: 254XXXXXXXXX', 400);
    }

    // Generate transaction ID
    const transactionId = `mpesa_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // In production, this would call the M-Pesa STK Push API
    // For demo, simulate the flow
    const paymentIntent: PaymentIntent = {
      id: transactionId,
      amount,
      currency: 'KES',
      status: 'pending',
      paymentMethod: 'mpesa',
      folioId,
      reservationId,
      metadata: { phoneNumber, accountReference },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    paymentIntents.set(transactionId, paymentIntent);

    console.log(`[M-Pesa] Initiated STK push to ${phoneNumber} for KES ${amount}`);

    res.json({
      success: true,
      data: {
        transactionId,
        message: 'STK push sent to customer phone. Awaiting confirmation.',
        status: 'pending',
        checkoutRequestId: `ws_CO_${Date.now()}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * M-Pesa callback (would be called by M-Pesa gateway)
 */
export const mpesaCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { Body } = req.body;
    
    // Parse M-Pesa callback format
    const resultCode = Body?.stkCallback?.ResultCode;
    const resultDesc = Body?.stkCallback?.ResultDesc;
    const checkoutRequestId = Body?.stkCallback?.CheckoutRequestID;

    console.log(`[M-Pesa Callback] Result: ${resultCode} - ${resultDesc}`);

    // Find payment intent by checkout ID
    // In production, we'd store the checkout ID mapping
    
    res.json({
      ResultCode: 0,
      ResultDesc: 'Callback received successfully',
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
