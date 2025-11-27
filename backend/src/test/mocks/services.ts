import { jest } from '@jest/globals';

// Mock email service
export const mockEmailService = {
  sendEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendBookingConfirmation: jest.fn(),
  sendMaintenanceAlert: jest.fn(),
  sendInventoryAlert: jest.fn()
};

// Mock SMS service
export const mockSMSService = {
  sendSMS: jest.fn(),
  sendBookingConfirmation: jest.fn(),
  sendCheckInReminder: jest.fn(),
  sendMaintenanceAlert: jest.fn(),
  sendLowStockAlert: jest.fn(),
  sendHousekeepingAlert: jest.fn(),
  sendEmergencyAlert: jest.fn()
};

// Mock payment service
export const mockPaymentService = {
  createPaymentIntent: jest.fn(),
  confirmPayment: jest.fn(),
  createRefund: jest.fn(),
  createCustomer: jest.fn(),
  attachPaymentMethod: jest.fn(),
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  createProduct: jest.fn(),
  createPrice: jest.fn(),
  handleWebhookEvent: jest.fn()
};

// Mock socket service
export const mockSocketService = {
  emitToUser: jest.fn(),
  emitToRoom: jest.fn(),
  emitToAuthenticated: jest.fn(),
  emitToAll: jest.fn(),
  getUserSocketCount: jest.fn(),
  getRoomSocketCount: jest.fn(),
  getTotalSocketCount: jest.fn(),
  isUserOnline: jest.fn(),
  getOnlineUsers: jest.fn(),
  getActiveRooms: jest.fn(),
  disconnectUser: jest.fn(),
  disconnectRoom: jest.fn()
};

// Mock upload service
export const mockUploadService = {
  uploadSingle: jest.fn(),
  uploadMultiple: jest.fn(),
  uploadFields: jest.fn(),
  deleteFile: jest.fn(),
  getFileInfo: jest.fn(),
  moveFile: jest.fn(),
  copyFile: jest.fn(),
  createDirectory: jest.fn(),
  listDirectory: jest.fn(),
  fileExists: jest.fn(),
  getFileSize: jest.fn(),
  readFileContent: jest.fn(),
  writeFileContent: jest.fn()
};

// Mock logger
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};
