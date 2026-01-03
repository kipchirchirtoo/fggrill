import { logger } from '../utils/logger';

interface BarcodeRequest {
  bookingId: string;
  format?: string;
  includeText?: boolean;
}

interface BookingCardRequest {
  booking_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  room_type: string;
  adults: number;
  children?: number;
}

class BarcodeGeneratorService {
  private pythonServiceUrl: string;

  constructor() {
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
  }

  /**
   * Generate barcode for booking ID
   */
  async generateBarcode(bookingId: string, format: string = 'code128', includeText: boolean = true): Promise<string | null> {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/api/barcode/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          booking_id: bookingId,
          format,
          include_text: includeText,
          return_base64: true
        })
      });

      if (!response.ok) {
        throw new Error(`Barcode service error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.barcode; // Base64 encoded barcode

    } catch (error) {
      logger.error('Error generating barcode:', error);
      return null;
    }
  }

  /**
   * Generate complete booking card with barcode and details
   */
  async generateBookingCard(bookingData: BookingCardRequest): Promise<string | null> {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/api/barcode/generate-card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingData)
      });

      if (!response.ok) {
        throw new Error(`Barcode service error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.booking_card; // Base64 encoded booking card

    } catch (error) {
      logger.error('Error generating booking card:', error);
      return null;
    }
  }

  /**
   * Generate QR code for booking
   */
  async generateQRCode(bookingId: string, bookingUrl?: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/api/barcode/generate-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          booking_id: bookingId,
          booking_url: bookingUrl
        })
      });

      if (!response.ok) {
        throw new Error(`Barcode service error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.qr_code; // Base64 encoded QR code

    } catch (error) {
      logger.error('Error generating QR code:', error);
      return null;
    }
  }

  /**
   * Get barcode image URL for embedding in emails
   */
  getBarcodeImageUrl(bookingId: string, format: string = 'code128', includeText: boolean = true): string {
    const params = new URLSearchParams({
      format,
      include_text: includeText.toString()
    });
    
    return `${this.pythonServiceUrl}/api/barcode/barcode-image/${bookingId}?${params.toString()}`;
  }

  /**
   * Test barcode service connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/api/barcode/health`);
      return response.ok;
    } catch (error) {
      logger.error('Barcode service connection failed:', error);
      return false;
    }
  }
}

export const barcodeGeneratorService = new BarcodeGeneratorService();
