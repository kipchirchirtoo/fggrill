// =====================================================
// ENHANCED HOUSEKEEPING MODULE - ROUTES
// =====================================================

import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { UserRole } from '../models/User';

// Import controllers
import * as dashboardCtrl from '../controllers/housekeeping/dashboard.controller';
import * as tasksCtrl from '../controllers/housekeeping/tasks.controller';
import * as roomsCtrl from '../controllers/housekeeping/rooms.controller';
import * as inspectionsCtrl from '../controllers/housekeeping/inspections.controller';
import * as staffCtrl from '../controllers/housekeeping/staff.controller';
import * as linenCtrl from '../controllers/housekeeping/linen.controller';
import * as lostFoundCtrl from '../controllers/housekeeping/lost-found.controller';
import * as maintenanceCtrl from '../controllers/housekeeping/maintenance.controller';
import * as guestRequestsCtrl from '../controllers/housekeeping/guest-requests.controller';
import * as schedulingCtrl from '../controllers/housekeeping/scheduling.controller';
import * as reportsCtrl from '../controllers/housekeeping/reports.controller';
import * as suppliesCtrl from '../controllers/housekeeping/supplies.controller';
import * as enhancedCtrl from '../controllers/housekeeping/enhanced.controller';

const router = express.Router();

// Role definitions for access control
const ALL_HK_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.HOUSEKEEPING,
  UserRole.HOUSEKEEPING_SUPERVISOR,
  UserRole.ROOM_ATTENDANT,
  UserRole.RECEPTIONIST,
  UserRole.FRONT_DESK_SUPERVISOR
];

const SUPERVISOR_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.HOUSEKEEPING_SUPERVISOR,
  UserRole.RECEPTIONIST,
  UserRole.FRONT_DESK_SUPERVISOR
];

const MANAGER_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.GENERAL_MANAGER
];

// Apply authentication to all routes
router.use(protect);

// =====================================================
// DASHBOARD ROUTES
// =====================================================
router.get('/dashboard', authorize(ALL_HK_ROLES), dashboardCtrl.getDashboard);
router.get('/dashboard/room-grid', authorize(ALL_HK_ROLES), dashboardCtrl.getRoomGrid);
router.get('/dashboard/stats', authorize(ALL_HK_ROLES), dashboardCtrl.getStats);
router.get('/dashboard/workload', authorize(SUPERVISOR_ROLES), dashboardCtrl.getWorkloadDistribution);

// =====================================================
// TASK ROUTES
// =====================================================
router.get('/tasks', authorize(ALL_HK_ROLES), tasksCtrl.getTasks);
router.get('/tasks/my-tasks', authorize(ALL_HK_ROLES), tasksCtrl.getMyTasks);
router.get('/tasks/:id', authorize(ALL_HK_ROLES), tasksCtrl.getTask);
router.post('/tasks', authorize(SUPERVISOR_ROLES), tasksCtrl.createTask);
router.put('/tasks/:id/status', authorize(ALL_HK_ROLES), tasksCtrl.updateTaskStatus);
router.put('/tasks/:id/assign', authorize(SUPERVISOR_ROLES), tasksCtrl.assignTask);
router.put('/tasks/:id/checklist', authorize(ALL_HK_ROLES), tasksCtrl.updateChecklist);
router.post('/tasks/bulk-assign', authorize(SUPERVISOR_ROLES), tasksCtrl.bulkAssignTasks);
router.post('/tasks/auto-assign', authorize(SUPERVISOR_ROLES), tasksCtrl.autoAssignTasks);
router.delete('/tasks/:id', authorize(MANAGER_ROLES), tasksCtrl.deleteTask);

// =====================================================
// ROOM ROUTES
// =====================================================
router.get('/rooms', authorize(ALL_HK_ROLES), roomsCtrl.getRooms);
router.get('/rooms/by-floor', authorize(ALL_HK_ROLES), roomsCtrl.getRoomsByFloor);
router.get('/rooms/for-inspection', authorize(SUPERVISOR_ROLES), roomsCtrl.getRoomsForInspection);
router.get('/rooms/:id', authorize(ALL_HK_ROLES), roomsCtrl.getRoom);
router.get('/rooms/:id/history', authorize(SUPERVISOR_ROLES), roomsCtrl.getRoomHistory);
router.put('/rooms/:id/status', authorize(ALL_HK_ROLES), roomsCtrl.updateRoomStatus);
router.put('/rooms/:id/dnd', authorize(ALL_HK_ROLES), roomsCtrl.setDND);
router.put('/rooms/:id/assign', authorize(SUPERVISOR_ROLES), roomsCtrl.assignAttendant);
router.put('/rooms/bulk-status', authorize(SUPERVISOR_ROLES), roomsCtrl.bulkUpdateRoomStatus);

