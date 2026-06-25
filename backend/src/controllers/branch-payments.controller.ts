import { Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { isGlobalRole } from '../utils/branchIsolation';
import notificationService from '../services/notification.service';

// ============================================================================
// Branch outbound payments — initiate, approve (maker-checker + threshold
// director sign-off), release, with a forensic audit trail.
// ============================================================================

// Payments above this (in branch currency) require Director sign-off.
const DIRECTOR_THRESHOLD = Number(process.env.BRANCH_PAYMENT_DIRECTOR_THRESHOLD || 50000);

const num = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const money = (value: any, currency = 'KES'): string =>
  `${currency} ${num(value).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const clean = (value: any, fallback = '—'): string => {
  const text = value == null ? '' : String(value).trim();
  return text && text !== 'null' && text !== 'undefined' ? text : fallback;
};

const fmtDate = (value: any): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return clean(value);
  return date.toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const logoPath = (): string => {
  const candidates = [
    path.join(process.cwd(), 'public', 'fglogo.png'),
    path.join(process.cwd(), '../frontend/public/fglogo.png'),
    path.join(process.cwd(), '../famous_gates_app/assets/frontend_public/fglogo.png'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
};

// True when the error is "table not found" (migration not yet applied).
const isMissingTable = (err: any): boolean => {
  const msg = `${err?.message || ''}`.toLowerCase();
  return err?.code === 'PGRST205' ||
    err?.code === '42P01' ||
    (msg.includes('could not find the table') && msg.includes('branch_payment'));
};

const resolveBranchId = (req: Request): number | null => {
  const role = (req as any).user?.role;
  const userBranch = (req as any).user?.branch_id;
  const queryBranch = req.query.branch_id ?? (req.body && req.body.branch_id);
  if (isGlobalRole(role)) {
    const q = parseInt(String(queryBranch), 10);
    if (Number.isFinite(q) && q > 0) return q;
    const ub = parseInt(String(userBranch), 10);
    return Number.isFinite(ub) && ub > 0 ? ub : null;
  }
  const ub = parseInt(String(userBranch), 10);
  return Number.isFinite(ub) && ub > 0 ? ub : null;
};

const actorName = (req: Request): string => {
  const u = (req as any).user || {};
  return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.name || u.email || 'User';
};

const writeAudit = async (
  paymentId: string,
  action: string,
  req: Request,
  details: Record<string, any> = {}
): Promise<void> => {
  try {
    await supabase.from('branch_payment_audit').insert({
      payment_id: paymentId,
      action,
      actor_id: (req as any).user?.id || null,
      actor_name: actorName(req),
      actor_role: (req as any).user?.role || null,
      ip_address: req.ip || req.headers['x-forwarded-for']?.toString() || null,
      details,
    });
  } catch (e) {
    logger.warn('branch_payment_audit insert failed', e as any);
  }
};

const receiptUrlFor = (paymentId: string): string => `/api/branch-payments/${paymentId}/receipt.pdf`;

const generateReceiptNumber = async (branchId: number | string | null): Promise<string> => {
  const branch = branchId || 'X';
  const day = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const prefix = `FGR-${branch}-${day}-`;
  let query = supabase
    .from('branch_payment_receipts')
    .select('id', { count: 'exact', head: true })
    .ilike('receipt_number', `${prefix}%`);
  query = branchId == null ? query.is('branch_id', null) : query.eq('branch_id', branchId);
  const { count, error } = await query;
  if (error) logger.warn('receipt sequence lookup failed', error as any);
  return `${prefix}${String((count || 0) + 1).padStart(4, '0')}`;
};

const archiveReceiptForPayment = async (
  payment: Record<string, any>,
  req: Request,
  action = 'supplier_receipt_archived'
): Promise<Record<string, any> | null> => {
  try {
    const receiptUrl = receiptUrlFor(payment.id);
    const { data: existing } = await supabase
      .from('branch_payment_receipts')
      .select('*')
      .eq('payment_id', payment.id)
      .eq('document_status', 'archived')
      .maybeSingle();

    const receipt = existing || (await (async () => {
      const receiptNumber = await generateReceiptNumber(payment.branch_id);
      const { data, error } = await supabase
        .from('branch_payment_receipts')
        .insert({
          payment_id: payment.id,
          branch_id: payment.branch_id || null,
          receipt_number: receiptNumber,
          payment_number: payment.payment_number || null,
          supplier_name: payment.payee_name || null,
          amount: num(payment.amount),
          currency: payment.currency || 'KES',
          receipt_url: receiptUrl,
          generated_by: (req as any).user?.id || null,
          metadata: {
            po_id: payment.po_id || null,
            grn_id: payment.grn_id || null,
            invoice_id: payment.invoice_id || null,
            payment_method: payment.payment_method || null,
            reference: payment.reference || null,
          },
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    })());

    await supabase
      .from('branch_payments')
      .update({ receipt_url: receiptUrl, updated_at: new Date().toISOString() })
      .eq('id', payment.id);

    await writeAudit(payment.id, action, req, {
      receipt_number: receipt.receipt_number,
      receipt_url: receiptUrl,
    });

    return receipt;
  } catch (error) {
    logger.warn('branch payment receipt archive failed', error as any);
    return null;
  }
};

const notifyReceiptReleased = async (payment: Record<string, any>, receipt: Record<string, any> | null) => {
  const receiptNumber = receipt?.receipt_number || payment.payment_number || payment.id;
  const title = 'Supplier payment receipt archived';
  const message = `${payment.payee_name || 'Supplier'} was paid ${money(payment.amount, payment.currency || 'KES')}. Receipt ${receiptNumber} is ready for audit review.`;
  const metadata = {
    payment_id: payment.id,
    payment_number: payment.payment_number,
    receipt_number: receiptNumber,
    receipt_url: receiptUrlFor(payment.id),
    branch_id: payment.branch_id,
    po_id: payment.po_id,
    grn_id: payment.grn_id,
    invoice_id: payment.invoice_id,
  };

  await Promise.all([
    notificationService.notifyRole('auditor', title, message, {
      type: 'success',
      category: 'payments',
      priority: 'high',
      branchId: payment.branch_id || null,
      actionUrl: '/dashboard/auditor',
      metadata,
    }),
    notificationService.notifyRole('director', title, message, {
      type: 'info',
      category: 'payments',
      priority: 'medium',
      actionUrl: '/dashboard/director',
      metadata,
    }),
  ]);
};

const fetchReceiptBundle = async (req: Request, res: Response): Promise<Record<string, any> | null> => {
  const { data: payment, error } = await supabase
    .from('branch_payments')
    .select('*')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) throw error;
  if (!payment) {
    res.status(404).json({ success: false, message: 'Payment not found' });
    return null;
  }
  if (!isGlobalRole((req as any).user?.role)) {
    const ub = (req as any).user?.branch_id;
    if (ub && Number(payment.branch_id) !== Number(ub)) {
      res.status(404).json({ success: false, message: 'Payment not found in your branch' });
      return null;
    }
  }

  const [
    { data: branch },
    { data: receipt },
    { data: grn },
    { data: po },
    { data: invoice },
  ] = await Promise.all([
    payment.branch_id
      ? supabase.from('branches').select('*').eq('id', payment.branch_id).maybeSingle()
      : { data: null } as any,
    supabase.from('branch_payment_receipts').select('*').eq('payment_id', payment.id).eq('document_status', 'archived').maybeSingle(),
    payment.grn_id
      ? supabase.from('store_grn').select('*').eq('id', payment.grn_id).maybeSingle()
      : { data: null } as any,
    payment.po_id
      ? supabase.from('store_purchase_orders').select('*').eq('id', payment.po_id).maybeSingle()
      : { data: null } as any,
    payment.invoice_id
      ? supabase.from('store_supplier_invoices').select('*').eq('id', payment.invoice_id).maybeSingle()
      : payment.grn_id
        ? supabase.from('store_supplier_invoices').select('*').eq('grn_id', payment.grn_id).order('created_at', { ascending: false }).limit(1).maybeSingle()
        : { data: null } as any,
  ]);

  const supplierId = invoice?.supplier_id || grn?.supplier_id || po?.supplier_id || null;
  const { data: supplier } = supplierId
    ? await supabase.from('store_suppliers').select('*').eq('id', supplierId).maybeSingle()
    : { data: null } as any;

  const { data: grnItems } = payment.grn_id
    ? await supabase.from('store_grn_items').select('*').eq('grn_id', payment.grn_id)
    : { data: [] } as any;
  const { data: invoiceItems } = !grnItems?.length && (invoice?.id)
    ? await supabase.from('store_supplier_invoice_items').select('*').eq('supplier_invoice_id', invoice.id)
    : { data: [] } as any;

  const itemRows = (grnItems?.length ? grnItems : invoiceItems) || [];
  const skus = [...new Set(itemRows.map((row: any) => clean(row.item_id || row.item_sku, '')).filter(Boolean))];
  const { data: itemDetails } = skus.length
    ? await supabase.from('simple_items').select('sku, item_name, description, unit_of_measure').in('sku', skus)
    : { data: [] } as any;
  const itemBySku = new Map((itemDetails || []).map((item: any) => [String(item.sku), item]));

  return { payment, branch, receipt, grn, po, invoice, supplier, items: itemRows, itemBySku };
};

const drawSupplierReceiptPdf = (res: Response, bundle: Record<string, any>) => {
  const doc = new PDFDocument({ margin: 30, size: 'A4' });
  const payment = bundle.payment || {};
  const branch = bundle.branch || {};
  const receipt = bundle.receipt || {};
  const grn = bundle.grn || {};
  const po = bundle.po || {};
  const invoice = bundle.invoice || {};
  const supplier = bundle.supplier || {};
  const currency = payment.currency || 'KES';
  const receiptNumber = receipt.receipt_number || payment.payment_number || payment.id;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=FG_Supplier_Receipt_${clean(receiptNumber, 'receipt').replace(/[^A-Za-z0-9._-]/g, '_')}.pdf`
  );
  doc.pipe(res);

  const blue = '#4f8edb';
  const dark = '#333333';
  const muted = '#888888';
  const line = '#d9dfe8';
  const light = '#f8fafc';
  const pageW = doc.page.width;
  const left = 30;
  const right = pageW - 30;

  const lp = logoPath();
  doc.roundedRect(left, 27, 96, 34, 4).stroke('#9ac3ef');
  if (lp) doc.image(lp, left + 8, 31, { width: 36, height: 26, fit: [36, 26] });
  doc.font('Helvetica-Bold').fontSize(11).fillColor(blue).text('FamousGate', left + 46, 39, { width: 70 });

  doc.font('Helvetica-Bold').fontSize(20).fillColor(dark)
    .text('SUPPLIER PAYMENT RECEIPT', left, 84, { width: pageW - 60, align: 'center' });
  doc.font('Helvetica').fontSize(9).fillColor(muted)
    .text(`Receipt No: ${receiptNumber} | Paid: ${fmtDate(payment.released_at || payment.updated_at || payment.created_at)}`, left, 110, { width: pageW - 60, align: 'center' });

  const boxTop = 140;
  const boxW = 245;
  const boxH = 124;
  const gap = 14;
  const drawPartyBox = (x: number, title: string, label: string, lines: string[]) => {
    doc.rect(x, boxTop, boxW, boxH).dash(1, { space: 1 }).stroke(line).undash();
    doc.font('Helvetica-Bold').fontSize(11).fillColor(blue).text(title, x + 12, boxTop + 12);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(muted).text(label.toUpperCase(), x + 12, boxTop + 30);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(dark).text(lines[0] || '—', x + 12, boxTop + 43, { width: boxW - 24 });
    doc.font('Helvetica').fontSize(8.5).fillColor(muted)
      .text(lines.slice(1).filter(Boolean).join('\n') || '—', x + 12, boxTop + 64, { width: boxW - 24, lineGap: 1.5 });
  };

  drawPartyBox(left, 'FamousGate details', 'From', [
    branch.name || branch.branch_name || branch.display_name || 'FamousGate Hotels',
    branch.location || branch.address || 'Bomet, Kenya',
    `Tel: ${branch.phone || branch.contact_phone || '0706 782 828'}`,
    `Email: ${branch.email || branch.contact_email || 'famousgateshotelsbmt@gmail.com'}`,
    'Payment issued by Branch Accountant',
  ]);
  drawPartyBox(left + boxW + gap, 'Supplier details', 'To', [
    supplier.name || supplier.supplier_name || supplier.contact_person || payment.payee_name || 'Supplier',
    supplier.supplier_code ? `Supplier Code: ${supplier.supplier_code}` : '',
    supplier.address || supplier.location ? `${supplier.address || supplier.location}` : '',
    supplier.phone || supplier.contact_phone || payment.payee_account ? `Tel: ${supplier.phone || supplier.contact_phone || payment.payee_account}` : '',
    supplier.email || supplier.contact_email ? `Email: ${supplier.email || supplier.contact_email}` : '',
    supplier.tax_id || supplier.kra_pin ? `PIN: ${supplier.tax_id || supplier.kra_pin}` : '',
  ]);

  let y = boxTop + boxH + 18;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(dark)
    .text(`Receipt No : ${receiptNumber}`, left + 14, y)
    .text(`Payment Method : ${clean(payment.payment_method).replace(/_/g, ' ').toUpperCase()}`, left + 300, y);
  y += 20;
  doc.text(`Payment Date : ${fmtDate(payment.released_at || payment.updated_at)}`, left + 14, y)
    .text(`Reference : ${clean(payment.reference || grn.grn_number || po.po_number || invoice.invoice_number)}`, left + 300, y);
  y += 36;

  const cols = [
    { label: 'Item', x: left + 8, w: 224, align: 'left' as const },
    { label: 'DOC/REF', x: left + 238, w: 95, align: 'left' as const },
    { label: 'QTY', x: left + 340, w: 45, align: 'right' as const },
    { label: 'Rate', x: left + 395, w: 58, align: 'right' as const },
    { label: 'Subtotal', x: left + 462, w: 72, align: 'right' as const },
  ];
  doc.moveTo(left, y - 6).lineTo(right, y - 6).stroke(line);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(dark);
  cols.forEach((c) => doc.text(c.label, c.x, y, { width: c.w, align: c.align }));
  y += 20;
  doc.moveTo(left, y - 7).lineTo(right, y - 7).stroke(line);

  const rows = bundle.items?.length ? bundle.items : [{
    item_name: `Supplier payment - ${clean(payment.payee_name)}`,
    item_id: payment.reference || payment.payment_number,
    quantity_received: 1,
    unit_price: payment.amount,
    total_value: payment.amount,
  }];
  rows.forEach((row: any, index: number) => {
    if (y > 690) {
      doc.addPage();
      y = 50;
    }
    const sku = clean(row.item_id || row.item_sku, '');
    const item = bundle.itemBySku?.get(sku) || {};
    const qty = num(row.quantity_received ?? row.quantity_accepted ?? row.quantity ?? 1);
    const rate = num(row.unit_price);
    const total = num(row.total_value ?? row.total_amount ?? row.subtotal ?? (qty * rate));
    const name = item.item_name || item.description || row.item_name || row.description || sku || 'Supplier payment';
    if (index % 2 === 0) doc.rect(left, y - 5, right - left, 28).fill(light);
    doc.font('Helvetica').fontSize(8.5).fillColor(dark);
    doc.text(name, cols[0].x, y, { width: cols[0].w, ellipsis: true });
    doc.text(clean(sku || grn.grn_number || invoice.invoice_number || po.po_number), cols[1].x, y, { width: cols[1].w, ellipsis: true });
    doc.text(String(qty), cols[2].x, y, { width: cols[2].w, align: 'right' });
    doc.text(money(rate, currency), cols[3].x, y, { width: cols[3].w, align: 'right' });
    doc.text(money(total, currency), cols[4].x, y, { width: cols[4].w, align: 'right' });
    y += 28;
    doc.moveTo(left, y - 7).lineTo(right, y - 7).stroke(line);
  });

  const summaryW = 218;
  const sx = right - summaryW;
  y += 28;
  const subtotal = rows.reduce((sum: number, row: any) =>
    sum + num(row.total_value ?? row.total_amount ?? row.subtotal ?? (num(row.quantity_received ?? row.quantity ?? 1) * num(row.unit_price))), 0);
  const paid = num(payment.amount);
  doc.rect(sx, y, summaryW, 28).stroke(line);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(dark).text('Payment Summary', sx, y + 10, { width: summaryW, align: 'center' });
  y += 40;
  [
    ['GRN Value', money(subtotal, currency)],
    ['Amount Paid', money(paid, currency)],
    ['Balance After Payment', money(Math.max(num(invoice.balance_due), 0), currency)],
  ].forEach(([label, value], index) => {
    doc.font(index === 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(index === 1 ? blue : muted);
    doc.text(label, sx, y, { width: 100 });
    doc.fillColor(index === 1 ? dark : muted).text(value, sx + 105, y, { width: summaryW - 105, align: 'right' });
    y += 22;
    doc.moveTo(sx, y - 9).lineTo(sx + summaryW, y - 9).stroke(line);
  });

  doc.font('Helvetica').fontSize(7.5).fillColor(muted)
    .text('This supplier receipt confirms released outbound payment against the linked PO/GRN/invoice record. It is archived automatically for audit and director review.', left, 765, {
      width: right - left,
      align: 'center',
    });
  doc.end();
};

