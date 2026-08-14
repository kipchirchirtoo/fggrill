import express from 'express';
import {
  submitReview,
  listPublicReviews,
  markReviewHelpful,
  listBranchReviews,
  respondToReview,
} from '../controllers/reviews.controller';
import { protect, authorize, UserRole } from '../middleware/auth';

const router = express.Router();

const MANAGER_ROLES = [
  UserRole.BRANCH_MANAGER,
  UserRole.GENERAL_MANAGER,
  UserRole.DIRECTOR,
  UserRole.SUPER_ADMIN,
];

// ── Public — landing page guest reviews (no login system for guests) ──────
router.post('/', submitReview);
router.get('/', listPublicReviews);
router.patch('/:id/helpful', markReviewHelpful);

// ── Branch manager review management ───────────────────────────────────────
router.get('/manager/list', protect, authorize(MANAGER_ROLES), listBranchReviews);
router.patch('/manager/:id/respond', protect, authorize(MANAGER_ROLES), respondToReview);

export default router;
