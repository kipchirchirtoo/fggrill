import { supabase } from '../../config/supabase';

interface GuestServiceRequest {
  id?: string;
  roomNumber: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  requestType: 'clean_now' | 'extra_amenities' | 'dnd_schedule' | 'timing_preference' | 'turndown' | 'other';
  details: any;
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  preferredDate?: string;
  priority?: 'low' | 'normal' | 'high';
}

interface GuestPreference {
  pillowType?: string;
  bedFirmness?: string;
  roomTemperature?: number;
  preferredCleaningTime?: string;
  extraTowels?: boolean;
  extraPillows?: number;
  noFeather?: boolean;
  allergyInfo?: string;
  minibarPreferences?: string[];
  turndownService?: boolean;
  dndDefaultHours?: string;
  specialNotes?: string;
}

interface NotificationRequest {
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  recipient: string;
  template: string;
  data: any;
}

class GuestPortalService {
  /**
   * Submit a service request from guest portal
   */
  async submitServiceRequest(request: GuestServiceRequest): Promise<{ success: boolean; requestId?: string; message?: string }> {
    try {
      // Get room details
      const { data: room } = await supabase
        .from('rooms')
        .select('id, branch_id, is_vip')
        .eq('room_number', request.roomNumber)
        .single();

      if (!room) {
        return { success: false, message: 'Room not found' };
      }

      // Determine priority
      let priority = request.priority || 'normal';
      if (room.is_vip) {
        priority = priority === 'normal' ? 'high' : priority;
      }
      if (request.requestType === 'clean_now') {
        priority = 'high';
      }

      // Create service request
      const { data: newRequest, error } = await supabase
        .from('hk_guest_service_requests')
        .insert({
          room_id: room.id,
          room_number: request.roomNumber,
          guest_name: request.guestName,
          guest_email: request.guestEmail,
          guest_phone: request.guestPhone,
          request_type: request.requestType,
          details: request.details,
          preferred_time_start: request.preferredTimeStart,
          preferred_time_end: request.preferredTimeEnd,
          preferred_date: request.preferredDate,
          priority,
          branch_id: room.branch_id
        })
        .select()
        .single();

      if (error) {
        console.error('[GuestPortal] Error creating request:', error);
        return { success: false, message: 'Failed to create request' };
      }

      // Handle immediate actions based on request type
      await this.handleRequestType(newRequest);

      // Send confirmation to guest
      if (request.guestEmail || request.guestPhone) {
        await this.sendGuestNotification(newRequest, 'request_received');
      }

      return { success: true, requestId: newRequest.id };
    } catch (error) {
      console.error('[GuestPortal] Error:', error);
      return { success: false, message: 'Internal error' };
    }
  }

  /**
   * Get request status for guest tracking
   */
  async getRequestStatus(requestId: string): Promise<any> {
    const { data } = await supabase
      .from('hk_guest_service_requests')
      .select(`
        id,
        request_number,
        request_type,
        status,
        created_at,
        assigned_at,
        completed_at,
        guest_notified
      `)
      .eq('id', requestId)
      .single();

    if (!data) return null;

    return {
      requestNumber: data.request_number,
      type: data.request_type,
      status: data.status,
      submittedAt: data.created_at,
      estimatedCompletion: this.estimateCompletionTime(data),
      isCompleted: data.status === 'completed'
    };
  }

  /**
   * Set room DND schedule
   */
  async setDndSchedule(roomNumber: string, startTime: string, endTime: string): Promise<boolean> {
    const { error } = await supabase
      .from('rooms')
      .update({
        hk_status: 'do_not_disturb',
        dnd_start_time: new Date().toISOString()
      })
      .eq('room_number', roomNumber);

    if (error) return false;

    // Schedule status reset
    // In production, this would be handled by a job scheduler
    
    return true;
  }

