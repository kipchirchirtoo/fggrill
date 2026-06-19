import axios from 'axios';
import { logger } from '../utils/logger';
import { PYTHON_SERVICE_URL } from '../config/pythonService';

interface CustomerReceiptPrintData {
  order_number: string;
  short_code?: string;
  customer_name?: string;
  items: Array<{
    name?: string;
    item_name?: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  amount_paid: number;
  payment_method?: string;
  cashier_name?: string;
  outlet_name?: string;
  created_at?: string;
}

/**
 * Service to handle automatic customer receipt printing for cashier POS payments
 */
class CustomerReceiptPrintService {
  private pythonServiceUrl: string;

  constructor() {
    this.pythonServiceUrl = PYTHON_SERVICE_URL;
  }

  /**
   * Print customer receipt to till printer.
   * Automatically called when a cashier records a POS payment.
   */
  async printCustomerReceipt(receiptData: CustomerReceiptPrintData): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      logger.info(`🧾 Printing customer receipt ${receiptData.order_number} to till printer...`);

      const payload = {
        receipt_type: 'sale',
        receipt_number: receiptData.short_code || receiptData.order_number,
        order_number: receiptData.order_number,
        short_code: receiptData.short_code,
        barcode_value: receiptData.short_code || receiptData.order_number,
        lookup_code: receiptData.short_code || receiptData.order_number,

        cashier_name: receiptData.cashier_name || 'STAFF',
        items: receiptData.items.map((item) => ({
          name: item.name || item.item_name || 'Item',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.line_total
        })),

        payment_method: receiptData.payment_method || 'cash',
        amount_paid: receiptData.amount_paid,
        outlet_name: receiptData.outlet_name || 'Restaurant',
        date: receiptData.created_at || new Date().toISOString(),

        is_captain_order: false,
        print_to_kitchen: false
      };

      const response = await axios.post(
        `${this.pythonServiceUrl}/api/receipts/printer/print`,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      if (response.data?.success) {
        logger.info(`✅ Customer receipt ${receiptData.order_number} printed successfully`);
        return { success: true, message: 'Customer receipt printed' };
      }

      logger.warn(`⚠️ Customer receipt ${receiptData.order_number} print failed: ${response.data?.error || 'Unknown error'}`);
      return { success: false, error: response.data?.error || 'Print failed' };
    } catch (error: any) {
      logger.error(`❌ Error printing customer receipt ${receiptData.order_number}:`, error);
      // Don't throw — printing failure should not block payment recording
      return { success: false, error: error.message || 'Print service unavailable' };
    }
  }
}

export const customerReceiptPrintService = new CustomerReceiptPrintService();