// @desc    Download archived supplier payment receipt
// @route   GET /api/branch-payments/:id/receipt.pdf
export const downloadPaymentReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bundle = await fetchReceiptBundle(req, res);
    if (!bundle) return;
    if (String(bundle.payment.status || '').toLowerCase() !== 'released') {
      res.status(400).json({ success: false, message: 'Receipt is available after payment release' });
      return;
    }
    if (!bundle.receipt) {
      bundle.receipt = await archiveReceiptForPayment(bundle.payment, req, 'receipt_generated_on_download');
    }
    drawSupplierReceiptPdf(res, bundle);
  } catch (error) {
    logger.error('downloadPaymentReceipt failed:', error);
    next(error);
  }
};

// @desc    Initiate an outbound branch payment (Branch Accountant = maker)
// @route   POST /api/branch-payments
export const createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = resolveBranchId(req);
    if (!branchId) {
      res.status(400).json({ success: false, message: 'No branch context available' });
      return;
    }
    const {
      category, payment_method, payee_name, payee_account, amount, currency,
      description, reference, receipt_url, po_id, grn_id, invoice_id,
      cash_flow_category, source,
    } = req.body || {};

    if (!category || !payment_method || !payee_name) {
      res.status(400).json({ success: false, message: 'category, payment_method and payee_name are required' });
      return;
    }
    const amt = num(amount);
    if (amt <= 0) {
      res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
      return;
    }

    const paymentNumber = `FGP-${branchId}-${Date.now().toString().slice(-8)}`;
    const role = String((req as any).user?.role || '').toLowerCase();
    const now = new Date().toISOString();

    // Branch Accountant payments are auto-released — no approval chain required.
    // Every payment is logged to the audit trail for management review.
    const isBranchAccountant = ['branch_accountant', 'accountant'].includes(role);
    const finalStatus = isBranchAccountant ? 'released' : 'pending';
    const requiresDirector = !isBranchAccountant && amt > DIRECTOR_THRESHOLD;

    const { data, error } = await supabase
      .from('branch_payments')
      .insert([{
        branch_id: branchId,
        payment_number: paymentNumber,
        category,
        payment_method,
        payee_name,
        payee_account: payee_account || null,
        amount: amt,
        currency: currency || 'KES',
        description: description || null,
        reference: reference || null,
        receipt_url: receipt_url || null,
        po_id: po_id || null,
        grn_id: grn_id || null,
        invoice_id: invoice_id || null,
        cash_flow_category: cash_flow_category || null,
        source: source || 'manual',
        settlement_status: 'pending',
        status: finalStatus,
        requires_director: requiresDirector,
        created_by: (req as any).user?.id || null,
        created_by_name: actorName(req),
        // Auto-release fields — set when branch accountant creates the payment
        ...(isBranchAccountant ? {
          manager_approved_at: now,
          director_approved_at: now,
          released_at: now,
          released_by: (req as any).user?.id || null,
        } : {}),
      }])
      .select()
      .single();
    if (error) throw error;

    const auditAction = isBranchAccountant ? 'auto_released' : 'created';
    await writeAudit(data.id, auditAction, req, {
      amount: amt,
      requires_director: requiresDirector,
      auto_released: isBranchAccountant,
      note: isBranchAccountant
        ? 'Auto-released by Branch Accountant — logged for management audit trail'
        : undefined,
    });

    // If GRN was linked, mark it as billed so it leaves the unbilled queue
    if (grn_id && isBranchAccountant) {
      await supabase
        .from('store_grn')
        .update({ payment_status: 'paid', paid_at: now })
        .eq('id', grn_id)
        .then(() => {}); // fire-and-forget; non-fatal
    }

    res.status(201).json({ success: true, data });
  } catch (error) {
    logger.error('createPayment failed:', error);
    next(error);
  }
};

