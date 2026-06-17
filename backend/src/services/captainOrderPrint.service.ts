import axios from 'axios';
import { logger } from '../utils/logger';
import { PYTHON_SERVICE_URL } from '../config/pythonService';

interface CaptainOrderPrintData {
  order_number: string;
  short_code?: string;
  customer_name: string;
  table_number?: string;
  room_number?: string;
  order_type?: string;
  items: Array<{
    name?: string;
    item_name?: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    notes?: string;
    special_instructions?: string;
  }>;
  total_amount: number;
  waiter_name?: string;
  outlet_name?: string;
  outlet_type?: string;
  created_at?: string;
}

/**
 * Service to handle automatic captain order printing for restaurant POS
 */
class CaptainOrderPrintService {
  private pythonServiceUrl: string;

  constructor() {
    this.pythonServiceUrl = PYTHON_SERVICE_URL;
  }

  /**
   * Print captain order to kitchen thermal printer
   * This is automatically called when a restaurant POS order is created
   */
  async printCaptainOrder(orderData: CaptainOrderPrintData): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      logger.info(`📄 Printing captain order ${orderData.order_number} to kitchen printer...`);

      // Format the receipt data for Python thermal printer service
      const receiptData = {
        receipt_type: 'CAPTAIN ORDER',
        receipt_number: orderData.short_code || orderData.order_number,
        order_number: orderData.order_number,
        short_code: orderData.short_code,
        barcode_value: orderData.short_code || orderData.order_number,
        lookup_code: orderData.short_code || orderData.order_number,
        
        // Customer/Location info
        customer_name: orderData.customer_name || 'Walk-in',
        table_number: orderData.table_number,
        room_number: orderData.room_number,
        order_type: orderData.order_type || 'dine_in',
        
        // Order items
        items: orderData.items.map((item, index) => ({
          id: index + 1,
          name: item.name || item.item_name || 'Item',
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.line_total,
          notes: item.notes || item.special_instructions || ''
        })),
        
        // Totals
        total_amount: orderData.total_amount,
        subtotal: orderData.total_amount,
        
        // Additional metadata
        waiter_name: orderData.waiter_name,
        outlet_name: orderData.outlet_name || 'Restaurant',
        outlet_type: orderData.outlet_type,
        date: orderData.created_at || new Date().toISOString(),
        
        // Kitchen-specific flags
        is_captain_order: true,
        print_to_kitchen: true
      };

      // Call Python thermal printer service
      const response = await axios.post(
        `${this.pythonServiceUrl}/api/receipts/printer/print`,
        receiptData,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000 // 10 second timeout
        }
      );

      if (response.data?.success) {
        logger.info(`✅ Captain order ${orderData.order_number} printed successfully`);
        return {
          success: true,
          message: `Captain order printed to kitchen`
        };
      } else {
        logger.warn(`⚠️ Captain order ${orderData.order_number} print failed: ${response.data?.error || 'Unknown error'}`);
        return {
          success: false,
          error: response.data?.error || 'Print failed'
        };
      }

    } catch (error: any) {
      logger.error(`❌ Error printing captain order ${orderData.order_number}:`, error);
      
      // Don't throw - printing failure should not block order creation
      return {
        success: false,
        error: error.message || 'Print service unavailable'
      };
    }
  }

  /**
   * Check if thermal printer service is available
   */
  async checkPrinterStatus(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.pythonServiceUrl}/api/receipts/printer/status`,
        { timeout: 5000 }
      );
      return response.data?.configured === true;
    } catch (error) {
      logger.warn('Thermal printer service not available');
      return false;
    }
  }
}

export const captainOrderPrintService = new CaptainOrderPrintService();