  /**
   * Set cleaning time preference
   */
  async setCleaningTimePreference(
    roomNumber: string,
    preferredTimeStart: string,
    preferredTimeEnd: string
  ): Promise<boolean> {
    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_number', roomNumber)
      .single();

    if (!room) return false;

    await supabase
      .from('hk_guest_preferences')
      .upsert({
        room_id: room.id,
        preferred_cleaning_time: `${preferredTimeStart}-${preferredTimeEnd}`
      }, { onConflict: 'room_id' });

    return true;
  }

  /**
   * Save guest preferences
   */
  async saveGuestPreferences(roomNumber: string, preferences: GuestPreference): Promise<boolean> {
    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_number', roomNumber)
      .single();

    if (!room) return false;

    const { error } = await supabase
      .from('hk_guest_preferences')
      .upsert({
        room_id: room.id,
        pillow_type: preferences.pillowType,
        bed_firmness: preferences.bedFirmness,
        room_temperature: preferences.roomTemperature,
        preferred_cleaning_time: preferences.preferredCleaningTime,
        extra_towels: preferences.extraTowels,
        extra_pillows: preferences.extraPillows,
        no_feather: preferences.noFeather,
        allergy_info: preferences.allergyInfo,
        minibar_preferences: preferences.minibarPreferences,
        turndown_service: preferences.turndownService,
        dnd_default_hours: preferences.dndDefaultHours,
        special_notes: preferences.specialNotes
      }, { onConflict: 'room_id' });

    return !error;
  }

  /**
   * Get guest preferences for room
   */
  async getGuestPreferences(roomNumber: string): Promise<GuestPreference | null> {
    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_number', roomNumber)
      .single();

    if (!room) return null;

    const { data } = await supabase
      .from('hk_guest_preferences')
      .select('*')
      .eq('room_id', room.id)
      .single();

    if (!data) return null;

    return {
      pillowType: data.pillow_type,
      bedFirmness: data.bed_firmness,
      roomTemperature: data.room_temperature,
      preferredCleaningTime: data.preferred_cleaning_time,
      extraTowels: data.extra_towels,
      extraPillows: data.extra_pillows,
      noFeather: data.no_feather,
      allergyInfo: data.allergy_info,
      minibarPreferences: data.minibar_preferences,
      turndownService: data.turndown_service,
      dndDefaultHours: data.dnd_default_hours,
      specialNotes: data.special_notes
    };
  }

  /**
   * Submit guest feedback for completed service
   */
  async submitFeedback(requestId: string, rating: number, feedback?: string): Promise<boolean> {
    const { error } = await supabase
      .from('hk_guest_service_requests')
      .update({
        guest_rating: rating,
        guest_feedback: feedback
      })
      .eq('id', requestId);

    if (error) return false;

    // If highly rated, award bonus points to staff
    if (rating >= 5) {
      const { data: request } = await supabase
        .from('hk_guest_service_requests')
        .select('assigned_to')
        .eq('id', requestId)
        .single();

      if (request?.assigned_to) {
        // Award points through gamification service
        const { gamification } = await import('./gamification.service');
        await gamification.awardSpecialBonus(
          request.assigned_to,
          'guest_compliment',
          'Guest 5-star rating received'
        );
      }
    }

    return true;
  }

  /**
   * Request room to be cleaned now
   */
  async requestCleanNow(roomNumber: string, guestName?: string, reason?: string): Promise<{ success: boolean; taskId?: string }> {
    const { data: room } = await supabase
      .from('rooms')
      .select('id, branch_id, is_vip, hk_status')
      .eq('room_number', roomNumber)
      .single();

    if (!room) {
      return { success: false };
    }

    // Check if room is already being cleaned
    if (room.hk_status === 'cleaning_in_progress') {
      return { success: false };
    }

    // Create urgent cleaning task
    const { data: task, error } = await supabase
      .from('hk_tasks')
      .insert({
        room_id: room.id,
        room_number: roomNumber,
        floor_number: parseInt(roomNumber.charAt(0)),
        task_type: 'guest_request',
        priority: room.is_vip ? 'urgent' : 'high',
        status: 'pending',
        is_vip: room.is_vip,
        special_instructions: reason ? `Guest request: ${reason}` : 'Clean now requested by guest',
        credit_value: 1.0,
        estimated_duration_minutes: 30
      })
      .select()
      .single();

    if (error) {
      return { success: false };
    }

    // Update room status
    await supabase
      .from('rooms')
      .update({ hk_status: 'vacant_dirty', cleaning_priority: 'urgent' })
      .eq('id', room.id);

    return { success: true, taskId: task.id };
  }

