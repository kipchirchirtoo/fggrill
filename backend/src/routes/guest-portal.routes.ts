import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// =====================================================
// GUEST PORTAL API ROUTES
// =====================================================

// Get guest dashboard data
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get guest profile
    const { data: profile } = await supabase
      .from('guest_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get current/upcoming bookings
    const today = new Date().toISOString().split('T')[0];
    const { data: bookings } = await supabase
      .from('bookings')
      .select(`
        *,
        room:rooms(room_number, floor, type:room_types(name, description))
      `)
      .eq('guest_id', userId)
      .gte('check_out_date', today)
      .order('check_in_date', { ascending: true })
      .limit(5);

    // Get active booking (currently checked in)
    const { data: activeBooking } = await supabase
      .from('bookings')
      .select(`
        *,
        room:rooms(room_number, floor, type:room_types(name, description, amenities))
      `)
      .eq('guest_id', userId)
      .eq('status', 'checked_in')
      .single();

    // Get loyalty info
    const { data: loyalty } = await supabase
      .from('guest_loyalty')
      .select('*')
      .eq('guest_id', userId)
      .single();

    // Get pending requests
    const { data: requests } = await supabase
      .from('guest_requests')
      .select('*')
      .eq('guest_id', userId)
      .in('status', ['pending', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(5);

    // Get unread messages count
    const { count: unreadMessages } = await supabase
      .from('guest_messages')
      .select('*', { count: 'exact', head: true })
      .eq('guest_id', userId)
      .eq('sender_type', 'staff')
      .eq('is_read', false);

    // Get available amenities
    const { data: amenities } = await supabase
      .from('hotel_amenities')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });

    res.json({
      success: true,
      data: {
        profile,
        bookings: bookings || [],
        activeBooking,
        loyalty: loyalty || { total_points: 0, tier: 'bronze', total_stays: 0 },
        pendingRequests: requests || [],
        unreadMessages: unreadMessages || 0,
        amenities: amenities || []
      }
    });
  } catch (error: any) {
    console.error('Guest dashboard error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get guest profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    const { data: profile } = await supabase
      .from('guest_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    const { data: preferences } = await supabase
      .from('guest_preferences')
      .select('*')
      .eq('guest_id', profile?.id);

    res.json({
      success: true,
      data: { ...user, guestProfile: profile, preferences: preferences || [] }
    });
  } catch (error: any) {
    console.error('Get guest profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update guest profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { phone_number, address, nationality, company } = req.body;

    // Update user table
    if (phone_number || address) {
      await supabase
        .from('users')
        .update({ phone_number, address, updated_at: new Date().toISOString() })
        .eq('id', userId);
    }

    // Update guest profile
    if (nationality || company) {
      await supabase
        .from('guest_profiles')
        .update({ nationality, company, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    }

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error: any) {
    console.error('Update guest profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get bookings
router.get('/bookings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { status, upcoming } = req.query;

    let query = supabase
      .from('bookings')
      .select(`
        *,
        room:rooms(room_number, floor, type:room_types(name, description))
      `)
      .eq('guest_id', userId)
      .order('check_in_date', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (upcoming === 'true') {
      const today = new Date().toISOString().split('T')[0];
      query = query.gte('check_out_date', today);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get bookings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single booking details
router.get('/bookings/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        room:rooms(room_number, floor, type:room_types(name, description, amenities, base_price))
      `)
      .eq('id', id)
      .eq('guest_id', userId)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Get booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel booking
router.post('/bookings/:id/cancel', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { reason } = req.body;

    // Check if booking can be cancelled
    const { data: booking } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .eq('guest_id', userId)
      .single();

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (['checked_in', 'checked_out', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel this booking' });
    }

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        notes: reason ? `Cancelled by guest: ${reason}` : 'Cancelled by guest',
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (error: any) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get service requests
router.get('/requests', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { status } = req.query;

    let query = supabase
      .from('guest_requests')
      .select('*')
      .eq('guest_id', userId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get requests error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create service request
router.post('/requests', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { request_type, title, description, priority, scheduled_time } = req.body;

    // Get active booking
    const { data: activeBooking } = await supabase
      .from('bookings')
      .select('id, room:rooms(room_number, branch_id)')
      .eq('guest_id', userId)
      .eq('status', 'checked_in')
      .single();

    const { data, error } = await supabase
      .from('guest_requests')
      .insert({
        guest_id: userId,
        booking_id: activeBooking?.id,
        branch_id: (activeBooking?.room as any)?.branch_id,
        request_type,
        title,
        description,
        priority: priority || 'normal',
        room_number: (activeBooking?.room as any)?.room_number,
        scheduled_time,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Request submitted successfully', data });
  } catch (error: any) {
    console.error('Create request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel service request
router.delete('/requests/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('guest_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('guest_id', userId)
      .eq('status', 'pending');

    if (error) throw error;
    res.json({ success: true, message: 'Request cancelled' });
  } catch (error: any) {
    console.error('Cancel request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Rate completed request
router.post('/requests/:id/rate', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { rating, feedback } = req.body;

    const { error } = await supabase
      .from('guest_requests')
      .update({ rating, feedback, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('guest_id', userId)
      .eq('status', 'completed');

    if (error) throw error;
    res.json({ success: true, message: 'Thank you for your feedback' });
  } catch (error: any) {
    console.error('Rate request error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get messages
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const { data, error } = await supabase
      .from('guest_messages')
      .select('*')
      .eq('guest_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Mark messages as read
    await supabase
      .from('guest_messages')
      .update({ is_read: true })
      .eq('guest_id', userId)
      .eq('sender_type', 'staff')
      .eq('is_read', false);

    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get messages error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Send message
router.post('/messages', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { subject, message, booking_id } = req.body;

    const { data: booking } = await supabase
      .from('bookings')
      .select('room:rooms(branch_id)')
      .eq('id', booking_id)
      .single();

    const { data, error } = await supabase
      .from('guest_messages')
      .insert({
        guest_id: userId,
        booking_id,
        branch_id: (booking?.room as any)?.branch_id,
        subject,
        message,
        sender_type: 'guest',
        sender_id: userId
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Message sent', data });
  } catch (error: any) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get loyalty info
router.get('/loyalty', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const { data: loyalty } = await supabase
      .from('guest_loyalty')
      .select('*')
      .eq('guest_id', userId)
      .single();

    const { data: transactions } = await supabase
      .from('guest_loyalty_transactions')
      .select('*')
      .eq('guest_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({
      success: true,
      data: {
        loyalty: loyalty || { total_points: 0, tier: 'bronze', total_stays: 0, total_spent: 0 },
        transactions: transactions || []
      }
    });
  } catch (error: any) {
    console.error('Get loyalty error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get amenities
router.get('/amenities', async (req: Request, res: Response) => {
  try {
    const { category } = req.query;

    let query = supabase
      .from('hotel_amenities')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get amenities error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Book amenity
router.post('/amenities/:id/book', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { scheduled_date, scheduled_time, duration_minutes, guests_count, special_requests } = req.body;

    // Get amenity details
    const { data: amenity } = await supabase
      .from('hotel_amenities')
      .select('*')
      .eq('id', id)
      .single();

    if (!amenity || !amenity.is_bookable) {
      return res.status(400).json({ success: false, message: 'This amenity cannot be booked' });
    }

    // Get active booking
    const { data: activeBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('guest_id', userId)
      .eq('status', 'checked_in')
      .single();

    const { data, error } = await supabase
      .from('amenity_bookings')
      .insert({
        amenity_id: id,
        guest_id: userId,
        booking_id: activeBooking?.id,
        scheduled_date,
        scheduled_time,
        duration_minutes,
        guests_count: guests_count || 1,
        special_requests,
        total_amount: amenity.price * (guests_count || 1),
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Booking request submitted', data });
  } catch (error: any) {
    console.error('Book amenity error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get amenity bookings
router.get('/amenity-bookings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const { data, error } = await supabase
      .from('amenity_bookings')
      .select(`
        *,
        amenity:hotel_amenities(name, category, price)
      `)
      .eq('guest_id', userId)
      .order('scheduled_date', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get amenity bookings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Cancel amenity booking
router.delete('/amenity-bookings/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('amenity_bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('guest_id', userId)
      .in('status', ['pending', 'confirmed']);

    if (error) throw error;
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (error: any) {
    console.error('Cancel amenity booking error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit feedback
router.post('/feedback', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const {
      booking_id,
      overall_rating,
      cleanliness_rating,
      service_rating,
      amenities_rating,
      value_rating,
      comment,
      would_recommend
    } = req.body;

    // Get booking details
    const { data: booking } = await supabase
      .from('bookings')
      .select('room:rooms(branch_id)')
      .eq('id', booking_id)
      .single();

    const { data, error } = await supabase
      .from('guest_feedback')
      .insert({
        guest_id: userId,
        booking_id,
        branch_id: (booking?.room as any)?.branch_id,
        overall_rating,
        cleanliness_rating,
        service_rating,
        amenities_rating,
        value_rating,
        comment,
        would_recommend,
        is_public: true
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Thank you for your feedback!', data });
  } catch (error: any) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get preferences
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    const { data, error } = await supabase
      .from('guest_saved_preferences')
      .select('*')
      .eq('guest_id', userId);

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Get preferences error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update preferences
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { category, preference_key, preference_value } = req.body;

    const { data, error } = await supabase
      .from('guest_saved_preferences')
      .upsert({
        guest_id: userId,
        category,
        preference_key,
        preference_value,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'guest_id,category,preference_key'
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, message: 'Preference saved', data });
  } catch (error: any) {
    console.error('Update preference error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
