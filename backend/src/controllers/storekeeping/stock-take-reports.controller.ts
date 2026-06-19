import { Request, Response } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { getEnrichedStockCountItems } from './resources.controller';
import {
  generateBranchStockTakeReportPDF,
  generateBranchStockTakeWorkbook,
  storeTypeLabel,
  StockTakeReportData,
  StockTakeVariant,
} from '../../services/branch-stock-take-reports.service';

const outletLabel = (storeType: string | null | undefined): string => storeTypeLabel(storeType);

const fullName = (u: any): string =>
  u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.email || '—' : '—';

const resolveVariant = (raw: any): StockTakeVariant => {
  const v = `${raw || ''}`.toLowerCase();
  if (v === 'accountant_review' || v === 'accountant') return 'accountant_review';
  if (v === 'audit' || v === 'auditor') return 'audit';
  return 'storekeeper';
};

async function buildReportData(id: string, variant: StockTakeVariant, requester: any): Promise<StockTakeReportData> {
  const { data: header, error } = await supabase
    .from('stock_counts')
    .select('*, branch:branches(name)')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      throw new Error(`Stock take with ID ${id} not found`);
    }
    throw error;
  }
  if (!header) throw new Error('Stock take not found');

  const items = await getEnrichedStockCountItems(id, header.branch_id);

  // Resolve the people in the workflow chain in one query.
  const userIds = [
    header.counted_by,
    header.submitted_to_accountant_by,
    header.accountant_reviewed_by,
    header.auditor_reviewed_by,
  ].filter(Boolean);
  let usersById = new Map<string, any>();
  if (userIds.length) {
    const { data: users } = await supabase
      .from('users')
      .select('id, first_name, last_name, name, email')
      .in('id', [...new Set(userIds)]);
    usersById = new Map((users || []).map((u: any) => [u.id, u]));
  }

  const period = header.count_date
    ? new Date(header.count_date).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })
    : '—';

  return {
    header,
    items,
    branchName: header.branch?.name || `Branch ${header.branch_id || ''}`.trim() || 'Branch',
    outletName: outletLabel(header.store_type),
    storeTypeLabel: outletLabel(header.store_type),
    countDate: header.count_date || header.created_at || null,
    periodLabel: period,
    preparedBy: fullName(usersById.get(header.counted_by) || usersById.get(header.submitted_to_accountant_by)),
    reviewedBy: fullName(usersById.get(header.accountant_reviewed_by)),
    approvedBy: fullName(usersById.get(header.auditor_reviewed_by)),
    generatedBy: fullName(requester),
    accountantNotes: header.accountant_review_notes,
    auditorNotes: header.auditor_review_notes,
    variant,
  };
}

export const downloadBranchStockTakeReportPDF = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock take ID format',
        code: 'INVALID_UUID'
      });
    }
    
    const variant = resolveVariant(req.query.variant);
    const data = await buildReportData(id, variant, (req as any).user);
    await generateBranchStockTakeReportPDF(res, data);
  } catch (error: any) {
    logger.error('Error generating branch stock take PDF:', error);
    
    if (!res.headersSent) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ 
          success: false, 
          message: error.message,
          code: 'STOCK_TAKE_NOT_FOUND'
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to generate stock take PDF report',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  }
};

export const downloadBranchStockTakeWorkbook = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock take ID format',
        code: 'INVALID_UUID'
      });
    }
    
    const variant = resolveVariant(req.query.variant);
    const data = await buildReportData(id, variant, (req as any).user);
    await generateBranchStockTakeWorkbook(res, data);
  } catch (error: any) {
    logger.error('Error generating branch stock take workbook:', error);
    
    if (!res.headersSent) {
      if (error.message?.includes('not found')) {
        res.status(404).json({ 
          success: false, 
          message: error.message,
          code: 'STOCK_TAKE_NOT_FOUND'
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to generate stock take workbook report',
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  }
};
