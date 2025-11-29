import { supabase } from '../../config/supabase';

interface DemandForecast {
  date: string;
  predictedCheckouts: number;
  predictedArrivals: number;
  predictedStayovers: number;
  predictedVipArrivals: number;
  predictedTasksTotal: number;
  confidenceLevel: number;
  weatherFactor?: string;
  eventFactor?: string;
}

interface StaffPrediction {
  date: string;
  shiftType: string;
  predictedRooms: number;
  predictedWorkloadCredits: number;
  recommendedStaffCount: number;
  recommendedSupervisors: number;
}

interface QualityAlert {
  alertType: 'staff_decline' | 'room_recurring' | 'category_trend';
  severity: 'info' | 'warning' | 'critical';
  subjectType: string;
  subjectId: string;
  subjectName: string;
  alertMessage: string;
  metricName: string;
  currentValue: number;
  thresholdValue: number;
  trendDirection: 'declining' | 'improving' | 'volatile';
  recommendedAction: string;
}

class PredictiveAnalyticsService {
  // Prediction configuration
  private config = {
    // Average cleaning time by task type (minutes)
    avgCleaningTimes: {
      checkout_full_clean: 45,
      checkout_vip_clean: 60,
      stay_over_service: 20,
      stay_over_full: 35,
      deep_clean: 90,
      turndown_service: 15,
      default: 30
    },
    // Credit values by task type
    creditValues: {
      checkout_full_clean: 1.0,
      checkout_vip_clean: 1.5,
      stay_over_service: 0.5,
      stay_over_full: 0.8,
      deep_clean: 2.0,
      turndown_service: 0.3,
      default: 0.5
    },
    // Staff capacity
    staffCreditsPerShift: 14,
    roomsPerStaff: 14,
    supervisorRatio: 0.15, // 1 supervisor per ~7 staff
    // Quality thresholds
    qualityAlertThreshold: 3.5,
    qualityDeclinePercent: 15
  };

  /**
   * Generate demand forecast for a date
   */
  async generateDemandForecast(targetDate: string, branchId?: number): Promise<DemandForecast> {
    // Get historical data for same day of week
    const targetDay = new Date(targetDate).getDay();
    const weeksBack = 8;
    
    const historicalDates: string[] = [];
    const target = new Date(targetDate);
    
    for (let i = 1; i <= weeksBack; i++) {
      const pastDate = new Date(target);
      pastDate.setDate(pastDate.getDate() - (i * 7));
      historicalDates.push(pastDate.toISOString().split('T')[0]);
    }

    // Get historical task counts
    let query = supabase
      .from('hk_tasks')
      .select('created_at, task_type, is_vip')
      .in('created_at::date', historicalDates);

    if (branchId) {
      // Would filter by branch if tasks had branch_id
    }

    const { data: historicalTasks } = await query;

    // Calculate averages
    const avgCheckouts = this.calculateAverage(
      historicalTasks?.filter(t => 
        t.task_type === 'checkout_full_clean' || t.task_type === 'checkout_vip_clean'
      ).length || 0,
      weeksBack
    );

    const avgStayovers = this.calculateAverage(
      historicalTasks?.filter(t => 
        t.task_type === 'stay_over_service' || t.task_type === 'stay_over_full'
      ).length || 0,
      weeksBack
    );

    const avgVip = this.calculateAverage(
      historicalTasks?.filter(t => t.is_vip).length || 0,
      weeksBack
    );

    // Get booking data for more accurate prediction
    const { data: bookings } = await supabase
      .from('bookings')
      .select('check_in_date, check_out_date')
      .or(`check_in_date.eq.${targetDate},check_out_date.eq.${targetDate}`);

    const actualCheckouts = bookings?.filter(b => b.check_out_date === targetDate).length || 0;
    const actualArrivals = bookings?.filter(b => b.check_in_date === targetDate).length || 0;

    // Use actual booking data if available, otherwise use historical average
    const predictedCheckouts = actualCheckouts || Math.round(avgCheckouts);
    const predictedArrivals = actualArrivals || Math.round(avgCheckouts * 0.9);
    const predictedStayovers = Math.round(avgStayovers);
    const predictedVip = Math.round(avgVip);

    // Calculate total predicted tasks
    const predictedTasksTotal = 
      predictedCheckouts + 
      predictedStayovers + 
      Math.round(predictedArrivals * 0.3); // Pre-arrival prep

    // Calculate confidence level based on data availability
    const confidenceLevel = bookings && bookings.length > 0 
      ? 85 
      : historicalTasks && historicalTasks.length > 10 
        ? 70 
        : 50;

    const forecast: DemandForecast = {
      date: targetDate,
      predictedCheckouts,
      predictedArrivals,
      predictedStayovers,
      predictedVipArrivals: predictedVip,
      predictedTasksTotal,
      confidenceLevel
    };

    // Store forecast
    await supabase
      .from('hk_demand_forecasts')
      .upsert({
        forecast_date: targetDate,
        branch_id: branchId,
        predicted_checkouts: forecast.predictedCheckouts,
        predicted_arrivals: forecast.predictedArrivals,
        predicted_stayovers: forecast.predictedStayovers,
        predicted_vip_arrivals: forecast.predictedVipArrivals,
        predicted_tasks_total: forecast.predictedTasksTotal,
        confidence_level: forecast.confidenceLevel
      }, { onConflict: 'forecast_date,branch_id' });

    return forecast;
  }