// =====================================================
// INSPECTION ROUTES
// =====================================================
router.get('/inspections', authorize(SUPERVISOR_ROLES), inspectionsCtrl.getInspections);
router.get('/inspections/queue', authorize(SUPERVISOR_ROLES), inspectionsCtrl.getInspectionQueue);
router.get('/inspections/stats', authorize(SUPERVISOR_ROLES), inspectionsCtrl.getInspectionStats);
router.get('/inspections/:id', authorize(SUPERVISOR_ROLES), inspectionsCtrl.getInspection);
router.post('/inspections', authorize(SUPERVISOR_ROLES), inspectionsCtrl.submitInspection);

// =====================================================
// STAFF ROUTES
// =====================================================
router.get('/staff', authorize(SUPERVISOR_ROLES), staffCtrl.getStaff);
router.get('/staff/workload', authorize(SUPERVISOR_ROLES), staffCtrl.getStaffWorkload);
router.get('/staff/:id', authorize(ALL_HK_ROLES), staffCtrl.getStaffMember);
router.get('/staff/:id/performance', authorize(ALL_HK_ROLES), staffCtrl.getStaffPerformance);
router.post('/staff', authorize(MANAGER_ROLES), staffCtrl.createStaffProfile);
router.put('/staff/:id', authorize(MANAGER_ROLES), staffCtrl.updateStaffProfile);
router.put('/staff/:id/availability', authorize(ALL_HK_ROLES), staffCtrl.updateAvailability);
router.post('/staff/:id/check-in', authorize(ALL_HK_ROLES), staffCtrl.checkIn);
router.post('/staff/:id/check-out', authorize(ALL_HK_ROLES), staffCtrl.checkOut);

// =====================================================
// LINEN MANAGEMENT ROUTES
// =====================================================
router.get('/linen/types', authorize(ALL_HK_ROLES), linenCtrl.getLinenTypes);
router.get('/linen/inventory', authorize(ALL_HK_ROLES), linenCtrl.getLinenInventory);
router.get('/linen/transactions', authorize(SUPERVISOR_ROLES), linenCtrl.getTransactions);
router.get('/linen/par-levels', authorize(SUPERVISOR_ROLES), linenCtrl.getParLevelStatus);
router.post('/linen/transactions', authorize(ALL_HK_ROLES), linenCtrl.recordTransaction);
router.post('/linen/issue', authorize(SUPERVISOR_ROLES), linenCtrl.issueLinen);
router.post('/linen/return', authorize(ALL_HK_ROLES), linenCtrl.returnLinen);

// =====================================================
// LOST & FOUND ROUTES
// =====================================================
router.get('/lost-found', authorize(ALL_HK_ROLES), lostFoundCtrl.getLostFoundItems);
router.get('/lost-found/expiring', authorize(SUPERVISOR_ROLES), lostFoundCtrl.getExpiringItems);
router.get('/lost-found/stats', authorize(SUPERVISOR_ROLES), lostFoundCtrl.getLostFoundStats);
router.get('/lost-found/:id', authorize(ALL_HK_ROLES), lostFoundCtrl.getLostFoundItem);
router.post('/lost-found', authorize(ALL_HK_ROLES), lostFoundCtrl.createLostFoundItem);
router.put('/lost-found/:id', authorize(SUPERVISOR_ROLES), lostFoundCtrl.updateLostFoundItem);
router.put('/lost-found/:id/status', authorize(SUPERVISOR_ROLES), lostFoundCtrl.updateItemStatus);
router.post('/lost-found/:id/contact', authorize(SUPERVISOR_ROLES), lostFoundCtrl.addContactAttempt);

// =====================================================
// MAINTENANCE REQUEST ROUTES
// =====================================================
router.get('/maintenance', authorize(ALL_HK_ROLES), maintenanceCtrl.getMaintenanceRequests);
router.get('/maintenance/stats', authorize(SUPERVISOR_ROLES), maintenanceCtrl.getMaintenanceStats);
router.get('/maintenance/room/:roomId', authorize(ALL_HK_ROLES), maintenanceCtrl.getRoomMaintenance);
router.get('/maintenance/:id', authorize(ALL_HK_ROLES), maintenanceCtrl.getMaintenanceRequest);
router.post('/maintenance', authorize(ALL_HK_ROLES), maintenanceCtrl.createMaintenanceRequest);
router.put('/maintenance/:id/status', authorize(SUPERVISOR_ROLES), maintenanceCtrl.updateRequestStatus);
router.put('/maintenance/:id/verify', authorize(SUPERVISOR_ROLES), maintenanceCtrl.verifyCompletion);

