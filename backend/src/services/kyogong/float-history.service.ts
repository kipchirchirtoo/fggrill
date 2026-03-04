import { supabase } from '../../config/supabase';

export interface FloatHistoryEntry {
  id?: string;
  shift_id: string;
  timestamp: Date;
  change_type: 'TRANSACTION' | 'ADJUSTMENT' | 'OPENING' | 'CLOSING' | 'VOID';
  amount_change: number;
  resulting_float: number;
  transaction_id?: string;
  adjustment_reason?: string;
  performed_by?: string;
  created_at?: Date;
}

export interface FloatHistoryFilters {
  startTime?: Date;
  endTime?: Date;
  changeType?: string;
}

export class FloatHistoryService {
  /**
   * Record a float change in the history
   */
  static async recordFloatChange(
    shiftId: string,
    amountChange: number,
    resultingFloat: number,
    changeType: 'TRANSACTION' | 'ADJUSTMENT' | 'OPENING' | 'CLOSING' | 'VOID',
    referenceId?: string,
    reason?: string,
    userId?: string
  ): Promise<void> {
    try {
      const historyEntry: any = {
        shift_id: shiftId,
        change_type: changeType,
        amount_change: amountChange,
        resulting_float: resultingFloat,
        timestamp: new Date().toISOString(),
      };

      // Add optional fields
      if (changeType === 'TRANSACTION' && referenceId) {
        historyEntry.transaction_id = referenceId;
      }
      
      if (changeType === 'ADJUSTMENT' && reason) {
        historyEntry.adjustment_reason = reason;
      }
      
      if (userId) {
        historyEntry.performed_by = userId;
      }

      const { error } = await supabase
        .from('float_history')
        .insert(historyEntry);

      if (error) {
        console.error('Error recording float history:', error);
        throw new Error(`Failed to record float history: ${error.message}`);
      }
    } catch (err: any) {
      console.error('Float history service error:', err);
      throw err;
    }
  }

  /**
   * Get float history for a shift with optional filters
   */
  static async getHistory(
    shiftId: string,
    filters?: FloatHistoryFilters
  ): Promise<FloatHistoryEntry[]> {
    try {
      let query = supabase
        .from('float_history')
        .select('*')
        .eq('shift_id', shiftId)
        .order('timestamp', { ascending: false });

      // Apply filters
      if (filters?.startTime) {
        query = query.gte('timestamp', filters.startTime.toISOString());
      }
      
      if (filters?.endTime) {
        query = query.lte('timestamp', filters.endTime.toISOString());
      }
      
      if (filters?.changeType) {
        query = query.eq('change_type', filters.changeType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching float history:', error);
        throw new Error(`Failed to fetch float history: ${error.message}`);
      }

      return data || [];
    } catch (err: any) {
      console.error('Float history service error:', err);
      throw err;
    }
  }
}
