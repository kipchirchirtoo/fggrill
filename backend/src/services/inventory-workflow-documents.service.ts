import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { supabase } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

type JsonRecord = Record<string, any>;

const PRIMARY = '#163a5f';
const TEXT = '#23272f';
const MUTED = '#677386';
const BORDER = '#dfe5ec';
const GOLD = '#c8a84b';

const COMPANY = {
  name: 'Famous Gates Hotels',
  address: 'Bomet, Kenya',
  phone: '0706 782 828',
  email: 'famousgateshotelsbmt@gmail.com'
};

const clean = (value: any, fallback = '-'): string => {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text && text !== 'null' && text !== 'undefined' ? text : fallback;
};

const qty = (value: any): string =>
  Number(value || 0).toLocaleString('en-KE', { maximumFractionDigits: 3 });

const dateText = (value: any): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return clean(value);
  return parsed.toLocaleString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const logoPath = (): string => path.resolve(process.cwd(), '../frontend/public/fglogo.png');

const safeName = (value: any): string => clean(value).replace(/[^\w.-]+/g, '_').slice(0, 80);

async function branchName(branchId: any): Promise<string> {
  if (!branchId) return '-';
  const { data } = await supabase
    .from('branches')
    .select('name, code')
    .eq('id', branchId)
    .maybeSingle();
  return clean(data?.name || data?.code || branchId);
}

async function userName(userId: any): Promise<string> {
  if (!userId) return '-';
  const { data } = await supabase
    .from('users')
    .select('first_name, last_name, email')
    .eq('id', userId)
    .maybeSingle();
  const name = clean([data?.first_name, data?.last_name].filter(Boolean).join(' '), '');
  return name || clean(data?.email || userId);
}

async function ensureDocument(input: {
  documentType: string;
  documentNumber: string;
  sourceTable: string;
  sourceId: string;
  branchId?: number | null;
  actorId?: string | null;
  metadata?: JsonRecord;
}): Promise<void> {
  try {
    await supabase
      .from('inventory_documents')
      .upsert({
        document_type: input.documentType,
        document_number: input.documentNumber,
        source_table: input.sourceTable,
        source_id: input.sourceId,
        branch_id: input.branchId ?? null,
        generated_by: input.actorId ?? null,
        generated_at: new Date().toISOString(),
        status: 'generated',
        metadata: input.metadata || {}
      }, { onConflict: 'document_number' });
  } catch (error) {
    logger.warn(`Document archive write failed: ${(error as Error).message}`);
  }
}

function startPdf(res: Response, title: string, filename: string): PDFKit.PDFDocument {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(res);

  const logo = logoPath();
  if (fs.existsSync(logo)) {
    doc.image(logo, 40, 28, { width: 54 });
  } else {
    doc.roundedRect(40, 28, 54, 34, 6).stroke(PRIMARY);
    doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(15).text('FG', 55, 38);
  }

  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(14)
    .text(COMPANY.name, 110, 30, { align: 'right' });
  doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
    .text(COMPANY.address, { align: 'right' })
    .text(`Tel: ${COMPANY.phone}`, { align: 'right' })
    .text(`Email: ${COMPANY.email}`, { align: 'right' });

  doc.moveTo(40, 92).lineTo(555, 92).strokeColor(BORDER).lineWidth(1).stroke();
  doc.rect(40, 93, 515, 3).fill(GOLD);
  doc.fillColor(TEXT).font('Helvetica-Bold').fontSize(17)
    .text(title.toUpperCase(), 40, 114, { align: 'center' });
  doc.moveTo(40, 145).lineTo(555, 145).strokeColor(BORDER).lineWidth(0.5).stroke();
  return doc;
}

function infoBox(doc: PDFKit.PDFDocument, x: number, y: number, width: number, title: string, rows: Array<[string, string]>): number {
  const height = 30 + rows.length * 18;
  doc.roundedRect(x, y, width, height, 5).fillAndStroke('#ffffff', BORDER);
  doc.fillColor(PRIMARY).font('Helvetica-Bold').fontSize(8).text(title.toUpperCase(), x + 10, y + 10);
  rows.forEach(([label, value], index) => {
    const rowY = y + 30 + index * 18;
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text(label, x + 10, rowY, { width: 82 });
    doc.fillColor(TEXT).font('Helvetica').fontSize(8).text(value, x + 96, rowY - 1, { width: width - 106, ellipsis: true });
  });
  return y + height;
}

