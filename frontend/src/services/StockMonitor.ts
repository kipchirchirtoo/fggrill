import { monitorStockLevels } from '@/lib/workflows';

class StockMonitor {
  private intervalId: number | null = null;
  private checkInterval = 1800000; // 30 minutes

  constructor() {
    this.intervalId = null;
  }

  start() {
    if (this.intervalId) return;

    // Initial check
    this.checkStock();

    // Set up periodic checks
    this.intervalId = window.setInterval(() => {
      this.checkStock();
    }, this.checkInterval);
  }

  stop() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkStock() {
    try {
      await monitorStockLevels();
    } catch (error) {
      console.error('Stock monitoring error:', error);
    }
  }
}

export const stockMonitor = new StockMonitor();
