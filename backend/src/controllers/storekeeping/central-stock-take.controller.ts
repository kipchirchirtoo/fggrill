import { Request, Response } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { generateCentralStockTakePDF } from '../../services/native-pdf-reports.service';
const ExcelJS = require('exceljs');

const STORE_TYPES = ['foodstuffs', 'bar_store'] as const;
const SIMPLE_ITEM_SELECT = 'sku, item_name, description, quantity, store_type, is_active';

const ensureValidStoreType = (value?: string): value is (typeof STORE_TYPES)[number] =>
  !!value && STORE_TYPES.includes(value as (typeof STORE_TYPES)[number]);

const normalizeSku = (sku: unknown): string => {
  if (sku === null || sku === undefined) return '';
  return String(sku).trim();
};

const fetchSimpleItemsBySku = async (skus: unknown[]): Promise<Map<string, any>> => {
  const uniqueSkus = [...new Set(skus.map(normalizeSku).filter(Boolean))];
  if (uniqueSkus.length === 0) return new Map();

  const { data, error } = await supabase
    .from('simple_items')
    .select(SIMPLE_ITEM_SELECT)
    .in('sku', uniqueSkus);

  if (error) throw error;

  return new Map((data || []).map((item: any) => [normalizeSku(item.sku), item]));
};

const attachCatalogItems = async (items: any[]): Promise<any[]> => {
  const itemMap = await fetchSimpleItemsBySku(items.map(item => item.item_sku));

  return items.map(item => {
    const sku = normalizeSku(item.item_sku);
    const catalogItem = itemMap.get(sku);

    return {
      ...item,
      item: catalogItem ? {
        ...catalogItem,
        category: catalogItem.store_type || 'uncategorized',
        unit: 'Unit',
        unit_of_measure: 'Unit',
        cost_price: item.unit_cost || 0
      } : {
        sku,
        item_name: sku || 'Unknown item',
        description: null,
        category: 'uncategorized',
        unit: 'Unit',
        unit_of_measure: 'Unit',
        cost_price: item.unit_cost || 0,
        quantity: item.system_quantity || 0
      },
      item_name: catalogItem?.item_name || catalogItem?.description || sku || 'Unknown item',
      unit: 'Unit',
      category: catalogItem?.store_type || 'uncategorized'
    };
  });
};

const fetchCentralStockTakeItemsWithCatalog = async (sessionId: string): Promise<any[]> => {
  const { data: items, error } = await supabase
    .from('central_stock_take_items')
    .select('*')
    .eq('session_id', sessionId)
    .order('item_sku');

  if (error) throw error;

  return attachCatalogItems(items || []);
};

const computeTotals = (items: Array<{ counted_quantity: number | null; variance: number | null; variance_value: number | null }>) => {
  const totalItemsCounted = items.filter(item => item.counted_quantity !== null).length;
  const itemsWithVariance = items.filter(item => item.variance !== null && item.variance !== 0).length;
  const totalVarianceValue = items.reduce((sum, item) => sum + (item.variance_value || 0), 0);

  return { totalItemsCounted, itemsWithVariance, totalVarianceValue };
};

