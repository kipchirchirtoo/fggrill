import express from 'express';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  getSchedule,
  getStats,
  assignTask,
  startTask,
  completeTask,
  verifyTask,
  reportIssue,
  resolveIssue,
  updateChecklist,
  addPartUsage,
  updateToolStatus,
  getTaskHistory,
  getAssetHistory,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssets,
  getAsset,
  uploadTaskPhotos
} from '../controllers/maintenance.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import { uploadService } from '../services/upload.service';

const router = express.Router();

// Apply protection to all routes
router.use(protect);

// Staff routes
router.use(authorize([
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.MAINTENANCE,
  UserRole.HOUSEKEEPING
]));

router.route('/tasks')
  .get(getTasks)
  .post(createTask);

router.route('/tasks/:id')
  .get(getTask)
  .put(updateTask)
  .delete(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), deleteTask);

router.post('/tasks/:id/assign', assignTask);
router.post('/tasks/:id/start', startTask);
router.post('/tasks/:id/complete', completeTask);
router.post('/tasks/:id/verify', authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), verifyTask);

router.route('/tasks/:id/checklist')
  .put(updateChecklist);

router.route('/tasks/:id/parts')
  .post(addPartUsage);

router.route('/tasks/:id/tools')
  .put(updateToolStatus);

router.route('/tasks/:id/issues')
  .post(reportIssue);

router.post('/tasks/:id/issues/:issueId/resolve', resolveIssue);

router.post(
  '/tasks/:id/photos',
  uploadService.uploadMultiple('photos', 5),
  uploadTaskPhotos
);

router.get('/tasks/:id/history', getTaskHistory);

// Assets
router.route('/assets')
  .get(getAssets)
  .post(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), createAsset);

router.route('/assets/:id')
  .get(getAsset)
  .put(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]), updateAsset)
  .delete(authorize([UserRole.SUPER_ADMIN]), deleteAsset);

router.get('/assets/:id/history', getAssetHistory);

// Schedule and Stats
router.get('/schedule', getSchedule);
router.get('/stats/overview', getStats);

export default router;