// @desc    List branch payments (branch-scoped; global roles see all/by branch)
// @route   GET /api/branch-payments?status=&branch_id=
export const listPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = String((req as any).user?.role || '');
    let query = supabase.from('branch_payments').select('*').order('created_at', { ascending: false });

    // Branch isolation: non-global roles only see their own branch.
    if (!isGlobalRole(role)) {
      const ub = (req as any).user?.branch_id;
      if (ub) query = query.eq('branch_id', ub);
    } else if (req.query.branch_id) {
      query = query.eq('branch_id', req.query.branch_id);
    }
    if (req.query.status && req.query.status !== 'all') {
      query = query.eq('status', req.query.status);
    }
    if (req.query.cash_flow_category && req.query.cash_flow_category !== 'all') {
      query = query.eq('cash_flow_category', req.query.cash_flow_category);
    }
    if (req.query.settlement_status && req.query.settlement_status !== 'all') {
      query = query.eq('settlement_status', req.query.settlement_status);
    }
    if (req.query.source && req.query.source !== 'all') {
      query = query.eq('source', req.query.source);
    }
    const { data, error } = await query.limit(300);
    if (error) {
      if (isMissingTable(error)) {
        res.status(200).json({
          success: true,
          data: [],
          summary: { total: 0, pending: 0, awaiting_director: 0, released: 0, total_outflow: 0, pending_value: 0 },
          notice: 'Branch payments not initialised yet — run the branch_payments migration.',
        });
        return;
      }
      throw error;
    }

    const list = (data || []) as Array<Record<string, any>>;
    const summary = {
      total: list.length,
      pending: list.filter((p) => p.status === 'pending').length,
      awaiting_director: list.filter((p) => p.status === 'manager_approved' && p.requires_director).length,
      released: list.filter((p) => p.status === 'released').length,
      total_outflow: list.filter((p) => p.status === 'released').reduce((s, p) => s + num(p.amount), 0),
      pending_value: list
        .filter((p) => ['pending', 'manager_approved', 'director_approved'].includes(p.status))
        .reduce((s, p) => s + num(p.amount), 0),
    };

    res.status(200).json({ success: true, data: list, summary });
  } catch (error) {
    logger.error('listPayments failed:', error);
    next(error);
  }
};