  /**
   * Generate staff requirement prediction
   */
  async generateStaffPrediction(
    targetDate: string,
    shiftType: string = 'morning',
    branchId?: number
  ): Promise<StaffPrediction> {
    // Get demand forecast
    const forecast = await this.generateDemandForecast(targetDate, branchId);

    // Calculate workload
    let totalCredits = 0;
    
    // Checkout cleans
    totalCredits += forecast.predictedCheckouts * this.config.creditValues.checkout_full_clean;
    
    // Stayover service
    totalCredits += forecast.predictedStayovers * this.config.creditValues.stay_over_service;
    
    // VIP premium (extra credit for VIP rooms)
    totalCredits += forecast.predictedVipArrivals * 0.5;

    // Calculate required staff
    const baseStaffNeeded = Math.ceil(totalCredits / this.config.staffCreditsPerShift);
    
    // Adjust for shift type
    const shiftMultipliers: Record<string, number> = {
      morning: 1.0,
      afternoon: 0.6,
      evening: 0.3,
      night: 0.1
    };

    const adjustedStaff = Math.ceil(baseStaffNeeded * (shiftMultipliers[shiftType] || 1.0));
    const recommendedSupervisors = Math.max(1, Math.ceil(adjustedStaff * this.config.supervisorRatio));

    const prediction: StaffPrediction = {
      date: targetDate,
      shiftType,
      predictedRooms: forecast.predictedCheckouts + forecast.predictedStayovers,
      predictedWorkloadCredits: Math.round(totalCredits * 10) / 10,
      recommendedStaffCount: Math.max(1, adjustedStaff),
      recommendedSupervisors
    };

    // Store prediction
    await supabase
      .from('hk_staff_predictions')
      .insert({
        prediction_date: targetDate,
        branch_id: branchId,
        shift_type: shiftType,
        predicted_rooms: prediction.predictedRooms,
        predicted_workload_credits: prediction.predictedWorkloadCredits,
        recommended_staff_count: prediction.recommendedStaffCount,
        recommended_supervisors: prediction.recommendedSupervisors
      });

    return prediction;
  }

  /**
   * Detect quality alerts
   */
  async detectQualityAlerts(branchId?: number): Promise<QualityAlert[]> {
    const alerts: QualityAlert[] = [];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // 1. Check for declining staff performance
    const staffAlerts = await this.checkStaffQualityDecline(oneWeekAgo);
    alerts.push(...staffAlerts);

    // 2. Check for recurring room issues
    const roomAlerts = await this.checkRecurringRoomIssues();
    alerts.push(...roomAlerts);

    // 3. Check for category trends
    const categoryAlerts = await this.checkCategoryTrends();
    alerts.push(...categoryAlerts);

    // Store alerts in database
    for (const alert of alerts) {
      await supabase
        .from('hk_quality_alerts')
        .insert({
          alert_type: alert.alertType,
          severity: alert.severity,
          subject_type: alert.subjectType,
          subject_id: alert.subjectId,
          subject_name: alert.subjectName,
          alert_message: alert.alertMessage,
          metric_name: alert.metricName,
          current_value: alert.currentValue,
          threshold_value: alert.thresholdValue,
          trend_direction: alert.trendDirection,
          recommended_action: alert.recommendedAction,
          branch_id: branchId
        });
    }

    return alerts;
  }

