import express from 'express';
import {
    getAttendance,
    clockIn,
    clockOut
} from '../controllers/attendance.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

router.get('/', getAttendance);
router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);

export default router;
