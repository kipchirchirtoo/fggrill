import axios from 'axios';
import { logger } from '../utils/logger';

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: any;
    fees: number;
    customer: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
    };
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
    };
  };
}

interface PaystackTransferResponse {
  status: boolean;
  message: string;
  data: {
    integration: number;
    domain: string;
    amount: number;
    currency: string;
    source: string;
    reason: string;
    recipient: number;
    status: string;
    transfer_code: string;
    id: number;
    createdAt: string;
    updatedAt: string;
  };
}

interface RecipientData {
  type: 'nuban' | 'mobile_money' | 'basa';
  name: string;
  account_number: string;
  bank_code: string;
  currency?: string;
}

class PaystackService {
  private apiKey: string;
  private baseURL: string = 'https://api.paystack.co';

  constructor() {
    this.apiKey = process.env.PAYSTACK_SECRET_KEY || '';
    if (!this.apiKey) {
      logger.warn('Paystack API key not configured');
    }
  }

  /**
   * Initialize a payment transaction
   */
  async initializeTransaction(
    email: string,
    amount: number,
    reference?: string,
    metadata?: any
  ): Promise<PaystackInitializeResponse> {
    try {
      const response = await axios.post<PaystackInitializeResponse>(
        `${this.baseURL}/transaction/initialize`,
        {
          email,
          amount: amount * 100, // Convert to kobo
          reference: reference || this.generateReference(),
          metadata,
          currency: 'KES'
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Paystack transaction initialized: ${response.data.data.reference}`);
      return response.data;
    } catch (error: any) {
      logger.error('Error initializing Paystack transaction:', error.response?.data || error.message);
      throw new Error('Failed to initialize payment');
    }
  }

  /**
   * Verify a payment transaction
   */
  async verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
    try {
      const response = await axios.get<PaystackVerifyResponse>(
        `${this.baseURL}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`
          }
        }
      );

      logger.info(`Paystack transaction verified: ${reference}`);
      return response.data;
    } catch (error: any) {
      logger.error('Error verifying Paystack transaction:', error.response?.data || error.message);
      throw new Error('Failed to verify payment');
    }
  }

  /**
   * Create a transfer recipient
   */
  async createTransferRecipient(recipientData: RecipientData): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseURL}/transferrecipient`,
        {
          ...recipientData,
          currency: recipientData.currency || 'KES'
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Transfer recipient created: ${response.data.data.recipient_code}`);
      return response.data;
    } catch (error: any) {
      logger.error('Error creating transfer recipient:', error.response?.data || error.message);
      throw new Error('Failed to create transfer recipient');
    }
  }

  /**
   * Initiate a transfer (for payroll disbursements)
   */
  async initiateTransfer(
    amount: number,
    recipientCode: string,
    reason: string,
    reference?: string
  ): Promise<PaystackTransferResponse> {
    try {
      const response = await axios.post<PaystackTransferResponse>(
        `${this.baseURL}/transfer`,
        {
          source: 'balance',
          amount: amount * 100, // Convert to kobo
          recipient: recipientCode,
          reason,
          reference: reference || this.generateReference(),
          currency: 'KES'
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Transfer initiated: ${response.data.data.transfer_code}`);
      return response.data;
    } catch (error: any) {
      logger.error('Error initiating transfer:', error.response?.data || error.message);
      throw new Error('Failed to initiate transfer');
    }
  }

  /**
   * Bulk transfer (for payroll batch processing)
   */
  async bulkTransfer(transfers: Array<{
    amount: number;
    recipient: string;
    reason: string;
    reference?: string;
  }>): Promise<any> {
    try {
      const formattedTransfers = transfers.map(t => ({
        ...t,
        amount: t.amount * 100, // Convert to kobo
        reference: t.reference || this.generateReference()
      }));

      const response = await axios.post(
        `${this.baseURL}/transfer/bulk`,
        {
          currency: 'KES',
          source: 'balance',
          transfers: formattedTransfers
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Bulk transfer initiated: ${formattedTransfers.length} transfers`);
      return response.data;
    } catch (error: any) {
      logger.error('Error initiating bulk transfer:', error.response?.data || error.message);
      throw new Error('Failed to initiate bulk transfer');
    }
  }

  /**
   * Get list of supported banks
   */
  async getBanks(country: string = 'kenya'): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseURL}/bank?country=${country}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Error fetching banks:', error.response?.data || error.message);
      throw new Error('Failed to fetch banks');
    }
  }

  /**
   * Verify bank account
   */
  async verifyBankAccount(accountNumber: string, bankCode: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseURL}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Error verifying bank account:', error.response?.data || error.message);
      throw new Error('Failed to verify bank account');
    }
  }

  /**
   * Generate unique reference
   */
  private generateReference(): string {
    return `FGH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const paystackService = new PaystackService();