// @desc    Single payment + audit trail (three-way match docs included)
// @route   GET /api/branch-payments/:id
export const getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('branch_payments').select('*').eq('id', req.params.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }
    if (!isGlobalRole((req as any).user?.role)) {
      const ub = (req as any).user?.branch_id;
      if (ub && Number(data.branch_id) !== Number(ub)) {
        res.status(404).json({ success: false, message: 'Payment not found in your branch' });
        return;
      }
    }
    const { data: audit } = await supabase
      .from('branch_payment_audit').select('*').eq('payment_id', req.params.id)
      .order('created_at', { ascending: true });

    res.status(200).json({ success: true, data: { ...data, audit_trail: audit || [] } });
  } catch (error) {
    logger.error('getPayment failed:', error);
    next(error);
  }
};

const loadForAction = async (req: Request, res: Response): Promise<Record<string, any> | null> => {
  const { data, error } = await supabase
    .from('branch_payments').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) {
    res.status(404).json({ success: false, message: 'Payment not found' });
    return null;
  }
  if (!isGlobalRole((req as any).user?.role)) {
    const ub = (req as any).user?.branch_id;
    if (ub && Number(data.branch_id) !== Number(ub)) {
      res.status(404).json({ success: false, message: 'Payment not found in your branch' });
      return null;
    }
  }
  // Maker-checker: the creator may never approve/release/their own payment.
  if (data.created_by && data.created_by === (req as any).user?.id) {
    res.status(403).json({ success: false, message: 'Maker-checker: you cannot approve a payment you created' });
    return null;
  }
  return data;
};

