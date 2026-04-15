import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { UserRole } from '../../models/User';

// Helper to check edit lock
const checkEditLock = async (isManager: boolean): Promise<void> => {
  const { data: config , error } = await supabase.from('simple_app_config').select('edit_lock').eq('id', 1).single();
  if (error) {
    console.error('Database error:', error);
    throw error;
  }
  if (config?.edit_lock && !isManager) {
    throw { status: 403, message: "Transfers are disabled as the warehouse is being maintained. Please try again later." };
  }
};

// @desc    Get transfer items
// @route   GET /api/store/transfer-items
// @access  Private
export const getTransferItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user;
    // Check if manager
    const isManager = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER].includes(user.role);
    
    let query = supabase
      .from('simple_transfer_items')
      .select(`
        *,
        item:simple_items(*),
        shop_user:users(id, first_name, last_name, email)
      `);

    if (isManager) {
      query = query.eq('ordered', true);
    } else {
      query = query.eq('shop_user_id', user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Search filtering similar to shop items
    const { search } = req.query;
    let result = data || [];
    if (search) {
      const searchLower = String(search).toLowerCase();
      result = result.filter((record: any) => 
          record.item?.description?.toLowerCase().includes(searchLower) || 
          record.item?.sku?.toLowerCase().includes(searchLower)
      );
    }

    res.status(200).json({
      success: true,
      count: result.length,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Transfer Item (Request or immediate if logic allows, but usually creates a TransferItem)
// @route   POST /api/store/transfer
// @access  Private (Shop Users)
export const transferItem = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { sku, transfer_quantity } = req.body;
    const userId = req.user.id;
    const isManager = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER].includes(req.user.role);

    await checkEditLock(isManager);

    // Validate quantity
    const quantity = parseInt(transfer_quantity);
    if (isNaN(quantity) || quantity <= 0) {
      res.status(400).json({ message: "Transfer quantity must be a positive integer." });
      return;
    }

    // Get Item
    const { data: item, error: itemError } = await supabase
      .from('simple_items')
      .select('*')
      .eq('sku', sku)
      .single();

    if (itemError || !item) {
      res.status(404).json({ message: "Item not found." });
      return;
    }

    // Check stock
    if (item.quantity < quantity) {
      res.status(400).json({ message: "Not enough stock to transfer" });
      return;
    }

    // Create/Update Transfer Item
    // Check if exists
    const { data: existingTransfer } = await supabase
      .from('simple_transfer_items')
      .select('*')
      .eq('shop_user_id', userId)
      .eq('item_sku', sku)
      .single();

    if (existingTransfer) {
        if (existingTransfer.ordered) {
            res.status(400).json({ message: "This item has already been ordered and is awaiting dispatch." });
            return;
        }
        // Update
        await supabase
            .from('simple_transfer_items')
            .update({ quantity: quantity }) // Set to new quantity as per original logic "xfer_item.quantity = transfer_quantity" (not +=)
            .eq('id', existingTransfer.id);
    } else {
        // Create
        await supabase
            .from('simple_transfer_items')
            .insert([{
                shop_user_id: userId,
                item_sku: sku,
                quantity: quantity,
                ordered: false
            }]);
    }

    res.status(200).json({ detail: "Transfer successful." });
  } catch (error) {
    next(error);
  }
};

import { emailService } from '../../services/email.service';

// @desc    Submit Transfer Request
// @route   POST /api/store/submit-transfer-request
// @access  Private
export const submitTransferRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const isManager = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER].includes(req.user.role);
    await checkEditLock(isManager);

    const userId = req.user.id;

    // Get unordered items
    const { data: items, error } = await supabase
      .from('simple_transfer_items')
      .select('*, item:simple_items(*)')
      .eq('shop_user_id', userId)
      .eq('ordered', false);

    if (error) throw error;
    if (!items || items.length === 0) {
      res.status(400).json({ detail: "There were no outstanding items to request!" });
      return;
    }

    // Update to ordered
    const { error: updateError } = await supabase
      .from('simple_transfer_items')
      .update({ ordered: true })
      .eq('shop_user_id', userId)
      .eq('ordered', false);

    if (updateError) throw updateError;

    // Check if email notifications are allowed
    const { data: config } = await supabase
      .from('simple_app_config')
      .select('allow_email_notifications')
      .eq('id', 1)
      .single();

    if (config?.allow_email_notifications) {
        try {
            await emailService.sendStockTransferEmail(req.user, items);
            logger.info(`Stock Transfer Request email sent for user ${req.user.email}`);
        } catch (emailError) {
            logger.error('Failed to send stock transfer email', emailError);
            // Do not fail the request if email fails, but log it
        }
    }

    logger.info(`Stock Transfer Request submitted by ${req.user.username || req.user.email} for ${items.length} items.`);

    res.status(200).json({ detail: "Transfer successfully submitted." });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete Transfer
// @route   POST /api/store/complete-transfer
// @access  Private (Manager)
export const completeTransfer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Verify manager
    // Assumed middleware handles basic role check, but logic here doubles down
    const isManager = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER].includes(req.user.role);
    // cancel flag
    const cancel = req.body.cancel === "true" || req.body.cancel === true;
    
    if (!isManager && !cancel) {
         res.status(403).json({ detail: "Permission denied." });
         return;
    }

    const { sku, quantity: qtyStr, shop_user_id: shopUsernameOrId } = req.body;
    const quantity = parseInt(qtyStr);
    
    // Resolve shop user
    // Input might be username or id. Original code tries username first.
    // We will assume ID is passed or look up by username if needed.
    // For simplicity, let's assume ID is passed from frontend or we try to find user.
    let shopUserId = shopUsernameOrId;
    // If uuid format, assume ID. If not, assume username (if we had username lookup).
    // Supabase usually uses UUIDs.

    const { data: item , error } = await supabase.from('simple_items').select('*').eq('sku', sku).single();
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    if (!item) {
        res.status(404).json({ detail: "Item not found." });
        return;
    }

    if (cancel) {
        // Delete transfer item
        await supabase
            .from('simple_transfer_items')
            .delete()
            .eq('item_sku', sku)
            .eq('shop_user_id', shopUserId);
            
        res.status(200).json({ detail: "Transfer cancelled." });
        return;
    }

    // Execute Transfer
    if (item.quantity < quantity) {
        res.status(400).json({ detail: "Not enough stock to transfer" });
        return;
    }

    // Update Shop Item
    const { data: existingShopItem } = await supabase
        .from('simple_shop_items')
        .select('*')
        .eq('shop_user_id', shopUserId)
        .eq('item_sku', sku)
        .single();

    if (existingShopItem) {
        await supabase
            .from('simple_shop_items')
            .update({ quantity: existingShopItem.quantity + quantity })
            .eq('id', existingShopItem.id);
    } else {
        await supabase
            .from('simple_shop_items')
            .insert([{
                shop_user_id: shopUserId,
                item_sku: sku,
                quantity: quantity
            }]);
    }

    // Decrease Stock
    await supabase
        .from('simple_items')
        .update({ quantity: item.quantity - quantity })
        .eq('sku', sku);

    // Delete pending transfer item
    await supabase
        .from('simple_transfer_items')
        .delete()
        .eq('item_sku', sku)
        .eq('shop_user_id', shopUserId);

    res.status(200).json({ detail: "Transfer action successful." });
  } catch (error) {
    next(error);
  }
};
