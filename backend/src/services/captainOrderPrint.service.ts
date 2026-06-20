import axios from 'axios';
import { logger } from '../utils/logger';
import { PYTHON_SERVICE_URL } from '../config/pythonService';

/**
 * Captain-order printing itself now happens entirely client-side (see
 * BAR_CASHIER_CAPTAIN_ORDER_OUTLET_TYPES in outlet-pos.controller.ts) since
 * this backend and python-services run in the cloud with no network path to
 * a branch's USB/LAN till printer. This service only reports whether
 * python-services' configured printer is reachable, for the
 * GET /printer/status endpoint.
 */
class CaptainOrderPrintService {
  private pythonServiceUrl: string;

  constructor() {
    this.pythonServiceUrl = PYTHON_SERVICE_URL;
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
