import { Request, Response, NextFunction } from 'express';
import { smartAssignment } from '../../services/housekeeping/smart-assignment.service';
import { gamification } from '../../services/housekeeping/gamification.service';
import { guestPortal } from '../../services/housekeeping/guest-portal.service';
import { sustainability } from '../../services/housekeeping/sustainability.service';
import { predictiveAnalytics } from '../../services/housekeeping/predictive-analytics.service';
import { pmsIntegration } from '../../services/housekeeping/pms-integration.service';

// =====================================================
// SMART ASSIGNMENT ENDPOINTS
// =====================================================

export const autoAssignTask = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;
    const result = await smartAssignment.autoAssignTask(taskId);
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, message: result.reason });
    }
  } catch (error) {
    next(error);
  }
};

export const autoAssignBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskIds } = req.body;
    const results = await smartAssignment.autoAssignBatch(taskIds);
    
    res.json({
      success: true,
      data: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAssignmentRecommendations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;
    const limit = parseInt(req.query.limit as string) || 5;
    
    const recommendations = await smartAssignment.getAssignmentRecommendations(taskId, limit);
    res.json({ success: true, data: recommendations });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// GAMIFICATION ENDPOINTS
// =====================================================

export const getLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = (req.query.period as 'week' | 'month' | 'all') || 'month';
    const limit = parseInt(req.query.limit as string) || 10;
    
    const leaderboard = await gamification.getLeaderboard(period, limit);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    next(error);
  }
};

export const getStaffStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { staffId } = req.params;
    const stats = await gamification.getStaffStats(staffId);
    
    if (stats) {
      res.json({ success: true, data: stats });
    } else {
      res.status(404).json({ success: false, message: 'Staff not found' });
    }
  } catch (error) {
    next(error);
  }
};

export const getAchievements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const achievements = await gamification.getAchievements();
    res.json({ success: true, data: achievements });
  } catch (error) {
    next(error);
  }
};

export const getStaffAchievements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { staffId } = req.params;
    const achievements = await gamification.getStaffAchievements(staffId);
    res.json({ success: true, data: achievements });
  } catch (error) {
    next(error);
  }
};

export const getTeamChallenges = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const activeOnly = req.query.active !== 'false';
    const challenges = await gamification.getTeamChallenges(activeOnly);
    res.json({ success: true, data: challenges });
  } catch (error) {
    next(error);
  }
};

export const awardBonusPoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { staffId, type, description } = req.body;
    const points = await gamification.awardSpecialBonus(staffId, type, description);
    res.json({ success: true, data: { pointsAwarded: points } });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// GUEST PORTAL ENDPOINTS
// =====================================================

export const submitGuestRequest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await guestPortal.submitServiceRequest(req.body);
    
    if (result.success) {
      res.status(201).json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, message: result.message });
    }
  } catch (error) {
    next(error);
  }
};

export const getGuestRequestStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId } = req.params;
    const status = await guestPortal.getRequestStatus(requestId);
    
    if (status) {
      res.json({ success: true, data: status });
    } else {
      res.status(404).json({ success: false, message: 'Request not found' });
    }
  } catch (error) {
    next(error);
  }
};

export const requestCleanNow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomNumber, guestName, reason } = req.body;
    const result = await guestPortal.requestCleanNow(roomNumber, guestName, reason);
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, message: 'Failed to create clean request' });
    }
  } catch (error) {
    next(error);
  }
};

export const setDndSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomNumber, startTime, endTime } = req.body;
    const success = await guestPortal.setDndSchedule(roomNumber, startTime, endTime);
    res.json({ success });
  } catch (error) {
    next(error);
  }
};

export const saveGuestPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomNumber, preferences } = req.body;
    const success = await guestPortal.saveGuestPreferences(roomNumber, preferences);
    res.json({ success });
  } catch (error) {
    next(error);
  }
};

export const getGuestPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomNumber } = req.params;
    const preferences = await guestPortal.getGuestPreferences(roomNumber);
    res.json({ success: true, data: preferences });
  } catch (error) {
    next(error);
  }
};

export const submitGuestFeedback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requestId } = req.params;
    const { rating, feedback } = req.body;
    const success = await guestPortal.submitFeedback(requestId, rating, feedback);
    res.json({ success });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// SUSTAINABILITY ENDPOINTS
