import express from 'express';
import { upload, uploadDocument, getGuestDocuments, deleteDocument } from '../controllers/document.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = express.Router();

router.use(protect);

router.post('/upload', 
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  upload.single('file'), 
  uploadDocument
);

router.get('/guest/:guestId', 
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]),
  getGuestDocuments
);

router.delete('/:id', 
  authorize([UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]),
  deleteDocument
);

export default router;
