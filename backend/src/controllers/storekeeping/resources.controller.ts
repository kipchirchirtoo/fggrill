import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import * as BranchInventoryService from '../../services/branch-inventory.service';
import { logger } from '../../utils/logger';
import notificationService from '../../services/notification.service';
import { UserRole } from '../../models/User';
import pool from '../../db';
import { isGlobalRole } from '../../utils/branchIsolation';
import { isWarehouseUserContext } from '../../services/inventory-warehouse.service';

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

    const validStatuses = ['active', 'maintenance', 'retired'];
    const normalizedStatus = status ? (String(status).toLowerCase() as string) : 'active';
    const safeStatus = validStatuses.includes(normalizedStatus) ? normalizedStatus : 'active';

    const { data, error } = await supabase
      .from('vehicles')
      .insert([{ registration_number, make, model, type, capacity_kg, status: safeStatus, insurance_expiry: insurance_expiry || null, notes }])
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

    const validStatuses = ['active', 'maintenance', 'retired'];
    const normalizedStatus = status ? String(status).toLowerCase() : undefined;
    const safeStatus = normalizedStatus && validStatuses.includes(normalizedStatus) ? normalizedStatus : undefined;

    const updatePayload: any = { registration_number, make, model, type, capacity_kg, insurance_expiry: insurance_expiry || null, notes, updated_at: new Date().toISOString() };
    if (safeStatus !== undefined) updatePayload.status = safeStatus;

    const { data, error } = await supabase
      .from('vehicles')
      .update(updatePayload)
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
      .select('id, first_name, last_name, phone, position, employment_status, national_id')
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
      status: s.employment_status === 'active' ? 'active' : 'inactive',
      source: 'staff',
      position: s.position || 'Driver',
      employee_id: s.national_id || null,
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
    const isCentral = isWarehouseUserContext(user) || (!userBranchId && isGlobalRole(user?.role));

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
      } else if (scope === 'all') {
        query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
      } else {
        // Default: strictly separate branch vs central (global) - see own branch only
        query = query.eq('branch_id', branchId);
      }
    } else {
      // Central users: default to central/global suppliers (branch_id IS NULL)
      // Allow explicit branch lookup only when a specific branchId query param is provided
      const requestedBranch = req.query.branchId || req.query.branch_id;
      if (scope === 'branch' && requestedBranch) {
        query = query.eq('branch_id', Number(requestedBranch));
      } else if (scope === 'all') {
        // Central users see all suppliers when scope is 'all'
        // Do not apply any branch_id filter
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
    const isCentral = !userBranchId || isGlobalRole(user?.role);


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
      // Each delete is wrapped in its own BEGIN/EXCEPTION block so missing tables/columns
      // (from migrations not yet applied) won't abort the whole transaction.
      // Catching OTHERS to handle both undefined_table AND undefined_column errors
      await client.query(`
        DO $$
        DECLARE
          v_id UUID := current_setting('app.delete_supplier_id')::UUID;
        BEGIN
          -- Delete only from tables that exist in new database schema
          
          -- 1. GRN items then GRNs (these tables exist)
          BEGIN
            DELETE FROM store_grn_items 
            WHERE grn_id IN (SELECT id FROM store_grn WHERE supplier_id = v_id);
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            DELETE FROM store_grn WHERE supplier_id = v_id;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          -- 2. PO items then purchase orders (these tables exist)
          BEGIN
            DELETE FROM store_po_items 
            WHERE po_id IN (SELECT id FROM store_purchase_orders WHERE supplier_id = v_id);
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            DELETE FROM store_purchase_orders WHERE supplier_id = v_id;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          -- 3. Procurement audit logs (this table exists)
          BEGIN
            DELETE FROM store_procurement_audit_logs WHERE supplier_id = v_id;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;

          -- 4. Finally delete the supplier
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
// STOCK TAKES (Aligned with stock_takes schema)
// =====================================================

const toNumber = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const resolveStockCountBranchId = async (stockCountId: string): Promise<number | null> => {
  const { data, error } = await supabase
    .from('stock_takes')
    .select('branch_id')
    .eq('id', stockCountId)
    .maybeSingle();

  if (error) throw error;
  return data?.branch_id ? Number(data.branch_id) : null;
};

const normalizeStoreType = (value: any): string => {
  const raw = `${value || 'foodstuffs'}`.toLowerCase();
  if (['restaurant', 'restaurant_store', 'restaurant_inventory'].includes(raw)) return 'restaurant_store';
  if (['bar', 'bars', 'bar_store', 'executive_bar', 'main_bar', 'sports_bar'].includes(raw)) {
    return 'bar_store';
  }
  if (['sports_bar', 'sports_bar_stock_take'].includes(raw)) return 'sports_bar';
  if (['main_bar_stock_take'].includes(raw)) return 'main_bar';
  if (['executive_bar_stock_take'].includes(raw)) return 'executive_bar';
  if (['kitchen_shift_a', 'shift_a', 'kitchen_a'].includes(raw)) return 'kitchen_shift_a';
  if (['kitchen_shift_b', 'shift_b', 'kitchen_b'].includes(raw)) return 'kitchen_shift_b';
  if (['kitchen_production', 'production'].includes(raw)) return 'kitchen_production';
  if (['housekeeping', 'housekeeping_stock_take'].includes(raw)) return 'housekeeping';
  if (['spa', 'spa_sauna', 'spa_stock_take'].includes(raw)) return 'spa_sauna';
  if (['pos', 'pos_outlet', 'pos_outlet_stock_take'].includes(raw)) return 'pos_outlet';
  if (['general', 'general_stock_take'].includes(raw)) return 'general';
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

  if (['bar_store', 'main_bar', 'executive_bar', 'sports_bar'].includes(storeType)) return isBarItem;
  if (storeType === 'foodstuffs' || storeType === 'restaurant_store') return !isBarItem;
  return true;
};

const editableStockCountStatuses = new Set(['draft']);
const submittedStockCountStatuses = new Set(['submitted', 'submitted_to_accountant']);
const accountantReviewStatuses = new Set(['submitted', 'submitted_to_accountant', 'under_review']);
const auditorReviewStatuses = new Set(['accountant_approved', 'auditor_review', 'submitted']);

const stockTakeStatusLabel = (status: any): string => {
  const value = `${status || ''}`.toLowerCase();
  if (value === 'submitted_to_accountant') return 'submitted';
  if (value === 'approved') return 'auditor_approved';
  if (value === 'rejected') return 'accountant_rejected';
  return value || 'draft';
};

const varianceSeverity = (variancePct: number): string => {
  const abs = Math.abs(variancePct);
  if (abs >= 10) return 'red';
  if (abs >= 5) return 'amber';
  return 'green';
};

const getDayBounds = (date?: string) => {
  const day = date || new Date().toISOString().split('T')[0];
  return {
    day,
    start: `${day}T00:00:00.000Z`,
    end: `${day}T23:59:59.999Z`
  };
};

/**
 * Get live branch stock from the new inventory_balances schema.
 * Returns a Map of SKU -> { quantity, item_name, category, unit, cost_price, ... }
 * Falls back to empty map if no branch_store location or no balances.
 */
async function getLiveBranchStockBySku(branchId: number): Promise<Map<string, any>> {
  const { data: locRows } = await supabase
    .from('inventory_locations')
    .select('id')
    .eq('branch_id', branchId)
    .eq('location_type', 'branch_store')
    .limit(1);

  const locationId = locRows?.[0]?.id;
  if (!locationId) return new Map();

  const { data: balances, error: balError } = await supabase
    .from('inventory_balances')
    .select('item_id, current_quantity, unit_cost')
    .eq('location_id', locationId);

  if (balError || !balances || balances.length === 0) return new Map();

  const itemIds = balances.map((b: any) => b.item_id);
  const { data: invItems, error: itemsError } = await supabase
    .from('inventory_items')
    .select('id, sku, item_name, category, unit, default_unit_cost, reorder_level')
    .in('id', itemIds);

  if (itemsError || !invItems) return new Map();

  const itemById = new Map(invItems.map((i: any) => [i.id, i]));
  const result = new Map<string, any>();

  for (const bal of balances) {
    const invItem = itemById.get(bal.item_id);
    if (!invItem?.sku) continue;

    const sku = invItem.sku;
    const existing = result.get(sku);
    const qty = toNumber(bal.current_quantity);

    if (existing) {
      existing.quantity = existing.quantity + qty;
    } else {
      result.set(sku, {
        item_sku: sku,
        quantity: qty,
        item_name: invItem.item_name,
        description: invItem.description,
        category: invItem.category,
        unit_of_measure: invItem.unit,
        cost_price: toNumber(bal.unit_cost) || toNumber(invItem.default_unit_cost),
        reorder_level: toNumber(invItem.reorder_level),
        store_type: null,
      });
    }
  }

  return result;
}

const seedStockCountItemsFromBranchStock = async (
  stockCountId: string,
  branchId: number,
  storeType = 'foodstuffs',
  countDate?: string,
  selectedSkus?: string[] | null
): Promise<void> => {
  // When the storekeeper hand-picks which master-inventory items belong on the
  // sheet, restrict the seed to those SKUs and bypass the store_type matcher
  // (the explicit selection is authoritative).
  const selectedSet = (selectedSkus && selectedSkus.length)
    ? new Set(selectedSkus.map((s) => `${s}`.trim()).filter(Boolean))
    : null;
  const { data: existing, error: existingError } = await supabase
    .from('stock_take_lines')
    .select('id')
    .eq('stock_count_id', stockCountId)
    .limit(1);

  if (existingError) throw existingError;
  if (existing && existing.length > 0) return;

  const normalizedStoreType = normalizeStoreType(storeType);
  const { day, start, end } = getDayBounds(countDate);

  // ─────────────────────────────────────────────────────────────────────────
  // 1. New inventory_balances schema (source of truth since Phase-3 migration)
  // ─────────────────────────────────────────────────────────────────────────
  const inventoryBySku = await getLiveBranchStockBySku(branchId);
  let stockRows: any[] = [];
  let simpleBySku = new Map<string, any>();

  if (inventoryBySku.size > 0) {
    stockRows = Array.from(inventoryBySku.values()).map((detail) => ({
      item_sku: detail.item_sku,
      quantity: detail.quantity,
    }));
    simpleBySku = inventoryBySku;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Legacy branch_stock fallback
  // ─────────────────────────────────────────────────────────────────────────
  if (stockRows.length === 0) {
    const { data: branchStock, error: stockError } = await supabase
      .from('branch_stock')
      .select('item_sku, quantity')
      .eq('branch_id', branchId)
      .order('item_sku');

    if (stockError) throw stockError;
    stockRows = branchStock || [];

    const initialSkus = stockRows.map((item: any) => item.item_sku).filter(Boolean);
    const { data: simpleItems, error: itemsError } = await supabase
      .from('simple_items')
      .select('sku, item_name, description, category, unit_of_measure, cost_price, store_type')
      .in('sku', initialSkus.length > 0 ? initialSkus : ['__none__']);

    if (itemsError) throw itemsError;
    let simpleRows = simpleItems || [];
    simpleBySku = new Map(simpleRows.map((item: any) => [item.sku, item]));

    if (stockRows.length === 0) {
      const { data: branchItems, error: branchItemsError } = await supabase
        .from('simple_items')
        .select('sku, item_name, description, category, unit_of_measure, cost_price, store_type')
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
          .select('sku, item_name, description, category, unit_of_measure, cost_price, store_type')
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
  }

  // Explicit selection: guarantee every chosen SKU appears on the sheet (with a
  // 0 quantity if the branch has no stock row for it yet), and pull in any
  // catalog details that weren't already loaded.
  if (selectedSet) {
    const quantityBySku = new Map(stockRows.map((item: any) => [item.item_sku, item.quantity]));
    const missingDetailSkus = [...selectedSet].filter((sku) => !simpleBySku.has(sku));
    if (missingDetailSkus.length > 0) {
      const { data: extraItems, error: extraError } = await supabase
        .from('simple_items')
        .select('sku, item_name, description, category, unit_of_measure, cost_price, store_type')
        .in('sku', missingDetailSkus);
      if (extraError) throw extraError;
      (extraItems || []).forEach((item: any) => simpleBySku.set(item.sku, item));
    }
    stockRows = [...selectedSet].map((sku) => ({
      item_sku: sku,
      quantity: toNumber(quantityBySku.get(sku)),
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

  // Non-fatal: if branch_stock_movements is missing or has schema issues, proceed with empty movements
  if (movementError) {
    logger.warn('branch_stock_movements query failed (using empty movements):', movementError.message);
  }

  const movementBySku = new Map<string, any[]>();
  (movements || []).forEach((movement: any) => {
    const list = movementBySku.get(movement.item_sku) || [];
    list.push(movement);
    movementBySku.set(movement.item_sku, list);
  });

  let rows = stockRows
    .filter((item: any) => {
      if (selectedSet) return selectedSet.has(item.item_sku);
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
        stock_take_id: stockCountId,
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
        stock_take_id: stockCountId,
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
        variance_reason: null,
      };
    });
  }

  if (rows.length === 0) {
    logger.info(`No ${normalizedStoreType} branch stock rows found for branch ${branchId} on ${day}`);
    return;
  }

  const { error: insertError } = await supabase
    .from('stock_take_lines')
    .insert(rows);

  if (insertError) {
    // The richer columns (store_type, opening_stock, additions, issued_quantity,
    // system_closing_stock, cost_price, variance_reason) are added by migrations
    // that may not be applied on every environment. Retry with the minimal,
    // always-present column set so branch stock taking still works.
    if (insertError.code === '42703' || /column/i.test(insertError.message || '')) {
      logger.warn(
        'stock_take_lines full insert failed, retrying with minimal columns:',
        insertError.message
      );
      const minimalRows = rows.map((r: any) => ({
        stock_take_id: r.stock_take_id || r.stock_count_id,
        stock_count_id: r.stock_count_id,
        item_sku: r.item_sku,
        item_id: r.item_id,
        system_quantity: r.system_quantity,
        physical_quantity: r.physical_quantity,
        unit_cost: r.unit_cost,
      }));
      const { error: minimalError } = await supabase
        .from('stock_take_lines')
        .insert(minimalRows);
      if (minimalError) throw minimalError;
    } else {
      throw insertError;
    }
  }
};

const recalculateStockCountTotals = async (stockCountId: string): Promise<void> => {
  // Non-fatal: totals are a convenience aggregate. A failure here (e.g. missing
  // columns on a not-yet-migrated environment) must never break count save/load.
  try {
    const { data: items, error } = await supabase
      .from('stock_take_lines')
      .select('item_sku, physical_quantity, system_quantity, system_closing_stock, cost_price, unit_cost, issued_quantity')
      .eq('stock_count_id', stockCountId);

    if (error) {
      logger.warn('recalculateStockCountTotals select failed (skipped):', error.message);
      return;
    }

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

    for (const item of items || []) {
      const systemClosing = toNumber(item.system_closing_stock ?? item.system_quantity);
      const physical = item.physical_quantity === null || item.physical_quantity === undefined
        ? systemClosing
        : toNumber(item.physical_quantity);
      const variance = physical - systemClosing;
      const percentage = systemClosing === 0 ? (variance === 0 ? 0 : 100) : (variance / systemClosing) * 100;
      await supabase
        .from('stock_take_lines')
        .update({
          variance_percentage: Number(percentage.toFixed(2)),
          variance_severity: varianceSeverity(percentage),
        })
        .eq('stock_count_id', stockCountId)
        .eq('item_sku', (item as any).item_sku);
    }

    const { error: updateError } = await supabase
      .from('stock_takes')
      .update(totals)
      .eq('id', stockCountId);

    if (updateError) {
      logger.warn('recalculateStockCountTotals update failed (skipped):', updateError.message);
    }
  } catch (e: any) {
    logger.warn('recalculateStockCountTotals threw (skipped):', e?.message || e);
  }
};

export const getEnrichedStockCountItems = async (
  stockCountId: string,
  branchId?: number | null
): Promise<any[]> => {
  const itemResult = await supabase
    .from('stock_take_lines')
    .select('*')
    .eq('stock_count_id', stockCountId)
    .order('created_at', { ascending: true });

  if (itemResult.error) throw itemResult.error;
  let items = itemResult.data;

  if ((!items || items.length === 0) && branchId) {
    try {
      const { data: count } = await supabase
        .from('stock_takes')
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
        .from('stock_take_lines')
        .select('*')
        .eq('stock_count_id', stockCountId)
        .order('created_at', { ascending: true });
      if (seeded.error) throw seeded.error;
      items = seeded.data || [];
    } catch (seedErr: any) {
      // Non-fatal: return whatever exists rather than 500. The sheet can be
      // re-seeded on next open once data/migrations catch up.
      logger.warn('Stock count seeding failed (returning current items):', seedErr?.message || seedErr);
      items = items || [];
    }
  }

  if (!items || items.length === 0) return [];

  const itemSkus = [...new Set(items.map((item: any) => item.item_sku).filter(Boolean))];
  const itemIds = [...new Set(items.map((item: any) => item.item_id).filter(Boolean))];

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch live inventory data from the new schema (inventory_balances)
  // ─────────────────────────────────────────────────────────────────────────
  let liveStockBySku = new Map<string, number>();
  let inventoryBySku = new Map<string, any>();

  if (branchId) {
    const invStock = await getLiveBranchStockBySku(branchId);
    for (const [sku, detail] of invStock) {
      liveStockBySku.set(sku, detail.quantity);
    }
    inventoryBySku = invStock;
  }

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

    const simpleBySku = new Map((simpleItems || []).flatMap((item: any) => {
      const sku = `${item.sku || ''}`.trim();
      return sku ? [[sku, item], [sku.toLowerCase(), item]] : [];
    }));
    const storeById = new Map((storeItems || []).map((item: any) => [item.id, item]));

  return items.map((item: any) => {
    const rawSku = `${item.item_sku || ''}`.trim();
    const simple = rawSku ? (simpleBySku.get(rawSku) || simpleBySku.get(rawSku.toLowerCase())) : null;
    const store = item.item_id ? storeById.get(item.item_id) : null;
    const inv = rawSku ? inventoryBySku.get(rawSku) || inventoryBySku.get(rawSku.toLowerCase()) : null;
    const physical = item.physical_quantity;
    const counted = physical === null || physical === undefined ? null : toNumber(physical);

    // Use live inventory_balances data when the stored system_closing_stock
    // is 0 but live stock exists (indicates stale seeding from legacy branch_stock).
    const liveQuantity = rawSku ? (liveStockBySku.get(rawSku) ?? null) : null;
    let systemClosing = toNumber(item.system_closing_stock ?? item.system_quantity);
    if (systemClosing === 0 && liveQuantity !== null && liveQuantity > 0) {
      systemClosing = liveQuantity;
    }

    const unitCost = toNumber(
      item.unit_cost ?? inv?.cost_price ?? simple?.cost_price
    );
    const variance = counted === null ? null : counted - systemClosing;
    const variancePct = variance === null
      ? null
      : systemClosing === 0
        ? (variance === 0 ? 0 : 100)
        : (variance / systemClosing) * 100;
    const itemSku = rawSku || store?.item_code || item.item_id;
    const itemName = item.item_name || item.name || item.description ||
      inv?.item_name || simple?.item_name || simple?.description || store?.name || itemSku || 'Unknown Item';
    let additions = toNumber(item.additions ?? item.added_quantity ?? item.transfers_in);
    const issuedQuantity = toNumber(item.issued_quantity ?? item.sales_quantity ?? item.quantity_issued);
    let openingStock = toNumber(item.opening_stock ?? item.opening_quantity);
    if (openingStock === 0 && additions === 0 && issuedQuantity === 0 && systemClosing > 0) {
      openingStock = systemClosing;
    }

    // Fallback: infer additions from system_closing - opening + issued when stored is 0.
    // This handles cases where branch_stock_movements is empty or the additions
    // column wasn't populated during seeding.
    if (additions === 0 && systemClosing > 0) {
      const inferred = systemClosing - openingStock + issuedQuantity;
      if (inferred > 0) additions = inferred;
    }

    return {
      ...item,
      item_sku: itemSku,
      item_name: itemName,
      unit: item.unit_of_measure || item.unit || (inv?.unit_of_measure || simple?.unit_of_measure) || store?.unit || 'pcs',
      unit_of_measure: item.unit_of_measure || item.unit || (inv?.unit_of_measure || simple?.unit_of_measure) || store?.unit || 'pcs',
      category: item.category || (inv?.category || simple?.category) || simple?.store_type || store?.category || null,
      store_type: item.store_type || simple?.store_type || null,
      opening_stock: openingStock,
      additions,
      issued_quantity: issuedQuantity,
      system_closing_stock: systemClosing,
      system_quantity: systemClosing,
      physical_quantity: counted,
      counted_quantity: counted,
      actual_quantity: counted,
      variance,
      variance_value: variance === null ? null : variance * unitCost,
      variance_percentage: variancePct === null ? null : Number(variancePct.toFixed(2)),
      variance_severity: variancePct === null ? 'pending' : varianceSeverity(variancePct),
      cost_price: unitCost,
      selling_price: toNumber(item.selling_price ?? item.unit_price ?? item.price),
      cogs_value: toNumber(item.issued_quantity) * unitCost,
      variance_reason: item.variance_reason || item.reason || null,
      explanation: item.explanation || null,
      action_taken: item.action_taken || null,
      status: counted === null ? 'PENDING' : 'COUNTED',
      item: {
        id: item.item_id,
        sku: itemSku,
        item_code: itemSku,
        name: itemName,
        item_name: itemName,
        category: (inv?.category || simple?.category) || store?.category || null,
        unit: (inv?.unit_of_measure || simple?.unit_of_measure) || store?.unit || 'pcs',
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
      .from('stock_takes')
      .select('*')
      .order('count_date', { ascending: false });

    if (effectiveBranchId) query = query.eq('branch_id', effectiveBranchId);
    if (status) query = query.eq('status', status);
    if (store_type && store_type !== 'all') query = query.eq('store_type', normalizeStoreType(store_type));
    if (date) query = query.eq('count_date', date);

    const { data, error } = await query;

    if (error) throw error;

    // Fetch branch names separately to avoid schema cache join issues
    const branchIds = [...new Set((data || []).map((item: any) => item.branch_id).filter(Boolean))];
    let branchMap: Record<string, any> = {};
    if (branchIds.length > 0) {
      const { data: branches } = await supabase
        .from('branches')
        .select('id, name, code')
        .in('id', branchIds);
      branchMap = (branches || []).reduce((acc: any, b: any) => {
        acc[String(b.id)] = b;
        return acc;
      }, {});
    }

    // Enrich data with branch info
    const dataWithBranch = (data || []).map((item: any) => ({
      ...item,
      branch: branchMap[String(item.branch_id)] || null,
    }));

    // Manually fetch user details to avoid ambiguous relationship errors
    const userIds = new Set<string>();
    (data || []).forEach((item: any) => {
      if (item.prepared_by) userIds.add(item.prepared_by);
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
    const enrichedData = (dataWithBranch || []).map((item: any) => {
      let started_by_name = 'System';
      let completed_by_name = 'System';

      if (item.prepared_by && usersMap[item.prepared_by]) {
        const u = usersMap[item.prepared_by];
        started_by_name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'System';
      }

      if (item.counted_by && usersMap[item.counted_by]) {
        const u = usersMap[item.counted_by];
        completed_by_name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'System';
      }

      return {
        ...item,
        workflow_status: stockTakeStatusLabel(item.status),
        take_number: item.count_number,
        take_type: item.count_type,
        store_type: item.store_type || 'foodstuffs',
        outlet_code: item.outlet_code,
        started_by: started_by_name,
        completed_by: completed_by_name,
        // Aligned with what frontend might expect
        started_at: item.created_at,
        completed_at: submittedStockCountStatuses.has(`${item.status}`) ? item.updated_at : null
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
      .from('stock_takes')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Stock take not found' });
      }
      throw error;
    }

    // Fetch branch name separately to avoid schema cache join issues
    let branchData = null;
    if ((data as any).branch_id) {
      const { data: branch } = await supabase
        .from('branches')
        .select('id, name, code')
        .eq('id', (data as any).branch_id)
        .maybeSingle();
      branchData = branch;
    }
    (data as any).branch = branchData;

    // Manually fetch user details to avoid ambiguous relationship errors
    const userIds = new Set<string>();
    if ((data as any).prepared_by) userIds.add((data as any).prepared_by);
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

    if ((data as any).prepared_by && usersMap[(data as any).prepared_by]) {
      const u = usersMap[(data as any).prepared_by];
      started_by_name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'System';
    }

    if ((data as any).counted_by && usersMap[(data as any).counted_by]) {
      const u = usersMap[(data as any).counted_by];
      completed_by_name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'System';
    }

    const enrichedResult = {
      ...data,
      workflow_status: stockTakeStatusLabel((data as any).status),
      take_number: (data as any).count_number || (data as any).take_number,
      take_type: (data as any).count_type || (data as any).take_type,
      total_variance_value: totalVarianceValue,
      items_with_variance: itemsWithVarianceCount,
      total_items_counted: enrichedItems.length,
      started_by: started_by_name,
      completed_by: completed_by_name,
      started_at: (data as any).created_at,
      completed_at: submittedStockCountStatuses.has(`${(data as any).status}`) ? (data as any).updated_at : null,
      items: enrichedItems
    };

    res.json({ success: true, data: enrichedResult });
  } catch (error: any) {
    logger.error('getStockTake error:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
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
    // Optional: storekeeper hand-picks which master-inventory items go on the
    // sheet. Accept `item_skus` (preferred) or `selected_skus`.
    const rawSelected = req.body.item_skus ?? req.body.selected_skus;
    const selectedSkus: string[] | null = Array.isArray(rawSelected)
      ? rawSelected.map((s: any) => `${s}`.trim()).filter(Boolean)
      : null;

    // Enforce branch from user profile for non-admins
    if (user && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.GENERAL_MANAGER) {
      branch_id = user.branch_id || user.branchId;
    }

    if (!branch_id) {
      return res.status(400).json({ success: false, message: 'Branch is required' });
    }

    const existingQuery = supabase
      .from('stock_takes')
      .select('*')
      .eq('branch_id', branch_id)
      .eq('count_date', countDate)
      .eq('store_type', storeType)
      .eq('count_type', count_type || 'daily')
      .in('status', [
        'draft',
        'submitted',
        'under_review',
        'accountant_approved',
        'auditor_review',
        'submitted_to_accountant',
      ]);

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
      .from('stock_takes')
      .insert([{
        branch_id,
        count_date: countDate,
        count_type: count_type || 'daily',
        store_type: storeType,
        outlet_code: outlet_code || null,
        status: 'draft',
        notes,
        prepared_by: userId // Ensure the person who starts the count is recorded
      }])
      .select()
      .single();

    if (countError) throw countError;

    try {
      await seedStockCountItemsFromBranchStock(count.id, Number(branch_id), storeType, countDate, selectedSkus);
      await recalculateStockCountTotals(count.id);
    } catch (seedErr: any) {
      // Non-fatal: stock take header was created; items can be seeded on next GET
      logger.warn(`Stock count ${count.id} item seeding failed (will retry on first GET): ${seedErr.message}`);
    }

    res.status(201).json({ success: true, data: count });
    logger.info(`Stock count session created: ${count.id} for branch ${branch_id}`);
  } catch (error: any) {
    logger.error('createStockTake error:', error.message, error.details || '');
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
    logger.error('getStockTakeItems error:', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
    });
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStockTakeItem = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { physical_quantity, actual_quantity, reason, variance_reason, explanation, action_taken } = req.body;

    // Support both field names for flexibility
    const newQuantity = physical_quantity !== undefined ? physical_quantity : actual_quantity;

    const { data: current, error: currentError } = await supabase
      .from('stock_take_lines')
      .select('id, stock_count_id')
      .eq('id', id)
      .single();

    if (currentError) throw currentError;

    const { data: parentCount, error: parentError } = await supabase
      .from('stock_takes')
      .select('status')
      .eq('id', current.stock_count_id)
      .single();

    if (parentError) throw parentError;
    const parentStatus = `${parentCount?.status || ''}`;
    const userRole = (req as any).user?.role;
    const isAccountantOrAuditor = ['branch_accountant', 'super_admin', 'auditor'].includes(userRole);

    if (!editableStockCountStatuses.has(parentStatus) && !(parentStatus === 'submitted' && isAccountantOrAuditor)) {
      return res.status(409).json({
        success: false,
        message: 'Submitted stock takes are read-only and cannot be edited.',
      });
    }

    const updatePayload: any = {
      physical_quantity: newQuantity,
      reason: variance_reason || reason,
      variance_reason: variance_reason || reason,
      updated_at: new Date().toISOString()
    };
    if (explanation !== undefined) updatePayload.explanation = explanation;
    if (action_taken !== undefined) updatePayload.action_taken = action_taken;

    const { data, error } = await supabase
      .from('stock_take_lines')
      .update(updatePayload)
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

export const updateStockTake = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { status, notes, items } = req.body;
    const userId = (req as any).user?.id;

    // Bar stocktake annotations: the accountant review screen reuses this
    // generic endpoint, but bar counts live in bar_stocktake_records (not
    // stock_takes). If the id is a bar record, persist explanation/action_taken
    // there and return. The frontend loops one call per record id (each with the
    // full items payload), so update just THIS record using the payload entry
    // that matches its item_id — keeping it to one write per call.
    const { data: barRecord } = await supabase
      .from('bar_stocktake_records')
      .select('id, item_id, branch_id')
      .eq('id', id)
      .maybeSingle();
    if (barRecord) {
      const role = String((req as any).user?.role || '').toLowerCase();
      const userBranch = Number((req as any).user?.branch_id ?? (req as any).user?.branchId);
      const globalRole = ['super_admin', 'auditor', 'general_manager'].includes(role);
      if (!globalRole && Number.isInteger(userBranch) && Number(barRecord.branch_id) !== userBranch) {
        return res.status(403).json({ success: false, message: 'Forbidden: stocktake belongs to another branch' });
      }
      const match = Array.isArray(items)
        ? items.find((it: any) => String(it.id ?? it.item_id) === String(barRecord.item_id))
        : null;
      const barUpdate: any = {};
      const expl = match?.explanation ?? (notes !== undefined ? notes : undefined);
      if (expl !== undefined) barUpdate.explanation = expl || null;
      if (match?.action_taken !== undefined) barUpdate.action_taken = match.action_taken || null;
      if (Object.keys(barUpdate).length > 0) {
        const { error: barErr } = await supabase
          .from('bar_stocktake_records')
          .update(barUpdate)
          .eq('id', id);
        if (barErr) throw barErr;
      }
      return res.json({ success: true, message: 'Bar stocktake annotation saved' });
    }

    // Try new stock_takes table first, fall back to legacy stock_takes
    const { data: existingCount, error: existingCountError } = await supabase
      .from('stock_takes')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();

    if (existingCountError) throw existingCountError;

    let isLegacy = false;
    let count: any;

    if (!existingCount) {
      // Check legacy stock_takes table
      const { data: legacyTake, error: legacyError } = await supabase
        .from('stock_takes')
        .select('id, status')
        .eq('id', id)
        .maybeSingle();

      if (legacyError) throw legacyError;
      if (!legacyTake) {
        return res.status(404).json({ success: false, message: 'Stock take not found' });
      }
      isLegacy = true;
      count = legacyTake;
    } else {
      const currentStatus = `${existingCount.status}`;
      const userRole = (req as any).user?.role;
      const isAccountantOrAuditor = ['branch_accountant', 'super_admin', 'auditor'].includes(userRole);

      if (!editableStockCountStatuses.has(currentStatus) && !(currentStatus === 'submitted' && isAccountantOrAuditor)) {
        return res.status(409).json({
          success: false,
          message: 'Submitted stock takes are read-only. Request accountant/auditor action instead of editing counts.',
        });
      }
    }

    const updateData: any = { updated_at: new Date().toISOString() };
    if (status) {
      updateData.status = status;
      if (status === 'COMPLETED' || status === 'submitted') {
        updateData.counted_by = userId;
      }
    }
    if (notes !== undefined) updateData.notes = notes;

    // 1. Update header (skip for legacy records with no columns to update)
    if (!isLegacy) {
      const { data: counts, error: countError } = await supabase
        .from('stock_takes')
        .update(updateData)
        .eq('id', id)
        .select();

      if (countError) throw countError;
      count = counts?.[0] ?? existingCount;
    } else if (Object.keys(updateData).length > 0) {
      // Legacy header update
      const legacyHeaderUpdate: any = {};
      if (updateData.status) legacyHeaderUpdate.status = updateData.status;
      if (updateData.notes !== undefined) legacyHeaderUpdate.notes = updateData.notes;
      if (updateData.counted_by) legacyHeaderUpdate.completed_by = updateData.counted_by;
      if (Object.keys(legacyHeaderUpdate).length > 0) {
        await supabase.from('stock_takes').update(legacyHeaderUpdate).eq('id', id);
      }
    }

    // 2. Update items in bulk. The branch store count sheet is keyed by item_sku,
    // while older rows may still only have a stock_take_lines id.
    if (items && items.length > 0) {
      for (const item of items) {
        const countedQuantity =
          item.counted_quantity ?? item.physical_quantity ?? item.actual_quantity ?? null;
        const reason = item.variance_reason ?? item.reason ?? item.notes ?? null;
        const updatedAt = new Date().toISOString();
        const hasCount = countedQuantity !== null && countedQuantity !== undefined;

        const stockCountPayload: any = {
          physical_quantity: countedQuantity,
          variance_reason: reason,
          updated_at: updatedAt
        };
        if (item.explanation !== undefined) stockCountPayload.explanation = item.explanation;
        if (item.action_taken !== undefined) stockCountPayload.action_taken = item.action_taken;

        if (item.item_sku && (!item.id || String(item.id).startsWith('manual:'))) {
          const { data: existing, error: existingError } = await supabase
            .from('stock_take_lines')
            .select('id')
            .eq('stock_count_id', id)
            .eq('item_sku', item.item_sku)
            .maybeSingle();

          if (existingError) throw existingError;

          if (existing?.id) {
            const { error: updateError } = await supabase
              .from('stock_take_lines')
              .update(stockCountPayload)
              .eq('id', existing.id);

            if (updateError) throw updateError;
          } else {
            const { error: insertError } = await supabase
              .from('stock_take_lines')
              .insert({
                stock_take_id: id,
                stock_count_id: id,
                item_sku: item.item_sku,
                item_id: item.item_id || null,
                system_quantity: toNumber(item.system_quantity),
                physical_quantity: countedQuantity,
                unit_cost: toNumber(item.unit_cost),
                cost_price: toNumber(item.cost_price ?? item.unit_cost),
                variance_reason: reason,
                explanation: item.explanation || null,
                action_taken: item.action_taken || null
              });

            if (insertError) throw insertError;
          }

          continue;
        }

        if (!item.id) continue;

        const { error: countItemError } = await supabase
          .from('stock_take_lines')
          .update(stockCountPayload)
          .eq('id', item.id);

        if (countItemError) {
          logger.warn(`Could not update stock_take_lines row ${item.id}: ${countItemError.message}`);
        }

        const legacyPayload: any = {
          counted_quantity: countedQuantity,
          variance_reason: reason,
          notes: item.notes,
          status: hasCount ? 'COUNTED' : 'PENDING',
          updated_at: updatedAt
        };
        if (item.explanation !== undefined) legacyPayload.explanation = item.explanation;
        if (item.action_taken !== undefined) legacyPayload.action_taken = item.action_taken;

        const { error: legacyError } = await supabase
          .from('stock_take_lines')
          .update(legacyPayload)
          .eq('id', item.id);

        if (legacyError) {
          logger.warn(`Could not update stock_take_lines row ${item.id}: ${legacyError.message}`);
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
        .from('stock_takes')
        .select('*')
        .eq('id', id)
        .single();

      if (countError) throw countError;
      if (count?.branch_id) {
        const { data: branch } = await supabase.from('branches').select('name').eq('id', count.branch_id).maybeSingle();
        if (branch) branchName = branch.name;
      }
      title = `Stock Take Worksheet - ${count.count_number || id.substring(0,8)}`;

      items = await getEnrichedStockCountItems(id, Number(count.branch_id || branch_id || user?.branch_id));
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
          .select('sku, item_name, category, unit_of_measure, cost_price')
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
          item_name: inv?.item_name || s.item_sku,
          item_sku: s.item_sku,
          opening_stock: s.quantity || 0,
          system_quantity: s.quantity || 0,
          system_closing_stock: s.quantity || 0,
          cost_price: s.cost_price || inv?.cost_price || 0,
          unit_of_measure: inv?.unit_of_measure || s.unit || 'units',
          category: inv?.category || s.store_type || 'branch stock',
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

export const completeStockTake = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const user = (req as any).user;
    const userId = user?.id;

    // Get the stock count (without problematic joins)
    const { data: counts, error: countError } = await supabase
      .from('stock_takes')
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

    // Variance explanation is now done by the accountant during review, bypass this validation for storekeepers.
    /*
    const unexplained = items.filter((item: any) =>
      toNumber(item.variance) !== 0 && !(`${item.variance_reason || item.reason || ''}`.trim())
    );
    if (unexplained.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Explain all stock variances before submitting. Missing explanations: ${unexplained.length}`,
      });
    }
    */

    await recalculateStockCountTotals(id);

    if (!editableStockCountStatuses.has(`${count.status}`)) {
      return res.status(409).json({
        success: false,
        message: 'Only draft stock takes can be submitted by the storekeeper.',
      });
    }

    const nextStatus = 'submitted';
    const updatePayload: any = {
      status: nextStatus,
      counted_by: userId,
      updated_at: new Date().toISOString(),
      submitted_to_accountant_by: userId,
      submitted_to_accountant_at: new Date().toISOString()
    };

    const { data: updatedCounts, error: updateError } = await supabase
      .from('stock_takes')
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
      description: `Branch accountant review required for ${count.store_type || 'branch'} stock take: ${count.count_number || id}`,
      metadata: { stock_count_id: id, review_stage: 'accountant' }
    });

    if (error) {

      console.error('Database error:', error);

      throw error;

    }

    res.json({
      success: true,
      message: 'Stock take submitted to branch accountant',
      data: updatedCount
    });

    logger.info(`Stock count ${id} submitted with status ${nextStatus} by ${userId}`);

    notificationService.notifyRole(
      'branch_accountant',
      'Stock Take Ready for Accountant Review',
      `A ${count.store_type || 'branch'} stock take (${count.count_number || id}) has been submitted for accountant review.`,
      {
        type: 'warning',
        category: 'audit',
        priority: 'medium',
        actionUrl: `/dashboard/branch-store/stock-takes/${id}`,
        metadata: { stock_count_id: id, type: 'stock_take', review_stage: 'accountant' }
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
