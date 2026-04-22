/**
 * Dispatch Routes
 * 
 * Central Store Scanning & Inventory Workflow
 * Handles barcode generation, dispatch creation with dual OTP,
 * OTP verification, document uploads, and auditor reviews
 */

import express from 'express';
import multer from 'multer';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

// Configure multer for file uploads (5MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  },
});

// Import controllers (to be created)
import {
  getCentralDashboard,
  receiveItem,
  getItems,
  searchByBarcode,
  generateBarcode,
  printBarcodeLabel,
} from '../controllers/dispatch/items.controller';

import {
  createDispatch,
  getDispatches,
  getDispatchById,
  verifyDriverOtp,
  verifyBranchOtp,
  uploadDocument,
  getDispatchDocuments,
} from '../controllers/dispatch/dispatches.controller';

import {
  getAuditorDeliveries,
  getAuditorDeliveryDetail,
  reviewDelivery,
} from '../controllers/dispatch/auditor.controller';

import {
  generatePosBarcode,
  scanPosBarcode,
} from '../controllers/dispatch/pos.controller';

import {
  generateOTP,
  verifyOTP,
  getOTP,
  cleanupExpiredOTPs,
} from '../controllers/dispatch/otp.controller';

import {
  updateDispatchLocation,
  getDispatchLocation,
  getActiveDispatchesWithLocation,
} from '../controllers/dispatch/tracking.controller';

const router = express.Router();

// Apply authentication to all routes
router.use(protect);

// Define authorized roles
const centralRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER];
const branchRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_STOREKEEPER];
const driverRoles = [UserRole.SUPER_ADMIN, UserRole.DRIVER];
const auditorRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR];
const cashierRoles = [UserRole.SUPER_ADMIN, UserRole.CASHIER, UserRole.BRANCH_STOREKEEPER];
const allStoreRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.AUDITOR,
];

const allDispatchRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.CENTRAL_STOREKEEPER,
  UserRole.BRANCH_STOREKEEPER,
  UserRole.AUDITOR,
  UserRole.DRIVER,
];

// =====================================================
// DASHBOARD STATS
// =====================================================

// Get central store dashboard statistics
router.get('/dashboard/central', authorize(centralRoles), getCentralDashboard);

// =====================================================
// ITEM RECEIVING & BARCODE MANAGEMENT
// =====================================================

// Receive item (create new or select existing) with barcode
router.post('/items/receive', authorize(centralRoles), receiveItem);

// Get all items
router.get('/items', authorize(allStoreRoles), getItems);

// Search item by barcode
router.get('/barcodes/:barcode', authorize(allStoreRoles), searchByBarcode);

// Generate unique barcode
router.post('/barcodes/generate', authorize(centralRoles), generateBarcode);

// Print barcode label (prepare for printer integration)
router.post('/barcodes/:barcode/print', authorize(centralRoles), printBarcodeLabel);

// =====================================================
// DISPATCH CREATION & OTP GENERATION
// =====================================================

// Create dispatch with dual OTP (Driver D-XXXX, Branch B-XXXX)
router.post('/dispatches', authorize(centralRoles), createDispatch);

// Get all dispatches (filtered by role)
router.get('/dispatches', authorize(allDispatchRoles), getDispatches);

// Get single dispatch details
router.get('/dispatches/:id', authorize(allDispatchRoles), getDispatchById);

// =====================================================
// OTP VERIFICATION
// =====================================================

// Verify Driver OTP (D-XXXX) - marks dispatch as "In Transit"
router.post('/dispatches/:id/verify-driver-otp', authorize(driverRoles), verifyDriverOtp);

// Verify Branch OTP (B-XXXX) - marks dispatch as "Completed"
router.post('/dispatches/:id/verify-branch-otp', authorize(branchRoles), verifyBranchOtp);

// =====================================================
// NEW OTP SYSTEM (6-digit OTP for workflow)
// =====================================================

// Generate 6-digit OTP for dispatch
router.post('/dispatches/:id/generate-otp', authorize(centralRoles), generateOTP);

// Verify 6-digit OTP (marks dispatch as COMPLETED)
router.post('/dispatches/:id/verify-otp', authorize(branchRoles), verifyOTP);

// Get active OTP for dispatch
router.get('/dispatches/:id/otp', authorize([...centralRoles, ...branchRoles]), getOTP);

// Cleanup expired OTPs (admin/cron)
router.post('/otps/cleanup', authorize([UserRole.SUPER_ADMIN]), cleanupExpiredOTPs);

// =====================================================
// GPS TRACKING
// =====================================================

// Update dispatch location (driver sends GPS coordinates)
router.post('/dispatches/:id/location', authorize(driverRoles), updateDispatchLocation);

// Get dispatch location history
router.get('/dispatches/:id/location', authorize(allStoreRoles), getDispatchLocation);

// Get all active dispatches with locations (for map view)
router.get('/tracking/active', authorize(centralRoles), getActiveDispatchesWithLocation);

// =====================================================
// DOCUMENT UPLOAD
// =====================================================

// Upload signed stock sheet document
router.post(
  '/dispatches/:id/upload-document',
  authorize(branchRoles),
  upload.single('document'),
  uploadDocument
);

// Get documents for a dispatch
router.get('/dispatches/:id/documents', authorize(allStoreRoles), getDispatchDocuments);

// =====================================================
// AUDITOR REVIEW
// =====================================================

// Get all deliveries for auditor review
router.get('/auditor/deliveries', authorize(auditorRoles), getAuditorDeliveries);

// Get detailed delivery information for auditor
router.get('/auditor/deliveries/:id', authorize(auditorRoles), getAuditorDeliveryDetail);

// Review delivery (approve or flag)
router.post('/auditor/deliveries/:id/review', authorize(auditorRoles), reviewDelivery);

// =====================================================
// POS BARCODE INTEGRATION
// =====================================================

// Generate barcode for POS transaction (order/bill)
router.post('/pos/barcodes/generate', authorize(cashierRoles), generatePosBarcode);

// Scan POS barcode to retrieve transaction
router.get('/pos/barcodes/scan/:barcode', authorize(cashierRoles), scanPosBarcode);

export default router;
