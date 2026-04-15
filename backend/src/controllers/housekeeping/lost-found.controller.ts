// =====================================================
// HOUSEKEEPING LOST & FOUND CONTROLLER
// =====================================================

import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/supabase';
import { logger } from '../../utils/logger';
import { ICreateLostFoundRequest, HKLostFoundStatus } from '../../types/housekeeping.types';

async function getStaffProfileId(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const { data , error } = await supabase.from('hk_staff_profiles').select('id').eq('user_id', userId).single();
  if (error) {
    console.error('Database error:', error);
    throw error;
  }
  return data?.id || null;
}

/**
 * @desc    Get all lost & found items
 * @route   GET /api/housekeeping/lost-found
 * @access  Private
 */
export const getLostFoundItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { status, category, valuable } = req.query;
    const branchId = req.query.branchId as string || req.user?.branchId;

    let query = supabase
      .from('hk_lost_found')
      .select(`
        *,
        found_by_staff:hk_staff_profiles!found_by(id, staff_code, user:users!user_id(first_name, last_name)),
        room:rooms(room_number, floor)
      `, { count: 'exact' })
      .eq('branch_id', branchId)
      .order('found_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (status) query = query.eq('status', status);
    if (category) query = query.eq('item_category', category);
    if (valuable === 'true') query = query.eq('is_valuable', true);

    const { data: items, error, count } = await query;
    if (error) throw error;

    res.status(200).json({
      success: true,
      count: items?.length || 0,
      total: count || 0,
      page,
      pages: Math.ceil((count || 0) / limit),
      data: items
    });
  } catch (error) {
    logger.error('Error fetching lost & found items:', error);
    next(error);
  }
};

/**
 * @desc    Get single lost & found item
 * @route   GET /api/housekeeping/lost-found/:id
 * @access  Private
 */
export const getLostFoundItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: item, error } = await supabase
      .from('hk_lost_found')
      .select(`
        *,
        found_by_staff:hk_staff_profiles!found_by(id, staff_code, user:users!user_id(first_name, last_name)),
        room:rooms(room_number, floor, room_type)
      `)
      .eq('id', id)
      .single();

    if (error) {
      res.status(404).json({ success: false, message: 'Item not found' });
      return;
    }

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    logger.error('Error fetching lost & found item:', error);
    next(error);
  }
};

/**
 * @desc    Create lost & found item
 * @route   POST /api/housekeeping/lost-found
 * @access  Private
 */
export const createLostFoundItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      itemDescription,
      itemCategory,
      estimatedValue,
      isValuable,
      foundLocation,
      roomId,
      photos
    } = req.body as ICreateLostFoundRequest;

    const staffId = await getStaffProfileId(req.user?.id);
    if (!staffId) {
      res.status(403).json({ success: false, message: 'Staff profile required' });
      return;
    }

    // Get floor number if room provided
    let floorNumber = null;
    if (roomId) {
      const { data: room } = await supabase
        .from('rooms')
        .select('floor')
        .eq('id', roomId)
        .single();
      floorNumber = room?.floor;
    }

    // Calculate retention end date (90 days default)
    const retentionDays = isValuable ? 180 : 90;
    const retentionEndDate = new Date();
    retentionEndDate.setDate(retentionEndDate.getDate() + retentionDays);

    const { data: item, error } = await supabase
      .from('hk_lost_found')
      .insert([{
        item_description: itemDescription,
        item_category: itemCategory,
        estimated_value: estimatedValue,
        is_valuable: isValuable || (estimatedValue && estimatedValue > 1000),
        found_location: foundLocation,
        room_id: roomId,
        floor_number: floorNumber,
        photos: photos || [],
        found_by: staffId,
        status: 'found',
        retention_days: retentionDays,
        retention_end_date: retentionEndDate.toISOString().split('T')[0],
        branch_id: req.user?.branchId
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data: item });
    logger.info(`Lost & found item created: ${item.item_number}`);
  } catch (error) {
    logger.error('Error creating lost & found item:', error);
    next(error);
  }
};

/**
 * @desc    Update lost & found item
 * @route   PUT /api/housekeeping/lost-found/:id
 * @access  Private
 */
export const updateLostFoundItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    delete updates.id;
    delete updates.item_number;
    delete updates.found_by;
    delete updates.found_at;

    const { data: item, error } = await supabase
      .from('hk_lost_found')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    logger.error('Error updating lost & found item:', error);
    next(error);
  }
};

