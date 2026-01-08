import { Request, Response } from 'express';
import { supabase } from '../config/database';

/**
 * Additional Services Controller
 * Handles pool, conference, banqueting, car wash, and other revenue streams
 */

// ============================================
// ADDITIONAL SERVICES MANAGEMENT
// ============================================

// Get all additional services
export const getServices = async (req: Request, res: Response) => {
  try {
    const { branch_id, service_type, is_active } = req.query;

    let query = supabase
      .from('additional_services')
      .select('*')
      .order('service_name', { ascending: true });

    if (branch_id) {
      query = query.or(`branch_id.eq.${branch_id},branch_id.is.null`);
    }

    if (service_type) {
      query = query.eq('service_type', service_type);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === 'true');
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      message: 'Services retrieved successfully',
      data
    });
  } catch (error: any) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch services'
    });
  }
};

// Get service by ID
export const getServiceById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('additional_services')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Service not found'
      });
    }

    res.json({
      success: true,
      message: 'Service retrieved successfully',
      data
    });
  } catch (error: any) {
    console.error('Error fetching service:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch service'
    });
  }
};

// Create additional service
export const createService = async (req: Request, res: Response) => {
  try {
    const {
      service_code,
      service_name,
      service_type,
      description,
      branch_id,
      is_branch_specific,
      pricing_type,
      base_price,
      currency,
      capacity,
      duration_minutes,
      requires_booking,
      advance_booking_hours,
      terms_and_conditions
    } = req.body;

    const { data, error } = await supabase
      .from('additional_services')
      .insert({
        service_code,
        service_name,
        service_type,
        description,
        branch_id: is_branch_specific ? branch_id : null,
        is_branch_specific: is_branch_specific || false,
        pricing_type,
        base_price,
        currency: currency || 'KES',
        capacity,
        duration_minutes,
        is_active: true,
        requires_booking: requires_booking !== false,
        advance_booking_hours: advance_booking_hours || 0,
        terms_and_conditions
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Service created successfully',
      data
    });
  } catch (error: any) {
    console.error('Error creating service:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create service'
    });
  }
};

// Update service
export const updateService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { data, error } = await supabase
      .from('additional_services')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Service updated successfully',
      data
    });
  } catch (error: any) {
    console.error('Error updating service:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update service'
    });
  }
};

// Delete service
export const deleteService = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { error} = await supabase
      .from('additional_services')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting service:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete service'
    });
  }
};

// ============================================
// SERVICE BOOKINGS MANAGEMENT
// ============================================

// Get all service bookings
export const getServiceBookings = async (req: Request, res: Response) => {
  try {
    const { branch_id, booking_status, payment_status, service_id, start_date, end_date } = req.query;

    let query = supabase
      .from('service_bookings')
      .select(`
        *,
        service:additional_services(*)
      `)
      .order('booking_date', { ascending: false });

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    if (booking_status) {
      query = query.eq('booking_status', booking_status);
    }

    if (payment_status) {
      query = query.eq('payment_status', payment_status);
    }

    if (service_id) {
      query = query.eq('service_id', service_id);
    }

    if (start_date) {
      query = query.gte('booking_date', start_date);
    }

    if (end_date) {
      query = query.lte('booking_date', end_date);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      message: 'Service bookings retrieved successfully',
      data
    });
  } catch (error: any) {
    console.error('Error fetching service bookings:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch service bookings'
    });
  }
};