  /**
   * Request extra amenities
   */
  async requestExtraAmenities(roomNumber: string, items: string[], guestName?: string): Promise<{ success: boolean; requestId?: string }> {
    return this.submitServiceRequest({
      roomNumber,
      guestName,
      requestType: 'extra_amenities',
      details: { items },
      priority: 'normal'
    });
  }

  // Private methods

  private async handleRequestType(request: any): Promise<void> {
    switch (request.request_type) {
      case 'clean_now':
        await this.requestCleanNow(request.room_number, request.guest_name, request.details?.reason);
        break;

      case 'dnd_schedule':
        if (request.details?.startTime && request.details?.endTime) {
          await this.setDndSchedule(request.room_number, request.details.startTime, request.details.endTime);
        }
        break;

      case 'timing_preference':
        if (request.preferred_time_start && request.preferred_time_end) {
          await this.setCleaningTimePreference(
            request.room_number,
            request.preferred_time_start,
            request.preferred_time_end
          );
        }
        break;

      case 'turndown':
        await this.createTurndownTask(request.room_number);
        break;
    }
  }

  private async createTurndownTask(roomNumber: string): Promise<void> {
    const { data: room } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_number', roomNumber)
      .single();

    if (!room) return;

    await supabase
      .from('hk_tasks')
      .insert({
        room_id: room.id,
        room_number: roomNumber,
        floor_number: parseInt(roomNumber.charAt(0)),
        task_type: 'turndown_service',
        priority: 'normal',
        status: 'pending',
        credit_value: 0.3,
        estimated_duration_minutes: 15
      });
  }

  private async sendGuestNotification(request: any, template: string): Promise<void> {
    const notificationData = {
      requestNumber: request.request_number,
      roomNumber: request.room_number,
      requestType: request.request_type,
      status: request.status
    };

    // Queue notification
    await supabase
      .from('hk_notifications')
      .insert({
        recipient_type: 'guest',
        recipient_email: request.guest_email,
        recipient_phone: request.guest_phone,
        notification_type: template,
        channel: request.guest_email ? 'email' : 'sms',
        title: this.getNotificationTitle(template),
        message: this.getNotificationMessage(template, notificationData),
        data: notificationData,
        priority: 'normal'
      });
  }

  private getNotificationTitle(template: string): string {
    const titles: Record<string, string> = {
      'request_received': 'Service Request Received',
      'request_assigned': 'Your Request is Being Processed',
      'request_completed': 'Service Completed',
      'room_ready': 'Your Room is Ready'
    };
    return titles[template] || 'Housekeeping Update';
  }

  private getNotificationMessage(template: string, data: any): string {
    const messages: Record<string, string> = {
      'request_received': `Your request #${data.requestNumber} has been received and will be processed shortly.`,
      'request_assigned': `A team member has been assigned to your request #${data.requestNumber}.`,
      'request_completed': `Your request #${data.requestNumber} has been completed. We hope everything is to your satisfaction.`,
      'room_ready': `Room ${data.roomNumber} has been cleaned and is ready for you.`
    };
    return messages[template] || 'Your request is being processed.';
  }

  private estimateCompletionTime(request: any): string | null {
    if (request.status === 'completed') return null;

    const estimates: Record<string, number> = {
      'clean_now': 45,
      'extra_amenities': 15,
      'turndown': 20,
      'timing_preference': 0,
      'dnd_schedule': 0,
      'other': 30
    };

    const minutes = estimates[request.request_type] || 30;
    const baseTime = request.assigned_at ? new Date(request.assigned_at) : new Date();
    const estimatedTime = new Date(baseTime.getTime() + minutes * 60000);

    return estimatedTime.toISOString();
  }
}

export const guestPortal = new GuestPortalService();
export default guestPortal;
