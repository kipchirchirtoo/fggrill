import { supabase } from '../../config/supabase';

interface SustainabilityMetrics {
  waterUsedLiters: number;
  waterSavedLiters: number;
  linenReuseOpted: boolean;
  towelsReplaced: number;
  sheetsReplaced: number;
  chemicalUnitsUsed: number;
  ecoProductsUsed: boolean;
  lightsOffChecked: boolean;
  acAdjusted: boolean;
  recyclablesSeparated: boolean;
  wasteKg: number;
}

interface DailySustainabilitySummary {
  date: string;
  totalRoomsCleaned: number;
  linenReuseCount: number;
  linenReusePercentage: number;
  totalWaterLiters: number;
  waterSavedLiters: number;
  ecoProductsUsagePercentage: number;
  avgEcoScore: number;
  totalCarbonKg: number;
  recyclablesKg: number;
  landfillKg: number;
}

interface GreenGuestStats {
  guestId?: string;
  bookingId?: string;
  daysLinenReused: number;
  daysNoClean: number;
  waterSavedLiters: number;
  treesEquivalent: number;
  greenPointsEarned: number;
}

// Carbon footprint constants (kg CO2 equivalent)
const CARBON_FACTORS = {
  waterPerLiter: 0.0003,      // kg CO2 per liter of heated water
  linenWashPerKg: 0.5,        // kg CO2 per kg of linen washed
  chemicalPerUnit: 0.1,       // kg CO2 per unit of cleaning chemical
  electricityPerKwh: 0.4,     // kg CO2 per kWh
  wastePerKg: 0.5             // kg CO2 per kg of landfill waste
};

// Water usage estimates (liters)
const WATER_USAGE = {
  fullClean: 50,
  stayOver: 25,
  turndown: 5,
  bathroomOnly: 15,
  linenChange: 0  // Calculated separately based on laundry
};

// Linen weights (kg)
const LINEN_WEIGHTS = {
  bedSheet: 1.5,
  duvetCover: 2.0,
  pillowcase: 0.3,
  bathTowel: 0.6,
  handTowel: 0.2,
  bathmat: 0.5
};

class SustainabilityService {
  /**
   * Record sustainability metrics for a completed task
   */
  async recordTaskMetrics(
    taskId: string,
    metrics: Partial<SustainabilityMetrics>
  ): Promise<{ success: boolean; ecoScore: number }> {
    try {
      const { data: task } = await supabase
        .from('hk_tasks')
        .select('room_id, completed_by, task_type')
        .eq('id', taskId)
        .single();

      if (!task) {
        return { success: false, ecoScore: 0 };
      }

      // Calculate water usage
      const baseWater = WATER_USAGE[task.task_type as keyof typeof WATER_USAGE] || WATER_USAGE.fullClean;
      const waterUsed = metrics.waterUsedLiters || baseWater;
      const waterSaved = metrics.linenReuseOpted ? baseWater * 0.3 : 0;

      // Calculate carbon footprint
      const carbonFootprint = this.calculateCarbonFootprint({
        waterLiters: waterUsed,
        linenKg: this.calculateLinenWeight(metrics.towelsReplaced || 0, metrics.sheetsReplaced || 0),
        chemicalUnits: metrics.chemicalUnitsUsed || 1,
        wasteKg: metrics.wasteKg || 0.5
      });

      // Calculate eco score (0-100)
      const ecoScore = this.calculateEcoScore(metrics);

      // Get branch_id from room
      const { data: room } = await supabase
        .from('rooms')
        .select('branch_id')
        .eq('id', task.room_id)
        .single();

      // Insert metrics
      await supabase
        .from('hk_sustainability_metrics')
        .insert({
          task_id: taskId,
          room_id: task.room_id,
          staff_id: task.completed_by,
          branch_id: room?.branch_id,
          water_used_liters: waterUsed,
          water_saved_liters: waterSaved,
          linen_reuse_opted: metrics.linenReuseOpted || false,
          towels_replaced: metrics.towelsReplaced || 0,
          sheets_replaced: metrics.sheetsReplaced || 0,
          chemical_units_used: metrics.chemicalUnitsUsed || 1,
          eco_products_used: metrics.ecoProductsUsed || false,
          lights_off_checked: metrics.lightsOffChecked || false,
          ac_adjusted: metrics.acAdjusted || false,
          recyclables_separated: metrics.recyclablesSeparated || false,
          waste_kg: metrics.wasteKg || 0.5,
          eco_score: ecoScore,
          carbon_footprint_kg: carbonFootprint
        });

      return { success: true, ecoScore };
    } catch (error) {
      console.error('[Sustainability] Error recording metrics:', error);
      return { success: false, ecoScore: 0 };
    }
  }

