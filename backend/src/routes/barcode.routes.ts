import express from 'express';
import {
  generateBarcode,
  generateQRCode,
  generateBookingCard,
  getBarcodeImageUrl,
  testBarcodeService
} from '../controllers/barcode.controller';

const router = express.Router();

// Public routes - no authentication required for barcode generation
router.post('/generate', generateBarcode);
router.post('/generate-qr', generateQRCode);
router.post('/generate-card', generateBookingCard);
router.get('/image-url/:bookingId', getBarcodeImageUrl);
router.get('/health', testBarcodeService);

export default router;
