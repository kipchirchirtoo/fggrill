import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import moment from 'moment';

export interface ShiftCalculation {
    hoursNormal: number;
    hoursOTWeekday: number;
    hoursOTRest: number;
    hoursOTHoliday: number;
    hoursNight: number;
    otRateApplied: number;
}

export class AttendanceService {
    /**
     * Calculates categorized hours for a shift based on Kenyan Labour Laws
     * Rules:
     * - Normal Day: First 8 hours normal, anything above is 1.5x OT.
     * - Rest Day: All hours are 2.0x OT.
     * - Public Holiday: All hours are 2.0x OT.
     * - Night hours (22:00-06:00) are tracked separately.
     */
    static async calculateShiftHours(staffId: string, clockIn: string | Date, clockOut: string | Date): Promise<ShiftCalculation> {
        try {
            // 1. Fetch Staff Profile for rules
            const { data: profile, error: profileError } = await supabase
                .from('staff_profiles')
                .select('id, rest_day, hourly_base_rate')
                .eq('id', staffId)
                .single();

            if (profileError) {
                logger.error(`Profile not found for staff ${staffId}:`, profileError);
                throw new Error('Staff profile not found');
            }

            const inMoment = moment(clockIn);
            const outMoment = moment(clockOut);

            if (!outMoment.isValid() || outMoment.isBefore(inMoment)) {
                throw new Error('Invalid clock-out time');
            }

            const totalHours = outMoment.diff(inMoment, 'hours', true);
            const dateStr = inMoment.format('YYYY-MM-DD');
            const dayOfWeek = inMoment.day(); // 0=Sunday, 1=Monday...

            // 2. Check for Public Holiday
            const { data: holiday } = await supabase
                .from('kenyan_public_holidays')
                .select('name')
                .eq('holiday_date', dateStr)
                .maybeSingle();

            let hoursNormal = 0;
            let hoursOTWeekday = 0;
            let hoursOTRest = 0;
            let hoursOTHoliday = 0;
            let otRateApplied = 1.0;

            // 3. Main Calculation Logic
            if (holiday) {
                hoursOTHoliday = totalHours;
                otRateApplied = 2.0;
            } else if (dayOfWeek === (profile.rest_day ?? 0)) {
                hoursOTRest = totalHours;
                otRateApplied = 2.0;
            } else {
                // Normal Day
                if (totalHours > 8) {
                    hoursNormal = 8;
                    hoursOTWeekday = totalHours - 8;
                    otRateApplied = 1.5; // mixed rate, but 1.5 is the OT trigger
                } else {
                    hoursNormal = totalHours;
                    otRateApplied = 1.0;
                }
            }

            // 4. Night Hours Calculation (22:00 - 06:00)
            const hoursNight = this.calculateNightOverlap(inMoment, outMoment);

            return {
                hoursNormal: Number(hoursNormal.toFixed(2)),
                hoursOTWeekday: Number(hoursOTWeekday.toFixed(2)),
                hoursOTRest: Number(hoursOTRest.toFixed(2)),
                hoursOTHoliday: Number(hoursOTHoliday.toFixed(2)),
                hoursNight: Number(hoursNight.toFixed(2)),
                otRateApplied
            };
        } catch (error) {
            logger.error('Error in calculateShiftHours:', error);
            throw error;
        }
    }

    /**
     * Calculates overlap with night hours (22:00 to 06:00)
     * Uses a scan method for accuracy across multi-day shifts
     */
    private static calculateNightOverlap(start: moment.Moment, end: moment.Moment): number {
        let nightMinutes = 0;
        let current = moment(start).seconds(0).milliseconds(0);
        const stop = moment(end).seconds(0).milliseconds(0);

        const stepMinutes = 15;
        while (current.isBefore(stop)) {
            const hour = current.hour();
            if (hour >= 22 || hour < 6) {
                nightMinutes += stepMinutes;
            }
            current.add(stepMinutes, 'minutes');
        }

        return nightMinutes / 60;
    }

    /**
     * Records an audit log for manual attendance adjustments
     */
    static async logAttendanceEdit(recordId: string, editorId: string, oldValues: any, newValues: any, reason: string) {
        try {
            const { error } = await supabase
                .from('attendance_audit_logs')
                .insert([{
                    record_id: recordId,
                    editor_id: editorId,
                    old_values: oldValues,
                    new_values: newValues,
                    reason
                }]);

            if (error) throw error;
        } catch (error) {
            logger.error('Failed to log attendance edit:', error);
        }
    }
}
