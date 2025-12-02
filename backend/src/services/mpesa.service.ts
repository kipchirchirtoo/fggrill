import axios from 'axios';
import { logger } from '../utils/logger';

interface MpesaTokenResponse {
  access_token: string;
  expires_in: string;
}

interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

interface STKQueryResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: string;
  ResultDesc: string;
}

interface B2CResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

class MpesaService {
  private consumerKey: string;
  private consumerSecret: string;
  private environment: 'sandbox' | 'production';
  private baseURL: string;
  private businessShortCode: string;
  private passkey: string;
  private initiatorName: string;
  private initiatorPassword: string;
  private securityCredential: string;

  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY || '';
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET || '';
    this.environment = (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox';
    this.businessShortCode = process.env.MPESA_SHORTCODE || '';
    this.passkey = process.env.MPESA_PASSKEY || '';
    this.initiatorName = process.env.MPESA_INITIATOR_NAME || '';
    this.initiatorPassword = process.env.MPESA_INITIATOR_PASSWORD || '';
    this.securityCredential = process.env.MPESA_SECURITY_CREDENTIAL || '';

    this.baseURL = this.environment === 'production'
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';

    if (!this.consumerKey || !this.consumerSecret) {
      logger.warn('M-Pesa credentials not configured');
    }
  }

  /**
   * Get OAuth access token
   */
  private async getAccessToken(): Promise<string> {
    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get<MpesaTokenResponse>(
        `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`
          }
        }
      );

      return response.data.access_token;
    } catch (error: any) {
      logger.error('Error getting M-Pesa access token:', error.response?.data || error.message);
      throw new Error('Failed to get M-Pesa access token');
    }
  }

  /**
   * Generate password for STK push
   */
  private generatePassword(timestamp: string): string {
    const str = this.businessShortCode + this.passkey + timestamp;
    return Buffer.from(str).toString('base64');
  }

  /**
   * Generate timestamp in MPESA format
   */
  private generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Initiate STK Push (Lipa Na M-Pesa Online)
   */
  async stkPush(
    phoneNumber: string,
    amount: number,
    accountReference: string,
    transactionDesc: string,
    callbackUrl?: string
  ): Promise<STKPushResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);

      // Format phone number (remove leading 0, add 254)
      const formattedPhone = phoneNumber.startsWith('0')
        ? '254' + phoneNumber.substring(1)
        : phoneNumber.startsWith('+254')
        ? phoneNumber.substring(1)
        : phoneNumber.startsWith('254')
        ? phoneNumber
        : '254' + phoneNumber;

      const response = await axios.post<STKPushResponse>(
        `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.businessShortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.round(amount),
          PartyA: formattedPhone,
          PartyB: this.businessShortCode,
          PhoneNumber: formattedPhone,
          CallBackURL: callbackUrl || process.env.MPESA_CALLBACK_URL || 'https://yourdomain.com/api/mpesa/callback',
          AccountReference: accountReference,
          TransactionDesc: transactionDesc
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`M-Pesa STK Push initiated: ${response.data.CheckoutRequestID}`);
      return response.data;
    } catch (error: any) {
      logger.error('Error initiating M-Pesa STK Push:', error.response?.data || error.message);
      throw new Error('Failed to initiate M-Pesa payment');
    }
  }

  /**
   * Query STK Push transaction status
   */
  async queryStkPush(checkoutRequestId: string): Promise<STKQueryResponse> {
    try {
      const accessToken = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(timestamp);

      const response = await axios.post<STKQueryResponse>(
        `${this.baseURL}/mpesa/stkpushquery/v1/query`,
        {
          BusinessShortCode: this.businessShortCode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Error querying M-Pesa STK Push:', error.response?.data || error.message);
      throw new Error('Failed to query M-Pesa transaction');
    }
  }

  /**
   * B2C Payment (Business to Customer) - For payroll disbursements
   */
  async b2cPayment(
    phoneNumber: string,
    amount: number,
    remarks: string,
    occasion: string,
    resultUrl?: string,
    queueTimeoutUrl?: string
  ): Promise<B2CResponse> {
    try {
      const accessToken = await this.getAccessToken();

      // Format phone number
      const formattedPhone = phoneNumber.startsWith('0')
        ? '254' + phoneNumber.substring(1)
        : phoneNumber.startsWith('+254')
        ? phoneNumber.substring(1)
        : phoneNumber.startsWith('254')
        ? phoneNumber
        : '254' + phoneNumber;

      const response = await axios.post<B2CResponse>(
        `${this.baseURL}/mpesa/b2c/v1/paymentrequest`,
        {
          InitiatorName: this.initiatorName,
          SecurityCredential: this.securityCredential,
          CommandID: 'BusinessPayment',
          Amount: Math.round(amount),
          PartyA: this.businessShortCode,
          PartyB: formattedPhone,
          Remarks: remarks,
          QueueTimeOutURL: queueTimeoutUrl || process.env.MPESA_TIMEOUT_URL || 'https://yourdomain.com/api/mpesa/timeout',
          ResultURL: resultUrl || process.env.MPESA_RESULT_URL || 'https://yourdomain.com/api/mpesa/result',
          Occasion: occasion
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`M-Pesa B2C payment initiated: ${response.data.ConversationID}`);
      return response.data;
    } catch (error: any) {
      logger.error('Error initiating M-Pesa B2C payment:', error.response?.data || error.message);
      throw new Error('Failed to initiate M-Pesa disbursement');
    }
  }

  /**
   * Bulk B2C payments for payroll
   */
  async bulkB2CPayments(payments: Array<{
    phoneNumber: string;
    amount: number;
    remarks: string;
    occasion: string;
  }>): Promise<Array<B2CResponse | { error: string }>> {
    const results: Array<B2CResponse | { error: string }> = [];

    for (const payment of payments) {
      try {
        const result = await this.b2cPayment(
          payment.phoneNumber,
          payment.amount,
          payment.remarks,
          payment.occasion
        );
        results.push(result);
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        logger.error(`Failed B2C payment for ${payment.phoneNumber}:`, error.message);
        results.push({ error: error.message });
      }
    }

    return results;
  }

  /**
   * Check account balance
   */
  async checkBalance(resultUrl?: string, queueTimeoutUrl?: string): Promise<any> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseURL}/mpesa/accountbalance/v1/query`,
        {
          Initiator: this.initiatorName,
          SecurityCredential: this.securityCredential,
          CommandID: 'AccountBalance',
          PartyA: this.businessShortCode,
          IdentifierType: '4',
          Remarks: 'Balance query',
          QueueTimeOutURL: queueTimeoutUrl || process.env.MPESA_TIMEOUT_URL || 'https://yourdomain.com/api/mpesa/timeout',
          ResultURL: resultUrl || process.env.MPESA_RESULT_URL || 'https://yourdomain.com/api/mpesa/result'
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error('Error checking M-Pesa balance:', error.response?.data || error.message);
      throw new Error('Failed to check M-Pesa balance');
    }
  }
}

export const mpesaService = new MpesaService();
