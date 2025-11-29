import { supabase } from '../../config/supabase';

interface BookingEvent {
  bookingId: string;
  externalRef?: string;
  eventType: 'arrival' | 'departure' | 'modification' | 'cancellation' | 'early_checkout' | 'late_checkout';
  roomId?: string;
  roomNumber: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  isVip: boolean;
  specialRequests?: string;
}

interface TaskGenerationResult {
  success: boolean;
  tasksCreated: string[];
  errors: string[];
}

class PMSIntegrationService {
  /**
   * Process booking event from PMS
   */
  async processBookingEvent(event: BookingEvent): Promise<TaskGenerationResult> {
    const result: TaskGenerationResult = {
      success: true,
      tasksCreated: [],
      errors: []
    };

    try {
      // Log the sync event
      const { data: syncLog } = await supabase
        .from('hk_booking_sync')
        .insert({
          booking_id: event.bookingId,
          external_booking_ref: event.externalRef,
          sync_type: event.eventType,
          room_number: event.roomNumber,
          guest_name: event.guestName,
          check_in_date: event.checkInDate,
          check_out_date: event.checkOutDate,
          is_vip: event.isVip,
          special_requests: event.specialRequests,
          sync_status: 'pending'
        })
        .select()
        .single();

      // Get room details
      const { data: room } = await supabase
        .from('rooms')
        .select('id, type_id, floor, is_vip, cleaning_credits')
        .eq('room_number', event.roomNumber)
        .single();

      if (!room) {
        result.errors.push(`Room ${event.roomNumber} not found`);
        result.success = false;
        return result;
      }

      // Process based on event type
      switch (event.eventType) {
        case 'departure':
          await this.handleDeparture(event, room, result);
          break;

        case 'arrival':
          await this.handleArrival(event, room, result);
          break;

        case 'early_checkout':
          await this.handleEarlyCheckout(event, room, result);
          break;

        case 'late_checkout':
          await this.handleLateCheckout(event, room, result);
          break;

        case 'modification':
          await this.handleModification(event, room, result);
          break;

        case 'cancellation':
          await this.handleCancellation(event, room, result);
          break;
      }

      // Update sync log
      await supabase
        .from('hk_booking_sync')
        .update({
          sync_status: result.success ? 'processed' : 'failed',
          processed_at: new Date().toISOString(),
          tasks_generated: result.tasksCreated,
          error_message: result.errors.length > 0 ? result.errors.join('; ') : null
        })
        .eq('id', syncLog?.id);

    } catch (error) {
      console.error('[PMS Integration] Error:', error);
      result.success = false;
      result.errors.push('Internal processing error');
    }

    return result;
  }

  /**
   * Sync guest preferences from PMS/booking
   */
  async syncGuestPreferences(
    bookingId: string,
    roomNumber: string,
    preferences: any
  ): Promise<boolean> {
    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_number', roomNumber)
      .single();

    if (!room) return false;

    // Update room with guest preferences
    await supabase
      .from('rooms')
      .update({
        is_vip: preferences.isVip || false,
        guest_preferences: preferences
      })
      .eq('id', room.id);

    // Store in guest preferences table
    await supabase
      .from('hk_guest_preferences')
      .upsert({
        booking_id: bookingId,
        room_id: room.id,
        pillow_type: preferences.pillowType,
        extra_towels: preferences.extraTowels,
        extra_pillows: preferences.extraPillows,
        allergy_info: preferences.allergyInfo,
        turndown_service: preferences.turndownService,
        special_notes: preferences.specialNotes,
        is_vip: preferences.isVip,
        vip_level: preferences.vipLevel
      }, { onConflict: 'room_id' });

    return true;
  }

