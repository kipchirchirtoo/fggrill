import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getUserProfile,
  updateUserProfile,
  updateUserPassword,
  uploadProfilePhoto,
  testCreateUser
} from '../controllers/user.controller';
import { uploadService } from '../services/upload.service';

const router = express.Router();

// Apply protection to all routes
router.use(protect);

// Public routes (authenticated users)
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.put('/password', updateUserPassword);
router.post(
  '/profile/photo',
  uploadService.uploadSingle('photo'),
  uploadProfilePhoto
);
router.post(
  '/:id/photo',
  uploadService.uploadSingle('photo'),
  uploadProfilePhoto
);

// Admin only routes
router.use(authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]));

router.route('/')
  .get(getUsers)
  .post(createUser);

// Test route for debugging user creation
router.post('/test', testCreateUser);

router.route('/:id')
  .get(getUser)
  .put(updateUser)
  .delete(authorize([UserRole.SUPER_ADMIN]), deleteUser);

export default router;