export const getCentralStockTakes = async (req: Request, res: Response) => {
  try {
    const { store_type, status } = req.query;

    let query = supabase
      .from('central_stock_take_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (store_type && ensureValidStoreType(String(store_type))) {
      query = query.eq('store_type', store_type);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error: any) {
    logger.error('Error fetching central stock takes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getCentralStockTake = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: session, error: sessionError } = await supabase
      .from('central_stock_take_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return res.status(404).json({ success: false, message: 'Central stock take not found' });
      }
      throw sessionError;
    }

    const enrichedItems = await fetchCentralStockTakeItemsWithCatalog(id);

    res.status(200).json({ success: true, data: { ...session, items: enrichedItems } });
  } catch (error: any) {
    logger.error('Error fetching central stock take:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createCentralStockTake = async (req: Request, res: Response) => {
  try {
    const { store_type, notes } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    if (!ensureValidStoreType(store_type)) {
      return res.status(400).json({ success: false, message: 'Valid store_type is required' });
    }

    const { data: sessionNumber, error: seqError } = await supabase
      .rpc('get_central_stock_take_number');

    if (seqError) throw seqError;

    const { data: session, error: sessionError } = await supabase
      .from('central_stock_take_sessions')
      .insert({
        session_number: sessionNumber,
        store_type,
        status: 'in_progress',
        notes,
        started_by: userId,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    const { data: items, error: itemsError } = await supabase
      .from('simple_items')
      .select('sku, quantity, cost_price, item_name, description, unit_of_measure, category')
      .eq('is_active', true)
      .eq('store_type', store_type);

    if (itemsError) throw itemsError;

    const itemsToInsert = (items || []).map(item => ({
      session_id: session.id,
      item_sku: item.sku,
      system_quantity: item.quantity || 0,
      unit_cost: item.cost_price || 0
    }));

    if (itemsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('central_stock_take_items')
        .insert(itemsToInsert);

      if (insertError) throw insertError;
    }

    res.status(201).json({ success: true, data: session, message: 'Central stock take started successfully' });
  } catch (error: any) {
    logger.error('Error creating central stock take:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateCentralStockTake = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { notes, status, items } = req.body;
    const userId = (req as any).user?.id;

    if (notes !== undefined || status) {
      const updatePayload: any = {};
      if (notes !== undefined) updatePayload.notes = notes;
      if (status) updatePayload.status = status;

      const { error: sessionError } = await supabase
        .from('central_stock_take_sessions')
        .update(updatePayload)
        .eq('id', id);

      if (sessionError) throw sessionError;
    }

    if (items && Array.isArray(items) && items.length > 0) {
      const itemIds = items.map((item: any) => item.id).filter(Boolean);
      const { data: existingItems, error: existingError } = await supabase
        .from('central_stock_take_items')
        .select('id, system_quantity')
        .in('id', itemIds);

      if (existingError) throw existingError;

      const existingMap = (existingItems || []).reduce((acc: Record<string, any>, item) => {
        acc[item.id] = item;
        return acc;
      }, {});

      for (const item of items) {
        const current = existingMap[item.id];
        if (!current) continue;

        const countedQuantity = item.counted_quantity ?? null;
        const variance = countedQuantity === null ? null : countedQuantity - (current.system_quantity || 0);

        if (countedQuantity !== null && variance !== 0 && !item.variance_reason) {
          return res.status(400).json({
            success: false,
            message: 'Variance reason is required for items with variance',
            item_id: item.id
          });
        }

        const { error: updateError } = await supabase
          .from('central_stock_take_items')
          .update({
            counted_quantity: countedQuantity,
            variance_reason: item.variance_reason ?? null,
            notes: item.notes ?? null,
            counted_by: countedQuantity !== null ? userId : null,
            counted_at: countedQuantity !== null ? new Date().toISOString() : null
          })
          .eq('id', item.id);

        if (updateError) throw updateError;
      }
    }

    const { data: totalsSource, error: totalsError } = await supabase
      .from('central_stock_take_items')
      .select('counted_quantity, variance, variance_value')
      .eq('session_id', id);

    if (totalsError) throw totalsError;

    const totals = computeTotals(totalsSource || []);

    await supabase
      .from('central_stock_take_sessions')
      .update({
        total_items_counted: totals.totalItemsCounted,
        items_with_variance: totals.itemsWithVariance,
        total_variance_value: totals.totalVarianceValue
      })
      .eq('id', id);

    res.status(200).json({ success: true, message: 'Central stock take updated successfully' });
  } catch (error: any) {
    logger.error('Error updating central stock take:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const submitCentralStockTake = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { data: items, error: itemsError } = await supabase
      .from('central_stock_take_items')
      .select('id, counted_quantity, variance, variance_reason, variance_value')
      .eq('session_id', id);

    if (itemsError) throw itemsError;

    const missingCounts = (items || []).filter(item => item.counted_quantity === null);
    if (missingCounts.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'All items must be counted before submission',
        missing_count: missingCounts.length
      });
    }

    const missingReasons = (items || []).filter(item => item.variance !== null && item.variance !== 0 && !item.variance_reason);
    if (missingReasons.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Variance reason is required for all items with variance',
        missing_reason_count: missingReasons.length
      });
    }

    const totals = computeTotals(items || []);

    const { data: updatedSession, error: sessionError } = await supabase
      .from('central_stock_take_sessions')
      .update({
        status: 'submitted',
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
        total_items_counted: totals.totalItemsCounted,
        items_with_variance: totals.itemsWithVariance,
        total_variance_value: totals.totalVarianceValue
      })
      .eq('id', id)
      .select()
      .single();

    if (sessionError) throw sessionError;

    const { error: approvalError } = await supabase
      .from('approval_requests')
      .insert({
        request_type: 'stock_take',
        status: 'pending',
        requested_by: userId,
        description: `Auditor review required for central ${updatedSession?.store_type || 'store'} stock take: ${updatedSession?.session_number || id}`,
        metadata: {
          central_stock_take_id: id,
          review_stage: 'auditor',
          scope: 'central_store',
          store_type: updatedSession?.store_type || null
        }
      });

    if (approvalError) throw approvalError;

    res.status(200).json({ success: true, message: 'Central stock take submitted for review' });
  } catch (error: any) {
    logger.error('Error submitting central stock take:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const approveCentralStockTake = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { data: session, error: sessionError } = await supabase
      .from('central_stock_take_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError) throw sessionError;

    if (session.status !== 'submitted') {
      return res.status(400).json({ success: false, message: 'Only submitted stock takes can be approved' });
    }

    const { data: items, error: itemsError } = await supabase
      .from('central_stock_take_items')
      .select('item_sku, variance, variance_value, unit_cost')
      .eq('session_id', id);

    if (itemsError) throw itemsError;

    const varianceItems = (items || []).filter(item => item.variance !== null && item.variance !== 0);

    if (varianceItems.length > 0) {
      const inventoryAccountId = await getAccountId('1350');
      const varianceAccountId = await getAccountId('5900');

      if (inventoryAccountId && varianceAccountId) {
        const journalNumber = `JE-${Date.now()}`;
        const totalVarianceValue = varianceItems.reduce((sum, item) => sum + (item.variance_value || 0), 0);

        const { data: journal, error: journalError } = await supabase
          .from('accounting_journal_entries')
          .insert({
            journal_number: journalNumber,
            entry_date: new Date().toISOString().split('T')[0],
            description: `Central Stock Take Variance - ${session.session_number} (${session.store_type})`,
            reference: session.session_number,
            total_debit: Math.abs(totalVarianceValue),
            total_credit: Math.abs(totalVarianceValue),
            status: 'posted',
            posted_by: userId
          })
          .select()
          .single();

        if (journalError) throw journalError;

        const lines = [];
        if (totalVarianceValue > 0) {
          lines.push({
            journal_entry_id: journal.id,
            account_id: varianceAccountId,
            description: 'Stock increase variance',
            debit_amount: totalVarianceValue,
            credit_amount: 0
          });
          lines.push({
            journal_entry_id: journal.id,
            account_id: inventoryAccountId,
            description: 'Central store inventory adjustment',
            debit_amount: 0,
            credit_amount: totalVarianceValue
          });
        } else if (totalVarianceValue < 0) {
          lines.push({
            journal_entry_id: journal.id,
            account_id: inventoryAccountId,
            description: 'Central store inventory adjustment',
            debit_amount: Math.abs(totalVarianceValue),
            credit_amount: 0
          });
          lines.push({
            journal_entry_id: journal.id,
            account_id: varianceAccountId,
            description: 'Stock decrease variance',
            debit_amount: 0,
            credit_amount: Math.abs(totalVarianceValue)
          });
        }

        if (lines.length > 0) {
          await supabase.from('accounting_journal_lines').insert(lines);
        }
      }

      for (const item of varianceItems) {
        const { data: current } = await supabase
          .from('simple_items')
          .select('quantity')
          .eq('sku', item.item_sku)
          .single();
        await supabase
          .from('simple_items')
          .update({ quantity: (current?.quantity ?? 0) + item.variance })
          .eq('sku', item.item_sku);
      }
    }

    await supabase
      .from('central_stock_take_sessions')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', id);

    res.status(200).json({ success: true, message: 'Central stock take approved and adjustments posted' });
  } catch (error: any) {
    logger.error('Error approving central stock take:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const rejectCentralStockTake = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { error: sessionError } = await supabase
      .from('central_stock_take_sessions')
      .update({
        status: 'rejected',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        notes: (reason || '') + (reason ? '\n' : '') + 'Rejected by auditor'
      })
      .eq('id', id);

    if (sessionError) throw sessionError;

    res.status(200).json({ success: true, message: 'Central stock take rejected' });
  } catch (error: any) {
    logger.error('Error rejecting central stock take:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateCentralStockTakeWorksheetPDF = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: session, error: sessionError } = await supabase
      .from('central_stock_take_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError) throw sessionError;

    const items = await fetchCentralStockTakeItemsWithCatalog(id);

    const pdfBuffer = await generateCentralStockTakePDF(session, items);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${session.session_number}-worksheet.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    logger.error('Error generating PDF worksheet:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const generateCentralStockTakeExcel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: session, error: sessionError } = await supabase
      .from('central_stock_take_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (sessionError) throw sessionError;

    const items = await fetchCentralStockTakeItemsWithCatalog(id);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Stock Take Report', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
    });

    worksheet.columns = [
      { key: 'sku', width: 18 },
      { key: 'name', width: 35 },
      { key: 'category', width: 18 },
      { key: 'unit', width: 10 },
      { key: 'system_qty', width: 12 },
      { key: 'counted_qty', width: 12 },
      { key: 'variance', width: 12 },
      { key: 'unit_cost', width: 12 },
      { key: 'variance_value', width: 15 },
      { key: 'reason', width: 30 }
    ];

    worksheet.addRow(['SKU', 'Item Name', 'Category', 'Unit', 'System Qty', 'Counted Qty', 'Variance', 'Unit Cost', 'Variance Value', 'Variance Reason']);
    worksheet.lastRow.font = { bold: true };
    worksheet.lastRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    items.forEach((item: any) => {
      worksheet.addRow([
        item.item_sku,
        item.item?.item_name || item.item?.description || item.item_sku,
        item.item?.category || '—',
        item.item?.unit_of_measure || 'unit',
        item.system_quantity,
        item.counted_quantity ?? '—',
        item.variance ?? '—',
        item.unit_cost,
        item.variance_value ?? '—',
        item.variance_reason || '—'
      ]);
    });

    worksheet.addRow([]);
    worksheet.addRow(['Summary', '', '', '', '', '', '', '', '', '']);
    worksheet.addRow(['Total Items', items?.length || 0, '', '', '', '', '', '', '', '']);
    worksheet.addRow(['Items with Variance', session.items_with_variance, '', '', '', '', '', '', '', '']);
    worksheet.addRow(['Total Variance Value', '', '', '', '', '', '', '', session.total_variance_value, '']);

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${session.session_number}-report.xlsx"`);
    res.send(buffer);
  } catch (error: any) {
    logger.error('Error generating Excel report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

async function getAccountId(accountCode: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('accounting_chart_of_accounts')
      .select('id')
      .eq('account_code', accountCode)
      .maybeSingle();

    if (error || !data) return null;
    return data.id;
  } catch {
    return null;
  }
}
