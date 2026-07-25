import { Router } from 'express';
import {
  getEligibleGuests,
  postRoomCharge,
  reverseRoomCharge,
  getRoomChargeReports,
} from '../controllers/room-charge.controller';

const router = Router();

router.get('/eligible-guests', getEligibleGuests);
router.post('/post', postRoomCharge);
router.post('/reverse', reverseRoomCharge);
router.get('/reports', getRoomChargeReports);

export default router;
