import axios from 'axios';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

/**
 * Channel Manager Service
 * Handles integration with OTAs (Online Travel Agencies) like Booking.com, Expedia, etc.
 * This is a mock implementation - in production, integrate with actual channel manager APIs
 */

interface ChannelConfig {
  channelId: string;
  channelName: string;
  apiKey?: string;
  apiSecret?: string;
  hotelId?: string;
  enabled: boolean;
  lastSync?: Date;
}

interface RoomAvailability {
  roomTypeId: string;
  date: string;
  available: number;
  rate: number;
  minStay?: number;
  maxStay?: number;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
}

interface ChannelBooking {
  channelBookingId: string;
  channelName: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalAmount: number;
  currency: string;
  status: string;
  specialRequests?: string;
  createdAt: string;
}

interface SyncResult {
  success: boolean;
  channel: string;
  operation: string;
  itemsProcessed: number;
  errors: string[];
  timestamp: Date;
}

class ChannelManagerService {
  private channels: Map<string, ChannelConfig> = new Map();

  constructor() {
    // Initialize supported channels (mock)
    this.channels.set('booking_com', {
      channelId: 'booking_com',
      channelName: 'Booking.com',
      enabled: false,
    });
    this.channels.set('expedia', {
      channelId: 'expedia',
      channelName: 'Expedia',
      enabled: false,
    });
    this.channels.set('airbnb', {
      channelId: 'airbnb',
      channelName: 'Airbnb',
      enabled: false,
    });
    this.channels.set('agoda', {
      channelId: 'agoda',
      channelName: 'Agoda',
      enabled: false,
    });
  }

  /**
   * Get all configured channels
   */
  getChannels(): ChannelConfig[] {
    return Array.from(this.channels.values());
  }