// =====================================================
// GUEST REQUEST ROUTES
// =====================================================
router.get('/guest-requests', authorize(ALL_HK_ROLES), guestRequestsCtrl.getGuestRequests);
router.get('/guest-requests/types-summary', authorize(SUPERVISOR_ROLES), guestRequestsCtrl.getRequestTypesSummary);
router.get('/guest-requests/room/:roomId', authorize(ALL_HK_ROLES), guestRequestsCtrl.getRoomRequests);
router.get('/guest-requests/:id', authorize(ALL_HK_ROLES), guestRequestsCtrl.getGuestRequest);
router.post('/guest-requests', authorize(ALL_HK_ROLES), guestRequestsCtrl.createGuestRequest);
router.put('/guest-requests/:id/assign', authorize(SUPERVISOR_ROLES), guestRequestsCtrl.assignGuestRequest);
router.put('/guest-requests/:id/complete', authorize(ALL_HK_ROLES), guestRequestsCtrl.completeGuestRequest);
router.put('/guest-requests/:id/feedback', authorize(ALL_HK_ROLES), guestRequestsCtrl.recordFeedback);

// =====================================================
// SCHEDULING ROUTES
// =====================================================
router.get('/scheduling/shifts', authorize(ALL_HK_ROLES), schedulingCtrl.getShiftDefinitions);
router.get('/scheduling/schedules', authorize(SUPERVISOR_ROLES), schedulingCtrl.getSchedules);
router.get('/scheduling/today-roster', authorize(SUPERVISOR_ROLES), schedulingCtrl.getTodayRoster);
router.get('/scheduling/leave-requests', authorize(SUPERVISOR_ROLES), schedulingCtrl.getLeaveRequests);
router.get('/scheduling/shift-swaps', authorize(SUPERVISOR_ROLES), schedulingCtrl.getShiftSwaps);
router.post('/scheduling/schedules', authorize(MANAGER_ROLES), schedulingCtrl.createSchedule);
router.post('/scheduling/schedules/bulk', authorize(MANAGER_ROLES), schedulingCtrl.bulkCreateSchedules);
router.put('/scheduling/schedules/:id', authorize(MANAGER_ROLES), schedulingCtrl.updateSchedule);
router.delete('/scheduling/schedules/:id', authorize(MANAGER_ROLES), schedulingCtrl.deleteSchedule);
router.post('/scheduling/leave-requests', authorize(ALL_HK_ROLES), schedulingCtrl.createLeaveRequest);
router.put('/scheduling/leave-requests/:id/review', authorize(MANAGER_ROLES), schedulingCtrl.reviewLeaveRequest);
router.post('/scheduling/shift-swaps', authorize(ALL_HK_ROLES), schedulingCtrl.createShiftSwap);
router.put('/scheduling/shift-swaps/:id/respond', authorize(ALL_HK_ROLES), schedulingCtrl.respondToShiftSwap);
router.put('/scheduling/shift-swaps/:id/approve', authorize(MANAGER_ROLES), schedulingCtrl.approveShiftSwap);

// =====================================================
// SUPPLIES ROUTES
// =====================================================
router.get('/supplies', authorize(ALL_HK_ROLES), suppliesCtrl.getSuppliesInventory);
router.post('/supplies/request', authorize(ALL_HK_ROLES), suppliesCtrl.requestSupplies);

// =====================================================
// REPORTS ROUTES
// =====================================================
router.get('/reports/daily', authorize(SUPERVISOR_ROLES), reportsCtrl.getDailyReport);
router.get('/reports/staff-performance', authorize(SUPERVISOR_ROLES), reportsCtrl.getStaffPerformanceReport);
router.get('/reports/productivity', authorize(MANAGER_ROLES), reportsCtrl.getProductivityReport);
router.get('/reports/turnaround', authorize(MANAGER_ROLES), reportsCtrl.getTurnaroundReport);
router.get('/reports/supply-usage', authorize(MANAGER_ROLES), reportsCtrl.getSupplyUsageReport);
router.get('/reports/export', authorize(MANAGER_ROLES), reportsCtrl.exportReport);

