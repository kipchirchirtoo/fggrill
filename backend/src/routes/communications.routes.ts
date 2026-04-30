import { Router } from 'express';
import { CommunicationsController } from '../controllers/communications.controller';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

const router = Router();

// All routes require authentication
router.use(protect);

// Channels
router.get('/channels', CommunicationsController.getChannels);
router.post('/channels', 
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]),
  CommunicationsController.createChannel
);
router.get('/channels/:channelId/members', CommunicationsController.getChannelMembers);
router.post('/channels/:channelId/members',
  authorize([UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.GENERAL_MANAGER]),
  CommunicationsController.addMembers
);

// Messages
router.get('/channels/:channelId/messages', CommunicationsController.getMessages);
router.post('/channels/:channelId/messages', CommunicationsController.sendMessage);
router.patch('/messages/:messageId', CommunicationsController.updateMessage);
router.delete('/messages/:messageId', CommunicationsController.deleteMessage);

// Reactions
router.post('/messages/:messageId/react', CommunicationsController.reactToMessage);

// Read receipts
router.post('/channels/:channelId/read', CommunicationsController.markAsRead);

// Users
router.get('/users', CommunicationsController.getUsers);

// File upload
router.post('/upload', CommunicationsController.uploadFile);

export default router;
