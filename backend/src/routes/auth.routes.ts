import express from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateDetails,
  updatePassword,
  forgotPassword
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.post('/forgotpassword', forgotPassword);

export default router;
