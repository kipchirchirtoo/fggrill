/**
 * POS Controller
 * Handles POS barcode generation and scanning
 */

import { Request, Response } from 'express';
import { supabase } from '../../config/supabase';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate barcode for POS transaction
 * POST /api/store/pos/barcodes/generate
 */
export const generatePosBarcode = async (req: Request, res: Response) => {
  try {
    const { transaction_id, order_id, bill_id } = req.body;
    const userId = (req as any).user?.id;

    if (!transaction_id && !order_id && !bill_id) {
      return res.status(400).json({ error: 'At least one of transaction_id, order_id, or bill_id is required' });
    }

    // Generate unique barcode
    const barcodeValue = `POS-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Insert barcode record
    const { data, error } = await supabase
      .from('pos_barcodes')
      .insert({
        transaction_id,
        order_id,
        bill_id,
        barcode_value: barcodeValue,
        generated_by: userId,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: 'Failed to generate barcode', details: error.message });
    }

    return res.status(201).json({
      data,
      barcode: barcodeValue,
      message: 'POS barcode generated successfully',
    });
  } catch (error: any) {
    console.error('Error in generatePosBarcode:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};

/**
 * Scan POS barcode to retrieve transaction
 * GET /api/store/pos/barcodes/scan/:barcode
 */
export const scanPosBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;

    // Find barcode record
    const { data, error } = await supabase
      .from('pos_barcodes')
      .select('*')
      .eq('barcode_value', barcode)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Barcode not found' });
    }

    // TODO: Fetch associated bill/order details from orders/bills table
    // For now, return the barcode record
    return res.status(200).json({
      data,
      message: 'Barcode scanned successfully',
    });
  } catch (error: any) {
    console.error('Error in scanPosBarcode:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
