import { Request, Response } from 'express';
import { supabase } from '../config/database';

// Get all catering bookings
export const getCateringBookings = async (req: Request, res: Response) => {
  try {
    const branchId = req.headers['x-branch-id'];
    const { startDate, endDate, status, search } = req.query;

    let query = supabase
      .from('catering_bookings')
      .select(`
        *,
        created_by_user:users!catering_bookings_created_by_fkey(first_name, last_name)
      `)
      .order('event_date', { ascending: false });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (startDate) {
      query = query.gte('event_date', startDate);
    }

    if (endDate) {
      query = query.lte('event_date', endDate);
    }

    if (status) {
      query = query.eq('booking_status', status);
    }

    if (search) {
      query = query.or(`customer_name.ilike.%${search}%,booking_number.ilike.%${search}%,customer_phone.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching catering bookings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch catering bookings'
    });
  }
};

// Get catering booking by ID
export const getCateringBookingById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('catering_bookings')
      .select(`
        *,
        created_by_user:users!catering_bookings_created_by_fkey(first_name, last_name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Catering booking not found'
      });
    }

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching catering booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch catering booking'
    });
  }
};

// Create catering booking
export const createCateringBooking = async (req: Request, res: Response) => {
  try {
    const branchId = req.headers['x-branch-id'];
    const userId = (req as any).user?.id;
    
    const bookingData = {
      ...req.body,
      branch_id: branchId,
      created_by: userId
    };

    // Generate booking number if not provided
    if (!bookingData.booking_number) {
      const prefix = 'CAT';
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      bookingData.booking_number = `${prefix}${date}${random}`;
    }

    const { data, error } = await supabase
      .from('catering_bookings')
      .insert([bookingData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
      message: 'Catering booking created successfully'
    });
  } catch (error: any) {
    console.error('Error creating catering booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create catering booking'
    });
  }
};

// Update catering booking
export const updateCateringBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const bookingData = req.body;

    const { data, error } = await supabase
      .from('catering_bookings')
      .update(bookingData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Catering booking updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating catering booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update catering booking'
    });
  }
};

// Cancel catering booking
export const cancelCateringBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('catering_bookings')
      .update({ booking_status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Catering booking cancelled successfully'
    });
  } catch (error: any) {
    console.error('Error cancelling catering booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel catering booking'
    });
  }
};

// Delete catering booking
export const deleteCateringBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('catering_bookings')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Catering booking deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting catering booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete catering booking'
    });
  }
};

// Record payment for catering booking
export const recordCateringPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;

    // Get current booking
    const { data: booking, error: fetchError } = await supabase
      .from('catering_bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Catering booking not found'
      });
    }

    const newAmountPaid = (booking.amount_paid || 0) + parseFloat(amount);
    const totalAmount = booking.total_amount || 0;

    let paymentStatus = 'pending';
    if (newAmountPaid >= totalAmount) {
      paymentStatus = 'paid';
    } else if (newAmountPaid > 0) {
      paymentStatus = 'partial';
    }

    const { data, error } = await supabase
      .from('catering_bookings')
      .update({
        amount_paid: newAmountPaid,
        payment_status: paymentStatus
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data,
      message: 'Payment recorded successfully'
    });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record payment'
    });
  }
};

// Get catering bookings calendar data
export const getCateringCalendar = async (req: Request, res: Response) => {
  try {
    const branchId = req.headers['x-branch-id'];
    const { month, year } = req.query;

    let query = supabase
      .from('catering_bookings')
      .select('id, booking_number, customer_name, event_date, event_time, num_guests, booking_status')
      .neq('booking_status', 'cancelled')
      .order('event_date', { ascending: true });

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(parseInt(year as string), parseInt(month as string), 0).toISOString().slice(0, 10);
      query = query.gte('event_date', startDate).lte('event_date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching catering calendar:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch catering calendar'
    });
  }
};

// Get catering statistics
export const getCateringStatistics = async (req: Request, res: Response) => {
  try {
    const branchId = req.headers['x-branch-id'];
    const { startDate, endDate } = req.query;

    let query = supabase
      .from('catering_bookings')
      .select('*');

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    if (startDate) {
      query = query.gte('event_date', startDate);
    }

    if (endDate) {
      query = query.lte('event_date', endDate);
    }

    const { data: bookings, error } = await query;

    if (error) throw error;

    const stats = {
      totalBookings: bookings?.length || 0,
      confirmedBookings: bookings?.filter(b => b.booking_status === 'confirmed').length || 0,
      completedBookings: bookings?.filter(b => b.booking_status === 'completed').length || 0,
      cancelledBookings: bookings?.filter(b => b.booking_status === 'cancelled').length || 0,
      totalRevenue: bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0,
      totalPaid: bookings?.reduce((sum, b) => sum + (b.amount_paid || 0), 0) || 0,
      totalGuests: bookings?.reduce((sum, b) => sum + (b.num_guests || 0), 0) || 0
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Error fetching catering statistics:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch catering statistics'
    });
  }
};
