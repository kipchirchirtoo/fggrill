/**
 * Dispatches Controller
 * Handles dispatch creation, OTP verification, and document uploads
 */

import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { supabaseAdmin } from '../../config/supabase-admin';

/**
 * Create dispatch with dual OTP generation
 * POST /api/store/dispatches
 */
export const createDispatch = async (req: Request, res: Response) => {
  try {
    const { items, destination_branch, driver_id, notes } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    if (!destination_branch) {
      return res.status(400).json({ error: 'Destination branch is required' });
    }

    // Create dispatch
    const { data: dispatch, error: dispatchError } = await supabase
      .from('dispatches')
      .insert({
        destination_branch,
        driver_id,
        notes,
        created_by: userId,
        status: 'pending',
      })
      .select()
      .single();

    if (dispatchError || !dispatch) {
      return res.status(400).json({ error: 'Failed to create dispatch', details: dispatchError?.message });
    }

    // Insert dispatch items
    const dispatchItems = items.map((item: any) => ({
      dispatch_id: dispatch.id,
      item_id: item.item_id,
      quantity: item.quantity,
      notes: item.notes,
    }));

    const { error: itemsError } = await supabase
      .from('dispatch_items')
      .insert(dispatchItems);

    if (itemsError) {
      return res.status(400).json({ error: 'Failed to add items to dispatch', details: itemsError.message });
    }

    // Generate Driver OTP (D-XXXX) and Branch OTP (B-XXXX)
    const { data: driverOtp } = await supabase.rpc('generate_otp', { prefix: 'D' });
    const { data: branchOtp } = await supabase.rpc('generate_otp', { prefix: 'B' });

    // Set expiry to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Insert OTPs
    const { error: otpError } = await supabase
      .from('dispatch_otps')
      .insert({
        dispatch_id: dispatch.id,
        driver_otp: driverOtp,
        branch_otp: branchOtp,
        expires_at: expiresAt.toISOString(),
      });

    if (otpError) {
      return res.status(400).json({ error: 'Failed to generate OTPs', details: otpError.message });
    }

    // Log action
    await supabase.from('dispatch_audit_log').insert({
      dispatch_id: dispatch.id,
      action: 'created',
      performed_by: userId,
      notes: 'Dispatch created with dual OTP system',
    });

    return res.status(201).json({
      data: {
        ...dispatch,
        driver_otp: driverOtp,
        branch_otp: branchOtp,
        expires_at: expiresAt.toISOString(),
      },
      message: 'Dispatch created successfully with dual OTP',
    });
  } catch (error: any) {
    console.error('Error in createDispatch:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Get all dispatches (filtered by role)
 * GET /api/store/dispatches
 */
export const getDispatches = async (req: Request, res: Response) => {
  try {
    const { status, branch_id } = req.query;
    const userRole = (req as any).user?.role;
    const userBranch = (req as any).user?.branch_id;

    let query = supabase
      .from('dispatches')
      .select('*, dispatch_items(*, inventory_items(*)), dispatch_otps(*)')
      .order('created_at', { ascending: false });

    // Apply RLS filtering based on role
    if (userRole === 'branch_storekeeper' && userBranch) {
      query = query.eq('destination_branch', userBranch);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (branch_id) {
      query = query.eq('destination_branch', branch_id);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(400).json({ error: 'Failed to fetch dispatches', details: error.message });
    }

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('Error in getDispatches:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Get single dispatch details
 * GET /api/store/dispatches/:id
 */
export const getDispatchById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('dispatches')
      .select(`
        *,
        dispatch_items(*, inventory_items(*)),
        dispatch_otps(*),
        dispatch_documents(*),
        dispatch_audit_log(*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Dispatch not found' });
    }

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('Error in getDispatchById:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Verify Driver OTP (D-XXXX) - marks dispatch as "In Transit"
 * POST /api/store/dispatches/:id/verify-driver-otp
 */
export const verifyDriverOtp = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { driver_otp } = req.body;
    const userId = (req as any).user?.id;

    if (!driver_otp) {
      return res.status(400).json({ error: 'Driver OTP is required' });
    }

    // Validate OTP format (D-XXXX)
    if (!/^D-\d{4}$/.test(driver_otp)) {
      return res.status(400).json({ error: 'Invalid OTP format. Must be D-XXXX (e.g., D-1234)' });
    }

    // Get OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from('dispatch_otps')
      .select('*')
      .eq('dispatch_id', id)
      .eq('driver_otp', driver_otp)
      .single();

    if (otpError || !otpRecord) {
      return res.status(404).json({ error: 'Invalid OTP' });
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Check if already used
    if (otpRecord.driver_otp_used_at) {
      return res.status(400).json({ error: 'OTP has already been used' });
    }

    // Mark OTP as used
    await supabase
      .from('dispatch_otps')
      .update({ driver_otp_used_at: new Date().toISOString() })
      .eq('dispatch_id', id);

    // Update dispatch status to "in_transit"
    await supabase
      .from('dispatches')
      .update({
        status: 'in_transit',
        in_transit_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Log action
    await supabase.from('dispatch_audit_log').insert({
      dispatch_id: id,
      action: 'driver_otp_verified',
      performed_by: userId,
      notes: 'Driver OTP verified, dispatch marked as In Transit',
    });

    return res.status(200).json({ message: 'Driver OTP verified successfully', status: 'in_transit' });
  } catch (error: any) {
    console.error('Error in verifyDriverOtp:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Verify Branch OTP (B-XXXX) - marks dispatch as "Completed"
 * POST /api/store/dispatches/:id/verify-branch-otp
 */
export const verifyBranchOtp = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { branch_otp } = req.body;
    const userId = (req as any).user?.id;

    if (!branch_otp) {
      return res.status(400).json({ error: 'Branch OTP is required' });
    }

    // Validate OTP format (B-XXXX)
    if (!/^B-\d{4}$/.test(branch_otp)) {
      return res.status(400).json({ error: 'Invalid OTP format. Must be B-XXXX (e.g., B-1234)' });
    }

    // Get dispatch to check status
    const { data: dispatch } = await supabase
      .from('dispatches')
      .select('status')
      .eq('id', id)
      .single();

    if (!dispatch) {
      return res.status(404).json({ error: 'Dispatch not found' });
    }

    // Verify dispatch is in_transit (driver OTP must be used first)
    if (dispatch.status !== 'in_transit') {
      return res.status(400).json({ error: 'Dispatch must be in transit before branch verification' });
    }

    // Get OTP record
    const { data: otpRecord, error: otpError } = await supabase
      .from('dispatch_otps')
      .select('*')
      .eq('dispatch_id', id)
      .eq('branch_otp', branch_otp)
      .single();

    if (otpError || !otpRecord) {
      return res.status(404).json({ error: 'Invalid OTP' });
    }

    // Check if expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    // Check if already used
    if (otpRecord.branch_otp_used_at) {
      return res.status(400).json({ error: 'OTP has already been used' });
    }

    // Mark OTP as used
    await supabase
      .from('dispatch_otps')
      .update({ branch_otp_used_at: new Date().toISOString() })
      .eq('dispatch_id', id);

    // Update dispatch status to "completed"
    await supabase
      .from('dispatches')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id);

    // Log action
    await supabase.from('dispatch_audit_log').insert({
      dispatch_id: id,
      action: 'branch_otp_verified',
      performed_by: userId,
      notes: 'Branch OTP verified, dispatch marked as Completed',
    });

    return res.status(200).json({ message: 'Branch OTP verified successfully', status: 'completed' });
  } catch (error: any) {
    console.error('Error in verifyBranchOtp:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Upload signed stock sheet document
 * POST /api/store/dispatches/:id/upload-document
 */
export const uploadDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Upload to Supabase Storage
    const fileName = `${id}-${Date.now()}-${file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('dispatch-documents')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(400).json({ error: 'Failed to upload document', details: uploadError.message });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('dispatch-documents')
      .getPublicUrl(fileName);

    // Save document record
    const { error: docError } = await supabase
      .from('dispatch_documents')
      .insert({
        dispatch_id: id,
        document_url: urlData.publicUrl,
        document_type: 'stock_sheet',
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        uploaded_by: userId,
      });

    if (docError) {
      return res.status(400).json({ error: 'Failed to save document record', details: docError.message });
    }

    // Log action
    await supabase.from('dispatch_audit_log').insert({
      dispatch_id: id,
      action: 'document_uploaded',
      performed_by: userId,
      notes: `Document uploaded: ${file.originalname}`,
    });

    return res.status(200).json({
      message: 'Document uploaded successfully',
      document_url: urlData.publicUrl,
    });
  } catch (error: any) {
    console.error('Error in uploadDocument:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Get documents for a dispatch
 * GET /api/store/dispatches/:id/documents
 */
export const getDispatchDocuments = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('dispatch_documents')
      .select('*')
      .eq('dispatch_id', id)
      .order('uploaded_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: 'Failed to fetch documents', details: error.message });
    }

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('Error in getDispatchDocuments:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