// @desc    Manager / Director approval step
// @route   PUT /api/branch-payments/:id/approve  body: { role: 'manager'|'director' }
export const approvePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userRole = String((req as any).user?.role || '').toLowerCase();
    const asDirector = req.body?.role === 'director' || ['director', 'super_admin'].includes(userRole);
    const bill = await loadForAction(req, res);
    if (!bill) return;
    if (['released', 'rejected'].includes(bill.status)) {
      res.status(400).json({ success: false, message: `Payment already ${bill.status}` });
      return;
    }

    const now = new Date().toISOString();
    const update: Record<string, any> = { updated_at: now };
    let action: string;

    if (asDirector) {
      if (!bill.requires_director) {
        res.status(400).json({ success: false, message: 'This payment does not require director sign-off' });
        return;
      }
      if (bill.status !== 'manager_approved') {
        res.status(400).json({ success: false, message: 'Manager approval is required before the director can sign off' });
        return;
      }
      update.status = 'director_approved';
      update.director_id = (req as any).user?.id;
      update.director_approved_at = now;
      action = 'director_approved';
    } else {
      if (bill.status !== 'pending') {
        res.status(400).json({ success: false, message: `Cannot approve a payment that is ${bill.status}` });
        return;
      }
      update.status = 'manager_approved';
      update.manager_id = (req as any).user?.id;
      update.manager_approved_at = now;
      action = 'manager_approved';
    }

    const { data, error } = await supabase
      .from('branch_payments').update(update).eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req.params.id, action, req);
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('approvePayment failed:', error);
    next(error);
  }
};

