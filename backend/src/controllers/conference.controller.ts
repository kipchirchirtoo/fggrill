import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import axios from 'axios';
import { recordConferenceCashierPayment } from '../services/receptionEventCashierPayment.service';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'https://services.hirall.com';

// @desc    Get all conference halls for a branch
// @route   GET /api/conference/halls
// @access  Private
export const getHalls = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id;

        let query = supabase.from('conference_halls').select('*');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        const { data: halls, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: halls
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new conference hall
// @route   POST /api/conference/halls
// @access  Private (Admin/Manager)
export const createHall = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { name, branch_id, capacity, base_price_per_day, base_price_per_hour, description, amenities } = req.body;

        const { data: hall, error } = await supabase
            .from('conference_halls')
            .insert([{
                name,
                branch_id,
                capacity,
                base_price_per_day,
                base_price_per_hour,
                description,
                amenities,
                status: 'available'
            }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            data: hall
        });

        logger.info(`Conference hall created: ${name} in branch ${branch_id}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Update conference hall
// @route   PATCH /api/conference/halls/:id
// @access  Private (Admin/Manager)
export const updateHall = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, capacity, base_price_per_day, base_price_per_hour, description, amenities, status } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (capacity !== undefined) updateData.capacity = capacity;
        if (base_price_per_day !== undefined) updateData.base_price_per_day = base_price_per_day;
        if (base_price_per_hour !== undefined) updateData.base_price_per_hour = base_price_per_hour;
        if (description !== undefined) updateData.description = description;
        if (amenities !== undefined) updateData.amenities = amenities;
        if (status !== undefined) updateData.status = status;

        const { data: hall, error } = await supabase
            .from('conference_halls')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: hall
        });

        logger.info(`Conference hall updated: ${id}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Check conference hall availability
// @route   GET /api/conference/halls/:id/availability
// @access  Private
export const checkHallAvailability = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { start_date, end_date, exclude_booking_id } = req.query;

        if (!start_date || !end_date) {
            throw new AppError('Start date and end date are required', 400);
        }

        let query = supabase
            .from('conference_hall_bookings')
            .select('*')
            .eq('conference_hall_id', id)
            .eq('booking_status', 'confirmed');

        if (exclude_booking_id) {
            query = query.neq('id', exclude_booking_id);
        }

        const { data: bookings, error } = await query;

        if (error) throw error;

        // Overlap check: reqStart < bEnd && reqEnd > bStart
        const reqStart = new Date(start_date as string);
        const reqEnd = new Date(end_date as string);

        const overlapping = bookings?.filter(b => {
            const bStart = new Date(b.start_date);
            const bEnd = new Date(b.end_date);
            return reqStart < bEnd && reqEnd > bStart;
        });

        const isAvailable = !overlapping || overlapping.length === 0;

        res.status(200).json({
            success: true,
            available: isAvailable,
            conflicts: overlapping || []
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all conference bookings
// @route   GET /api/conference/bookings
// @access  Private
export const getConferenceBookings = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branchId = req.query.branch_id || req.user?.branch_id;
        const { status, startDate, endDate } = req.query;
        const invoiceNumber = req.params.invoice_number;

        let query = supabase
            .from('conference_hall_bookings')
            .select('*, hall:conference_halls(*)');

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }
        if (status) {
            query = query.eq('booking_status', status);
        }
        if (startDate) {
            query = query.gte('start_date', startDate);
        }
        if (endDate) {
            query = query.lte('end_date', endDate);
        }

        const { data: bookings, error } = await query.order('start_date', { ascending: false });

        if (error) throw error;

        // Parse metadata from notes field
        const enrichedBookings = (bookings || []).map(booking => {
            if (booking.notes && booking.notes.includes('__METADATA__:')) {
                try {
                    const parts = booking.notes.split('__METADATA__:');
                    const actualNotes = parts[0].trim();
                    const metadataStr = parts[1];
                    const metadata = JSON.parse(metadataStr);
                    
                    logger.info(`Parsed metadata for booking ${booking.id}: ${JSON.stringify(metadata)}`);
                    
                    return {
                        ...booking,
                        notes: actualNotes || null,
                        ...metadata
                    };
                } catch (e) {
                    logger.error(`Failed to parse metadata for booking ${booking.id}: ${e}`);
                    // If parsing fails, return as is
                    return booking;
                }
            }
            return booking;
        });

        // If looking up by invoice number, filter and return single result
        if (invoiceNumber) {
            const booking = enrichedBookings.find(b => b.invoice_number === invoiceNumber);
            if (!booking) {
                throw new AppError('Conference booking not found', 404);
            }
            res.status(200).json({
                success: true,
                data: booking
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: enrichedBookings
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a conference hall booking
// @route   POST /api/conference/bookings
// @access  Private
export const createConferenceBooking = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            company_name,
            customer_email,
            start_date,
            end_date,
            num_participants,
            amount_per_pax,
            meal_plan_details,
            program_schedule,
            amenities_details,
            payment_mode,
            notes
        } = req.body;

        // Flutter sends 'hall_id'; web client may send 'conference_hall_id' — accept both
        const conference_hall_id: string = req.body.conference_hall_id || req.body.hall_id;
        // Flutter sends 'contact_person'; web client may send 'customer_name' — accept both
        const customer_name: string = req.body.customer_name || req.body.contact_person || company_name;
        const contact_person: string = req.body.contact_person || req.body.customer_name || '';
        const customer_phone: string = req.body.customer_phone || '';

        const branch_id = req.body.branch_id || req.user?.branch_id;
        const created_by = req.user?.id;

        // Generate Invoice Number for reference: CNF-YYYYMMDD-XXXX
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
        const invoice_number = `CNF-${dateStr}-${randomStr}`;

        if (!conference_hall_id || !start_date || !end_date || !customer_name) {
            throw new AppError('Missing required booking fields', 400);
        }

        // Check for existing bookings in that time range
        const { data: existing, error: checkError } = await supabase
            .from('conference_hall_bookings')
            .select('*')
            .eq('conference_hall_id', conference_hall_id)
            .eq('booking_status', 'confirmed')
            .or(`start_date.lte.${end_date},end_date.gte.${start_date}`);

        if (checkError) throw checkError;

        // More precise overlap check
        const hasOverlap = existing && existing.some(b => {
            const bStart = new Date(b.start_date);
            const bEnd = new Date(b.end_date);
            const reqStart = new Date(start_date);
            const reqEnd = new Date(end_date);
            return reqStart < bEnd && reqEnd > bStart;
        });

        if (hasOverlap) {
            throw new AppError('The hall is already booked for the selected time range', 400);
        }

        // Calculate Total Amount if not provided or to verify
        let calculatedTotal = 0;

        // 1. Hall Rental (simplified: assumes daily rate for now if >= 8h)
        const start = new Date(start_date);
        const end = new Date(end_date);
        const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

        const { data: hall , error: hallError } = await supabase.from('conference_halls').select('*').eq('id', conference_hall_id).single();
        if (hallError) {
          console.error('Database error:', hallError);
          throw hallError;
        }
        if (hall) {
            if (diffHours >= 8) {
                calculatedTotal += Math.ceil(diffHours / 24) * (hall.base_price_per_day || 0);
            } else {
                calculatedTotal += Math.ceil(diffHours) * (hall.base_price_per_hour || 0);
            }
        }

        // 2. Per Pax amount
        if (num_participants && amount_per_pax) {
            calculatedTotal += (num_participants * amount_per_pax);
        }

        // 3. Meal plans
        if (meal_plan_details && Array.isArray(meal_plan_details)) {
            meal_plan_details.forEach(meal => {
                calculatedTotal += (meal.price || 0) * (meal.pax || num_participants || 0);
            });
        }

        // 4. Amenities
        if (amenities_details && Array.isArray(amenities_details)) {
            amenities_details.forEach(item => {
                calculatedTotal += (item.unit_cost || 0) * (item.quantity || 0);
            });
        }

        // Store additional details in notes as JSON metadata
        const metadata = {
            invoice_number,
            company_name,
            contact_person,
            num_participants,
            amount_per_pax,
            meal_plan_details,
            amenities_details,
            program_schedule,
            payment_mode
        };
        
        logger.info(`Conference booking metadata: ${JSON.stringify(metadata)}`);
        
        const notesWithMetadata = notes 
            ? `${notes}\n\n__METADATA__:${JSON.stringify(metadata)}`
            : `__METADATA__:${JSON.stringify(metadata)}`;

        const depositAmount = Number(req.body.deposit_amount || req.body.amount_paid || 0);
        const totalAmount = Number(calculatedTotal || req.body.total_amount || 0);
        const balanceAmount = Math.max(0, totalAmount - depositAmount);

        const { data: booking, error: bookingError } = await supabase
            .from('conference_hall_bookings')
            .insert([{
                conference_hall_id,
                branch_id,
                customer_name,
                customer_phone,
                customer_email,
                start_date,
                end_date,
                invoice_number,
                total_amount: totalAmount,
                deposit_amount: depositAmount,
                amount_paid: depositAmount,
                balance_amount: balanceAmount,
                payment_status: depositAmount >= totalAmount ? 'paid' : depositAmount > 0 ? 'partial' : 'pending',
                booking_status: 'confirmed',
                notes: notesWithMetadata,
                created_by
            }])
            .select()
            .single();

        if (bookingError) throw bookingError;

        // Update hall status to 'occupied' when booking is confirmed
        const now = new Date();
        const bookingStart = new Date(start_date);
        const bookingEnd = new Date(end_date);
        
        // If booking starts today or is already ongoing, mark hall as occupied
        if (bookingStart <= now && bookingEnd >= now) {
            await supabase
                .from('conference_halls')
                .update({ status: 'occupied' })
                .eq('id', conference_hall_id);
        }

        // =====================================================
        // EVENT ORDERS & CHANNEL INTEGRATION
        // =====================================================
        try {
            const menuPkg = req.body.menu_package || (meal_plan_details && meal_plan_details[0]?.name) || 'Half day';
            const { data: pkgDef } = await supabase
                .from('channel_package_definitions')
                .select('id')
                .eq('branch_id', branch_id)
                .eq('channel', 'conference_event')
                .eq('package_name', menuPkg)
                .maybeSingle();

            await supabase.from('event_orders').insert([{
                event_number: `EO-${invoice_number}`,
                event_name: `Conference - ${customer_name}`,
                client_name: customer_name,
                event_type: 'conference',
                branch_id,
                event_date: start_date.slice(0, 10),
                pax: num_participants || 0,
                menu_package: menuPkg,
                package_definition_id: pkgDef?.id || null,
                charge_per_pax: amount_per_pax || 0,
                total_amount: calculatedTotal || req.body.total_amount || 0,
                amount_paid: 0,
                payment_status: 'pending',
                payment_method: (payment_mode || 'cash').toLowerCase() === 'mpesa' ? 'mpesa' : 'cash',
                notes: notesWithMetadata,
                conference_hall_id,
                conference_booking_id: booking.id
            }]);
        } catch (eoErr: any) {
            logger.error(`Event orders sync notice: ${eoErr?.message}`);
        }

        // =====================================================
        // PHASE 2: KITCHEN INTEGRATION
        // =====================================================
        if (meal_plan_details && Array.isArray(meal_plan_details) && meal_plan_details.length > 0) {
            try {
                // Generate order number for kitchen
                const { data: orderNumber , error } = await supabase.rpc('generate_order_number');
                if (error) {
                  console.error('Database error:', error);
                  throw error;
                }

                // Create a generic restaurant order for the conference
                const orderData = {
                    order_number: orderNumber || `CNF-ORD-${booking.id.slice(0, 4)}`,
                    order_type: 'room_service', // Mapping to room_service for kitchen visibility
                    guest_name: company_name || customer_name,
                    special_instructions: `CONFERENCE MEAL: ${company_name || customer_name} (PAX: ${num_participants}). Booking Ref: ${invoice_number}`,
                    total_amount: 0,
                    payment_method: payment_mode || 'Invoice',
                    payment_status: 'pending',
                    status: 'pending',
                    created_by,
                    branch_id
                };

                const { data: order, error: orderError } = await supabase
                    .from('restaurant_orders')
                    .insert([orderData])
                    .select()
                    .single();

                if (!orderError && order) {
                    // Create order items for each meal plan selected
                    const orderItems = meal_plan_details.map(meal => ({
                        order_id: order.id,
                        menu_item_id: meal.menu_item_id || null,
                        quantity: meal.pax || num_participants || 1,
                        unit_price: meal.price || 0,
                        total_price: (meal.pax || num_participants || 1) * (meal.price || 0),
                        special_instructions: `Meal Type: ${meal.name}`,
                        item_name: meal.name || ''
                    }));

                    const { error } = await supabase.from('restaurant_order_items').insert(orderItems);
                    if (error) {
                      console.error('Database error:', error);
                      throw error;
                    }
                } else {
                    logger.error(`Failed to trigger kitchen order for conference: ${orderError?.message}`);
                }
            } catch (kError: any) {
                logger.error(`Kitchen integration error: ${kError.message}`);
            }
        }

        res.status(201).json({
            success: true,
            data: booking
        });

        logger.info(`Conference booking created for ${customer_name} at hall ${conference_hall_id}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Update conference booking status
// @route   PATCH /api/conference/bookings/:id/status
// @access  Private
export const updateConferenceBookingStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['confirmed', 'cancelled', 'completed'].includes(status)) {
            throw new AppError('Invalid booking status', 400);
        }

        const { data: booking, error } = await supabase
            .from('conference_hall_bookings')
            .update({
                booking_status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        res.status(200).json({
            success: true,
            data: booking
        });

        logger.info(`Conference booking ${id} status updated to ${status}`);
    } catch (error) {
        next(error);
    }
};

// @desc    Get conference booking for invoice
// @route   GET /api/conference/bookings/:id/invoice
// @access  Private
export const getBookingInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: booking, error } = await supabase
            .from('conference_hall_bookings')
            .select('*, hall:conference_halls(*), branch:branches(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!booking) throw new AppError('Booking not found', 404);

        // Fetch the PDF from Python service
        try {
            const pdfResponse = await axios.post(`${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf`, {
                reportType: 'conference_invoice',
                filters: { id: booking.id },
                data: booking, // Pass the full booking data
                useRealData: false
            }, {
                responseType: 'arraybuffer'
            });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=Invoice_${booking.invoice_number}.pdf`);
            res.send(Buffer.from(pdfResponse.data));
        } catch (pdfError: any) {
            logger.error(`Error generating conference PDF: ${pdfError.message}`);
            // Fallback to JSON if PDF generation fails
            res.status(200).json({
                success: true,
                data: booking
            });
        }
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Record a payment for a conference booking
 * @route   POST /api/conference/bookings/:id/payments
 * @access  Private (Cashier/Reception)
 */
export const addConferencePayment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { amount, payment_method, paymentMethod, reference } = req.body;
        const method = payment_method || paymentMethod;

        if (!amount || amount <= 0 || !method) {
            throw new AppError('Amount and payment method are required', 400);
        }
        const settlement = await recordConferenceCashierPayment({
            bookingId: id,
            amount: Number(amount),
            paymentMethod: method,
            reference,
            cashierUserId: req.user?.id,
            cashierName: `${req.user?.first_name || ''} ${req.user?.last_name || ''}`.trim() || null,
        });

        res.status(200).json({
            success: true,
            message: 'Payment recorded successfully',
            data: {
                booking_id: settlement.bookingId,
                payment_id: settlement.paymentId,
                payment_reference: settlement.paymentReference,
                new_paid_amount: settlement.paidAmount,
                balance: settlement.balance,
                payment_status: settlement.paymentStatus,
                cashier_transaction_id: settlement.cashierTransactionId,
                cashier_shift_log_id: settlement.cashierShiftLogId,
            }
        });

    } catch (error) {
        next(error);
    }
};


/**
 * @desc    Auto-update conference hall statuses based on current bookings
 * @route   POST /api/conference/halls/auto-update-status
 * @access  Private (System/Admin)
 */
export const autoUpdateHallStatuses = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const now = new Date();
        
        // Get all halls
        const { data: halls, error: hallsError } = await supabase
            .from('conference_halls')
            .select('id, status');
        
        if (hallsError) throw hallsError;
        
        for (const hall of halls || []) {
            // Check if hall has any active bookings (ongoing right now)
            const { data: activeBookings, error: bookingsError } = await supabase
                .from('conference_hall_bookings')
                .select('id, start_date, end_date')
                .eq('conference_hall_id', hall.id)
                .eq('booking_status', 'confirmed')
                .lte('start_date', now.toISOString())
                .gte('end_date', now.toISOString());
            
            if (bookingsError) {
                logger.error(`Error checking bookings for hall ${hall.id}: ${bookingsError.message}`);
                continue;
            }
            
            // Update status based on active bookings
            const newStatus = (activeBookings && activeBookings.length > 0) ? 'occupied' : 'available';
            
            // Only update if status changed and not in maintenance
            if (hall.status !== 'maintenance' && hall.status !== newStatus) {
                await supabase
                    .from('conference_halls')
                    .update({ status: newStatus })
                    .eq('id', hall.id);
                
                logger.info(`Hall ${hall.id} status updated from ${hall.status} to ${newStatus}`);
            }
        }
        
        res.status(200).json({
            success: true,
            message: 'Hall statuses updated successfully'
        });
        
    } catch (error) {
        next(error);
    }
};