// =====================================================
// SMART ASSIGNMENT ROUTES
// =====================================================
router.post('/smart-assign/task/:taskId', authorize(SUPERVISOR_ROLES), enhancedCtrl.autoAssignTask);
router.post('/smart-assign/batch', authorize(SUPERVISOR_ROLES), enhancedCtrl.autoAssignBatch);
router.get('/smart-assign/recommendations/:taskId', authorize(SUPERVISOR_ROLES), enhancedCtrl.getAssignmentRecommendations);

// =====================================================
// GAMIFICATION ROUTES
// =====================================================
router.get('/gamification/leaderboard', authorize(ALL_HK_ROLES), enhancedCtrl.getLeaderboard);
router.get('/gamification/staff/:staffId/stats', authorize(ALL_HK_ROLES), enhancedCtrl.getStaffStats);
router.get('/gamification/achievements', authorize(ALL_HK_ROLES), enhancedCtrl.getAchievements);
router.get('/gamification/staff/:staffId/achievements', authorize(ALL_HK_ROLES), enhancedCtrl.getStaffAchievements);
router.get('/gamification/challenges', authorize(ALL_HK_ROLES), enhancedCtrl.getTeamChallenges);
router.post('/gamification/award-bonus', authorize(SUPERVISOR_ROLES), enhancedCtrl.awardBonusPoints);

// =====================================================
// GUEST PORTAL ROUTES (Some public for guest access)
// =====================================================
router.post('/guest-portal/request', enhancedCtrl.submitGuestRequest);
router.get('/guest-portal/request/:requestId/status', enhancedCtrl.getGuestRequestStatus);
router.post('/guest-portal/clean-now', enhancedCtrl.requestCleanNow);
router.post('/guest-portal/dnd-schedule', enhancedCtrl.setDndSchedule);
router.post('/guest-portal/preferences', enhancedCtrl.saveGuestPreferences);
router.get('/guest-portal/preferences/:roomNumber', enhancedCtrl.getGuestPreferences);
router.post('/guest-portal/feedback/:requestId', enhancedCtrl.submitGuestFeedback);

// =====================================================
// SUSTAINABILITY ROUTES
// =====================================================
router.post('/sustainability/task/:taskId/metrics', authorize(ALL_HK_ROLES), enhancedCtrl.recordSustainabilityMetrics);
router.get('/sustainability/daily-summary', authorize(SUPERVISOR_ROLES), enhancedCtrl.getSustainabilityDailySummary);
router.get('/sustainability/trends', authorize(SUPERVISOR_ROLES), enhancedCtrl.getSustainabilityTrends);
router.post('/sustainability/green-guest', authorize(ALL_HK_ROLES), enhancedCtrl.registerGreenGuest);
router.get('/sustainability/green-guest/:bookingId/stats', authorize(ALL_HK_ROLES), enhancedCtrl.getGreenGuestStats);
router.get('/sustainability/green-guest/:bookingId/certificate', enhancedCtrl.generateGreenCertificate);
router.get('/sustainability/staff-ranking', authorize(SUPERVISOR_ROLES), enhancedCtrl.getStaffSustainabilityRanking);

// =====================================================
// PREDICTIVE ANALYTICS ROUTES
// =====================================================
router.get('/analytics/demand-forecast', authorize(SUPERVISOR_ROLES), enhancedCtrl.getDemandForecast);
router.get('/analytics/staff-prediction', authorize(SUPERVISOR_ROLES), enhancedCtrl.getStaffPrediction);
router.get('/analytics/quality-alerts', authorize(SUPERVISOR_ROLES), enhancedCtrl.getQualityAlerts);
router.get('/analytics/forecast-accuracy', authorize(MANAGER_ROLES), enhancedCtrl.getForecastAccuracy);
router.get('/analytics/supply-prediction/:supplyId', authorize(SUPERVISOR_ROLES), enhancedCtrl.getSupplyPrediction);

// =====================================================
// PMS INTEGRATION ROUTES
// =====================================================
router.post('/pms/booking-event', authorize(SUPERVISOR_ROLES), enhancedCtrl.processBookingEvent);
router.post('/pms/sync-preferences', authorize(ALL_HK_ROLES), enhancedCtrl.syncGuestPreferences);
router.get('/pms/today-arrivals', authorize(ALL_HK_ROLES), enhancedCtrl.getTodayArrivals);
router.get('/pms/today-departures', authorize(ALL_HK_ROLES), enhancedCtrl.getTodayDepartures);
router.post('/pms/auto-generate-tasks', authorize(SUPERVISOR_ROLES), enhancedCtrl.autoGenerateTasks);
router.post('/pms/notify-room-ready', authorize(ALL_HK_ROLES), enhancedCtrl.notifyRoomReady);

export default router;