// @desc    Release the funds (Treasury / Director / Finance Manager)
// @route   PUT /api/branch-payments/:id/release
export const releasePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bill = await loadForAction(req, res);
    if (!bill) return;
    const ready = bill.requires_director
      ? bill.status === 'director_approved'
      : bill.status === 'manager_approved';
    if (!ready) {
      res.status(400).json({
        success: false,
        message: bill.requires_director
          ? 'Payment must be approved by the manager and director before release'
          : 'Payment must be approved by the manager before release',
      });
      return;
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('branch_payments')
      .update({ status: 'released', released_by: (req as any).user?.id, released_at: now, updated_at: now })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req.params.id, 'released', req, { amount: num(bill.amount) });
    const receipt = await archiveReceiptForPayment(data, req, 'released_receipt_archived');
    if (receipt) {
      notifyReceiptReleased(data, receipt).catch((notifyError) =>
        logger.warn('supplier receipt notification failed', notifyError as any)
      );
    }
    res.status(200).json({ success: true, data: { ...data, receipt } });
  } catch (error) {
    logger.error('releasePayment failed:', error);
    next(error);
  }
};

// @desc    Mark an outbound payment as settled against its purchase order
//          (cash_flow_category/settlement_status added in migration
//          20260622_famousgate_major_redesign.sql, section 3). The
//          fn_po_received_settle_outbound() trigger auto-settles PO-linked
//          payments when the PO is received; this endpoint covers the
//          manual case (non-PO payments, or a correction).
// @route   PUT /api/branch-payments/:id/settle
export const settlePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: existing, error: loadError } = await supabase
      .from('branch_payments').select('*').eq('id', req.params.id).maybeSingle();
    if (loadError) throw loadError;
    if (!existing) {
      res.status(404).json({ success: false, message: 'Payment not found' });
      return;
    }
    if (!isGlobalRole((req as any).user?.role)) {
      const ub = (req as any).user?.branch_id;
      if (ub && Number(existing.branch_id) !== Number(ub)) {
        res.status(404).json({ success: false, message: 'Payment not found in your branch' });
        return;
      }
    }
    if (existing.status !== 'released') {
      res.status(400).json({ success: false, message: 'Only released payments can be settled' });
      return;
    }
    if (existing.settlement_status === 'settled') {
      res.status(400).json({ success: false, message: 'Payment is already settled' });
      return;
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('branch_payments')
      .update({ settlement_status: 'settled', updated_at: now })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req.params.id, 'settled', req, { note: req.body?.note || null });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('settlePayment failed:', error);
    next(error);
  }
};

// @desc    Reject a payment with a reason
// @route   PUT /api/branch-payments/:id/reject  body: { reason }
export const rejectPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bill = await loadForAction(req, res);
    if (!bill) return;
    if (['released', 'rejected'].includes(bill.status)) {
      res.status(400).json({ success: false, message: `Payment already ${bill.status}` });
      return;
    }
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('branch_payments')
      .update({
        status: 'rejected',
        rejected_by: (req as any).user?.id,
        rejected_at: now,
        rejection_reason: req.body?.reason || null,
        updated_at: now,
      })
      .eq('id', req.params.id).select().single();
    if (error) throw error;
    await writeAudit(req.params.id, 'rejected', req, { reason: req.body?.reason || null });
    res.status(200).json({ success: true, data });
  } catch (error) {
    logger.error('rejectPayment failed:', error);
    next(error);
  }
};
