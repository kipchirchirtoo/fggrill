import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { applyBranchFilter } from '../utils/branchIsolation';

/**
 * Restaurant Bills Controller
 * Handles unified billing system with multiple orders, partial payments, and split bills
 */

// @desc    Create a new bill
// @route   POST /api/restaurant/bills
// @access  Private (Waiter, Cashier, Manager)
export const createBill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      table_number,
      room_number,
      guest_id,
      guest_name,
      guest_phone,
      branch_id,
      vat_rate = 16.00, // Kenya VAT default
      service_charge_rate = 0
    } = req.body;

    // Generate bill number
    const { data: billNumberData, error: billNumberError } = await supabase
      .rpc('generate_bill_number');

    if (billNumberError) throw billNumberError;

    // Create bill
    const { data: bill, error: billError } = await supabase
      .from('restaurant_bills')
      .insert([{
        bill_number: billNumberData,
        branch_id: branch_id || req.user?.branch_id,
        table_number,
        room_number,
        guest_id,
        guest_name,
        guest_phone,
        status: 'OPEN',
        vat_rate,
        service_charge_rate,
        created_by: req.user?.id
      }])
      .select()
      .single();

    if (billError) throw billError;

    logger.info(`Bill created: ${bill.bill_number} by user ${req.user?.id}`);

    res.status(201).json({
      success: true,
      data: bill
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get bill details with all orders and payments
// @route   GET /api/restaurant/bills/:id
// @access  Private
export const getBillDetails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    // Get bill with orders and payments
    const { data: bill, error: billError } = await supabase
      .from('restaurant_bills')
      .select(`
        *,
        orders:restaurant_orders(
          *,
          items:restaurant_order_items(
            *,
            menu_item:restaurant_menu_items(id, name, price)
          ),
          waiter:users!created_by(
            id,
            first_name,
            last_name
          )
        ),
        payments:restaurant_bill_payments(
          *,
          cashier:staff_profiles!cashier_id(
            id,
            first_name,
            last_name
          )
        )
      `)
      .eq('id', id)
      .single();

    if (billError) throw billError;
    if (!bill) throw new AppError('Bill not found', 404);

    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Search for open bills
// @route   POST /api/restaurant/bills/search
// @access  Private
export const searchOpenBills = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      branch_id,
      table_number,
      room_number,
      guest_name,
      bill_number,
      status = 'OPEN'
    } = req.body;

    let query = supabase
      .from('restaurant_bills')
      .select(`
        *,
        orders:restaurant_orders(count)
      `)
      .eq('status', status);

    query = applyBranchFilter(query, req);

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (table_number) query = query.eq('table_number', table_number);
    if (room_number) query = query.eq('room_number', room_number);
    if (guest_name) query = query.ilike('guest_name', `%${guest_name}%`);
    if (bill_number) query = query.eq('bill_number', bill_number);

    const { data: bills, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: bills?.length || 0,
      data: bills || []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add order to existing bill
// @route   POST /api/restaurant/bills/:id/orders
// @access  Private (Waiter)
export const addOrderToBill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: billId } = req.params;
    const { items, special_instructions, department = 'restaurant' } = req.body;

    // Check bill status
    const { data: bill, error: billError } = await supabase
      .from('restaurant_bills')
      .select('status, bill_number')
      .eq('id', billId)
      .single();

    if (billError) throw billError;
    if (!bill) throw new AppError('Bill not found', 404);

    if (bill.status === 'PAID') {
      throw new AppError('Cannot add orders to paid bills', 400);
    }

    if (bill.status === 'CANCELLED') {
      throw new AppError('Cannot add orders to cancelled bills', 400);
    }

    // Generate order number
    const { data: orderNumberData, error: orderNumberError } = await supabase
      .rpc('generate_order_number');

    if (orderNumberError) throw orderNumberError;

    // Calculate order total
    const orderTotal = items.reduce((sum: number, item: any) => {
      return sum + (item.quantity * item.unit_price);
    }, 0);

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .insert([{
        order_number: orderNumberData,
        bill_id: billId,
        order_type: 'dine_in',
        status: 'pending',
        total_amount: orderTotal,
        special_instructions,
        department,
        created_by: req.user?.id,
        branch_id: req.user?.branch_id
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    // Create order items
    const orderItems = items.map((item: any) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
      special_instructions: item.special_instructions,
      item_name: item.name || item.item_name || ''
    }));

    const { error: itemsError } = await supabase
      .from('restaurant_order_items')
      .insert(orderItems);

    if (itemsError) throw itemsError;

    // Recalculate bill totals (trigger will handle this)
    await supabase.rpc('calculate_bill_totals', { p_bill_id: billId });

    // Log audit trail
    await supabase
      .from('restaurant_bill_audit_log')
      .insert([{
        bill_id: billId,
        action: 'order_added',
        description: `Order ${order.order_number} added with ${items.length} items`,
        performed_by: req.user?.id,
        metadata: { order_id: order.id, items_count: items.length }
      }]);

    logger.info(`Order ${order.order_number} added to bill ${bill.bill_number}`);

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Close bill (no more orders, ready for payment)
// @route   PUT /api/restaurant/bills/:id/close
// @access  Private (Waiter, Cashier)
export const closeBill = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: bill, error } = await supabase
      .from('restaurant_bills')
      .update({
        status: 'CLOSED',
        closed_at: new Date().toISOString(),
        closed_by: req.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', 'OPEN')
      .select()
      .single();

    if (error) throw error;
    if (!bill) throw new AppError('Bill not found or already closed', 404);

    logger.info(`Bill ${bill.bill_number} closed by user ${req.user?.id}`);

    res.status(200).json({
      success: true,
      data: bill
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record payment for bill
// @route   POST /api/restaurant/bills/:id/payments
// @access  Private (Cashier)
export const recordPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: billId } = req.params;
    const {
      amount,
      payment_method,
      payment_reference,
      notes
    } = req.body;

    // Get bill details
    const { data: bill, error: billError } = await supabase
      .from('restaurant_bills')
      .select('*')
      .eq('id', billId)
      .single();

    if (billError) throw billError;
    if (!bill) throw new AppError('Bill not found', 404);

    if (bill.status === 'CANCELLED') {
      throw new AppError('Cannot accept payments for cancelled bills', 400);
    }

    // Check for overpayment
    if (amount > bill.balance) {
      throw new AppError(`Payment amount (${amount}) exceeds bill balance (${bill.balance})`, 400);
    }

    // Generate payment number
    const { data: paymentNumberData, error: paymentNumberError } = await supabase
      .rpc('generate_payment_number');

    if (paymentNumberError) throw paymentNumberError;

    // Record payment
    const { data: payment, error: paymentError } = await supabase
      .from('restaurant_bill_payments')
      .insert([{
        bill_id: billId,
        payment_number: paymentNumberData,
        amount,
        payment_method,
        payment_reference,
        notes,
        paid_by: req.user?.id,
        cashier_id: req.user?.staff_profile_id
      }])
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Get updated bill
    const { data: updatedBill, error: updatedBillError } = await supabase
      .from('restaurant_bills')
      .select('*')
      .eq('id', billId)
      .single();

    if (updatedBillError) throw updatedBillError;

    logger.info(`Payment ${payment.payment_number} recorded for bill ${bill.bill_number}: ${amount} via ${payment_method}`);

    res.status(201).json({
      success: true,
      data: {
        payment,
        bill: updatedBill
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get payment history for bill
// @route   GET /api/restaurant/bills/:id/payments
// @access  Private
export const getPaymentHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: payments, error } = await supabase
      .from('restaurant_bill_payments')
      .select(`
        *,
        cashier:staff_profiles!cashier_id(
          id,
          first_name,
          last_name
        )
      `)
      .eq('bill_id', id)
      .order('paid_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: payments?.length || 0,
      data: payments || []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reverse payment
// @route   POST /api/restaurant/bills/:id/payments/:paymentId/reverse
// @access  Private (Manager only)
export const reversePayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: billId, paymentId } = req.params;
    const { reversal_reason } = req.body;

    if (!reversal_reason) {
      throw new AppError('Reversal reason is required', 400);
    }

    // Get payment
    const { data: payment, error: paymentError } = await supabase
      .from('restaurant_bill_payments')
      .select('*')
      .eq('id', paymentId)
      .eq('bill_id', billId)
      .single();

    if (paymentError) throw paymentError;
    if (!payment) throw new AppError('Payment not found', 404);

    if (payment.reversed) {
      throw new AppError('Payment already reversed', 400);
    }

    // Reverse payment
    const { data: reversedPayment, error: reverseError } = await supabase
      .from('restaurant_bill_payments')
      .update({
        reversed: true,
        reversed_at: new Date().toISOString(),
        reversed_by: req.user?.id,
        reversal_reason
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (reverseError) throw reverseError;

    // Recalculate bill (trigger will handle this)
    await supabase.rpc('calculate_bill_totals', { p_bill_id: billId });

    logger.warn(`Payment ${payment.payment_number} reversed by user ${req.user?.id}: ${reversal_reason}`);

    res.status(200).json({
      success: true,
      data: reversedPayment
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Split bill by items
// @route   POST /api/restaurant/bills/:id/split/by-items
// @access  Private (Waiter, Cashier)
export const splitBillByItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: parentBillId } = req.params;
    const { splits } = req.body; // Array of { guest_name, item_ids[] }

    // Get parent bill
    const { data: parentBill, error: parentBillError } = await supabase
      .from('restaurant_bills')
      .select('*')
      .eq('id', parentBillId)
      .single();

    if (parentBillError) throw parentBillError;
    if (!parentBill) throw new AppError('Bill not found', 404);

    if (parentBill.status === 'PAID') {
      throw new AppError('Cannot split paid bills', 400);
    }

    // Create child bills for each split
    const childBills = [];

    for (const split of splits) {
      // Generate bill number
      const { data: billNumberData } = await supabase.rpc('generate_bill_number');

      // Create child bill
      const { data: childBill, error: childBillError } = await supabase
        .from('restaurant_bills')
        .insert([{
          bill_number: billNumberData,
          branch_id: parentBill.branch_id,
          table_number: parentBill.table_number,
          room_number: parentBill.room_number,
          guest_name: split.guest_name,
          status: 'CLOSED',
          vat_rate: parentBill.vat_rate,
          service_charge_rate: parentBill.service_charge_rate,
          parent_bill_id: parentBillId,
          split_type: 'by_items',
          created_by: req.user?.id
        }])
        .select()
        .single();

      if (childBillError) throw childBillError;

      // Move items to child bill
      const { error: moveItemsError } = await supabase
        .from('restaurant_order_items')
        .update({ bill_id: childBill.id })
        .in('id', split.item_ids);

      if (moveItemsError) throw moveItemsError;

      // Recalculate child bill
      await supabase.rpc('calculate_bill_totals', { p_bill_id: childBill.id });

      childBills.push(childBill);
    }

    // Mark parent bill as split
    await supabase
      .from('restaurant_bills')
      .update({
        is_split: true,
        status: 'CANCELLED',
        updated_at: new Date().toISOString()
      })
      .eq('id', parentBillId);

    logger.info(`Bill ${parentBill.bill_number} split into ${childBills.length} bills`);

    res.status(200).json({
      success: true,
      data: {
        parent_bill: parentBill,
        child_bills: childBills
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get bill audit log
// @route   GET /api/restaurant/bills/:id/audit-log
// @access  Private (Manager, Auditor)
export const getBillAuditLog = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: logs, error } = await supabase
      .from('restaurant_bill_audit_log')
      .select(`
        *,
        user:users!performed_by(id, first_name, last_name)
      `)
      .eq('bill_id', id)
      .order('performed_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: logs?.length || 0,
      data: logs || []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Merge bills
// @route   POST /api/restaurant/bills/merge
// @access  Private (Waiter, Cashier, Manager)
export const mergeBills = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { bill_ids, target_bill_id } = req.body;

    if (!bill_ids || bill_ids.length < 2) {
      throw new AppError('At least 2 bills are required to merge', 400);
    }

    // Get all bills to merge
    const { data: bills, error: billsError } = await supabase
      .from('restaurant_bills')
      .select('*')
      .in('id', bill_ids);

    if (billsError) throw billsError;
    if (!bills || bills.length < 2) throw new AppError('Bills not found', 404);

    // Check if any bills are already paid
    const paidBills = bills.filter(b => b.status === 'PAID');
    if (paidBills.length > 0) {
      throw new AppError('Cannot merge paid bills', 400);
    }

    // Use target bill or create new one
    let targetBill;
    if (target_bill_id) {
      const { data: target, error: targetError } = await supabase
        .from('restaurant_bills')
        .select('*')
        .eq('id', target_bill_id)
        .single();
      if (targetError) throw targetError;
      targetBill = target;
    } else {
      // Generate new bill number
      const { data: billNumberData } = await supabase.rpc('generate_bill_number');
      
      // Create new target bill
      const { data: newBill, error: newBillError } = await supabase
        .from('restaurant_bills')
        .insert([{
          bill_number: billNumberData,
          branch_id: bills[0].branch_id,
          table_number: bills[0].table_number,
          room_number: bills[0].room_number,
          guest_name: bills[0].guest_name,
          status: 'OPEN',
          vat_rate: bills[0].vat_rate,
          service_charge_rate: bills[0].service_charge_rate,
          created_by: req.user?.id
        }])
        .select()
        .single();
      
      if (newBillError) throw newBillError;
      targetBill = newBill;
    }

    // Move all orders from source bills to target bill
    const sourceBillIds = bills.filter(b => b.id !== targetBill.id).map(b => b.id);
    
    if (sourceBillIds.length > 0) {
      const { error: updateError } = await supabase
        .from('restaurant_orders')
        .update({ bill_id: targetBill.id })
        .in('bill_id', sourceBillIds);
      
      if (updateError) throw updateError;

      // Mark source bills as merged
      const { error: markError } = await supabase
        .from('restaurant_bills')
        .update({
          status: 'CANCELLED',
          is_merged: true,
          merged_into: targetBill.id,
          updated_at: new Date().toISOString()
        })
        .in('id', sourceBillIds);
      
      if (markError) throw markError;
    }

    // Recalculate target bill totals
    await supabase.rpc('calculate_bill_totals', { p_bill_id: targetBill.id });

    logger.info(`Bills ${bill_ids.join(', ')} merged into ${targetBill.bill_number}`);

    res.status(200).json({
      success: true,
      data: targetBill
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request void order (requires accountant approval)
// @route   POST /api/restaurant/orders/:id/void-request
// @access  Private (Waiter, Cashier)
export const requestVoidOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: orderId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new AppError('Void reason is required', 400);
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('restaurant_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) throw orderError;
    if (!order) throw new AppError('Order not found', 404);

    if (order.status === 'voided' || order.status === 'cancelled') {
      throw new AppError('Order already voided', 400);
    }

    // Create void request
    const { data: voidRequest, error: voidError } = await supabase
      .from('void_requests')
      .insert([{
        order_id: orderId,
        requested_by: req.user?.id,
        reason,
        status: 'pending',
        branch_id: order.branch_id,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (voidError) throw voidError;

    logger.info(`Void request created for order ${order.order_number} by user ${req.user?.id}`);

    res.status(201).json({
      success: true,
      data: voidRequest
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve void order (Accountant/Manager only)
// @route   POST /api/restaurant/void-requests/:id/approve
// @access  Private (Accountant, Manager)
export const approveVoidRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: requestId } = req.params;
    const { approved, rejection_reason } = req.body;

    // Get void request
    const { data: voidRequest, error: voidError } = await supabase
      .from('void_requests')
      .select('*, order:restaurant_orders(*)')
      .eq('id', requestId)
      .single();

    if (voidError) throw voidError;
    if (!voidRequest) throw new AppError('Void request not found', 404);

    if (voidRequest.status !== 'pending') {
      throw new AppError('Void request already processed', 400);
    }

    // Update void request
    const { error: updateError } = await supabase
      .from('void_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        reviewed_by: req.user?.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: approved ? null : rejection_reason
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    // If approved, void the order
    if (approved && voidRequest.order) {
      await supabase
        .from('restaurant_orders')
        .update({
          status: 'voided',
          voided_at: new Date().toISOString(),
          voided_by: req.user?.id,
          void_reason: voidRequest.reason
        })
        .eq('id', voidRequest.order_id);

      logger.info(`Order ${voidRequest.order.order_number} voided by accountant ${req.user?.id}`);
    }

    res.status(200).json({
      success: true,
      data: voidRequest
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get pending void requests (for accountant)
// @route   GET /api/restaurant/void-requests/pending
// @access  Private (Accountant, Manager)
export const getPendingVoidRequests = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id } = req.query;

    let query = supabase
      .from('void_requests')
      .select(`
        *,
        order:restaurant_orders(order_number, table_number, total_amount),
        requester:users!requested_by(id, first_name, last_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    const { data: requests, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: requests?.length || 0,
      data: requests || []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all open bills (for dashboard)
// @route   GET /api/restaurant/bills/open
// @access  Private
export const getOpenBills = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { branch_id } = req.query;

    let query = supabase
      .from('restaurant_bills')
      .select(`
        *,
        orders:restaurant_orders(count)
      `)
      .eq('status', 'OPEN');

    query = applyBranchFilter(query, req);

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    const { data: bills, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      success: true,
      count: bills?.length || 0,
      data: bills || []
    });
  } catch (error) {
    next(error);
  }
};