function table(
  doc: PDFKit.PDFDocument,
  y: number,
  headers: string[],
  rows: string[][],
  widths: number[]
): number {
  const x = 40;
  const rowHeight = 24;
  doc.rect(x, y, widths.reduce((a, b) => a + b, 0), rowHeight).fill('#2d2f33');
  let cursor = x;
  headers.forEach((header, index) => {
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(7.5)
      .text(header, cursor + 6, y + 8, { width: widths[index] - 12, ellipsis: true });
    cursor += widths[index];
  });

  let rowY = y + rowHeight;
  rows.forEach((row, rowIndex) => {
    doc.rect(x, rowY, widths.reduce((a, b) => a + b, 0), rowHeight).fill(rowIndex % 2 === 0 ? '#fbfbfb' : '#ffffff');
    cursor = x;
    row.forEach((cell, index) => {
      doc.fillColor(TEXT).font('Helvetica').fontSize(7.5)
        .text(cell, cursor + 6, rowY + 8, { width: widths[index] - 12, ellipsis: true });
      cursor += widths[index];
    });
    doc.moveTo(x, rowY + rowHeight).lineTo(x + widths.reduce((a, b) => a + b, 0), rowY + rowHeight)
      .strokeColor(BORDER).lineWidth(0.35).stroke();
    rowY += rowHeight;
  });
  return rowY + 14;
}

function signatures(doc: PDFKit.PDFDocument, y: number, labels: string[]): void {
  const width = (515 - (labels.length - 1) * 18) / labels.length;
  labels.forEach((label, index) => {
    const x = 40 + index * (width + 18);
    doc.moveTo(x, y + 28).lineTo(x + width, y + 28).strokeColor(BORDER).stroke();
    doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(7).text(label.toUpperCase(), x, y + 34, { width });
  });
}

async function fetchStockRequest(id: string): Promise<{ request: JsonRecord; items: JsonRecord[] }> {
  const { data: request, error } = await supabase
    .from('stock_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!request) throw new AppError('Stock request not found', 404);

  const { data: items, error: itemError } = await supabase
    .from('stock_request_items')
    .select('*')
    .eq('request_id', id)
    .order('created_at', { ascending: true });
  if (itemError) throw itemError;

  const skus = [...new Set((items || []).map((item: any) => item.item_sku).filter(Boolean))];
  const { data: catalog } = skus.length
    ? await supabase.from('simple_items').select('sku, item_name, unit_of_measure, store_type').in('sku', skus)
    : { data: [] as any[] };
  const catalogMap = new Map((catalog || []).map((item: any) => [item.sku, item]));

  return {
    request,
    items: (items || []).map((item: any) => ({ ...item, item: catalogMap.get(item.item_sku) || null }))
  };
}

export async function streamStockRequestDocument(
  res: Response,
  id: string,
  actorId: string,
  type: 'branch_request' | 'auditor_approval'
): Promise<void> {
  const { request, items } = await fetchStockRequest(id);
  const documentNumber = `${type === 'branch_request' ? 'BRQ' : 'APR'}-${clean(request.request_number || request.id)}`;
  await ensureDocument({
    documentType: type,
    documentNumber,
    sourceTable: 'stock_requests',
    sourceId: request.id,
    branchId: request.requesting_branch_id,
    actorId,
    metadata: { request_number: request.request_number, status: request.status, workflow_status: request.workflow_status }
  });

  const doc = startPdf(
    res,
    type === 'branch_request' ? 'Branch Stock Request' : 'Auditor Approval',
    `${safeName(documentNumber)}.pdf`
  );

  const branch = await branchName(request.requesting_branch_id);
  const requester = await userName(request.requested_by);
  const reviewer = await userName(request.reviewed_by);
  let y = 158;
  infoBox(doc, 40, y, 245, 'Request details', [
    ['Request No', clean(request.request_number)],
    ['Branch', branch],
    ['Priority', clean(request.priority)],
    ['Status', clean(request.workflow_status || request.status)],
    ['Date', dateText(request.created_at)]
  ]);
  infoBox(doc, 310, y, 245, 'People and audit', [
    ['Requested By', requester],
    ['Auditor', reviewer],
    ['Decision At', dateText(request.auditor_decision_at || request.reviewed_at)],
    ['Remarks', clean(request.review_notes || request.notes)],
    ['Barcode', clean(request.barcode_value || request.request_number)]
  ]);

  y = 300;
  y = table(doc, y, ['#', 'Item', 'SKU', 'Requested', 'Approved', 'Reason'], items.map((item: any, index: number) => [
    String(index + 1),
    clean(item.item?.item_name || item.item_name || item.item_sku),
    clean(item.item_sku),
    qty(item.requested_quantity),
    qty(item.approved_quantity ?? item.requested_quantity),
    clean(item.reason || item.line_notes)
  ]), [28, 155, 112, 68, 68, 84]);

  signatures(doc, Math.min(y + 18, 700), ['Storekeeper', 'Auditor', 'Central Store']);
  doc.end();
}

async function fetchDispatch(id: string): Promise<{ dispatch: JsonRecord; items: JsonRecord[] }> {
  const { data: dispatch, error } = await supabase
    .from('dispatch_notes')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!dispatch) throw new AppError('Dispatch note not found', 404);

  const { data: items, error: itemError } = await supabase
    .from('dispatch_items')
    .select('*')
    .eq('dispatch_id', id)
    .order('created_at', { ascending: true });
  if (itemError) throw itemError;

  const skus = [...new Set((items || []).map((item: any) => item.item_sku).filter(Boolean))];
  const { data: catalog } = skus.length
    ? await supabase.from('simple_items').select('sku, item_name, unit_of_measure, store_type').in('sku', skus)
    : { data: [] as any[] };
  const catalogMap = new Map((catalog || []).map((item: any) => [item.sku, item]));

  // Attach requested and approved quantities from the originating stock request if it exists
  const enrichedItems = (items || []).map((item: any) => ({ ...item, item: catalogMap.get(item.item_sku) || null }));
  if (dispatch.stock_request_id) {
    const { data: requestLines } = await supabase
      .from('stock_request_items')
      .select('item_sku, requested_quantity, approved_quantity')
      .eq('request_id', dispatch.stock_request_id);
    if (requestLines && requestLines.length) {
      const lineMap = new Map(requestLines.map((l: any) => [String(l.item_sku).trim().toUpperCase(), l]));
      for (const item of enrichedItems) {
        const line = lineMap.get(String(item.item_sku).trim().toUpperCase());
        if (line) {
          item.requested_quantity = line.requested_quantity;
          item.approved_quantity = line.approved_quantity;
        }
      }
    }
  }

  return {
    dispatch,
    items: enrichedItems
  };
}

