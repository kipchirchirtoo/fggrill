import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

export const getTabs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, status } = req.query;

    let query = supabase
      .from('bar_tabs')
      .select(`
        *,
        items:bar_tab_items(*)
      `)
      .order('created_at', { ascending: false });

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const createTab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customer_name, phone, branch_id } = req.body;

    const { data, error } = await supabase
      .from('bar_tabs')
      .insert([{
        customer_name,
        phone,
        branch_id,
        status: 'open',
        created_by: (req as any).user?.id
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const addToTab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params; // Tab ID
    const { items } = req.body; // Array of drinks

    // 1. Calculate total to add
    let additionalTotal = 0;
    const tabItems = items.map((item: any) => {
      const total = item.price * item.quantity;
      additionalTotal += total;
      return {
        tab_id: id,
        drink_id: item.drink_id,
        drink_name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: total
      };
    });

    // 2. Insert items
    const { error: itemsError } = await supabase
      .from('bar_tab_items')
      .insert(tabItems);

    if (itemsError) throw itemsError;

    // 3. Update tab total
    const { data: tab, error: tabError } = await supabase.rpc('update_tab_total', { p_tab_id: id });
    // Note: I need to create this RPC or do it manually. Manual for now:

    if (tabError) {
      // Fallback manual update
      const { data: currentTab } = await supabase.from('bar_tabs').select('total_amount').eq('id', id).single();
      const newTotal = (currentTab?.total_amount || 0) + additionalTotal;

      const { data: updatedTab, error: updateError } = await supabase
        .from('bar_tabs')
        .update({ total_amount: newTotal })
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      res.status(200).json({ success: true, data: updatedTab });
      return;
    }

    res.status(200).json({ success: true, message: 'Items added to tab' });
  } catch (error) {
    next(error);
  }
};

export const closeTab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { payment_method } = req.body;

    const { data, error } = await supabase
      .from('bar_tabs')
      .update({
        status: 'closed',
        payment_method,
        closed_at: new Date().toISOString(),
        closed_by: (req as any).user?.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // TODO: Convert tab items to sales/deduct stock if not done already?
    // Usually items on tab are served immediately, so stock should be deducted when added to tab.
    // But my addToTab didn't deduct stock. 
    // ENHANCEMENT: Trigger stock deduction on addToTab or here.
    // Let's assume we do it here for simplicity or add a 'served' status to tab items.

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const updateTab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { customer_name, phone, table_number } = req.body;

    // Only allow updating open tabs
    const { data: existingTab, error: fetchError } = await supabase
      .from('bar_tabs')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (existingTab.status !== 'open') {
      res.status(400).json({
        success: false,
        message: 'Only open tabs can be updated'
      });
      return;
    }

    const updateData: any = {};
    if (customer_name !== undefined) updateData.customer_name = customer_name;
    if (phone !== undefined) updateData.phone = phone;
    if (table_number !== undefined) updateData.table_number = table_number;

    const { data, error } = await supabase
      .from('bar_tabs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const deleteTab = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    // Only allow deleting open tabs with no items
    const { data: existingTab, error: fetchError } = await supabase
      .from('bar_tabs')
      .select('status, total_amount')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (existingTab.status !== 'open') {
      res.status(400).json({
        success: false,
        message: 'Only open tabs can be deleted'
      });
      return;
    }

    if (existingTab.total_amount > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete tabs with items. Please remove all items first.'
      });
      return;
    }

    // Delete tab items first (if any)
    await supabase
      .from('bar_tab_items')
      .delete()
      .eq('tab_id', id);

    // Delete the tab
    const { error } = await supabase
      .from('bar_tabs')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Tab deleted successfully' });
  } catch (error) {
    next(error);
  }
};
