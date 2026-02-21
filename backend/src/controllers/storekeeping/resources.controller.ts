import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import * as BranchInventoryService from '../../services/branch-inventory.service';
import { logger } from '../../utils/logger';
import notificationService from '../../services/notification.service';

// =====================================================
// VEHICLES
// =====================================================

export const getVehicles = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createVehicle = async (req: Request, res: Response) => {
  try {
    const { registration_number, make, model, type, capacity_kg, status, insurance_expiry, notes } = req.body;

    if (!registration_number) {
      return res.status(400).json({ success: false, message: 'Registration number is required' });
    }

    const { data, error } = await supabase
      .from('vehicles')
      .insert([{ registration_number, make, model, type, capacity_kg, status, insurance_expiry, notes }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { registration_number, make, model, type, capacity_kg, status, insurance_expiry, notes } = req.body;

    const { data, error } = await supabase
      .from('vehicles')
      .update({ registration_number, make, model, type, capacity_kg, status, insurance_expiry, notes, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteVehicle = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('vehicles').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Vehicle deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// DRIVERS
// =====================================================

export const getDrivers = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('drivers')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDriver = async (req: Request, res: Response) => {
  try {
    const { name, phone, license_number, license_expiry, status } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }

    const { data, error } = await supabase
      .from('drivers')
      .insert([{ name, phone, license_number, license_expiry, status }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateDriver = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, license_number, license_expiry, status } = req.body;

    const { data, error } = await supabase
      .from('drivers')
      .update({ name, phone, license_number, license_expiry, status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteDriver = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('drivers').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Driver deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// SUPPLIERS
// =====================================================

export const getSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('store_suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('store_suppliers')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createSupplier = async (req: Request, res: Response) => {
  try {
    const { name, supplier_code, legal_name, contact_person, email, phone, alternate_phone, website,
      address_line1, address_line2, city, state, country, postal_code,
      tax_id, vat_number, registration_number, payment_terms, credit_limit,
      bank_name, bank_account_number, bank_branch, lead_time_days,
      status, is_preferred, notes } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Supplier name is required' });
    }

    // Map legacy fields if incoming data uses them
    const supplier_code_val = supplier_code || (req.body as any).code;
    const address_line1_val = address_line1 || (req.body as any).address;
    const tax_id_val = tax_id || (req.body as any).supplier_pin;
    const vat_number_val = vat_number || (req.body as any).vat_registration_number;

    // Generate supplier code if not provided
    let finalSupplierCode = supplier_code_val;
    if (!finalSupplierCode) {
      const { count } = await supabase.from('store_suppliers').select('*', { count: 'exact', head: true });
      const nextNum = (count || 0) + 1;
      finalSupplierCode = `SUP-${nextNum.toString().padStart(4, '0')}`;
    }

    // Validate Status and Payment Terms Enums
    const validStatus = ['active', 'inactive', 'blacklisted', 'pending_approval'];
    const validPaymentTerms = ['cash', 'credit_7_days', 'credit_15_days', 'credit_30_days', 'credit_45_days', 'credit_60_days', 'credit_90_days', 'advance_payment'];

    let finalStatus = status;
    if (status && !validStatus.includes(status)) {
      // Map common potentially invalid values to valid ones
      if (status.toLowerCase() === 'active') finalStatus = 'active';
      else if (status.toLowerCase() === 'inactive') finalStatus = 'inactive';
      else finalStatus = 'active'; // Default
    }

    let finalPaymentTerms = payment_terms;
    if (payment_terms && !validPaymentTerms.includes(payment_terms)) {
      finalPaymentTerms = 'cash'; // Default safe value
    }

    const { data, error } = await supabase
      .from('store_suppliers')
      .insert([{
        name,
        supplier_code: finalSupplierCode,
        legal_name,
        contact_person,
        email,
        phone,
        alternate_phone,
        website,
        address_line1: address_line1_val,
        address_line2,
        city,
        state,
        country: country || 'Kenya',
        postal_code,
        tax_id: tax_id_val,
        vat_number: vat_number_val,
        registration_number,
        payment_terms: finalPaymentTerms,
        credit_limit,
        bank_name,
        bank_account_number,
        bank_branch,
        lead_time_days,
        status: finalStatus,
        is_preferred,
        notes,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      logger.error('Error creating supplier:', error);
      throw error;
    }
    res.status(201).json({ success: true, data });
  } catch (error: any) {
    logger.error('Create Supplier Exception:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body;
    const userId = (req as any).user?.id;

    // Get old values for audit
    const { data: oldValues } = await supabase
      .from('store_suppliers')
      .select('*')
      .eq('id', id)
      .single();

    // Construct update object with allowed fields only and map legacy fields
    const updateData: any = {};
    const allowedFields = [
      'name', 'supplier_code', 'legal_name', 'contact_person', 'email', 'phone',
      'alternate_phone', 'website', 'address_line1', 'address_line2', 'city',
      'state', 'country', 'postal_code', 'tax_id', 'vat_number', 'registration_number',
      'payment_terms', 'credit_limit', 'bank_name', 'bank_account_number', 'bank_branch',
      'lead_time_days', 'status', 'is_preferred', 'notes'
    ];

    allowedFields.forEach(field => {
      if (body[field] !== undefined) updateData[field] = body[field];
    });

    // Map legacy fields if present and new ones aren't
    if (body.code && !updateData.supplier_code) updateData.supplier_code = body.code;
    if (body.address && !updateData.address_line1) updateData.address_line1 = body.address;
    if (body.supplier_pin && !updateData.tax_id) updateData.tax_id = body.supplier_pin;
    if (body.vat_registration_number && !updateData.vat_number) updateData.vat_number = body.vat_registration_number;

    // Validate Enums if they are being updated
    const validStatus = ['active', 'inactive', 'blacklisted', 'pending_approval'];
    const validPaymentTerms = ['cash', 'credit_7_days', 'credit_15_days', 'credit_30_days', 'credit_45_days', 'credit_60_days', 'credit_90_days', 'advance_payment'];

    if (updateData.status && !validStatus.includes(updateData.status)) {
      if (updateData.status.toLowerCase() === 'active') updateData.status = 'active';
      else if (updateData.status.toLowerCase() === 'inactive') updateData.status = 'inactive';
      else delete updateData.status; // Ignore invalid status to avoid error
    }

    if (updateData.payment_terms && !validPaymentTerms.includes(updateData.payment_terms)) {
      delete updateData.payment_terms; // Ignore invalid payment terms
    }

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('store_suppliers')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Error updating supplier:', error);
      throw error;
    }

    // Create audit log
    if (userId) {
      // Safe audit log creation - if it fails, don't revert the update
      try {
        await supabase.rpc('create_audit_log', {
          p_user_id: userId,
          p_action: 'UPDATE',
          p_entity_type: 'SUPPLIER',
          p_entity_id: id,
          p_entity_reference: data.supplier_code || data.name,
          p_old_values: oldValues,
          p_new_values: data,
          p_description: `Updated supplier profile: ${data.name}`,
          p_supplier_id: id
        });
      } catch (auditError) {
        logger.warn('Failed to create audit log for supplier update', auditError);
      }
    }

    res.json({ success: true, data });
  } catch (error: any) {
    logger.error('Update Supplier Exception:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSupplier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('store_suppliers').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true, message: 'Supplier deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// STOCK TAKES (Aligned with stock_counts schema)
// =====================================================

export const getStockTakes = async (req: Request, res: Response) => {
  try {
    const { branch_id, status } = req.query;

    let query = supabase
      .from('stock_counts')
      .select(`
        *,
        branch:branches(id, name, code),
        created_by_user:users(id, first_name, last_name),
        counted_by_user:users(id, first_name, last_name)
      `)
      .order('count_date', { ascending: false });

    if (branch_id) query = query.eq('branch_id', branch_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) throw error;

    // Resolve names robustly
    const enrichedData = (data || []).map((item: any) => {
      let started_by_name = 'System';
      let completed_by_name = 'System';

      const creator = item.created_by_user;
      if (creator) {
        const u = Array.isArray(creator) ? creator[0] : creator;
        const fname = u.first_name || u.firstName;
        const lname = u.last_name || u.lastName || '';
        if (fname) started_by_name = `${fname} ${lname}`.trim();
      }

      const counter = item.counted_by_user;
      if (counter) {
        const u = Array.isArray(counter) ? counter[0] : counter;
        const fname = u.first_name || u.firstName;
        const lname = u.last_name || u.lastName || '';
        if (fname) completed_by_name = `${fname} ${lname}`.trim();
      }

      return {
        ...item,
        take_number: item.count_number,
        take_type: item.count_type,
        started_by: started_by_name,
        completed_by: completed_by_name,
        // Aligned with what frontend might expect
        started_at: item.created_at,
        completed_at: item.status === 'submitted' ? item.updated_at : null
      };
    });

    res.json({ success: true, data: enrichedData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStockTake = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('stock_counts')
      .select(`
        *,
        branch:branches(id, name, code),
        created_by_user:users(id, first_name, last_name),
        counted_by_user:users(id, first_name, last_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Stock take not found' });
      }
      throw error;
    }

    let totalVarianceValue = 0;
    let itemsWithVarianceCount = 0;

    // 1. Try to fetch from new table (stock_count_items)
    const { data: rawItems, error: itemsError } = await supabase
      .from('stock_count_items')
      .select('*')
      .eq('stock_count_id', id);

    let items = rawItems || [];
    let isLegacy = false;

    // 2. Fallback to legacy table (stock_take_items) if new table is empty
    if (items.length === 0) {
      const { data: legacyItems } = await supabase
        .from('stock_take_items')
        .select('*')
        .eq('stock_take_id', id);

      if (legacyItems && legacyItems.length > 0) {
        items = legacyItems;
        isLegacy = true;
      }
    }

    // 3. Resolve item details manually if join is unreliable
    let enrichedItems = [];
    if (items.length > 0) {
      const itemIds = items.map((i: any) => i.item_id).filter(id => id);
      const itemSkus = items.map((i: any) => i.item_sku).filter(sku => sku);

      const { data: itemDetails } = await supabase
        .from(isLegacy ? 'inventory_items' : 'store_items')
        .select('id, name, unit, item_code, category')
        .in(isLegacy ? 'item_code' : 'id', isLegacy ? itemSkus : itemIds);

      const detailsMap = (itemDetails || []).reduce((acc: any, curr: any) => {
        const key = isLegacy ? curr.item_code : curr.id;
        acc[key] = curr;
        return acc;
      }, {});

      let totalVal = 0;
      let varCount = 0;

      enrichedItems = items.map((item: any) => {
        const detailKey = isLegacy ? item.item_sku : item.item_id;
        const detail = detailsMap[detailKey];

        const physicalQty = isLegacy ? item.counted_quantity : item.physical_quantity;
        const systemQty = item.system_quantity || 0;
        const unitCost = item.unit_cost || 0;
        const variance = (physicalQty || 0) - systemQty;
        const varianceValue = variance * unitCost;

        if (variance !== 0) varCount++;
        totalVal += varianceValue;

        return {
          ...item,
          physical_quantity: physicalQty,
          counted_quantity: physicalQty, // Map for frontend
          variance,
          variance_value: varianceValue,
          item_name: detail?.name || 'Unknown',
          unit: detail?.unit || 'pcs',
          item: detail || null
        };
      });

      totalVarianceValue = totalVal;
      itemsWithVarianceCount = varCount;
    }

    // Resolve names robustly
    let started_by_name = 'System';
    let completed_by_name = 'System';

    const creator = (data as any).created_by_user;
    if (creator) {
      const u = Array.isArray(creator) ? creator[0] : creator;
      const fname = u.first_name || u.firstName;
      const lname = u.last_name || u.lastName || '';
      if (fname) started_by_name = `${fname} ${lname}`.trim();
    }

    const counter = (data as any).counted_by_user;
    if (counter) {
      const u = Array.isArray(counter) ? counter[0] : counter;
      const fname = u.first_name || u.firstName;
      const lname = u.last_name || u.lastName || '';
      if (fname) completed_by_name = `${fname} ${lname}`.trim();
    }

    const enrichedResult = {
      ...data,
      take_number: (data as any).count_number || (data as any).take_number,
      take_type: (data as any).count_type || (data as any).take_type,
      total_variance_value: totalVarianceValue,
      items_with_variance: itemsWithVarianceCount,
      total_items_counted: enrichedItems.length,
      started_by: started_by_name,
      completed_by: completed_by_name,
      started_at: (data as any).created_at,
      completed_at: data.status === 'submitted' ? (data as any).updated_at : null,
      items: enrichedItems
    };

    res.json({ success: true, data: enrichedResult });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createStockTake = async (req: Request, res: Response) => {
  try {
    const { branch_id, count_type, notes } = req.body;
    const userId = (req as any).user?.id;

    if (!branch_id) {
      return res.status(400).json({ success: false, message: 'Branch is required' });
    }

    // Create stock count session
    const { data: count, error: countError } = await supabase
      .from('stock_counts')
      .insert([{
        branch_id,
        count_date: new Date().toISOString().split('T')[0],
        count_type: count_type || 'daily',
        status: 'draft',
        notes,
        created_by: userId // Ensure the person who starts the count is recorded
      }])
      .select()
      .single();

    if (countError) throw countError;

    let countItems: any[] = [];

    // 1. Try to get from branch stock
    const { data: stockItems } = await supabase
      .from('branch_stock')
      .select('item_sku, quantity')
      .eq('branch_id', branch_id);

    if (stockItems && stockItems.length > 0) {
      const skus = stockItems.map(i => i.item_sku);

      // Resolve store_item IDs and unit costs
      const { data: inventoryItems } = await supabase
        .from('store_items')
        .select('id, item_code, unit_cost')
        .in('item_code', skus);

      countItems = stockItems.map(stockItem => {
        const invItem = inventoryItems?.find(i => i.item_code === stockItem.item_sku);
        return {
          stock_count_id: count.id,
          item_id: invItem?.id,
          system_quantity: stockItem.quantity || 0,
          physical_quantity: stockItem.quantity || 0,
          unit_cost: invItem?.unit_cost || 0
        };
      }).filter(item => item.item_id);
    }

    // 2. If no branch stock or countItems, fall back to general inventory_items/store_items
    if (countItems.length === 0) {
      const { data: allItems } = await supabase
        .from('store_items')
        .select('id, item_code, unit_cost')
        .eq('is_active', true);

      if (allItems && allItems.length > 0) {
        countItems = allItems.map(item => ({
          stock_count_id: count.id,
          item_id: item.id,
          system_quantity: 0,
          physical_quantity: 0,
          unit_cost: item.unit_cost || 0
        }));
      }
    }

    if (countItems.length > 0) {
      await supabase.from('stock_count_items').insert(countItems);
    }

    res.status(201).json({ success: true, data: count });
    logger.info(`Stock count session created: ${count.id} for branch ${branch_id}`);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStockTakeItems = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1. Fetch stock count items
    const { data: items, error: itemsError } = await supabase
      .from('stock_count_items')
      .select('*')
      .eq('stock_count_id', id);

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // 2. Fetch inventory items details
    const itemIds = items.map(i => i.item_id).filter(id => id);
    if (itemIds.length === 0) {
      return res.json({ success: true, data: items });
    }

    const { data: inventoryItems, error: invError } = await supabase
      .from('store_items')
      .select('id, name, item_code, category, unit')
      .in('id', itemIds);

    if (invError) throw invError;

    // 3. Manually merge and flatten for frontend
    const mergedData = items.map(item => {
      const invItem = inventoryItems?.find(inv => inv.id === item.item_id);
      return {
        ...item,
        item_name: invItem?.name || 'Unknown Item',
        item_sku: invItem?.item_code || 'N/A',
        unit: invItem?.unit || 'pcs',
        // Support frontend expectation of actual_quantity mapping to physical_quantity
        actual_quantity: item.physical_quantity,
        variance: (item.physical_quantity || 0) - (item.system_quantity || 0),
        item: invItem || null
      };
    });

    res.json({ success: true, data: mergedData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStockTakeItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { physical_quantity, actual_quantity, reason } = req.body;

    // Support both field names for flexibility
    const newQuantity = physical_quantity !== undefined ? physical_quantity : actual_quantity;

    const { data, error } = await supabase
      .from('stock_count_items')
      .update({
        physical_quantity: newQuantity,
        reason,
        created_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const completeStockTake = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    // Get the stock count and its items
    const { data: count, error: countError } = await supabase
      .from('stock_counts')
      .select('*, items:stock_count_items(*, item:inventory_items(code))')
      .eq('id', id)
      .single();

    if (countError) throw countError;
    if (!count) return res.status(404).json({ success: false, message: 'Stock count not found' });

    // Transition to 'submitted' for auditor review
    const { data: updatedCount, error: updateError } = await supabase
      .from('stock_counts')
      .update({
        status: 'submitted',
        counted_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Create approval request for auditor
    await supabase.from('approval_requests').insert({
      request_type: 'stock_take',
      status: 'pending',
      branch_id: count.branch_id,
      requested_by: userId,
      description: `Stock count submission review: ${count.count_number || id}`,
      metadata: { stock_count_id: id }
    });

    res.json({
      success: true,
      message: 'Stock take submitted for auditor review',
      data: updatedCount
    });

    logger.info(`Stock count ${id} submitted for audit by ${userId}`);

    // Notify Auditor
    notificationService.notifyRole(
      'auditor',
      'Stock Take Submission',
      `A new stock take (${count.count_number || id}) has been submitted for audit.`,
      {
        type: 'warning',
        category: 'audit',
        priority: 'medium',
        actionUrl: `/dashboard/auditor/stock-takes/${id}`,
        metadata: { stock_count_id: id, type: 'stock_take' }
      }
    ).catch(e => logger.error('Failed to notify auditor of stock take submission', e));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =====================================================
// APP CONFIG
// =====================================================

export const getAppConfig = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('simple_app_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAppConfig = async (req: Request, res: Response) => {
  try {
    const updates = req.body;

    const { data, error } = await supabase
      .from('simple_app_config')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
