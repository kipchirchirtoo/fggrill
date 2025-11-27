import Stripe from 'stripe';
import { logger } from '../utils/logger';

class PaymentService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2023-10-16'
    });
  }

  async createPaymentIntent(amount: number, currency: string = 'kes'): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        automatic_payment_methods: {
          enabled: true
        }
      });

      logger.info(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error: any) {
      logger.error('Error creating payment intent:', error);
      throw new Error('Payment intent could not be created');
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
      logger.info(`Payment confirmed: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error: any) {
      logger.error('Error confirming payment:', error);
      throw new Error('Payment could not be confirmed');
    }
  }

  async createRefund(
    paymentIntentId: string,
    amount?: number
  ): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined // Convert to cents if amount provided
      });

      logger.info(`Refund created: ${refund.id}`);
      return refund;
    } catch (error: any) {
      logger.error('Error creating refund:', error);
      throw new Error('Refund could not be created');
    }
  }

  async createCustomer(
    email: string,
    name: string,
    phone?: string
  ): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        phone
      });

      logger.info(`Customer created: ${customer.id}`);
      return customer;
    } catch (error: any) {
      logger.error('Error creating customer:', error);
      throw new Error('Customer could not be created');
    }
  }

  async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });

      logger.info(`Payment method attached: ${paymentMethod.id}`);
      return paymentMethod;
    } catch (error: any) {
      logger.error('Error attaching payment method:', error);
      throw new Error('Payment method could not be attached');
    }
  }

  async createSubscription(
    customerId: string,
    priceId: string
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent']
      });

      logger.info(`Subscription created: ${subscription.id}`);
      return subscription;
    } catch (error: any) {
      logger.error('Error creating subscription:', error);
      throw new Error('Subscription could not be created');
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      logger.info(`Subscription cancelled: ${subscription.id}`);
      return subscription;
    } catch (error: any) {
      logger.error('Error cancelling subscription:', error);
      throw new Error('Subscription could not be cancelled');
    }
  }

  async createProduct(
    name: string,
    description?: string,
    images?: string[]
  ): Promise<Stripe.Product> {
    try {
      const product = await this.stripe.products.create({
        name,
        description,
        images
      });

      logger.info(`Product created: ${product.id}`);
      return product;
    } catch (error: any) {
      logger.error('Error creating product:', error);
      throw new Error('Product could not be created');
    }
  }

  async createPrice(
    productId: string,
    unitAmount: number,
    currency: string = 'kes',
    recurring?: { interval: 'day' | 'week' | 'month' | 'year' }
  ): Promise<Stripe.Price> {
    try {
      const price = await this.stripe.prices.create({
        product: productId,
        unit_amount: Math.round(unitAmount * 100), // Convert to cents
        currency,
        recurring
      });

      logger.info(`Price created: ${price.id}`);
      return price;
    } catch (error: any) {
      logger.error('Error creating price:', error);
      throw new Error('Price could not be created');
    }
  }

  async handleWebhookEvent(
    signature: string,
    payload: Buffer
  ): Promise<void> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET as string
      );

      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;
        default:
          logger.info(`Unhandled event type: ${event.type}`);
      }
    } catch (error: any) {
      logger.error('Error handling webhook:', error);
      throw new Error('Webhook could not be processed');
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    // Update booking/order status
    logger.info(`Payment succeeded: ${paymentIntent.id}`);
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    // Handle failed payment
    logger.error(`Payment failed: ${paymentIntent.id}`);
  }

  private async handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
    // Handle new subscription
    logger.info(`Subscription created: ${subscription.id}`);
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    // Handle cancelled subscription
    logger.info(`Subscription deleted: ${subscription.id}`);
  }
}

export const paymentService = new PaymentService();