  /**
   * Get forecast accuracy for past predictions
   */
  async getForecastAccuracy(days: number = 7): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: forecasts } = await supabase
      .from('hk_demand_forecasts')
      .select('*')
      .gte('forecast_date', startDate.toISOString().split('T')[0])
      .not('actual_checkouts', 'is', null);

    if (!forecasts) return [];

    return forecasts.map(f => ({
      date: f.forecast_date,
      predictedCheckouts: f.predicted_checkouts,
      actualCheckouts: f.actual_checkouts,
      accuracy: f.forecast_accuracy,
      variance: Math.abs(f.predicted_checkouts - f.actual_checkouts)
    }));
  }

  /**
   * Update forecast with actual data
   */
  async updateForecastActuals(date: string, branchId?: number): Promise<void> {
    // Get actual task counts for the date
    const { data: tasks } = await supabase
      .from('hk_tasks')
      .select('task_type')
      .gte('created_at', `${date}T00:00:00`)
      .lt('created_at', `${date}T23:59:59`);

    const actualCheckouts = tasks?.filter(t => 
      t.task_type === 'checkout_full_clean' || t.task_type === 'checkout_vip_clean'
    ).length || 0;

    // Get forecast
    let query = supabase
      .from('hk_demand_forecasts')
      .select('predicted_checkouts')
      .eq('forecast_date', date);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: forecast } = await query.single();

    if (!forecast) return;

    // Calculate accuracy
    const predicted = forecast.predicted_checkouts || 0;
    const accuracy = predicted > 0 
      ? Math.round((1 - Math.abs(predicted - actualCheckouts) / predicted) * 100)
      : 0;

    // Update forecast with actuals
    let updateQuery = supabase
      .from('hk_demand_forecasts')
      .update({
        actual_checkouts: actualCheckouts,
        forecast_accuracy: accuracy
      })
      .eq('forecast_date', date);

    if (branchId) {
      updateQuery = updateQuery.eq('branch_id', branchId);
    }

    await updateQuery;
  }

  /**
   * Predict supply consumption
   */
  async predictSupplyConsumption(
    supplyId: string,
    days: number = 7,
    branchId?: number
  ): Promise<{ date: string; predictedUsage: number; reorderRecommended: boolean }[]> {
    // Get historical consumption
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const { data: transactions } = await supabase
      .from('housekeeping_supply_transactions')
      .select('quantity, created_at')
      .eq('supply_id', supplyId)
      .eq('type', 'usage')
      .gte('created_at', startDate.toISOString());

    // Calculate daily average
    const dailyUsage: Record<string, number> = {};
    transactions?.forEach(t => {
      const date = new Date(t.created_at).toISOString().split('T')[0];
      dailyUsage[date] = (dailyUsage[date] || 0) + Math.abs(t.quantity);
    });

    const avgDailyUsage = Object.values(dailyUsage).length > 0
      ? Object.values(dailyUsage).reduce((a, b) => a + b, 0) / Object.values(dailyUsage).length
      : 1;

    // Get current stock level
    const { data: supply } = await supabase
      .from('housekeeping_supplies')
      .select('quantity, min_quantity')
      .eq('id', supplyId)
      .single();

    const currentStock = supply?.quantity || 0;
    const minQuantity = supply?.min_quantity || 10;

    // Generate predictions
    const predictions: { date: string; predictedUsage: number; reorderRecommended: boolean }[] = [];
    let projectedStock = currentStock;

    for (let i = 1; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      // Apply day-of-week variation
      const dayOfWeek = date.getDay();
      const dayMultiplier = [0.7, 1.0, 1.0, 1.0, 1.0, 1.2, 1.2][dayOfWeek]; // Weekend slightly higher

      const predictedUsage = Math.round(avgDailyUsage * dayMultiplier);
      projectedStock -= predictedUsage;

      predictions.push({
        date: dateStr,
        predictedUsage,
        reorderRecommended: projectedStock <= minQuantity
      });

      // Store prediction
      await supabase
        .from('hk_supply_predictions')
        .upsert({
          prediction_date: dateStr,
          branch_id: branchId,
          supply_id: supplyId,
          predicted_usage: predictedUsage,
          reorder_recommended: projectedStock <= minQuantity,
          reorder_quantity: projectedStock <= minQuantity 
            ? Math.max(minQuantity * 2 - projectedStock, 0) 
            : 0
        }, { onConflict: 'prediction_date,supply_id' });
    }

    return predictions;
  }

  // Private helper methods

  private calculateAverage(total: number, periods: number): number {
    return periods > 0 ? total / periods : 0;
  }

  private async checkStaffQualityDecline(since: Date): Promise<QualityAlert[]> {
    const alerts: QualityAlert[] = [];

    // Get recent inspections grouped by staff
    const { data: recentInspections } = await supabase
      .from('hk_inspections')
      .select(`
        overall_score,
        task:hk_tasks(completed_by, hk_staff_profiles:completed_by(
          id, staff_code, user:users(first_name, last_name)
        ))
      `)
      .gte('created_at', since.toISOString());

    // Group by staff and check for decline
    const staffScores: Record<string, number[]> = {};
    
    recentInspections?.forEach(i => {
      const staffId = (i.task as any)?.completed_by;
      if (staffId) {
        if (!staffScores[staffId]) staffScores[staffId] = [];
        staffScores[staffId].push(i.overall_score || 0);
      }
    });

    for (const [staffId, scores] of Object.entries(staffScores)) {
      if (scores.length < 3) continue;

      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      
      if (avgScore < this.config.qualityAlertThreshold) {
        alerts.push({
          alertType: 'staff_decline',
          severity: avgScore < 3.0 ? 'critical' : 'warning',
          subjectType: 'staff',
          subjectId: staffId,
          subjectName: staffId, // Would resolve to actual name
          alertMessage: `Quality score dropped to ${avgScore.toFixed(2)}`,
          metricName: 'quality_score',
          currentValue: avgScore,
          thresholdValue: this.config.qualityAlertThreshold,
          trendDirection: 'declining',
          recommendedAction: 'Schedule retraining session'
        });
      }
    }

    return alerts;
  }

  private async checkRecurringRoomIssues(): Promise<QualityAlert[]> {
    const alerts: QualityAlert[] = [];

    // Get rooms with multiple failed inspections
    const { data: failedInspections } = await supabase
      .from('hk_inspections')
      .select('room_id, room_number, result')
      .eq('result', 'fail')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Count failures per room
    const roomFailures: Record<string, { count: number; roomNumber: string }> = {};
    
    failedInspections?.forEach(i => {
      if (!roomFailures[i.room_id]) {
        roomFailures[i.room_id] = { count: 0, roomNumber: i.room_number };
      }
      roomFailures[i.room_id].count++;
    });

    for (const [roomId, data] of Object.entries(roomFailures)) {
      if (data.count >= 3) {
        alerts.push({
          alertType: 'room_recurring',
          severity: data.count >= 5 ? 'critical' : 'warning',
          subjectType: 'room',
          subjectId: roomId,
          subjectName: `Room ${data.roomNumber}`,
          alertMessage: `${data.count} failed inspections in 30 days`,
          metricName: 'failed_inspections',
          currentValue: data.count,
          thresholdValue: 3,
          trendDirection: 'volatile',
          recommendedAction: 'Investigate room-specific issues'
        });
      }
    }

    return alerts;
  }

  private async checkCategoryTrends(): Promise<QualityAlert[]> {
    const alerts: QualityAlert[] = [];

    // Get inspection scores by category
    const { data: inspections } = await supabase
      .from('hk_inspections')
      .select('category_scores')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (!inspections || inspections.length < 10) return alerts;

    // Aggregate category scores
    const categories: Record<string, number[]> = {};
    
    inspections.forEach(i => {
      const scores = i.category_scores as Record<string, number>;
      if (scores) {
        Object.entries(scores).forEach(([cat, score]) => {
          if (!categories[cat]) categories[cat] = [];
          categories[cat].push(score as number);
        });
      }
    });

    // Check for low-scoring categories
    for (const [category, scores] of Object.entries(categories)) {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      
      if (avgScore < 3.5) {
        alerts.push({
          alertType: 'category_trend',
          severity: avgScore < 3.0 ? 'critical' : 'warning',
          subjectType: 'category',
          subjectId: category,
          subjectName: category.replace(/_/g, ' '),
          alertMessage: `Average ${category} score is ${avgScore.toFixed(2)}`,
          metricName: `${category}_score`,
          currentValue: avgScore,
          thresholdValue: 3.5,
          trendDirection: 'declining',
          recommendedAction: `Focus training on ${category} standards`
        });
      }
    }

    return alerts;
  }
}

export const predictiveAnalytics = new PredictiveAnalyticsService();
export default predictiveAnalytics;