export async function streamDispatchDocument(
  res: Response,
  id: string,
  actorId: string,
  type: 'packing_list' | 'dispatch_document' | 'receipt_verification'
): Promise<void> {
  const { dispatch, items } = await fetchDispatch(id);
  const prefix = type === 'packing_list' ? 'PKL' : type === 'dispatch_document' ? 'DSP' : 'RCV';
  const documentNumber = `${prefix}-${clean(dispatch.dispatch_number || dispatch.id)}`;
  await ensureDocument({
    documentType: type,
    documentNumber,
    sourceTable: 'dispatch_notes',
    sourceId: dispatch.id,
    branchId: dispatch.to_branch_id,
    actorId,
    metadata: {
      dispatch_number: dispatch.dispatch_number,
      status: dispatch.status,
      workflow_status: dispatch.workflow_status,
      receipt_status: dispatch.receipt_status
    }
  });

  const title = type === 'packing_list'
    ? 'Packing List'
    : type === 'dispatch_document'
      ? 'Dispatch Document'
      : 'Receipt Verification';
  const doc = startPdf(res, title, `${safeName(documentNumber)}.pdf`);

  const fromBranch = await branchName(dispatch.from_branch_id);
  const toBranch = await branchName(dispatch.to_branch_id);
  const dispatcher = await userName(dispatch.dispatcher_id);
  const receiver = await userName(dispatch.receiver_id);
  let y = 158;
  infoBox(doc, 40, y, 245, 'Dispatch details', [
    ['Dispatch No', clean(dispatch.dispatch_number)],
    ['From', fromBranch],
    ['To', toBranch],
    ['Status', clean(dispatch.workflow_status || dispatch.status)],
    ['Barcode', clean(dispatch.barcode_value || dispatch.dispatch_number)]
  ]);
  infoBox(doc, 310, y, 245, 'Logistics and receipt', [
    ['Dispatcher', dispatcher],
    ['Receiver', receiver],
    ['Vehicle', clean(dispatch.vehicle_number)],
    ['Driver', clean(dispatch.driver_name)],
    ['Receipt', clean(dispatch.receipt_status || dispatch.status)]
  ]);

  y = 300;
  y = table(doc, y, ['#', 'Item', 'SKU', 'Req', 'Appr', 'Packed', 'Received', 'Damaged', 'Missing'], items.map((item: any, index: number) => [
    String(index + 1),
    clean(item.item?.item_name || item.item_name || item.item_sku),
    clean(item.item_sku),
    qty(item.requested_quantity ?? 0),
    qty(item.approved_quantity ?? item.requested_quantity ?? 0),
    qty(item.packed_quantity || item.dispatched_quantity),
    qty(item.received_quantity),
    qty(item.damaged_quantity),
    qty(item.missing_quantity)
  ]), [20, 132, 90, 42, 42, 45, 50, 50, 49]);

  signatures(doc, Math.min(y + 18, 700), ['Packer', 'Dispatcher', 'Receiver']);
  doc.end();
}