// =====================================================

export const recordSustainabilityMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;
    const result = await sustainability.recordTaskMetrics(taskId, req.body);
    res.json({ success: result.success, data: { ecoScore: result.ecoScore } });
  } catch (error) {
    next(error);
  }
};

export const getSustainabilityDailySummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date as string;
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string) : undefined;
    
    const summary = await sustainability.getDailySummary(date, branchId);
    res.json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

export const getSustainabilityTrends = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string) : undefined;
    
    const trends = await sustainability.getSustainabilityTrends(days, branchId);
    res.json({ success: true, data: trends });
  } catch (error) {
    next(error);
  }
};

export const registerGreenGuest = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId, roomNumber, options } = req.body;
    const success = await sustainability.registerGreenGuest(bookingId, roomNumber, options);
    res.json({ success });
  } catch (error) {
    next(error);
  }
};

export const getGreenGuestStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId } = req.params;
    const stats = await sustainability.updateGreenGuestSavings(bookingId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
};

export const generateGreenCertificate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId } = req.params;
    const certificate = await sustainability.generateGreenCertificate(bookingId);
    
    if (certificate) {
      res.json({ success: true, data: certificate });
    } else {
      res.status(404).json({ success: false, message: 'Booking not found' });
    }
  } catch (error) {
    next(error);
  }
};

export const getStaffSustainabilityRanking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const ranking = await sustainability.getStaffSustainabilityRanking(limit);
    res.json({ success: true, data: ranking });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// PREDICTIVE ANALYTICS ENDPOINTS
// =====================================================

export const getDemandForecast = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string) : undefined;
    
    const forecast = await predictiveAnalytics.generateDemandForecast(date, branchId);
    res.json({ success: true, data: forecast });
  } catch (error) {
    next(error);
  }
};

export const getStaffPrediction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const date = req.query.date as string || new Date().toISOString().split('T')[0];
    const shiftType = req.query.shiftType as string || 'morning';
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string) : undefined;
    
    const prediction = await predictiveAnalytics.generateStaffPrediction(date, shiftType, branchId);
    res.json({ success: true, data: prediction });
  } catch (error) {
    next(error);
  }
};

export const getQualityAlerts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string) : undefined;
    const alerts = await predictiveAnalytics.detectQualityAlerts(branchId);
    res.json({ success: true, data: alerts });
  } catch (error) {
    next(error);
  }
};

export const getForecastAccuracy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const accuracy = await predictiveAnalytics.getForecastAccuracy(days);
    res.json({ success: true, data: accuracy });
  } catch (error) {
    next(error);
  }
};

export const getSupplyPrediction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplyId } = req.params;
    const days = parseInt(req.query.days as string) || 7;
    const branchId = req.query.branchId ? parseInt(req.query.branchId as string) : undefined;
    
    const predictions = await predictiveAnalytics.predictSupplyConsumption(supplyId, days, branchId);
    res.json({ success: true, data: predictions });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// PMS INTEGRATION ENDPOINTS
// =====================================================

export const processBookingEvent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pmsIntegration.processBookingEvent(req.body);
    res.json({ success: result.success, data: result });
  } catch (error) {
    next(error);
  }
};

export const syncGuestPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId, roomNumber, preferences } = req.body;
    const success = await pmsIntegration.syncGuestPreferences(bookingId, roomNumber, preferences);
    res.json({ success });
  } catch (error) {
    next(error);
  }
};

export const getTodayArrivals = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const arrivals = await pmsIntegration.getTodayArrivals();
    res.json({ success: true, data: arrivals });
  } catch (error) {
    next(error);
  }
};

export const getTodayDepartures = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departures = await pmsIntegration.getTodayDepartures();
    res.json({ success: true, data: departures });
  } catch (error) {
    next(error);
  }
};

export const autoGenerateTasks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await pmsIntegration.autoGenerateTasksFromBookings();
    res.json({ success: result.success, data: result });
  } catch (error) {
    next(error);
  }
};

export const notifyRoomReady = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomNumber, bookingId } = req.body;
    await pmsIntegration.notifyRoomReady(roomNumber, bookingId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