  /**
   * Get daily sustainability summary
   */
  async getDailySummary(date?: string, branchId?: number): Promise<DailySustainabilitySummary | null> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Try to get from cached summary first
    let query = supabase
      .from('hk_sustainability_daily')
      .select('*')
      .eq('summary_date', targetDate);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: cached } = await query.single();

    if (cached) {
      return {
        date: cached.summary_date,
        totalRoomsCleaned: cached.total_rooms_cleaned,
        linenReuseCount: cached.linen_reuse_count,
        linenReusePercentage: cached.linen_reuse_percentage,
        totalWaterLiters: cached.total_water_liters,
        waterSavedLiters: cached.water_saved_liters,
        ecoProductsUsagePercentage: cached.eco_products_usage_percentage,
        avgEcoScore: cached.avg_eco_score,
        totalCarbonKg: cached.total_carbon_kg,
        recyclablesKg: cached.recyclables_kg,
        landfillKg: cached.landfill_kg
      };
    }

    // Calculate from raw metrics
    return this.calculateDailySummary(targetDate, branchId);
  }

  /**
   * Calculate and cache daily summary
   */
  async calculateDailySummary(date: string, branchId?: number): Promise<DailySustainabilitySummary> {
    let query = supabase
      .from('hk_sustainability_metrics')
      .select('*')
      .eq('metric_date', date);

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data: metrics } = await query;

    if (!metrics || metrics.length === 0) {
      return {
        date,
        totalRoomsCleaned: 0,
        linenReuseCount: 0,
        linenReusePercentage: 0,
        totalWaterLiters: 0,
        waterSavedLiters: 0,
        ecoProductsUsagePercentage: 0,
        avgEcoScore: 0,
        totalCarbonKg: 0,
        recyclablesKg: 0,
        landfillKg: 0
      };
    }

    const totalRooms = metrics.length;
    const linenReuseCount = metrics.filter(m => m.linen_reuse_opted).length;
    const ecoProductsCount = metrics.filter(m => m.eco_products_used).length;

    const summary: DailySustainabilitySummary = {
      date,
      totalRoomsCleaned: totalRooms,
      linenReuseCount,
      linenReusePercentage: Math.round((linenReuseCount / totalRooms) * 100),
      totalWaterLiters: metrics.reduce((sum, m) => sum + (m.water_used_liters || 0), 0),
      waterSavedLiters: metrics.reduce((sum, m) => sum + (m.water_saved_liters || 0), 0),
      ecoProductsUsagePercentage: Math.round((ecoProductsCount / totalRooms) * 100),
      avgEcoScore: Math.round(metrics.reduce((sum, m) => sum + (m.eco_score || 0), 0) / totalRooms),
      totalCarbonKg: metrics.reduce((sum, m) => sum + (m.carbon_footprint_kg || 0), 0),
      recyclablesKg: metrics.filter(m => m.recyclables_separated).reduce((sum, m) => sum + (m.waste_kg || 0) * 0.3, 0),
      landfillKg: metrics.filter(m => !m.recyclables_separated).reduce((sum, m) => sum + (m.waste_kg || 0), 0)
    };

    // Cache the summary
    await supabase
      .from('hk_sustainability_daily')
      .upsert({
        summary_date: date,
        branch_id: branchId,
        total_rooms_cleaned: summary.totalRoomsCleaned,
        linen_reuse_count: summary.linenReuseCount,
        linen_reuse_percentage: summary.linenReusePercentage,
        total_water_liters: summary.totalWaterLiters,
        water_saved_liters: summary.waterSavedLiters,
        eco_products_usage_percentage: summary.ecoProductsUsagePercentage,
        avg_eco_score: summary.avgEcoScore,
        total_carbon_kg: summary.totalCarbonKg,
        recyclables_kg: summary.recyclablesKg,
        landfill_kg: summary.landfillKg
      }, { onConflict: 'summary_date,branch_id' });

    return summary;
  }

  /**
   * Register guest green program opt-in
   */
  async registerGreenGuest(
    bookingId: string,
    roomNumber: string,
    options: {
      linenReuse?: boolean;
      noDailyClean?: boolean;
      ecoAmenities?: boolean;
    }
  ): Promise<boolean> {
    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_number', roomNumber)
      .single();

    if (!room) return false;

    const { error } = await supabase
      .from('hk_green_guests')
      .upsert({
        booking_id: bookingId,
        room_id: room.id,
        opted_linen_reuse: options.linenReuse || false,
        opted_no_daily_clean: options.noDailyClean || false,
        opted_eco_amenities: options.ecoAmenities || false
      }, { onConflict: 'booking_id' });

    return !error;
  }

  /**
   * Update green guest savings
   */
  async updateGreenGuestSavings(bookingId: string): Promise<GreenGuestStats | null> {
    const { data: greenGuest } = await supabase
      .from('hk_green_guests')
      .select('*')
      .eq('booking_id', bookingId)
      .single();

    if (!greenGuest) return null;

    // Calculate savings based on metrics
    const { data: metrics } = await supabase
      .from('hk_sustainability_metrics')
      .select('water_saved_liters, linen_reuse_opted')
      .eq('room_id', greenGuest.room_id);

    const waterSaved = metrics?.reduce((sum, m) => sum + (m.water_saved_liters || 0), 0) || 0;
    const daysLinenReused = metrics?.filter(m => m.linen_reuse_opted).length || 0;

    // Calculate environmental equivalents
    const treesEquivalent = (waterSaved / 1000) * 0.001; // Simplified calculation
    const greenPoints = Math.floor(waterSaved / 10) + (daysLinenReused * 5);

    // Update record
    await supabase
      .from('hk_green_guests')
      .update({
        days_linen_reused: daysLinenReused,
        water_saved_liters: waterSaved,
        trees_equivalent: treesEquivalent,
        green_points_earned: greenPoints
      })
      .eq('booking_id', bookingId);

    return {
      bookingId,
      daysLinenReused,
      daysNoClean: greenGuest.opted_no_daily_clean ? daysLinenReused : 0,
      waterSavedLiters: waterSaved,
      treesEquivalent,
      greenPointsEarned: greenPoints
    };
  }

  /**
   * Generate green certificate data
   */
  async generateGreenCertificate(bookingId: string): Promise<any> {
    const stats = await this.updateGreenGuestSavings(bookingId);
    if (!stats) return null;

    const { data: greenGuest } = await supabase
      .from('hk_green_guests')
      .select('*')
      .eq('booking_id', bookingId)
      .single();

    return {
      certificateNumber: `GC-${Date.now()}`,
      issuedDate: new Date().toISOString(),
      guestName: 'Guest', // Would come from booking
      stayPeriod: { start: greenGuest?.created_at, end: new Date().toISOString() },
      achievements: {
        waterSaved: `${stats.waterSavedLiters.toFixed(1)} liters`,
        treesEquivalent: stats.treesEquivalent.toFixed(4),
        carbonReduced: `${(stats.waterSavedLiters * CARBON_FACTORS.waterPerLiter).toFixed(2)} kg CO2`,
        greenPoints: stats.greenPointsEarned
      },
      optIns: {
        linenReuse: greenGuest?.opted_linen_reuse,
        noDailyClean: greenGuest?.opted_no_daily_clean,
        ecoAmenities: greenGuest?.opted_eco_amenities
      }
    };
  }

  /**
   * Get sustainability trends
   */
  async getSustainabilityTrends(days: number = 30, branchId?: number): Promise<any[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from('hk_sustainability_daily')
      .select('*')
      .gte('summary_date', startDate.toISOString().split('T')[0])
      .order('summary_date', { ascending: true });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data } = await query;

    return data?.map(d => ({
      date: d.summary_date,
      ecoScore: d.avg_eco_score,
      linenReuseRate: d.linen_reuse_percentage,
      waterSaved: d.water_saved_liters,
      carbonFootprint: d.total_carbon_kg
    })) || [];
  }

  /**
   * Get staff sustainability rankings
   */
  async getStaffSustainabilityRanking(limit: number = 10): Promise<any[]> {
    const { data } = await supabase
      .from('hk_sustainability_metrics')
      .select(`
        staff_id,
        eco_score,
        water_saved_liters,
        linen_reuse_opted,
        staff:hk_staff_profiles(
          staff_code,
          user:users(first_name, last_name)
        )
      `)
      .not('staff_id', 'is', null);

    if (!data) return [];

    // Aggregate by staff
    const staffStats: Record<string, any> = {};
    
    for (const m of data) {
      if (!staffStats[m.staff_id]) {
        staffStats[m.staff_id] = {
          staffId: m.staff_id,
          staffName: `${(m.staff as any)?.user?.[0]?.first_name || ''} ${(m.staff as any)?.user?.[0]?.last_name || ''}`.trim(),
          staffCode: (m.staff as any)?.staff_code,
          totalTasks: 0,
          avgEcoScore: 0,
          totalWaterSaved: 0,
          linenReuseCount: 0
        };
      }
      staffStats[m.staff_id].totalTasks++;
      staffStats[m.staff_id].avgEcoScore += m.eco_score || 0;
      staffStats[m.staff_id].totalWaterSaved += m.water_saved_liters || 0;
      if (m.linen_reuse_opted) staffStats[m.staff_id].linenReuseCount++;
    }

    // Calculate averages and sort
    return Object.values(staffStats)
      .map(s => ({
        ...s,
        avgEcoScore: Math.round(s.avgEcoScore / s.totalTasks),
        linenReuseRate: Math.round((s.linenReuseCount / s.totalTasks) * 100)
      }))
      .sort((a, b) => b.avgEcoScore - a.avgEcoScore)
      .slice(0, limit);
  }

  // Private calculation methods

  private calculateCarbonFootprint(inputs: {
    waterLiters: number;
    linenKg: number;
    chemicalUnits: number;
    wasteKg: number;
  }): number {
    return (
      inputs.waterLiters * CARBON_FACTORS.waterPerLiter +
      inputs.linenKg * CARBON_FACTORS.linenWashPerKg +
      inputs.chemicalUnits * CARBON_FACTORS.chemicalPerUnit +
      inputs.wasteKg * CARBON_FACTORS.wastePerKg
    );
  }

  private calculateLinenWeight(towels: number, sheets: number): number {
    return (
      towels * LINEN_WEIGHTS.bathTowel +
      sheets * LINEN_WEIGHTS.bedSheet
    );
  }

  private calculateEcoScore(metrics: Partial<SustainabilityMetrics>): number {
    let score = 50; // Base score

    // Linen reuse: +20 points
    if (metrics.linenReuseOpted) score += 20;

    // Eco products: +15 points
    if (metrics.ecoProductsUsed) score += 15;

    // Energy conservation
    if (metrics.lightsOffChecked) score += 5;
    if (metrics.acAdjusted) score += 5;

    // Waste management
    if (metrics.recyclablesSeparated) score += 10;

    // Water efficiency (if below average)
    const avgWater = 40; // Average liters per clean
    if (metrics.waterUsedLiters && metrics.waterUsedLiters < avgWater * 0.8) {
      score += 10;
    }

    // Low chemical usage
    if (metrics.chemicalUnitsUsed && metrics.chemicalUnitsUsed < 1) {
      score += 5;
    }

    return Math.min(score, 100);
  }
}

export const sustainability = new SustainabilityService();
export default sustainability;