export async function streamDepartmentRequestDocument(res: Response, id: string, actorId: string): Promise<void> {
  const { data: request, error } = await supabase
    .from('department_request_logs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!request) throw new AppError('Department request not found', 404);

  const { data: items, error: itemError } = await supabase
    .from('department_request_items')
    .select('*')
    .eq('request_id', id)
    .order('created_at', { ascending: true });
  if (itemError) throw itemError;

  const documentNumber = `DRL-${clean(request.request_number)}`;
  await ensureDocument({
    documentType: 'department_request_log',
    documentNumber,
    sourceTable: 'department_request_logs',
    sourceId: request.id,
    branchId: request.branch_id,
    actorId,
    metadata: { request_number: request.request_number, status: request.status }
  });

  const doc = startPdf(res, 'Department Request Log', `${safeName(documentNumber)}.pdf`);
  const branch = await branchName(request.branch_id);
  const loggerName = await userName(request.logged_by);
  let y = 158;
  infoBox(doc, 40, y, 245, 'Request details', [
    ['Request No', clean(request.request_number)],
    ['Branch', branch],
    ['Department', clean(request.department_name)],
    ['Requestor', clean(request.requestor_name)],
    ['Status', clean(request.status)]
  ]);
  infoBox(doc, 310, y, 245, 'Use case', [
    ['Logged By', loggerName],
    ['Shift', clean(request.shift_code)],
    ['Event', clean(request.event_name)],
    ['Pax', clean(request.pax_count)],
    ['Purpose', clean(request.purpose)]
  ]);

  y = 300;
  y = table(doc, y, ['#', 'Item', 'SKU', 'Requested', 'Issued', 'Pending'], (items || []).map((item: any, index: number) => [
    String(index + 1),
    clean(item.item_name),
    clean(item.item_sku),
    qty(item.quantity),
    qty(item.issued_quantity),
    qty(item.pending_quantity)
  ]), [28, 185, 122, 60, 60, 60]);

  signatures(doc, Math.min(y + 18, 700), ['Department', 'Storekeeper', 'Auditor']);
  doc.end();
}

export async function streamMaterialIssueDocument(res: Response, ledgerId: string, actorId: string): Promise<void> {
  const { data: ledger, error } = await supabase
    .from('department_inventory_ledger')
    .select('*')
    .eq('id', ledgerId)
    .maybeSingle();
  if (error) throw error;
  if (!ledger) throw new AppError('Material issue note not found', 404);

  const documentNumber = clean(ledger.document_number || ledger.source_number || `MIN-${ledger.id}`);
  await ensureDocument({
    documentType: 'material_issue_note',
    documentNumber,
    sourceTable: 'department_inventory_ledger',
    sourceId: ledger.id,
    branchId: ledger.branch_id,
    actorId,
    metadata: { source_number: ledger.source_number, item_sku: ledger.item_sku }
  });

  const doc = startPdf(res, 'Material Issue Note', `${safeName(documentNumber)}.pdf`);
  const branch = await branchName(ledger.branch_id);
  let y = 158;
  infoBox(doc, 40, y, 245, 'Issue details', [
    ['MIN No', documentNumber],
    ['Branch', branch],
    ['Department', clean(ledger.department_name || ledger.metadata?.department_name)],
    ['Date', dateText(ledger.created_at)],
    ['Status', clean(ledger.metadata?.issue_status || ledger.status)]
  ]);
  infoBox(doc, 310, y, 245, 'Stock movement', [
    ['Item', clean(ledger.item_name || ledger.item_sku)],
    ['SKU', clean(ledger.item_sku)],
    ['Requested', qty(ledger.metadata?.requested_quantity || ledger.quantity)],
    ['Issued', qty(ledger.quantity)],
    ['Pending', qty(ledger.metadata?.pending_quantity)]
  ]);

  y = 300;
  table(doc, y, ['Item', 'SKU', 'Department', 'Quantity', 'Reference'], [[
    clean(ledger.item_name || ledger.item_sku),
    clean(ledger.item_sku),
    clean(ledger.department_name || ledger.metadata?.department_name),
    qty(ledger.quantity),
    clean(ledger.source_number)
  ]], [160, 125, 110, 60, 60]);

  signatures(doc, 690, ['Issued By', 'Received By', 'Checked By']);
  doc.end();
}
