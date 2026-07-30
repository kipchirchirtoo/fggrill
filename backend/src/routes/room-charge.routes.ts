import { Router } from 'express';
import {
  getEligibleGuests,
  postRoomCharge,
  reverseRoomCharge,
  getRoomChargeReports,
  settleRoomBill,
} from '../controllers/room-charge.controller';
import { protect as authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/eligible-guests', getEligibleGuests);
router.post('/post', postRoomCharge);
router.post('/reverse', reverseRoomCharge);
router.get('/reports', getRoomChargeReports);
router.post('/folio/:reservationId/settle', settleRoomBill);

export default router;
