import express from 'express';
import {
  getAssets,
  createAsset,
  updateAsset,
  getPreventiveSchedules,
  createPreventiveSchedule,
  getSpareParts,
  createPartTransaction,
  getContractors,
  recordMeterReading,
  getEnergyConsumption,
  uploadAttachment,
  getMaintenanceDashboard
} from '../controllers/maintenance.enhanced.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

// Dashboard
router.get('/dashboard',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]),
  getMaintenanceDashboard
);

// Assets
router.get('/assets',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]),
  getAssets
);

router.post('/assets',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createAsset
);

router.put('/assets/:id',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  updateAsset
);

// Preventive Maintenance
router.get('/preventive',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]),
  getPreventiveSchedules
);

router.post('/preventive',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  createPreventiveSchedule
);

// Spare Parts
router.get('/spare-parts',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]),
  getSpareParts
);

router.post('/spare-parts/transaction',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]),
  createPartTransaction
);

// Contractors
router.get('/contractors',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]),
  getContractors
);

// Energy/Utilities
router.post('/meter-reading',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]),
  recordMeterReading
);

router.get('/energy-consumption',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  getEnergyConsumption
);

// Attachments
router.post('/attachments',
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.MAINTENANCE]),
  uploadAttachment
);

export default router;