// Get booking by ID
export const getServiceBookingById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('service_bookings')
      .select(`
        *,
        service:additional_services(*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      message: 'Booking retrieved successfully',
      data
    });
  } catch (error: any) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch booking'
    });
  }
};

// Create service booking
export const createServiceBooking = async (req: Request, res: Response) => {
  try {
    const {
      service_id,
      branch_id,
      customer_type,
      guest_id,
      customer_name,
      customer_phone,
      customer_email,
      booking_date,
      start_time,
      end_time,
      duration_hours,
      number_of_people,
      total_amount,
      deposit_amount,
      special_requests
    } = req.body;

    // Generate booking number
    const { data: bookingNumberData } = await supabase
      .rpc('generate_service_booking_number');

    const booking_number = bookingNumberData || `SB${Date.now()}`;

    const balance_amount = total_amount - (deposit_amount || 0);

    const { data, error } = await supabase
      .from('service_bookings')
      .insert({
        booking_number,
        service_id,
        branch_id,
        customer_type,
        guest_id,
        customer_name,
        customer_phone,
        customer_email,
        booking_date,
        start_time,
        end_time,
        duration_hours,
        number_of_people: number_of_people || 1,
        total_amount,
        deposit_amount: deposit_amount || 0,
        balance_amount,
        payment_status: deposit_amount >= total_amount ? 'paid' : deposit_amount > 0 ? 'partial' : 'pending',
        booking_status: 'pending',
        special_requests,
        booked_by: req.user?.id
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      message: 'Service booking created successfully',
      data
    });
  } catch (error: any) {
    console.error('Error creating service booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create service booking'
    });
  }
};

// Update service booking
export const updateServiceBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Recalculate balance if amounts change
    if (updateData.total_amount !== undefined || updateData.deposit_amount !== undefined) {
      const { data: current } = await supabase
        .from('service_bookings')
        .select('*')
        .eq('id', id)
        .single();

      if (current) {
        const total = updateData.total_amount ?? current.total_amount;
        const deposit = updateData.deposit_amount ?? current.deposit_amount;
        updateData.balance_amount = total - deposit;
      }
    }

    const { data, error } = await supabase
      .from('service_bookings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Service booking updated successfully',
      data
    });
  } catch (error: any) {
    console.error('Error updating service booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update service booking'
    });
  }
};

// Confirm service booking
export const confirmServiceBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('service_bookings')
      .update({
        booking_status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Service booking confirmed successfully',
      data
    });
  } catch (error: any) {
    console.error('Error confirming service booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to confirm service booking'
    });
  }
};

// Complete service booking
export const completeServiceBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('service_bookings')
      .update({
        booking_status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Service booking completed successfully',
      data
    });
  } catch (error: any) {
    console.error('Error completing service booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to complete service booking'
    });
  }
};

// Cancel service booking
export const cancelServiceBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    const { data, error } = await supabase
      .from('service_bookings')
      .update({
        booking_status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Service booking cancelled successfully',
      data
    });
  } catch (error: any) {
    console.error('Error cancelling service booking:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel service booking'
    });
  }
};

// Record service booking payment
export const recordServicePayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { payment_amount, payment_method, payment_reference } = req.body;

    // Fetch current booking
    const { data: booking, error: fetchError } = await supabase
      .from('service_bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Calculate new deposit amount
    const new_deposit = (booking.deposit_amount || 0) + payment_amount;
    const new_balance = booking.total_amount - new_deposit;

    // Update booking
    const { data: updatedBooking, error: updateError } = await supabase
      .from('service_bookings')
      .update({
        deposit_amount: new_deposit,
        balance_amount: new_balance
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Record cashier transaction
    const { data: transactionData } = await supabase
      .rpc('generate_cashier_transaction_number');

    const transaction_number = transactionData || `CT${Date.now()}`;

    await supabase
      .from('cashier_transactions')
      .insert({
        transaction_number,
        branch_id: booking.branch_id,
        cashier_id: req.user?.id,
        transaction_type: 'payment',
        revenue_type: 'additional_service',
        reference_type: 'service_booking',
        reference_id: booking.id,
        payment_method,
        amount: payment_amount,
        payment_reference,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone
      });

    res.json({
      success: true,
      message: 'Payment recorded successfully',
      data: updatedBooking
    });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to record payment'
    });
  }
};

// Get service bookings dashboard stats
export const getServiceStats = async (req: Request, res: Response) => {
  try {
    const { branch_id } = req.query;
    const today = new Date().toISOString().split('T')[0];

    // Get today's bookings
    const { data: todayBookings } = await supabase
      .from('service_bookings')
      .select('*')
      .eq('branch_id', branch_id)
      .eq('booking_date', today);

    // Get pending bookings
    const { data: pendingBookings } = await supabase
      .from('service_bookings')
      .select('*', { count: 'exact' })
      .eq('branch_id', branch_id)
      .eq('booking_status', 'pending');

    // Get unpaid bookings
    const { data: unpaidBookings } = await supabase
      .from('service_bookings')
      .select('*')
      .eq('branch_id', branch_id)
      .neq('payment_status', 'paid');

    const todayRevenue = todayBookings?.reduce((sum, b) => sum + parseFloat(b.deposit_amount || 0), 0) || 0;
    const totalUnpaid = unpaidBookings?.reduce((sum, b) => sum + parseFloat(b.balance_amount || 0), 0) || 0;

    res.json({
      success: true,
      message: 'Service statistics retrieved successfully',
      data: {
        todayBookings: todayBookings?.length || 0,
        todayRevenue,
        pendingBookings: pendingBookings?.length || 0,
        unpaidBookings: unpaidBookings?.length || 0,
        totalUnpaidAmount: totalUnpaid
      }
    });
  } catch (error: any) {
    console.error('Error fetching service stats:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch service statistics'
    });
  }
};
