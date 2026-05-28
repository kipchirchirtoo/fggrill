import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import * as BranchInventoryService from '../../services/branch-inventory.service';
import { logger } from '../../utils/logger';
import notificationService from '../../services/notification.service';
import { UserRole } from '../../models/User';
import pool from '../../db';

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
    // 1. Fetch dedicated drivers table
    const { data: driverRecords, error: driverError } = await supabase
      .from('drivers')
      .select('*')
      .order('name');

    if (driverError) throw driverError;

    // 2. Fetch staff_profiles with department = 'driver'
    const { data: staffDrivers, error: staffError } = await supabase
      .from('staff_profiles')
      .select('id, first_name, last_name, phone, position, status, id_number')
      .eq('department', 'driver');

    if (staffError) {
      logger.warn('Could not fetch driver staff profiles:', staffError.message);
    }

    // 3. Map staff drivers to the Driver shape
    const staffMapped = (staffDrivers || []).map((s: any) => ({
      id: s.id,
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
      phone: s.phone || '',
      license_number: null,
      license_expiry: null,
      status: s.status === 'active' ? 'active' : 'inactive',
      source: 'staff',
      position: s.position || 'Driver',
      employee_id: s.id_number || null,
    }));

    // 4. Merge: drivers table first, then staff (deduplicate by phone)
    const existingPhones = new Set((driverRecords || []).map((d: any) => d.phone).filter(Boolean));
    const uniqueStaffDrivers = staffMapped.filter((s: any) => !s.phone || !existingPhones.has(s.phone));

    const merged = [
      ...(driverRecords || []).map((d: any) => ({ ...d, source: 'drivers_table' })),
      ...uniqueStaffDrivers,
    ];

    res.json({ success: true, data: merged });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createDriver = async (req: Request, res: Response) => {
  try {
    const { name, phone, license_number, branch_id, vehicle_id } = req.body;

    // Check if a staff member already exists with this name/phone to prevent double record
    const { data: existingStaff } = await supabase
      .from('staff_profiles')
      .select('id')
      .or(`phone.eq.${phone},id_number.eq.${license_number}`) // license_number often matches id_number
      .maybeSingle();

    if (existingStaff) {
       // Just update them to be a driver instead of creating a new driver record
       const { error } = await supabase.from('staff_profiles').update({ department: 'driver' }).eq('id', existingStaff.id);
       if (error) {
         console.error('Database error:', error);
         throw error;
       }
       return res.json({ success: true, data: existingStaff, message: 'Existing staff updated to driver' });
    }

    const { data, error } = await supabase
      .from('drivers')
      .insert({
        name,
        phone,
        license_number,
        branch_id,
        vehicle_id,
        status: 'ACTIVE'
      })
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
    const { name, phone, license_number, license_expiry, status, basic_salary, bank_name, account_number } = req.body;

    // Build the update object dynamically so we only update what's provided
    const updateData: any = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (license_number !== undefined) updateData.license_number = license_number;
    if (license_expiry !== undefined) updateData.license_expiry = license_expiry;
    if (status !== undefined) updateData.status = status;
    if (basic_salary !== undefined) updateData.basic_salary = basic_salary;
    if (bank_name !== undefined) updateData.bank_name = bank_name;
    if (account_number !== undefined) updateData.account_number = account_number;

    const { data, error } = await supabase
      .from('drivers')
      .update(updateData)
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
    
    // Map status to uppercase for frontend compatibility
    const enrichedData = data ? {
      ...data,
      status: (data.status || 'active').toUpperCase() === 'BLACKLISTED' ? 'BLOCKED' : (data.status || 'active').toUpperCase()
    } : null;

    res.json({ success: true, data: enrichedData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSuppliers = async (req: Request, res: Response) => {
  try {
    const { status, category, search, scope } = req.query;
    const user = (req as any).user;
    const userBranchId = user?.branch_id || user?.branchId;
    const isCentral = !userBranchId || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;

    logger.debug('SUPPLIER_DEBUG_START', { 
      email: user?.email, 
      role: user?.role, 
      branch_id: user?.branch_id, 
      branchId: user?.branchId, 
      isCentral, 
      scope 
    });

    let query = supabase
      .from('store_suppliers')
      .select('*')
      .order('name');

    // 1. Apply Scoping Filters
    if (!isCentral) {
      const branchId = Number(userBranchId);
      
      if (scope === 'branch') {
        query = query.eq('branch_id', branchId);
      } else if (scope === 'global') {
        query = query.is('branch_id', null);
      } else {
        // Default: see own branch OR global
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      }
    } else {
      // Central users: default to central/global suppliers (branch_id IS NULL)
      // Allow explicit branch lookup only when a specific branchId query param is provided
      const requestedBranch = req.query.branchId || req.query.branch_id;
      if (scope === 'branch' && requestedBranch) {
        query = query.eq('branch_id', Number(requestedBranch));
      } else {
        // Default and 'global' scope: only central suppliers
        query = query.is('branch_id', null);
      }
    }

    // 2. Apply Status Filter
    if (status) {
      const statusStr = String(status).toLowerCase();
      query = query.eq('status', statusStr === 'active' ? 'active' : (statusStr === 'blocked' ? 'blacklisted' : statusStr));
    }

    // 3. Apply Search Filter
    if (search) {
      const searchStr = String(search);
      query = query.or(`name.ilike.%${searchStr}%,supplier_code.ilike.%${searchStr}%,contact_person.ilike.%${searchStr}%`);
    }

    logger.debug('Supplier Scoping:', { 
      userEmail: user?.email, 
      userRole: user?.role, 
      userBranchId, 
      isCentral, 
      scope,
      appliedBranchId: !isCentral ? Number(userBranchId) : null
    });

    const { data, error } = await query;

    if (error) throw error;

    // Map status to uppercase for frontend compatibility
    const enrichedData = (data || []).map((s: any) => ({
      ...s,
      status: (s.status || 'active').toUpperCase() === 'BLACKLISTED' ? 'BLOCKED' : (s.status || 'active').toUpperCase()
    }));

    res.json({ success: true, data: enrichedData });
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
      status, is_preferred, notes, branch_id } = req.body;
    
    const user = (req as any).user;
    const userBranchId = user?.branch_id || user?.branchId;
    const isCentral = !userBranchId || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;


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
      const { count , error } = await supabase.from('store_suppliers').select('*', { count: 'exact', head: true });
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      const nextNum = (count || 0) + 1;
      finalSupplierCode = `SUP-${nextNum.toString().padStart(4, '0')}`;
    }

    // Validate Status and Payment Terms Enums
    const validStatus = ['active', 'inactive', 'blacklisted', 'pending_approval'];
    const validPaymentTerms = ['cash', 'credit_7_days', 'credit_15_days', 'credit_30_days', 'credit_45_days', 'credit_60_days', 'credit_90_days', 'advance_payment'];

    let finalStatus = status;
    if (status && !validStatus.includes(status)) {
      // Map common potentially invalid values from frontend (UPPERCASE) to valid ones (lowercase)
      const lowerStatus = status.toLowerCase();
      if (lowerStatus === 'active') finalStatus = 'active';
      else if (lowerStatus === 'inactive') finalStatus = 'inactive';
      else if (lowerStatus === 'blocked') finalStatus = 'blacklisted';
      else finalStatus = 'active';
      logger.info('Supplier status mapping applied', { original: status, mapped: finalStatus });
    } else if (!status) {
      finalStatus = 'active';
    }

    // Auto-inject branch_id for branch users if not provided
    let finalBranchId = branch_id;
    if (!isCentral && !finalBranchId) {
      finalBranchId = userBranchId;
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
        is_preferred: is_preferred || false,
        notes,
        branch_id: finalBranchId,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      logger.error('Error creating supplier:', error);
      throw error;
    }

    // Map status to uppercase for frontend
    const enrichedData = {
      ...data,
      status: (data.status || 'active').toUpperCase() === 'BLACKLISTED' ? 'BLOCKED' : (data.status || 'active').toUpperCase()
    };

    res.status(201).json({ success: true, data: enrichedData });
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
      const lowerStatus = updateData.status.toLowerCase();
      if (lowerStatus === 'active') updateData.status = 'active';
      else if (lowerStatus === 'inactive') updateData.status = 'inactive';
      else if (lowerStatus === 'blocked') updateData.status = 'blacklisted';
      else delete updateData.status; // Ignore invalid status
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
        const { error: auditError } = await supabase.rpc('create_audit_log', {
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
        
        if (auditError) {
          console.error('Database error:', auditError);
          throw auditError;
        }
      } catch (auditError) {
        logger.warn('Failed to create audit log for supplier update', auditError);
      }
    }

    // Map status to uppercase for frontend
    const enrichedData = {
      ...data,
      status: (data.status || 'active').toUpperCase() === 'BLACKLISTED' ? 'BLOCKED' : (data.status || 'active').toUpperCase()
    };

    res.json({ success: true, data: enrichedData });
  } catch (error: any) {
    logger.error('Update Supplier Exception:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteSupplier = async (req: Request, res: Response) => {
  let client;

  try {
    const { id } = req.params;

    // Validate UUID format to prevent any injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid supplier ID format' });
    }

    client = await pool.getClient();

    // Start explicit transaction to ensure session variable persists for the DO block
    await client.query('BEGIN');

    try {
      // Pass supplier ID via session variable for safe use in DO block
      await client.query(`SELECT set_config('app.delete_supplier_id', $1, true)`, [id]);

      // Use a PL/pgSQL DO block to handle all cascade deletes in a single transaction.
      // Each delete is wrapped in its own BEGIN/EXCEPTION block so missing tables
      // (from migrations not yet applied) won't abort the whole transaction.
      await client.query(`
        DO $$
        DECLARE
          v_id UUID := current_setting('app.delete_supplier_id')::UUID;
        BEGIN
          -- 1. Credit note items (child of credit notes)
          BEGIN
            DELETE FROM store_credit_note_items 
            WHERE credit_note_id IN (SELECT id FROM store_supplier_credit_notes WHERE supplier_id = v_id);
          EXCEPTION WHEN undefined_table THEN NULL;
          END;

          -- 2. Credit notes
          BEGIN
            DELETE FROM store_supplier_credit_notes WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;

          -- 3. Payment-invoice allocations
          BEGIN
            DELETE FROM store_payment_invoice_allocations 
            WHERE payment_id IN (SELECT id FROM store_supplier_payments WHERE supplier_id = v_id);
          EXCEPTION WHEN undefined_table THEN NULL;
          END;

          -- 4. Supplier payments
          BEGIN
            DELETE FROM store_supplier_payments WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;

          -- 5. Invoice items then invoices
          BEGIN
            DELETE FROM store_supplier_invoice_items 
            WHERE invoice_id IN (SELECT id FROM store_supplier_invoices WHERE supplier_id = v_id);
          EXCEPTION WHEN undefined_table THEN NULL;
          END;
          BEGIN
            DELETE FROM store_supplier_invoices WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;

          -- 6. VAT summary & transactions
          BEGIN
            DELETE FROM store_supplier_vat_summary WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;
          BEGIN
            DELETE FROM store_vat_transactions WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;

          -- 7. Supplier ledger & balances
          BEGIN
            DELETE FROM store_supplier_ledger WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;
          BEGIN
            DELETE FROM store_supplier_balances WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;

          -- 8. GRNI control account entries
          BEGIN
            DELETE FROM store_grni_control_account WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;

          -- 9. GRN items then GRNs
          BEGIN
            DELETE FROM store_grn_items 
            WHERE grn_id IN (SELECT id FROM store_grn WHERE supplier_id = v_id);
          EXCEPTION WHEN undefined_table THEN NULL;
          END;
          BEGIN
            DELETE FROM store_grn WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;

          -- 10. PO items then purchase orders
          BEGIN
            DELETE FROM store_po_items 
            WHERE po_id IN (SELECT id FROM store_purchase_orders WHERE supplier_id = v_id);
          EXCEPTION WHEN undefined_table THEN NULL;
          END;
          BEGIN
            DELETE FROM store_purchase_orders WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;

          -- 11. Supplier quotations & performance
          BEGIN
            DELETE FROM store_supplier_quotations WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;
          BEGIN
            DELETE FROM store_supplier_performance WHERE supplier_id = v_id;
          EXCEPTION WHEN undefined_table THEN NULL;
          END;

          -- 12. Finally delete the supplier
          DELETE FROM store_suppliers WHERE id = v_id;
        END $$;
      `);

      await client.query('COMMIT');
      res.json({ success: true, message: 'Supplier and all related records deleted successfully' });
    } catch (transactionError) {
      await client.query('ROLLBACK');
      throw transactionError;
    }
  } catch (error: any) {
    logger.error('Error deleting supplier:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
};

// =====================================================
// STOCK TAKES (Aligned with stock_counts schema)
// =====================================================

const toNumber = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveStockCountBranchId = async (stockCountId: string): Promise<number | null> => {
  const { data, error } = await supabase
    .from('stock_counts')
    .select('branch_id')
    .eq('id', stockCountId)
    .maybeSingle();

  if (error) throw error;
  return data?.branch_id ? Number(data.branch_id) : null;
};

const normalizeStoreType = (value: any): string => {
  const raw = `${value || 'foodstuffs'}`.toLowerCase();
  if (['bar', 'bars', 'bar_store', 'executive_bar', 'main_bar', 'sports_bar'].includes(raw)) {
    return 'bar_store';
  }
  if (['store', 'store_items', 'general_store'].includes(raw)) return 'store_items';
  return 'foodstuffs';
};

const itemMatchesStoreType = (item: any, storeType: string): boolean => {
  const rawStoreType = `${item?.store_type || item?.item?.store_type || ''}`.toLowerCase();
  const category = `${item?.category || item?.item?.category || ''}`.toLowerCase();
  const name = `${item?.item_name || item?.description || item?.item?.item_name || ''}`.toLowerCase();
  const isBarItem =
    rawStoreType === 'bar_store' ||
    category.includes('bar') ||
    category.includes('beverage') ||
    category.includes('drink') ||
    name.includes('beer') ||
    name.includes('wine') ||
    name.includes('whisky') ||
    name.includes('vodka') ||
    name.includes('gin') ||
    name.includes('brandy');

  if (storeType === 'bar_store') return isBarItem;
  if (storeType === 'foodstuffs') return !isBarItem;
  return true;
};

const getDayBounds = (date?: string) => {
  const day = date || new Date().toISOString().split('T')[0];
  return {
    day,
    start: `${day}T00:00:00.000Z`,
    end: `${day}T23:59:59.999Z`
  };
};

const seedStockCountItemsFromBranchStock = async (
  stockCountId: string,
  branchId: number,
  storeType = 'foodstuffs',
  countDate?: string
): Promise<void> => {
  const { data: existing, error: existingError } = await supabase
    .from('stock_count_items')
    .select('id')
    .eq('stock_count_id', stockCountId)
    .limit(1);

  if (existingError) throw existingError;
  if (existing && existing.length > 0) return;

  const normalizedStoreType = normalizeStoreType(storeType);
  const { day, start, end } = getDayBounds(countDate);

  let { data: branchStock, error: stockError } = await supabase
    .from('branch_stock')
    .select('item_sku, quantity')
    .eq('branch_id', branchId)
    .order('item_sku');

  if (stockError) throw stockError;
  let stockRows = branchStock || [];

  const initialSkus = stockRows.map((item: any) => item.item_sku).filter(Boolean);
  const { data: simpleItems, error: itemsError } = await supabase
    .from('simple_items')
    .select('sku, item_name, name, category, unit_of_measure, cost_price, store_type')
    .in('sku', initialSkus.length > 0 ? initialSkus : ['__none__']);

  if (itemsError) throw itemsError;
  let simpleRows = simpleItems || [];
  let simpleBySku = new Map(simpleRows.map((item: any) => [item.sku, item]));

  if (stockRows.length === 0) {
    const { data: branchItems, error: branchItemsError } = await supabase
      .from('simple_items')
      .select('sku, item_name, name, category, unit_of_measure, cost_price, store_type')
      .eq('branch_id', branchId)
      .eq('is_active', true)
      .order('sku');

    if (branchItemsError) throw branchItemsError;
    simpleRows = branchItems || [];

    // Some deployed branches keep inventory in the shared central catalog and
    // only materialize branch_stock rows after the first receipt/dispatch. A
    // new daily stock count must still open with countable rows instead of a
    // blank sheet, so fall back to active shared catalog items when the branch
    // has neither branch_stock nor branch-scoped simple_items rows.
    if (simpleRows.length === 0) {
      const { data: sharedItems, error: sharedItemsError } = await supabase
        .from('simple_items')
        .select('sku, item_name, name, category, unit_of_measure, cost_price, store_type')
        .is('branch_id', null)
        .eq('is_active', true)
        .order('sku');

      if (sharedItemsError) throw sharedItemsError;
      simpleRows = sharedItems || [];
    }

    simpleBySku = new Map(simpleRows.map((item: any) => [item.sku, item]));
    stockRows = simpleRows.map((item: any) => ({
      item_sku: item.sku,
      quantity: 0,
    }));
  }

  if (stockRows.length === 0) return;

  const skus = stockRows.map((item: any) => item.item_sku).filter(Boolean);

  const { data: movements, error: movementError } = await supabase
    .from('branch_stock_movements')
    .select('item_sku, movement_type, quantity, previous_stock, new_stock, notes, created_at')
    .eq('branch_id', branchId)
    .gte('created_at', start)
    .lte('created_at', end)
    .in('item_sku', skus);

  if (movementError) throw movementError;

  const movementBySku = new Map<string, any[]>();
  (movements || []).forEach((movement: any) => {
    const list = movementBySku.get(movement.item_sku) || [];
    list.push(movement);
    movementBySku.set(movement.item_sku, list);
  });

  let rows = stockRows
    .filter((item: any) => {
      const detail = simpleBySku.get(item.item_sku);
      return itemMatchesStoreType(detail || item, normalizedStoreType);
    })
    .map((item: any) => {
      const detail = simpleBySku.get(item.item_sku);
      const itemMovements = movementBySku.get(item.item_sku) || [];
      const additions = itemMovements
        .filter((movement: any) => toNumber(movement.new_stock) > toNumber(movement.previous_stock))
        .reduce((sum: number, movement: any) => sum + toNumber(movement.quantity), 0);
      const issued = itemMovements
        .filter((movement: any) => toNumber(movement.new_stock) < toNumber(movement.previous_stock))
        .reduce((sum: number, movement: any) => sum + toNumber(movement.quantity), 0);
      const currentStock = toNumber(item.quantity);
      const openingStock = currentStock - additions + issued;
      const costPrice = toNumber(detail?.cost_price);

      return {
        stock_count_id: stockCountId,
        item_sku: item.item_sku,
        item_id: null,
        store_type: normalizedStoreType,
        opening_stock: openingStock,
        additions,
        issued_quantity: issued,
        system_quantity: currentStock,
        system_closing_stock: currentStock,
        physical_quantity: null,
        unit_cost: costPrice,
        cost_price: costPrice,
        reason: null,
        variance_reason: null,
      };
    });

  if (rows.length === 0 && normalizedStoreType !== 'store_items') {
    rows = stockRows.map((item: any) => {
      const detail = simpleBySku.get(item.item_sku);
      const itemMovements = movementBySku.get(item.item_sku) || [];
      const additions = itemMovements
        .filter((movement: any) => toNumber(movement.new_stock) > toNumber(movement.previous_stock))
        .reduce((sum: number, movement: any) => sum + toNumber(movement.quantity), 0);
      const issued = itemMovements
        .filter((movement: any) => toNumber(movement.new_stock) < toNumber(movement.previous_stock))
        .reduce((sum: number, movement: any) => sum + toNumber(movement.quantity), 0);
      const currentStock = toNumber(item.quantity);
      const openingStock = currentStock - additions + issued;
      const costPrice = toNumber(detail?.cost_price);

      return {
        stock_count_id: stockCountId,
        item_sku: item.item_sku,
        item_id: null,
        store_type: normalizedStoreType,
        opening_stock: openingStock,
        additions,
        issued_quantity: issued,
        system_quantity: currentStock,
        system_closing_stock: currentStock,
        physical_quantity: null,
        unit_cost: costPrice,
        cost_price: costPrice,
        reason: null,
        variance_reason: null,
      };
    });
  }

  if (rows.length === 0) {
    logger.info(`No ${normalizedStoreType} branch stock rows found for branch ${branchId} on ${day}`);
    return;
  }

  const { error: insertError } = await supabase
    .from('stock_count_items')
    .insert(rows);

  if (insertError) throw insertError;
};

const recalculateStockCountTotals = async (stockCountId: string): Promise<void> => {
  const { data: items, error } = await supabase
    .from('stock_count_items')
    .select('physical_quantity, system_quantity, system_closing_stock, cost_price, unit_cost, issued_quantity')
    .eq('stock_count_id', stockCountId);

  if (error) throw error;

  const totals = (items || []).reduce(
    (acc: any, item: any) => {
      const cost = toNumber(item.cost_price ?? item.unit_cost);
      const systemClosing = toNumber(item.system_closing_stock ?? item.system_quantity);
      const physical = item.physical_quantity === null || item.physical_quantity === undefined
        ? systemClosing
        : toNumber(item.physical_quantity);
      const variance = physical - systemClosing;
      acc.total_stock_value += physical * cost;
      acc.total_cogs_value += toNumber(item.issued_quantity) * cost;
      acc.total_variance_value += variance * cost;
      return acc;
    },
    { total_stock_value: 0, total_cogs_value: 0, total_variance_value: 0 }
  );

  const { error: updateError } = await supabase
    .from('stock_counts')
    .update(totals)
    .eq('id', stockCountId);

  if (updateError) throw updateError;
};

const getEnrichedStockCountItems = async (
  stockCountId: string,
  branchId?: number | null
): Promise<any[]> => {
  const itemResult = await supabase
    .from('stock_count_items')
    .select('*')
    .eq('stock_count_id', stockCountId)
    .order('created_at', { ascending: true });

  if (itemResult.error) throw itemResult.error;
  let items = itemResult.data;

  if ((!items || items.length === 0) && branchId) {
    const { data: count } = await supabase
      .from('stock_counts')
      .select('store_type, count_date')
      .eq('id', stockCountId)
      .maybeSingle();
    await seedStockCountItemsFromBranchStock(
      stockCountId,
      branchId,
      count?.store_type,
      count?.count_date
    );
    const seeded = await supabase
      .from('stock_count_items')
      .select('*')
      .eq('stock_count_id', stockCountId)
      .order('created_at', { ascending: true });
    if (seeded.error) throw seeded.error;
    items = seeded.data || [];
  }

  if (!items || items.length === 0) return [];

  const itemSkus = [...new Set(items.map((item: any) => item.item_sku).filter(Boolean))];
  const itemIds = [...new Set(items.map((item: any) => item.item_id).filter(Boolean))];

  const [{ data: simpleItems }, { data: storeItems }] = await Promise.all([
    itemSkus.length > 0
      ? supabase
          .from('simple_items')
          .select('sku, item_name, description, category, unit_of_measure, cost_price, store_type')
          .in('sku', itemSkus)
      : Promise.resolve({ data: [] as any[] }),
    itemIds.length > 0
      ? supabase
          .from('store_items')
          .select('id, name, item_code, category, unit')
          .in('id', itemIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const simpleBySku = new Map((simpleItems || []).map((item: any) => [item.sku, item]));
  const storeById = new Map((storeItems || []).map((item: any) => [item.id, item]));

  return items.map((item: any) => {
    const simple = item.item_sku ? simpleBySku.get(item.item_sku) : null;
    const store = item.item_id ? storeById.get(item.item_id) : null;
    const physical = item.physical_quantity;
    const counted = physical === null || physical === undefined ? null : toNumber(physical);
    const systemClosing = toNumber(item.system_closing_stock ?? item.system_quantity);
    const unitCost = toNumber(item.unit_cost ?? simple?.cost_price);
    const itemSku = item.item_sku || store?.item_code || item.item_id;
    const itemName = simple?.item_name || store?.name || itemSku || 'Unknown Item';

    return {
      ...item,
      item_sku: itemSku,
      item_name: itemName,
      unit: simple?.unit_of_measure || store?.unit || 'pcs',
      category: simple?.category || store?.category || null,
      store_type: item.store_type || simple?.store_type || null,
      opening_stock: toNumber(item.opening_stock),
      additions: toNumber(item.additions),
      issued_quantity: toNumber(item.issued_quantity),
      system_closing_stock: systemClosing,
      physical_quantity: counted,
      counted_quantity: counted,
      actual_quantity: counted,
      variance: counted === null ? null : counted - systemClosing,
      variance_value: counted === null ? null : (counted - systemClosing) * unitCost,
      cost_price: unitCost,
      cogs_value: toNumber(item.issued_quantity) * unitCost,
      variance_reason: item.variance_reason || item.reason || null,
      status: counted === null ? 'PENDING' : 'COUNTED',
      item: {
        id: item.item_id,
        sku: itemSku,
        item_code: itemSku,
        name: itemName,
        item_name: itemName,
        category: simple?.category || store?.category || null,
        unit: simple?.unit_of_measure || store?.unit || 'pcs',
      },
    };
  });
};

export const getStockTakes = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { branch_id: queryBranchId, status, store_type, date } = req.query;

    // Enforce branch filtering for non-admin roles
    let effectiveBranchId = queryBranchId;
    if (user && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.GENERAL_MANAGER) {
      effectiveBranchId = user.branch_id || user.branchId;
    }

    let query = supabase
      .from('stock_counts')
      .select(`
        *,
        branch:branches(id, name, code)
      `)
      .order('count_date', { ascending: false });

    if (effectiveBranchId) query = query.eq('branch_id', effectiveBranchId);
    if (status) query = query.eq('status', status);
    if (store_type && store_type !== 'all') query = query.eq('store_type', normalizeStoreType(store_type));
    if (date) query = query.eq('count_date', date);

    const { data, error } = await query;

    if (error) throw error;
    
    // Manually fetch user details to avoid ambiguous relationship errors
    const userIds = new Set<string>();
    (data || []).forEach((item: any) => {
      if (item.created_by) userIds.add(item.created_by);
      if (item.counted_by) userIds.add(item.counted_by);
    });

    let usersMap: Record<string, any> = {};
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', Array.from(userIds));
      
      usersMap = (users || []).reduce((acc: any, user: any) => {
        acc[user.id] = user;
        return acc;
      }, {});
    }

    // Resolve names robustly
    const enrichedData = (data || []).map((item: any) => {
      let started_by_name = 'System';
      let completed_by_name = 'System';

      if (item.created_by && usersMap[item.created_by]) {
        const u = usersMap[item.created_by];
        started_by_name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'System';
      }

      if (item.counted_by && usersMap[item.counted_by]) {
        const u = usersMap[item.counted_by];
        completed_by_name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'System';
      }

      return {
        ...item,
        take_number: item.count_number,
        take_type: item.count_type,
        store_type: item.store_type || 'foodstuffs',
        outlet_code: item.outlet_code,
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
        branch:branches(id, name, code)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Stock take not found' });
      }
      throw error;
    }
    
    // Manually fetch user details to avoid ambiguous relationship errors
    const userIds = new Set<string>();
    if ((data as any).created_by) userIds.add((data as any).created_by);
    if ((data as any).counted_by) userIds.add((data as any).counted_by);

    let usersMap: Record<string, any> = {};
    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', Array.from(userIds));
      
      usersMap = (users || []).reduce((acc: any, user: any) => {
        acc[user.id] = user;
        return acc;
      }, {});
    }

    const enrichedItems = await getEnrichedStockCountItems(id, (data as any).branch_id);
    const totalVarianceValue = enrichedItems.reduce(
      (sum: number, item: any) => sum + toNumber(item.variance_value),
      0
    );
    const itemsWithVarianceCount = enrichedItems.filter(
      (item: any) => item.variance !== null && toNumber(item.variance) !== 0
    ).length;

    // Resolve names robustly
    let started_by_name = 'System';
    let completed_by_name = 'System';

    if ((data as any).created_by && usersMap[(data as any).created_by]) {
      const u = usersMap[(data as any).created_by];
      started_by_name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'System';
    }

    if ((data as any).counted_by && usersMap[(data as any).counted_by]) {
      const u = usersMap[(data as any).counted_by];
      completed_by_name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'System';
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
    const user = (req as any).user;
    let branch_id = req.body.branch_id;
    const { count_type, notes, outlet_code } = req.body;
    const storeType = normalizeStoreType(req.body.store_type);
    const countDate = req.body.count_date || new Date().toISOString().split('T')[0];
    const userId = user?.id;

    // Enforce branch from user profile for non-admins
    if (user && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.GENERAL_MANAGER) {
      branch_id = user.branch_id || user.branchId;
    }

    if (!branch_id) {
      return res.status(400).json({ success: false, message: 'Branch is required' });
    }

    const existingQuery = supabase
      .from('stock_counts')
      .select('*')
      .eq('branch_id', branch_id)
      .eq('count_date', countDate)
      .eq('store_type', storeType)
      .eq('count_type', count_type || 'daily')
      .in('status', ['draft', 'submitted_to_accountant', 'submitted']);

    const { data: existingCounts, error: existingError } = outlet_code
      ? await existingQuery.eq('outlet_code', outlet_code)
      : await existingQuery.is('outlet_code', null);

    if (existingError) throw existingError;
    if (existingCounts && existingCounts.length > 0) {
      await getEnrichedStockCountItems(existingCounts[0].id, Number(branch_id));
      return res.status(200).json({ success: true, data: existingCounts[0] });
    }

    // Create stock count session
    const { data: count, error: countError } = await supabase
      .from('stock_counts')
      .insert([{
        branch_id,
        count_date: countDate,
        count_type: count_type || 'daily',
        store_type: storeType,
        outlet_code: outlet_code || null,
        status: 'draft',
        notes,
        created_by: userId // Ensure the person who starts the count is recorded
      }])
      .select()
      .single();

    if (countError) throw countError;

    await seedStockCountItemsFromBranchStock(count.id, Number(branch_id), storeType, countDate);
    await recalculateStockCountTotals(count.id);

    res.status(201).json({ success: true, data: count });
    logger.info(`Stock count session created: ${count.id} for branch ${branch_id}`);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getStockTakeItems = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const branchId = await resolveStockCountBranchId(id);
    const mergedData = await getEnrichedStockCountItems(id, branchId);

    res.json({ success: true, data: mergedData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStockTakeItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { physical_quantity, actual_quantity, reason, variance_reason } = req.body;

    // Support both field names for flexibility
    const newQuantity = physical_quantity !== undefined ? physical_quantity : actual_quantity;

    const { data, error } = await supabase
      .from('stock_count_items')
      .update({
        physical_quantity: newQuantity,
        reason: variance_reason || reason,
        variance_reason: variance_reason || reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (data?.stock_count_id) await recalculateStockCountTotals(data.stock_count_id);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStockTake = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes, items } = req.body;
    const userId = (req as any).user?.id;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED' || status === 'submitted') {
        updateData.counted_by = userId;
        updateData.updated_at = new Date().toISOString();
      }
    }
    if (notes !== undefined) updateData.notes = notes;

    // 1. Update header
    const { data: counts, error: countError } = await supabase
      .from('stock_counts')
      .update(updateData)
      .eq('id', id)
      .select();

    if (countError) throw countError;
    if (!counts || counts.length === 0) {
      return res.status(404).json({ success: false, message: 'Stock take not found' });
    }

    const count = counts[0];

    // 2. Update items in bulk. The branch store count sheet is keyed by item_sku,
    // while older rows may still only have a stock_count_items id.
    if (items && items.length > 0) {
      for (const item of items) {
        const countedQuantity =
          item.counted_quantity ?? item.physical_quantity ?? item.actual_quantity ?? null;
        const reason = item.variance_reason ?? item.reason ?? item.notes ?? null;
        const updatedAt = new Date().toISOString();
        const hasCount = countedQuantity !== null && countedQuantity !== undefined;

        const stockCountPayload: any = {
          physical_quantity: countedQuantity,
          reason,
          variance_reason: reason,
          updated_at: updatedAt
        };

        if (item.item_sku && (!item.id || String(item.id).startsWith('manual:'))) {
          const { data: existing, error: existingError } = await supabase
            .from('stock_count_items')
            .select('id')
            .eq('stock_count_id', id)
            .eq('item_sku', item.item_sku)
            .maybeSingle();

          if (existingError) throw existingError;

          if (existing?.id) {
            const { error: updateError } = await supabase
              .from('stock_count_items')
              .update(stockCountPayload)
              .eq('id', existing.id);

            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .from('stock_count_items')
              .insert({
                stock_count_id: id,
                item_sku: item.item_sku,
                item_id: item.item_id || null,
                system_quantity: toNumber(item.system_quantity),
                physical_quantity: countedQuantity,
                unit_cost: toNumber(item.unit_cost),
                cost_price: toNumber(item.cost_price ?? item.unit_cost),
                reason
              });

            if (insertError) throw insertError;
          }

          continue;
        }

        if (!item.id) continue;

        const { error: countItemError } = await supabase
          .from('stock_count_items')
          .update(stockCountPayload)
          .eq('id', item.id);

        if (countItemError) {
          logger.warn(`Could not update stock_count_items row ${item.id}: ${countItemError.message}`);
        }

        const legacyPayload: any = {
          counted_quantity: countedQuantity,
          variance_reason: reason,
          notes: item.notes,
          status: hasCount ? 'COUNTED' : 'PENDING',
          updated_at: updatedAt
        };

        const { error: legacyError } = await supabase
          .from('stock_take_items')
          .update(legacyPayload)
          .eq('id', item.id);

        if (legacyError) {
          logger.warn(`Could not update stock_take_items row ${item.id}: ${legacyError.message}`);
        }
      }
    }

    await recalculateStockCountTotals(id);

    res.json({ success: true, data: count, message: 'Stock take updated successfully' });
  } catch (error: any) {
    logger.error('Error updating stock take:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateWorksheet = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { branch_id, category } = req.query;
    const user = (req as any).user;

    let items = [];
    let branchName = 'Main Branch';
    let title = 'Physical Stock Take';

    if (id && id !== 'undefined') {
      const { data: count, error: countError } = await supabase
        .from('stock_counts')
        .select('*, branch:branches(name)')
        .eq('id', id)
        .single();

      if (countError) throw countError;
      if (count.branch) branchName = count.branch.name;
      title = `Stock Take Worksheet - ${count.count_number || id.substring(0,8)}`;

      // Fetch items from stock_count_items
      const { data: takeItems, error: itemsError } = await supabase
        .from('stock_count_items')
        .select('*')
        .eq('stock_count_id', id);
      
      if (itemsError) throw itemsError;

      let finalTakeItems = takeItems || [];

      // Fallback to stock_take_items if new table is empty
      if (finalTakeItems.length === 0) {
        const { data: legacyItems } = await supabase
          .from('stock_take_items')
          .select('*')
          .eq('stock_take_id', id);
        if (legacyItems && legacyItems.length > 0) {
          finalTakeItems = legacyItems;
        }
      }

      if (finalTakeItems.length > 0) {
        // Fetch item details
        const itemIds = finalTakeItems.map(i => i.item_id || (i as any).store_item_id).filter(id => id);
        const { data: invItems } = await supabase
          .from('store_items')
          .select('id, name, item_code, unit')
          .in('id', itemIds);

        items = finalTakeItems.map(ti => {
          const inv = invItems?.find(i => i.id === (ti.item_id || (ti as any).store_item_id));
          return {
            ...ti,
            name: inv?.name || 'Unknown Item',
            item_sku: inv?.item_code || '—',
            system_quantity: (ti.system_quantity !== undefined ? ti.system_quantity : (ti as any).expected_quantity) || 0
          };
        });
      }
    } else {
      const bId = branch_id || user?.branch_id || 1;
      const { data: branch , error } = await supabase.from('branches').select('name').eq('id', bId).single();
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      if (branch) branchName = branch.name;

      const { data: branchStock, error: stockError } = await supabase
        .from('branch_stock')
        .select('*')
        .eq('branch_id', bId)
        .order('quantity', { ascending: true });
      if (stockError) throw stockError;

      const skus = (branchStock || []).map((s: any) => s.item_sku);
      let itemDetails: any[] = [];
      if (skus.length > 0) {
        const { data: simpleItems } = await supabase
          .from('simple_items')
          .select('sku, item_name, category, unit_of_measure')
          .in('sku', skus);
        itemDetails = simpleItems || [];
      }

      let filteredStock = branchStock || [];
      if (category && category !== 'ALL') {
        const catSkus = new Set(itemDetails.filter((i: any) => i.category === category).map((i: any) => i.sku));
        filteredStock = filteredStock.filter((s: any) => catSkus.has(s.item_sku));
      }

      items = filteredStock.map((s: any) => {
        const inv = itemDetails.find((i: any) => i.sku === s.item_sku);
        return {
          name: inv?.item_name || s.item_sku,
          item_sku: s.item_sku,
          system_quantity: s.quantity || 0
        };
      });
      title = `Inventory Count Worksheet${category ? ` - ${category}` : ''}`;
    }

    const { generateStockTakeWorksheetPDF } = await import('../../services/native-pdf-reports.service');
    await generateStockTakeWorksheetPDF(res, {
      title,
      branchName,
      items,
      generatedBy: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'System'
    });
  } catch (error: any) {
    logger.error('Error generating worksheet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const completeStockTake = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.id;

    // Get the stock count (without problematic joins)
    const { data: counts, error: countError } = await supabase
      .from('stock_counts')
      .select('*')
      .eq('id', id);

    if (countError) throw countError;
    if (!counts || counts.length === 0) return res.status(404).json({ success: false, message: 'Stock count not found' });

    const count = counts[0];
    const items = await getEnrichedStockCountItems(id, count.branch_id);
    const uncounted = items.filter((item: any) => item.counted_quantity === null || item.counted_quantity === undefined);
    if (uncounted.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Complete physical counts for all items before submitting. Missing: ${uncounted.length}`,
      });
    }

    const unexplained = items.filter((item: any) =>
      toNumber(item.variance) !== 0 && !(`${item.variance_reason || item.reason || ''}`.trim())
    );
    if (unexplained.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Explain all stock variances before submitting. Missing explanations: ${unexplained.length}`,
      });
    }

    await recalculateStockCountTotals(id);

    const isAccountant = user?.role === UserRole.BRANCH_ACCOUNTANT || user?.role === UserRole.ACCOUNTANT;
    const nextStatus = isAccountant ? 'submitted' : 'submitted_to_accountant';
    const updatePayload: any = {
      status: nextStatus,
      counted_by: userId,
      updated_at: new Date().toISOString()
    };

    if (isAccountant) {
      updatePayload.accountant_submitted_by = userId;
      updatePayload.accountant_submitted_at = new Date().toISOString();
    } else {
      updatePayload.submitted_to_accountant_by = userId;
      updatePayload.submitted_to_accountant_at = new Date().toISOString();
    }

    const { data: updatedCounts, error: updateError } = await supabase
      .from('stock_counts')
      .update(updatePayload)
      .eq('id', id)
      .select();

    if (updateError) throw updateError;
    const updatedCount = (updatedCounts && updatedCounts.length > 0) ? updatedCounts[0] : count;

    // Create approval request for the next review stage
    const { error } = await supabase.from('approval_requests').insert({
      request_type: 'stock_take',
      status: 'pending',
      branch_id: count.branch_id,
      requested_by: userId,
      description: isAccountant
        ? `Auditor review required for ${count.store_type || 'branch'} stock take: ${count.count_number || id}`
        : `Branch accountant review required for ${count.store_type || 'branch'} stock take: ${count.count_number || id}`,
      metadata: { stock_count_id: id, review_stage: isAccountant ? 'auditor' : 'branch_accountant' }
    });

    if (error) {

      console.error('Database error:', error);

      throw error;

    }

    res.json({
      success: true,
      message: isAccountant
        ? 'Stock take submitted to auditor'
        : 'Stock take submitted to branch accountant',
      data: updatedCount
    });

    logger.info(`Stock count ${id} submitted with status ${nextStatus} by ${userId}`);

    const notifyRole = isAccountant ? 'auditor' : 'branch_accountant';
    notificationService.notifyRole(
      notifyRole,
      isAccountant ? 'Stock Take Ready for Audit' : 'Stock Take Ready for Accounting Review',
      `A ${count.store_type || 'branch'} stock take (${count.count_number || id}) has been submitted.`,
      {
        type: 'warning',
        category: 'audit',
        priority: 'medium',
        actionUrl: `/dashboard/branch-store/stock-takes/${id}`,
        metadata: { stock_count_id: id, type: 'stock_take', review_stage: isAccountant ? 'auditor' : 'branch_accountant' }
      }
    ).catch(e => logger.error('Failed to notify stock take reviewer', e));
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