  /**
   * Get rooms needing preparation for today's arrivals
   */
  async getTodayArrivals(): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data: arrivals } = await supabase
      .from('hk_booking_sync')
      .select('*')
      .eq('check_in_date', today)
      .eq('sync_type', 'arrival')
      .order('created_at', { ascending: false });

    return arrivals || [];
  }

  /**
   * Get rooms with departures today
   */
  async getTodayDepartures(): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data: departures } = await supabase
      .from('hk_booking_sync')
      .select('*')
      .eq('check_out_date', today)
      .in('sync_type', ['departure', 'early_checkout'])
      .order('created_at', { ascending: false });

    return departures || [];
  }

  /**
   * Auto-generate tasks from bookings
   */
  async autoGenerateTasksFromBookings(): Promise<TaskGenerationResult> {
    const result: TaskGenerationResult = {
      success: true,
      tasksCreated: [],
      errors: []
    };

    const today = new Date().toISOString().split('T')[0];

    // Get departures from bookings table
    const { data: departures } = await supabase
      .from('bookings')
      .select(`
        id,
        room_id,
        room:rooms(room_number, floor, is_vip, cleaning_credits),
        guest:users(first_name, last_name),
        special_requests
      `)
      .eq('check_out_date', today)
      .eq('status', 'checked_in');

    if (!departures) return result;

    for (const booking of departures) {
      // Check if task already exists
      const { count } = await supabase
        .from('hk_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', booking.room_id)
        .gte('created_at', `${today}T00:00:00`)
        .in('task_type', ['checkout_full_clean', 'checkout_vip_clean']);

      if (count && count > 0) continue; // Task already exists

      const room = booking.room as any;
      const guest = booking.guest as any;

      // Create checkout task
      const taskType = room?.is_vip ? 'checkout_vip_clean' : 'checkout_full_clean';
      const priority = room?.is_vip ? 'high' : 'normal';

      const { data: task, error } = await supabase
        .from('hk_tasks')
        .insert({
          room_id: booking.room_id,
          room_number: room?.room_number,
          floor_number: room?.floor,
          task_type: taskType,
          priority,
          status: 'pending',
          is_vip: room?.is_vip || false,
          credit_value: room?.cleaning_credits || 1.0,
          estimated_duration_minutes: room?.is_vip ? 60 : 45,
          special_instructions: booking.special_requests
        })
        .select()
        .single();

      if (error) {
        result.errors.push(`Failed to create task for room ${room?.room_number}`);
      } else if (task) {
        result.tasksCreated.push(task.id);

        // Update room status
        await supabase
          .from('rooms')
          .update({ hk_status: 'checkout' })
          .eq('id', booking.room_id);
      }
    }

    // Generate arrival preparation tasks for VIP arrivals
    const { data: arrivals } = await supabase
      .from('bookings')
      .select(`
        id,
        room_id,
        room:rooms(room_number, floor, is_vip, cleaning_credits),
        guest:users(first_name, last_name)
      `)
      .eq('check_in_date', today)
      .eq('status', 'confirmed');

    if (arrivals) {
      for (const booking of arrivals) {
        const room = booking.room as any;
        
        // Only create pre-arrival for VIP
        if (!room?.is_vip) continue;

        const { count } = await supabase
          .from('hk_tasks')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', booking.room_id)
          .gte('created_at', `${today}T00:00:00`)
          .eq('task_type', 'pre_arrival_vip');

        if (count && count > 0) continue;

        const { data: task, error } = await supabase
          .from('hk_tasks')
          .insert({
            room_id: booking.room_id,
            room_number: room?.room_number,
            floor_number: room?.floor,
            task_type: 'pre_arrival_vip',
            priority: 'high',
            status: 'pending',
            is_vip: true,
            credit_value: 1.5,
            estimated_duration_minutes: 30,
            special_instructions: 'VIP arrival preparation'
          })
          .select()
          .single();

        if (task) {
          result.tasksCreated.push(task.id);
        }
      }
    }

    return result;
  }

  /**
   * Notify front desk when room is ready
   */
  async notifyRoomReady(roomNumber: string, bookingId?: string): Promise<void> {
    // Update room status
    await supabase
      .from('rooms')
      .update({ 
        hk_status: 'vacant_clean',
        status: 'available'
      })
      .eq('room_number', roomNumber);

    // Queue notification to front desk
    await supabase
      .from('hk_notifications')
      .insert({
        recipient_type: 'system',
        notification_type: 'room_ready',
        channel: 'in_app',
        title: 'Room Ready',
        message: `Room ${roomNumber} is now ready for check-in`,
        data: { roomNumber, bookingId },
        priority: 'normal'
      });

    // If booking exists, notify guest
    if (bookingId) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('guest:users(email, phone_number)')
        .eq('id', bookingId)
        .single();

      const guest = booking?.guest as any;
      if (guest?.email || guest?.phone_number) {
        await supabase
          .from('hk_notifications')
          .insert({
            recipient_type: 'guest',
            recipient_email: guest?.email,
            recipient_phone: guest?.phone_number,
            notification_type: 'room_ready',
            channel: guest?.email ? 'email' : 'sms',
            title: 'Your Room is Ready',
            message: `Good news! Room ${roomNumber} is now ready for your arrival.`,
            data: { roomNumber, bookingId },
            priority: 'normal'
          });
      }
    }
  }

  // Private handlers

  private async handleDeparture(
    event: BookingEvent,
    room: any,
    result: TaskGenerationResult
  ): Promise<void> {
    // Create checkout cleaning task
    const taskType = event.isVip ? 'checkout_vip_clean' : 'checkout_full_clean';
    const priority = event.isVip ? 'high' : 'normal';

    const { data: task, error } = await supabase
      .from('hk_tasks')
      .insert({
        room_id: room.id,
        room_number: event.roomNumber,
        floor_number: room.floor,
        task_type: taskType,
        priority,
        status: 'pending',
        is_vip: event.isVip,
        credit_value: room.cleaning_credits || 1.0,
        estimated_duration_minutes: event.isVip ? 60 : 45,
        special_instructions: event.specialRequests
      })
      .select()
      .single();

    if (error) {
      result.errors.push('Failed to create checkout task');
    } else if (task) {
      result.tasksCreated.push(task.id);
    }

    // Update room status
    await supabase
      .from('rooms')
      .update({ hk_status: 'checkout' })
      .eq('id', room.id);
  }

  private async handleArrival(
    event: BookingEvent,
    room: any,
    result: TaskGenerationResult
  ): Promise<void> {
    // For VIP arrivals, create pre-arrival preparation task
    if (event.isVip) {
      const { data: task, error } = await supabase
        .from('hk_tasks')
        .insert({
          room_id: room.id,
          room_number: event.roomNumber,
          floor_number: room.floor,
          task_type: 'pre_arrival_vip',
          priority: 'high',
          status: 'pending',
          is_vip: true,
          credit_value: 1.5,
          estimated_duration_minutes: 30,
          special_instructions: `VIP Arrival: ${event.guestName}. ${event.specialRequests || ''}`
        })
        .select()
        .single();

      if (task) {
        result.tasksCreated.push(task.id);
      }
    }

    // Store guest preferences
    if (event.specialRequests) {
      await supabase
        .from('hk_guest_preferences')
        .upsert({
          booking_id: event.bookingId,
          room_id: room.id,
          is_vip: event.isVip,
          special_notes: event.specialRequests
        }, { onConflict: 'room_id' });
    }

    // Update room VIP status
    if (event.isVip) {
      await supabase
        .from('rooms')
        .update({ is_vip: true })
        .eq('id', room.id);
    }
  }

  private async handleEarlyCheckout(
    event: BookingEvent,
    room: any,
    result: TaskGenerationResult
  ): Promise<void> {
    // Create urgent checkout task
    const { data: task, error } = await supabase
      .from('hk_tasks')
      .insert({
        room_id: room.id,
        room_number: event.roomNumber,
        floor_number: room.floor,
        task_type: event.isVip ? 'checkout_vip_clean' : 'checkout_full_clean',
        priority: 'urgent',
        status: 'pending',
        is_vip: event.isVip,
        credit_value: room.cleaning_credits || 1.0,
        estimated_duration_minutes: event.isVip ? 60 : 45,
        special_instructions: 'EARLY CHECKOUT - Priority turnaround'
      })
      .select()
      .single();

    if (task) {
      result.tasksCreated.push(task.id);
    }

    await supabase
      .from('rooms')
      .update({ 
        hk_status: 'checkout',
        cleaning_priority: 'urgent'
      })
      .eq('id', room.id);
  }

  private async handleLateCheckout(
    event: BookingEvent,
    room: any,
    result: TaskGenerationResult
  ): Promise<void> {
    // Update expected checkout time
    await supabase
      .from('rooms')
      .update({ 
        hk_status: 'late_checkout',
        expected_checkout: event.checkOutDate
      })
      .eq('id', room.id);

    // Reschedule any existing tasks
    await supabase
      .from('hk_tasks')
      .update({
        special_instructions: `Late checkout extended. Original checkout: ${event.checkOutDate}`
      })
      .eq('room_id', room.id)
      .eq('status', 'pending');
  }

  private async handleModification(
    event: BookingEvent,
    room: any,
    result: TaskGenerationResult
  ): Promise<void> {
    // Update room preferences if VIP status changed
    if (event.isVip !== room.is_vip) {
      await supabase
        .from('rooms')
        .update({ is_vip: event.isVip })
        .eq('id', room.id);
    }

    // Update any pending tasks
    if (event.isVip && !room.is_vip) {
      // Upgraded to VIP - increase priority
      await supabase
        .from('hk_tasks')
        .update({
          is_vip: true,
          priority: 'high',
          special_instructions: `UPGRADED TO VIP. ${event.specialRequests || ''}`
        })
        .eq('room_id', room.id)
        .eq('status', 'pending');
    }
  }

  private async handleCancellation(
    event: BookingEvent,
    room: any,
    result: TaskGenerationResult
  ): Promise<void> {
    // Cancel any pending pre-arrival tasks
    const { data: cancelled } = await supabase
      .from('hk_tasks')
      .update({ status: 'cancelled' })
      .eq('room_id', room.id)
      .eq('task_type', 'pre_arrival_vip')
      .eq('status', 'pending')
      .select('id');

    if (cancelled) {
      result.tasksCreated.push(...cancelled.map(t => `cancelled:${t.id}`));
    }

    // Reset room VIP status if it was set for this booking
    await supabase
      .from('rooms')
      .update({ is_vip: false })
      .eq('id', room.id);
  }
}

export const pmsIntegration = new PMSIntegrationService();
export default pmsIntegration;