/**
 * @desc    Update item status
 * @route   PUT /api/housekeeping/lost-found/:id/status
 * @access  Private
 */
export const updateItemStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, guestName, guestContact, claimedSignature, disposalMethod, disposalNotes } = req.body;

    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === HKLostFoundStatus.GUEST_CONTACTED) {
      updateData.guest_name = guestName;
      updateData.guest_contact = guestContact;
      updateData.contact_attempts = [{
        date: new Date().toISOString().split('T')[0],
        method: 'phone',
        result: 'contacted',
        notes: ''
      }];
    }

    if (status === HKLostFoundStatus.CLAIMED) {
      updateData.claimed_by = guestName;
      updateData.claimed_at = new Date().toISOString();
      updateData.claimed_signature = claimedSignature;
      updateData.returned_by = req.user?.id;
    }

    if (status === HKLostFoundStatus.DISPOSED) {
      updateData.disposal_date = new Date().toISOString().split('T')[0];
      updateData.disposal_method = disposalMethod;
      updateData.disposal_notes = disposalNotes;
    }

    const { data: item, error } = await supabase
      .from('hk_lost_found')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: item });
    logger.info(`Lost & found item ${item.item_number} status updated to ${status}`);
  } catch (error) {
    logger.error('Error updating item status:', error);
    next(error);
  }
};

/**
 * @desc    Add contact attempt
 * @route   POST /api/housekeeping/lost-found/:id/contact
 * @access  Private
 */
export const addContactAttempt = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { method, result, notes } = req.body;

    // Get current item
    const { data: item, error: fetchError } = await supabase
      .from('hk_lost_found')
      .select('contact_attempts, status')
      .eq('id', id)
      .single();

    if (fetchError || !item) {
      res.status(404).json({ success: false, message: 'Item not found' });
      return;
    }

    const attempts = item.contact_attempts || [];
    attempts.push({
      date: new Date().toISOString().split('T')[0],
      method,
      result,
      notes
    });

    const { data: updated, error } = await supabase
      .from('hk_lost_found')
      .update({
        contact_attempts: attempts,
        status: result === 'contacted' ? 'guest_contacted' : item.status
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error adding contact attempt:', error);
    next(error);
  }
};

/**
 * @desc    Get items expiring soon
 * @route   GET /api/housekeeping/lost-found/expiring
 * @access  Private
 */
export const getExpiringItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const daysAhead = parseInt(req.query.days as string) || 14;
    const branchId = req.query.branchId as string || req.user?.branchId;

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysAhead);

    const { data: items, error } = await supabase
      .from('hk_lost_found')
      .select(`
        *,
        found_by_staff:hk_staff_profiles!found_by(user:users!user_id(first_name, last_name))
      `)
      .eq('branch_id', branchId)
      .in('status', ['found', 'guest_contacted', 'stored'])
      .lte('retention_end_date', expiryDate.toISOString().split('T')[0])
      .order('retention_end_date', { ascending: true });

    if (error) throw error;

    res.status(200).json({ success: true, count: items?.length || 0, data: items });
  } catch (error) {
    logger.error('Error fetching expiring items:', error);
    next(error);
  }
};

/**
 * @desc    Get lost & found statistics
 * @route   GET /api/housekeeping/lost-found/stats
 * @access  Private
 */
export const getLostFoundStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = req.query.branchId as string || req.user?.branchId;
    const { startDate, endDate } = req.query;

    let query = supabase
      .from('hk_lost_found')
      .select('status, is_valuable, item_category')
      .eq('branch_id', branchId);

    if (startDate && endDate) {
      query = query.gte('found_at', `${startDate}T00:00:00`).lte('found_at', `${endDate}T23:59:59`);
    }

    const { data: items, error } = await query;
    if (error) throw error;

    const total = items?.length || 0;
    const stats = {
      total,
      found: items?.filter(i => i.status === 'found').length || 0,
      claimed: items?.filter(i => i.status === 'claimed').length || 0,
      unclaimed: items?.filter(i => i.status === 'unclaimed' || i.status === 'disposed').length || 0,
      valuable: items?.filter(i => i.is_valuable).length || 0,
      byCategory: {} as Record<string, number>
    };

    (items || []).forEach(item => {
      stats.byCategory[item.item_category] = (stats.byCategory[item.item_category] || 0) + 1;
    });

    res.status(200).json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching lost & found stats:', error);
    next(error);
  }
};