  /**
   * Configure a channel
   */
  async configureChannel(
    channelId: string,
    config: Partial<ChannelConfig>
  ): Promise<ChannelConfig | null> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return null;
    }

    const updatedChannel = { ...channel, ...config };
    this.channels.set(channelId, updatedChannel);

    logger.info(`Channel ${channelId} configured`);
    return updatedChannel;
  }

  /**
   * Push availability to a channel
   */
  async pushAvailability(
    channelId: string,
    availability: RoomAvailability[]
  ): Promise<SyncResult> {
    const channel = this.channels.get(channelId);
    if (!channel || !channel.enabled) {
      return {
        success: false,
        channel: channelId,
        operation: 'push_availability',
        itemsProcessed: 0,
        errors: ['Channel not configured or disabled'],
        timestamp: new Date(),
      };
    }

    try {
      // Mock API call to channel
      // In production: Use actual channel API
      logger.info(`Pushing ${availability.length} availability updates to ${channel.channelName}`);

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update last sync time
      channel.lastSync = new Date();
      this.channels.set(channelId, channel);

      return {
        success: true,
        channel: channelId,
        operation: 'push_availability',
        itemsProcessed: availability.length,
        errors: [],
        timestamp: new Date(),
      };
    } catch (error: any) {
      logger.error(`Failed to push availability to ${channelId}:`, error.message);
      return {
        success: false,
        channel: channelId,
        operation: 'push_availability',
        itemsProcessed: 0,
        errors: [error.message],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Push rates to a channel
   */
  async pushRates(
    channelId: string,
    rates: Array<{ roomTypeId: string; date: string; rate: number }>
  ): Promise<SyncResult> {
    const channel = this.channels.get(channelId);
    if (!channel || !channel.enabled) {
      return {
        success: false,
        channel: channelId,
        operation: 'push_rates',
        itemsProcessed: 0,
        errors: ['Channel not configured or disabled'],
        timestamp: new Date(),
      };
    }

    try {
      logger.info(`Pushing ${rates.length} rate updates to ${channel.channelName}`);

      // Mock processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      channel.lastSync = new Date();
      this.channels.set(channelId, channel);

      return {
        success: true,
        channel: channelId,
        operation: 'push_rates',
        itemsProcessed: rates.length,
        errors: [],
        timestamp: new Date(),
      };
    } catch (error: any) {
      logger.error(`Failed to push rates to ${channelId}:`, error.message);
      return {
        success: false,
        channel: channelId,
        operation: 'push_rates',
        itemsProcessed: 0,
        errors: [error.message],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Pull bookings from a channel
   */
  async pullBookings(channelId: string): Promise<{
    success: boolean;
    bookings: ChannelBooking[];
    errors: string[];
  }> {
    const channel = this.channels.get(channelId);
    if (!channel || !channel.enabled) {
      return {
        success: false,
        bookings: [],
        errors: ['Channel not configured or disabled'],
      };
    }

    try {
      logger.info(`Pulling bookings from ${channel.channelName}`);

      // Mock bookings (in production, fetch from channel API)
      const mockBookings: ChannelBooking[] = [];

      channel.lastSync = new Date();
      this.channels.set(channelId, channel);

      return {
        success: true,
        bookings: mockBookings,
        errors: [],
      };
    } catch (error: any) {
      logger.error(`Failed to pull bookings from ${channelId}:`, error.message);
      return {
        success: false,
        bookings: [],
        errors: [error.message],
      };
    }
  }

  /**
   * Sync all enabled channels
   */
  async syncAllChannels(): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const [channelId, channel] of this.channels) {
      if (!channel.enabled) continue;

      // Get current availability from database
      const { data: rooms } = await supabase
        .from('rooms')
        .select('id, room_type_id, status, base_price');

      const availability: RoomAvailability[] = (rooms || [])
        .filter((r: any) => r.status === 'available')
        .map((r: any) => ({
          roomTypeId: r.room_type_id,
          date: new Date().toISOString().split('T')[0],
          available: 1,
          rate: r.base_price || 0,
        }));

      const result = await this.pushAvailability(channelId, availability);
      results.push(result);
    }

    return results;
  }

  /**
   * Import booking from channel to PMS
   */
  async importBooking(booking: ChannelBooking): Promise<{
    success: boolean;
    bookingId?: string;
    error?: string;
  }> {
    try {
      // Check if booking already exists
      const { data: existing } = await supabase
        .from('bookings')
        .select('id')
        .eq('channel_booking_id', booking.channelBookingId)
        .single();

      if (existing) {
        return {
          success: false,
          error: 'Booking already imported',
        };
      }

      // Find or create guest
      let guestId: string;
      const { data: existingGuest } = await supabase
        .from('guests')
        .select('id')
        .eq('email', booking.guestEmail)
        .single();

      if (existingGuest) {
        guestId = existingGuest.id;
      } else {
        const nameParts = booking.guestName.split(' ');
        const { data: newGuest, error: guestError } = await supabase
          .from('guests')
          .insert({
            first_name: nameParts[0] || 'Guest',
            last_name: nameParts.slice(1).join(' ') || '',
            email: booking.guestEmail,
            phone: booking.guestPhone,
            source: booking.channelName,
          })
          .select()
          .single();

        if (guestError || !newGuest) {
          throw new Error('Failed to create guest');
        }
        guestId = newGuest.id;
      }

      // Find available room
      const { data: availableRoom } = await supabase
        .from('rooms')
        .select('id')
        .eq('room_type_id', booking.roomTypeId)
        .eq('status', 'available')
        .limit(1)
        .single();

      if (!availableRoom) {
        return {
          success: false,
          error: 'No available rooms for requested type',
        };
      }

      // Create booking
      const confirmationNumber = `CH-${Date.now().toString().slice(-8)}`;
      const { data: newBooking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          guest_id: guestId,
          room_id: availableRoom.id,
          room_type_id: booking.roomTypeId,
          check_in_date: booking.checkIn,
          check_out_date: booking.checkOut,
          adults: booking.adults,
          children: booking.children,
          total_amount: booking.totalAmount,
          status: 'confirmed',
          confirmation_number: confirmationNumber,
          channel_booking_id: booking.channelBookingId,
          channel_name: booking.channelName,
          special_requests: booking.specialRequests,
          source: booking.channelName,
        })
        .select()
        .single();

      if (bookingError || !newBooking) {
        throw new Error('Failed to create booking');
      }

      logger.info(`Imported booking ${booking.channelBookingId} from ${booking.channelName}`);

      return {
        success: true,
        bookingId: newBooking.id,
      };
    } catch (error: any) {
      logger.error('Failed to import booking:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get sync status for all channels
   */
  getSyncStatus(): Array<{
    channelId: string;
    channelName: string;
    enabled: boolean;
    lastSync?: Date;
    status: string;
  }> {
    return Array.from(this.channels.values()).map((channel) => ({
      channelId: channel.channelId,
      channelName: channel.channelName,
      enabled: channel.enabled,
      lastSync: channel.lastSync,
      status: channel.enabled ? 'active' : 'disabled',
    }));
  }
}

export const channelManagerService = new ChannelManagerService();
