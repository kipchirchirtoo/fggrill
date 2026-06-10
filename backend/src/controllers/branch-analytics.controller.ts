// Branch Analytics Controller
// Handles all analytics requests for branch managers

import { Request, Response } from 'express';
import axios from 'axios';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
import fs from 'fs';
import path from 'path';
import {
  BranchSalesRequest,
  BranchSalesResponse,
  ExportRequest,
  PaymentMethod,
  OrderType,
  ServiceCategory,
  TransactionRecord
} from '../types/analytics.types';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

// Validation schemas using Zod
const SalesFilterSchema = z.object({
  payment_methods: z.array(z.nativeEnum(PaymentMethod)).optional(),
  order_types: z.array(z.nativeEnum(OrderType)).optional(),
  categories: z.array(z.nativeEnum(ServiceCategory)).optional()
});

const BranchSalesRequestSchema = z.object({
  branch_id: z.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  filters: SalesFilterSchema.optional()
}).refine(
  (data) => new Date(data.end_date) >= new Date(data.start_date),
  { message: 'end_date must be after or equal to start_date' }
);

const ExportRequestSchema = z.object({
  branch_id: z.number().int().positive(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  filters: SalesFilterSchema.optional(),
  format: z.enum(['pdf', 'csv'])
});

// Get Python analytics service URL from environment
const ANALYTICS_SERVICE_URL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:5001';

const PDF_PRIMARY = '#1a1a1a';
const PDF_SECONDARY = '#555555';
const PDF_GOLD = '#c8a84b';
const PDF_BORDER = '#e0e0e0';
const PDF_HEADER_BG = '#333333';
const PDF_ROW_BG = '#f9f9f9';
const PDF_ACCENT = '#0066cc';
const COMPANY_NAME = 'FamousGateHotels';
const COMPANY_ADDRESS = 'Bomet, Kenya';
const COMPANY_EMAIL = 'famousgateshotelsbmt@gmail.com';
const COMPANY_PHONE = '0706 782 828';

const normalizePaymentMethod = (value: any): PaymentMethod | string => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'cash') return PaymentMethod.CASH;
  if (normalized === 'card') return PaymentMethod.CARD;
  if (normalized === 'mpesa' || normalized === 'm-pesa') return PaymentMethod.MPESA;
  if (normalized === 'mixed') return PaymentMethod.MIXED;
  return normalized || 'unknown';
};

const normalizeCategory = (value: any, source: TransactionRecord['source']): ServiceCategory | string => {
  if (source === 'booking') return ServiceCategory.ROOMS;
  if (source === 'restaurant') return ServiceCategory.RESTAURANT;
  if (source === 'bar') return ServiceCategory.BAR;

  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'ROOM') return ServiceCategory.ROOMS;
  if (normalized === 'RESTAURANT') return ServiceCategory.RESTAURANT;
  if (normalized === 'BAR') return ServiceCategory.BAR;
  if (normalized === 'SPA') return ServiceCategory.SPA;
  if (normalized === 'CONFERENCE') return ServiceCategory.CONFERENCE;
  if (normalized === 'DYNAMIC_SERVICE') return ServiceCategory.DYNAMIC_SERVICES;

  return String(value || 'other').trim().toLowerCase() || 'other';
};

const buildDateKey = (value: string) => value.split('T')[0];

const passesBranchSalesFilters = (transaction: TransactionRecord, filters?: BranchSalesRequest['filters']): boolean => {
  if (!filters) return true;

  if (filters.payment_methods?.length) {
    const paymentMethod = String(transaction.payment_method || '').toLowerCase();
    if (!filters.payment_methods.includes(paymentMethod as PaymentMethod)) {
      return false;
    }
  }

  if (filters.order_types?.length && transaction.source === 'restaurant') {
    const orderType = String(transaction.order_type || '').toLowerCase();
    if (!filters.order_types.includes(orderType as OrderType)) {
      return false;
    }
  }

  if (filters.categories?.length && transaction.source === 'shift_transaction') {
    const category = String(transaction.category || '').toLowerCase();
    if (!filters.categories.includes(category as ServiceCategory)) {
      return false;
    }
  }

  return true;
};

const getFallbackBranchSalesResponse = async (requestData: BranchSalesRequest): Promise<BranchSalesResponse> => {
  const startTimestamp = `${requestData.start_date}T00:00:00`;
  const endTimestamp = `${requestData.end_date}T23:59:59`;

  const [
    bookingsResult,
    restaurantResult,
    barResult,
    shiftResult,
    branchResult
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, branch_id, total_amount, payment_method, created_at, status')
      .eq('branch_id', requestData.branch_id)
      .gte('created_at', startTimestamp)
      .lte('created_at', endTimestamp)
      .not('status', 'eq', 'cancelled'),
    supabase
      .from('restaurant_orders')
      .select('id, branch_id, total_amount, grand_total, payment_method, order_type, created_at, status, order_number, bill_number, department')
      .eq('branch_id', requestData.branch_id)
      .gte('created_at', startTimestamp)
      .lte('created_at', endTimestamp)
      .not('status', 'eq', 'cancelled'),
    supabase
      .from('bar_orders')
      .select('id, branch_id, total, subtotal, payment_method, created_at, status, order_number, room_number')
      .eq('branch_id', requestData.branch_id)
      .gte('created_at', startTimestamp)
      .lte('created_at', endTimestamp)
      .not('status', 'eq', 'cancelled'),
    supabase
      .from('shift_transactions')
      .select('id, branch_id, total_amount, payment_method, service_category, created_at, is_voided, transaction_number')
      .eq('branch_id', requestData.branch_id)
      .gte('created_at', startTimestamp)
      .lte('created_at', endTimestamp),
    supabase
      .from('branches')
      .select('name')
      .eq('id', requestData.branch_id)
      .maybeSingle()
  ]);

  if (bookingsResult.error) throw bookingsResult.error;
  if (restaurantResult.error) throw restaurantResult.error;
  if (barResult.error) throw barResult.error;
  if (shiftResult.error) throw shiftResult.error;
  if (branchResult.error) throw branchResult.error;

  const bookingTransactions: TransactionRecord[] = (bookingsResult.data || []).map((booking: any) => ({
    id: String(booking.id),
    branch_id: Number(booking.branch_id || requestData.branch_id),
    transaction_date: booking.created_at,
    category: ServiceCategory.ROOMS,
    payment_method: normalizePaymentMethod(booking.payment_method) as PaymentMethod,
    total_amount: Number(booking.total_amount || 0),
    status: String(booking.status || 'completed'),
    source: 'booking'
  }));

  const restaurantTransactions: TransactionRecord[] = (restaurantResult.data || []).map((order: any) => ({
    id: String(order.id),
    branch_id: Number(order.branch_id || requestData.branch_id),
    transaction_date: order.created_at,
    category: ServiceCategory.RESTAURANT,
    payment_method: normalizePaymentMethod(order.payment_method) as PaymentMethod,
    order_type: String(order.order_type || '').toLowerCase() as OrderType,
    total_amount: Number(order.grand_total || order.total_amount || 0),
    status: String(order.status || 'completed'),
    source: 'restaurant',
    code: order.order_number || order.bill_number || null,
    short_code: order.bill_number || (order.order_number ? String(order.order_number).slice(-6) : null),
    outlet: order.department || 'Restaurant'
  }));

  const barTransactions: TransactionRecord[] = (barResult.data || []).map((order: any) => ({
    id: String(order.id),
    branch_id: Number(order.branch_id || requestData.branch_id),
    transaction_date: order.created_at,
    category: ServiceCategory.BAR,
    payment_method: normalizePaymentMethod(order.payment_method) as PaymentMethod,
    total_amount: Number(order.total || order.subtotal || 0),
    status: String(order.status || 'completed'),
    source: 'bar',
    code: order.order_number || null,
    short_code: order.order_number ? String(order.order_number).slice(-6) : null,
    outlet: 'Bar'
  }));

  const shiftTransactions: TransactionRecord[] = (shiftResult.data || [])
    .filter((transaction: any) => transaction.is_voided !== true)
    .map((transaction: any) => ({
      id: String(transaction.id),
      branch_id: Number(transaction.branch_id || requestData.branch_id),
      transaction_date: transaction.created_at,
      category: normalizeCategory(transaction.service_category, 'shift_transaction') as ServiceCategory,
      payment_method: normalizePaymentMethod(transaction.payment_method) as PaymentMethod,
      total_amount: Number(transaction.total_amount || 0),
      status: 'completed',
      source: 'shift_transaction',
      code: transaction.transaction_number || null,
      short_code: transaction.transaction_number ? String(transaction.transaction_number).slice(-6) : null,
      outlet: transaction.service_category || 'POS'
    }));

  const transactions = [...bookingTransactions, ...restaurantTransactions, ...barTransactions, ...shiftTransactions]
    .filter((transaction) => passesBranchSalesFilters(transaction, requestData.filters))
    .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());

  const totalSales = transactions.reduce((sum, transaction) => sum + Number(transaction.total_amount || 0), 0);
  const transactionCount = transactions.length;

  const dailyMap = new Map<string, { total_sales: number; transaction_count: number }>();
  const paymentMap = new Map<string, { total_sales: number; transaction_count: number }>();
  const categoryMap = new Map<string, { total_sales: number; transaction_count: number }>();

  transactions.forEach((transaction) => {
    const dateKey = buildDateKey(transaction.transaction_date);
    const paymentKey = String(transaction.payment_method || 'unknown').toLowerCase();
    const categoryKey = String(transaction.category || 'other').toLowerCase();
    const amount = Number(transaction.total_amount || 0);

    const dailyValue = dailyMap.get(dateKey) || { total_sales: 0, transaction_count: 0 };
    dailyValue.total_sales += amount;
    dailyValue.transaction_count += 1;
    dailyMap.set(dateKey, dailyValue);

    const paymentValue = paymentMap.get(paymentKey) || { total_sales: 0, transaction_count: 0 };
    paymentValue.total_sales += amount;
    paymentValue.transaction_count += 1;
    paymentMap.set(paymentKey, paymentValue);

    const categoryValue = categoryMap.get(categoryKey) || { total_sales: 0, transaction_count: 0 };
    categoryValue.total_sales += amount;
    categoryValue.transaction_count += 1;
    categoryMap.set(categoryKey, categoryValue);
  });

  return {
    data: {
      summary: {
        total_sales: Number(totalSales.toFixed(2)),
        transaction_count: transactionCount,
        avg_transaction_value: Number((transactionCount ? totalSales / transactionCount : 0).toFixed(2))
      },
      daily_breakdown: Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, value]) => ({
          date,
          total_sales: Number(value.total_sales.toFixed(2)),
          transaction_count: value.transaction_count,
          avg_transaction_value: Number((value.transaction_count ? value.total_sales / value.transaction_count : 0).toFixed(2))
        })),
      payment_method_breakdown: Array.from(paymentMap.entries())
        .map(([payment_method, value]) => ({
          payment_method: payment_method as PaymentMethod,
          total_sales: Number(value.total_sales.toFixed(2)),
          transaction_count: value.transaction_count,
          percentage: Number((totalSales ? (value.total_sales / totalSales) * 100 : 0).toFixed(2))
        }))
        .sort((a, b) => b.total_sales - a.total_sales),
      category_breakdown: Array.from(categoryMap.entries())
        .map(([category, value]) => ({
          category: category as ServiceCategory,
          total_sales: Number(value.total_sales.toFixed(2)),
          transaction_count: value.transaction_count,
          percentage: Number((totalSales ? (value.total_sales / totalSales) * 100 : 0).toFixed(2))
        }))
        .sort((a, b) => b.total_sales - a.total_sales),
      transactions
    },
    metadata: {
      branch_id: requestData.branch_id,
      branch_name: branchResult.data?.name || `Branch ${requestData.branch_id}`,
      date_range: {
        start: requestData.start_date,
        end: requestData.end_date
      },
      generated_at: new Date().toISOString(),
      filters_applied: requestData.filters || {}
    }
  };
};

const formatKes = (value: number | null | undefined): string =>
  `KES ${(value ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatPdfDate = (value: string | null | undefined): string => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('en-KE', { day: '2-digit', month: 'short', year: 'numeric' });
};

const getPdfLogoPath = (): string | null => {
  const candidates = [
    path.join(process.cwd(), '../frontend/public/fglogo.png'),
    path.join(process.cwd(), 'frontend/public/fglogo.png'),
    path.join(__dirname, '../../../frontend/public/fglogo.png')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

const drawFallbackHeader = (
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle: string
): number => {
  const logoPath = getPdfLogoPath();
  if (logoPath) {
    doc.image(logoPath, 40, 30, { width: 55 });
  } else {
    doc.circle(67, 57, 27).fill(PDF_PRIMARY);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold').text('FG', 53, 47);
  }

  doc.fillColor(PDF_PRIMARY).fontSize(15).font('Helvetica-Bold').text(COMPANY_NAME, 110, 30, {
    align: 'right'
  });
  doc.fontSize(9).font('Helvetica').fillColor(PDF_SECONDARY)
    .text(COMPANY_ADDRESS, 110, 50, { align: 'right' })
    .text(`Email: ${COMPANY_EMAIL}`, { align: 'right' })
    .text(`Tel: ${COMPANY_PHONE}`, { align: 'right' });

  doc.strokeColor(PDF_BORDER).lineWidth(1).moveTo(40, 100).lineTo(doc.page.width - 40, 100).stroke();
  doc.rect(40, 101, doc.page.width - 80, 3).fill(PDF_GOLD);
  doc.fillColor(PDF_PRIMARY).fontSize(14).font('Helvetica-Bold').text(title, 40, 114, { align: 'center' });
  doc.fontSize(9).font('Helvetica').fillColor(PDF_SECONDARY).text(subtitle, 40, 132, { align: 'center' });
  doc.strokeColor(PDF_BORDER).lineWidth(0.5).moveTo(40, 146).lineTo(doc.page.width - 40, 146).stroke();
  doc.fillColor(PDF_PRIMARY);
  return 158;
};

const drawFallbackFooter = (doc: PDFKit.PDFDocument): void => {
  const y = doc.page.height - 52;
  doc.strokeColor(PDF_BORDER).lineWidth(0.5).moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
  doc.fillColor(PDF_SECONDARY).fontSize(7.5).font('Helvetica')
    .text(`Generated: ${new Date().toLocaleString('en-KE')} | ${COMPANY_NAME} - Confidential`, 40, y + 7, {
      width: doc.page.width - 80,
      align: 'center',
      lineBreak: false,
      ellipsis: true
    });
};

const ensurePdfSpace = (doc: PDFKit.PDFDocument, y: number, needed = 60): number => {
  if (y + needed < doc.page.height - 70) return y;
  drawFallbackFooter(doc);
  doc.addPage();
  return drawFallbackHeader(doc, 'BRANCH SALES ANALYTICS REPORT', 'Continued');
};

const drawFallbackSectionTitle = (doc: PDFKit.PDFDocument, title: string, y: number): number => {
  doc.fillColor(PDF_PRIMARY).fontSize(11).font('Helvetica-Bold').text(title, 40, y);
  doc.rect(40, y + 15, doc.page.width - 80, 2).fill(PDF_GOLD);
  return y + 26;
};

const drawFallbackTable = (
  doc: PDFKit.PDFDocument,
  y: number,
  headers: string[],
  rows: string[][],
  widths: number[],
  aligns: Array<'left' | 'center' | 'right'> = []
): number => {
  const left = 40;
  let currentY = y;
  doc.rect(left, currentY, doc.page.width - 80, 20).fill(PDF_HEADER_BG);
  doc.fillColor('white').fontSize(7.5).font('Helvetica-Bold');
  let x = left + 6;
  headers.forEach((header, index) => {
    doc.text(header, x, currentY + 6, { width: widths[index] - 8, align: aligns[index] || 'left', ellipsis: true });
    x += widths[index];
  });
  currentY += 20;

  rows.forEach((row, rowIndex) => {
    currentY = ensurePdfSpace(doc, currentY, 22);
    if (rowIndex % 2 === 0) doc.rect(left, currentY, doc.page.width - 80, 18).fill(PDF_ROW_BG);
    doc.fillColor(PDF_PRIMARY).fontSize(7.5).font('Helvetica');
    x = left + 6;
    row.forEach((value, index) => {
      doc.text(value, x, currentY + 5, { width: widths[index] - 8, align: aligns[index] || 'left', ellipsis: true });
      x += widths[index];
    });
    doc.strokeColor(PDF_BORDER).lineWidth(0.3).moveTo(left, currentY + 18).lineTo(doc.page.width - 40, currentY + 18).stroke();
    currentY += 18;
  });
  return currentY + 12;
};

const buildFallbackBranchSalesPdf = async (response: BranchSalesResponse): Promise<Buffer> => {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const period = `${formatPdfDate(response.metadata.date_range.start)} to ${formatPdfDate(response.metadata.date_range.end)}`;
    let y = drawFallbackHeader(doc, 'BRANCH SALES ANALYTICS REPORT', `${response.metadata.branch_name} | ${period}`);

    doc.fillColor(PDF_SECONDARY).fontSize(8).font('Helvetica')
      .text(`Branch: ${response.metadata.branch_name}`, 40, y, { width: 180 })
      .text(`Report Period: ${period}`, 220, y, { width: 180 })
      .text(`Generated: ${new Date(response.metadata.generated_at).toLocaleString('en-KE')}`, 400, y, { width: 155 });
    y += 30;

    const summary = response.data.summary;
    const cards = [
      { label: 'TOTAL SALES', value: formatKes(summary.total_sales), color: PDF_PRIMARY },
      { label: 'TRANSACTIONS', value: summary.transaction_count.toLocaleString('en-KE'), color: PDF_ACCENT },
      { label: 'AVERAGE TICKET', value: formatKes(summary.avg_transaction_value), color: PDF_HEADER_BG }
    ];
    const cardWidth = (doc.page.width - 100) / 3;
    cards.forEach((card, index) => {
      const x = 40 + index * (cardWidth + 10);
      doc.roundedRect(x, y, cardWidth, 48, 4).fill(card.color);
      doc.fillColor(PDF_GOLD).fontSize(7.5).font('Helvetica-Bold').text(card.label, x + 10, y + 11, {
        width: cardWidth - 20,
        align: 'center'
      });
      doc.fillColor('white').fontSize(13).font('Helvetica-Bold').text(card.value, x + 10, y + 27, {
        width: cardWidth - 20,
        align: 'center',
        ellipsis: true
      });
    });
    y += 68;

    y = drawFallbackSectionTitle(doc, 'REVENUE BY PAYMENT METHOD', y);
    y = drawFallbackTable(
      doc,
      y,
      ['Payment Method', 'Transactions', 'Total Amount', '% of Sales'],
      response.data.payment_method_breakdown.map((item) => [
        String(item.payment_method || 'Unknown').toUpperCase(),
        Number(item.transaction_count || 0).toLocaleString('en-KE'),
        formatKes(item.total_sales),
        `${Number(item.percentage || 0).toFixed(1)}%`
      ]),
      [160, 95, 155, 95],
      ['left', 'center', 'right', 'center']
    );

    y = ensurePdfSpace(doc, y, 120);
    y = drawFallbackSectionTitle(doc, 'REVENUE BY CATEGORY', y);
    y = drawFallbackTable(
      doc,
      y,
      ['Category', 'Transactions', 'Total Amount', '% of Sales'],
      response.data.category_breakdown.map((item) => [
        String(item.category || 'Unknown').toUpperCase(),
        Number(item.transaction_count || 0).toLocaleString('en-KE'),
        formatKes(item.total_sales),
        `${Number(item.percentage || 0).toFixed(1)}%`
      ]),
      [160, 95, 155, 95],
      ['left', 'center', 'right', 'center']
    );

    y = ensurePdfSpace(doc, y, 120);
    y = drawFallbackSectionTitle(doc, 'DAILY SALES BREAKDOWN', y);
    y = drawFallbackTable(
      doc,
      y,
      ['Date', 'Transactions', 'Total Sales', 'Average Ticket'],
      response.data.daily_breakdown.slice(0, 31).map((item) => [
        formatPdfDate(item.date),
        Number(item.transaction_count || 0).toLocaleString('en-KE'),
        formatKes(item.total_sales),
        formatKes(item.avg_transaction_value)
      ]),
      [135, 105, 145, 120],
      ['left', 'center', 'right', 'right']
    );

    y = ensurePdfSpace(doc, y, 140);
    y = drawFallbackSectionTitle(doc, 'RECENT TRANSACTIONS', y);
    drawFallbackTable(
      doc,
      y,
      ['Date', 'Source', 'Category', 'Payment', 'Amount'],
      (response.data.transactions || []).slice(0, 40).map((transaction) => [
        formatPdfDate(buildDateKey(transaction.transaction_date)),
        String(transaction.source || '-'),
        String(transaction.category || '-'),
        String(transaction.payment_method || '-'),
        formatKes(Number(transaction.total_amount || 0))
      ]),
      [80, 95, 110, 95, 125],
      ['left', 'left', 'left', 'left', 'right']
    );

    drawFallbackFooter(doc);

    doc.end();
  });
};

const buildFallbackBranchSalesCsv = (response: BranchSalesResponse): string => {
  const parser = new Parser({
    fields: [
      { label: 'Transaction ID', value: 'id' },
      { label: 'Date', value: 'transaction_date' },
      { label: 'Source', value: 'source' },
      { label: 'Category', value: 'category' },
      { label: 'Payment Method', value: 'payment_method' },
      { label: 'Order Type', value: 'order_type' },
      { label: 'Status', value: 'status' },
      { label: 'Amount', value: 'total_amount' }
    ]
  });

  return parser.parse(response.data.transactions || []);
};

/**
 * Get branch sales analytics data
 * @route POST /api/analytics/branch-sales
 * @access Protected (branch_manager, general_manager, super_admin)
 */
export const getBranchSales = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validationResult = BranchSalesRequestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: validationResult.error.errors
      });
      return;
    }

    const requestData: BranchSalesRequest = validationResult.data;

    // Verify user has access to this branch
    const userBranchId = (req as any).user?.branch_id;
    const userRole = (req as any).user?.role;

    // Branch managers can only access their own branch
    // General managers and super admins can access any branch
    if (['branch_manager', 'branch_accountant'].includes(String(userRole)) && userBranchId !== requestData.branch_id) {
      res.status(403).json({
        error: 'Access denied. You can only view analytics for your assigned branch.',
        code: 'BRANCH_ACCESS_DENIED'
      });
      return;
    }

    logger.info('Fetching branch sales analytics', {
      user_id: (req as any).user?.id,
      branch_id: requestData.branch_id,
      date_range: { start: requestData.start_date, end: requestData.end_date }
    });

    // Forward request to Python analytics service
    const response = await axios.post<BranchSalesResponse>(
      `${ANALYTICS_SERVICE_URL}/api/analytics/branch-sales`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || ''
        },
        timeout: 30000 // 30 second timeout
      }
    );

    logger.info('Branch sales analytics fetched successfully', {
      branch_id: requestData.branch_id,
      total_sales: response.data.data.summary.total_sales
    });

    res.status(200).json(response.data);
  } catch (error: any) {
    logger.warn('Branch sales analytics service unavailable; attempting backend fallback', {
      error: error.message,
      status: error.response?.status,
      user_id: (req as any).user?.id
    });

    try {
      const fallbackResponse = await getFallbackBranchSalesResponse(req.body as BranchSalesRequest);
      logger.warn('Serving branch sales analytics from backend fallback', {
        branch_id: fallbackResponse.metadata.branch_id,
        user_id: (req as any).user?.id
      });
      res.status(200).json(fallbackResponse);
      return;
    } catch (fallbackError: any) {
      logger.error('Branch sales fallback failed', {
        error: fallbackError.message,
        user_id: (req as any).user?.id
      });
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.error || 'Failed to fetch analytics data';
      
      res.status(status).json({
        error: message,
        code: 'ANALYTICS_SERVICE_ERROR'
      });
    } else {
      res.status(500).json({
        error: 'An unexpected error occurred while fetching analytics',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
};

/**
 * Get branch sales summary (quick metrics)
 * @route GET /api/analytics/branch-sales/summary
 * @access Protected (branch_manager, general_manager, super_admin)
 */
export const getBranchSalesSummary = async (req: Request, res: Response): Promise<void> => {
  let branchId = 0;
  const periodValue = String(req.query.period || 'daily');
  let start_date = '';
  let end_date = '';
  let requestData: BranchSalesRequest | null = null;
  try {
    const { branch_id, period } = req.query;

    if (!branch_id) {
      res.status(400).json({
        error: 'branch_id is required',
        code: 'MISSING_PARAMETER'
      });
      return;
    }

    branchId = parseInt(branch_id as string, 10);
    if (isNaN(branchId)) {
      res.status(400).json({
        error: 'branch_id must be a valid number',
        code: 'INVALID_PARAMETER'
      });
      return;
    }

    // Verify user has access to this branch
    const userBranchId = (req as any).user?.branch_id;
    const userRole = (req as any).user?.role;

    if (['branch_manager', 'branch_accountant'].includes(String(userRole)) && userBranchId !== branchId) {
      res.status(403).json({
        error: 'Access denied. You can only view analytics for your assigned branch.',
        code: 'BRANCH_ACCESS_DENIED'
      });
      return;
    }

    // Calculate date range based on period (default: today)
    const today = new Date();
    end_date = today.toISOString().split('T')[0];

    switch (period) {
      case 'weekly':
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        start_date = weekAgo.toISOString().split('T')[0];
        break;
      case 'monthly':
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        start_date = monthAgo.toISOString().split('T')[0];
        break;
      case 'yearly':
        const yearAgo = new Date(today);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        start_date = yearAgo.toISOString().split('T')[0];
        break;
      default: // daily
        start_date = end_date;
    }

    requestData = {
      branch_id: branchId,
      start_date,
      end_date
    };

    logger.info('Fetching branch sales summary', {
      user_id: (req as any).user?.id,
      branch_id: branchId,
      period: periodValue
    });

    const response = await axios.post<BranchSalesResponse>(
      `${ANALYTICS_SERVICE_URL}/api/analytics/branch-sales`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || ''
        },
        timeout: 10000 // 10 second timeout for summary
      }
    );

    // Return only summary metrics for quick display
    res.status(200).json({
      data: response.data.data.summary,
      metadata: {
        branch_id: branchId,
        period: periodValue,
        date_range: { start: start_date, end: end_date }
      }
    });
  } catch (error: any) {
    logger.error('Error fetching branch sales summary', {
      error: error.message,
      user_id: (req as any).user?.id
    });

    try {
      if (!requestData) throw new Error('Fallback request data unavailable');
      const fallbackResponse = await getFallbackBranchSalesResponse(requestData);
      res.status(200).json({
        data: fallbackResponse.data.summary,
        metadata: {
          branch_id: branchId,
          period: periodValue,
          date_range: { start: start_date, end: end_date }
        }
      });
      return;
    } catch (fallbackError: any) {
      logger.error('Branch sales summary fallback failed', {
        error: fallbackError.message,
        user_id: (req as any).user?.id
      });
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.error || 'Failed to fetch summary';
      
      res.status(status).json({
        error: message,
        code: 'ANALYTICS_SERVICE_ERROR'
      });
    } else {
      res.status(500).json({
        error: 'An unexpected error occurred',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
};

/**
 * Export branch sales report as PDF
 * @route POST /api/analytics/branch-sales/export/pdf
 * @access Protected (branch_manager, general_manager, super_admin)
 */
export const exportBranchSalesPDF = async (req: Request, res: Response): Promise<void> => {
  let requestData: ExportRequest | null = null;
  try {
    const validationResult = ExportRequestSchema.safeParse({ ...req.body, format: 'pdf' });
    
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: validationResult.error.errors
      });
      return;
    }

    requestData = validationResult.data;

    // Verify user has access to this branch
    const userBranchId = (req as any).user?.branch_id;
    const userRole = (req as any).user?.role;

    if (['branch_manager', 'branch_accountant'].includes(String(userRole)) && userBranchId !== requestData.branch_id) {
      res.status(403).json({
        error: 'Access denied',
        code: 'BRANCH_ACCESS_DENIED'
      });
      return;
    }

    logger.info('Generating PDF report', {
      user_id: (req as any).user?.id,
      branch_id: requestData.branch_id
    });

    const response = await axios.post(
      `${ANALYTICS_SERVICE_URL}/api/analytics/branch-sales/export/pdf`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || ''
        },
        responseType: 'arraybuffer',
        timeout: 60000 // 60 second timeout for report generation
      }
    );

    const filename = `branch-sales-${requestData.branch_id}-${requestData.start_date}-${requestData.end_date}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(response.data));

    logger.info('PDF report generated successfully', {
      branch_id: requestData.branch_id,
      filename
    });
  } catch (error: any) {
    logger.error('Error generating PDF report', {
      error: error.message,
      user_id: (req as any).user?.id
    });

    try {
      if (!requestData) throw new Error('Fallback request data unavailable');
      const fallbackRequestData = requestData;
      const fallbackResponse = await getFallbackBranchSalesResponse(fallbackRequestData);
      const pdfBuffer = await buildFallbackBranchSalesPdf(fallbackResponse);
      const filename = `branch-sales-${fallbackRequestData.branch_id}-${fallbackRequestData.start_date}-${fallbackRequestData.end_date}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
      return;
    } catch (fallbackError: any) {
      logger.error('Branch sales PDF fallback failed', {
        error: fallbackError.message,
        user_id: (req as any).user?.id
      });
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      res.status(status).json({
        error: 'Failed to generate PDF report',
        code: 'REPORT_GENERATION_ERROR'
      });
    } else {
      res.status(500).json({
        error: 'An unexpected error occurred',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
};

/**
 * Export branch sales report as CSV
 * @route POST /api/analytics/branch-sales/export/csv
 * @access Protected (branch_manager, general_manager, super_admin)
 */
export const exportBranchSalesCSV = async (req: Request, res: Response): Promise<void> => {
  let requestData: ExportRequest | null = null;
  try {
    const validationResult = ExportRequestSchema.safeParse({ ...req.body, format: 'csv' });
    
    if (!validationResult.success) {
      res.status(400).json({
        error: 'Invalid request parameters',
        code: 'VALIDATION_ERROR',
        details: validationResult.error.errors
      });
      return;
    }

    requestData = validationResult.data;

    // Verify user has access to this branch
    const userBranchId = (req as any).user?.branch_id;
    const userRole = (req as any).user?.role;

    if (['branch_manager', 'branch_accountant'].includes(String(userRole)) && userBranchId !== requestData.branch_id) {
      res.status(403).json({
        error: 'Access denied',
        code: 'BRANCH_ACCESS_DENIED'
      });
      return;
    }

    logger.info('Generating CSV export', {
      user_id: (req as any).user?.id,
      branch_id: requestData.branch_id
    });

    const response = await axios.post(
      `${ANALYTICS_SERVICE_URL}/api/analytics/branch-sales/export/csv`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || ''
        },
        responseType: 'arraybuffer',
        timeout: 60000 // 60 second timeout
      }
    );

    const filename = `branch-sales-${requestData.branch_id}-${requestData.start_date}-${requestData.end_date}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(response.data));

    logger.info('CSV export generated successfully', {
      branch_id: requestData.branch_id,
      filename
    });
  } catch (error: any) {
    logger.error('Error generating CSV export', {
      error: error.message,
      user_id: (req as any).user?.id
    });

    try {
      if (!requestData) throw new Error('Fallback request data unavailable');
      const fallbackRequestData = requestData;
      const fallbackResponse = await getFallbackBranchSalesResponse(fallbackRequestData);
      const csv = buildFallbackBranchSalesCsv(fallbackResponse);
      const filename = `branch-sales-${fallbackRequestData.branch_id}-${fallbackRequestData.start_date}-${fallbackRequestData.end_date}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
      return;
    } catch (fallbackError: any) {
      logger.error('Branch sales CSV fallback failed', {
        error: fallbackError.message,
        user_id: (req as any).user?.id
      });
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      res.status(status).json({
        error: 'Failed to generate CSV export',
        code: 'EXPORT_GENERATION_ERROR'
      });
    } else {
      res.status(500).json({
        error: 'An unexpected error occurred',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
};

/**
 * Get a single branch-sale transaction with full POS detail (date/time, waiter,
 * items, payment method, outlet, order code + short code) — for the deep-dive
 * page opened from the Branch Sales & Payments feed.
 * @route GET /api/analytics/branch-sales/transaction/:source/:id
 * @access branch_manager, branch_accountant, auditor, director, gm, super_admin
 */
export const getBranchSaleTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const source = String(req.params.source || '');
    const id = String(req.params.id || '');
    const userRole = String((req as any).user?.role || '');
    const userBranchId = (req as any).user?.branch_id;
    const branchScoped = ['branch_manager', 'branch_accountant'].includes(userRole);

    const num = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

    const denyIfOtherBranch = (rowBranch: any): boolean =>
      branchScoped && userBranchId != null && Number(rowBranch) !== Number(userBranchId);

    let detail: Record<string, any> | null = null;

    if (source === 'restaurant') {
      const { data: order, error } = await supabase
        .from('restaurant_orders')
        .select('id, branch_id, order_number, bill_number, table_number, room_number, guest_name, waiter_id, department, payment_method, payment_status, status, total_amount, grand_total, service_charge, tax_amount, discount_amount, created_at, paid_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!order || denyIfOtherBranch(order.branch_id)) {
        res.status(404).json({ error: 'Order not found in your branch' });
        return;
      }

      const { data: rawItems } = await supabase
        .from('restaurant_order_items')
        .select('menu_item_id, quantity, unit_price, total_price, special_instructions')
        .eq('order_id', id);
      const menuIds = [...new Set((rawItems || []).map((i: any) => i.menu_item_id).filter(Boolean))];
      const nameById = new Map<string, string>();
      if (menuIds.length) {
        const { data: menu } = await supabase
          .from('restaurant_menu_items')
          .select('id, name')
          .in('id', menuIds);
        for (const m of (menu || []) as any[]) nameById.set(String(m.id), m.name);
      }
      let waiterName = '';
      if (order.waiter_id) {
        const { data: w } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', order.waiter_id)
          .maybeSingle();
        if (w) waiterName = `${w.first_name || ''} ${w.last_name || ''}`.trim();
      }

      detail = {
        source,
        id: String(order.id),
        code: order.order_number || order.bill_number || String(order.id),
        short_code: order.bill_number || (order.order_number ? String(order.order_number).slice(-6) : null),
        outlet: order.department || 'Restaurant',
        waiter_name: waiterName,
        customer_name: order.guest_name || null,
        table_number: order.table_number || order.room_number || null,
        payment_method: order.payment_method || null,
        payment_status: order.payment_status || null,
        status: order.status || null,
        date: order.created_at,
        paid_at: order.paid_at,
        subtotal: num(order.total_amount),
        service_charge: num(order.service_charge),
        tax_amount: num(order.tax_amount),
        discount_amount: num(order.discount_amount),
        total: num(order.grand_total) || num(order.total_amount),
        items: (rawItems || []).map((i: any) => ({
          name: nameById.get(String(i.menu_item_id)) || 'Item',
          quantity: num(i.quantity),
          unit_price: num(i.unit_price),
          total_price: num(i.total_price),
          notes: i.special_instructions || null,
        })),
      };
    } else if (source === 'bar') {
      const { data: order, error } = await supabase
        .from('bar_orders')
        .select('id, branch_id, order_number, room_number, seat_number, guest_name, created_by, payment_method, payment_status, status, subtotal, total, created_at, completed_at')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!order || denyIfOtherBranch(order.branch_id)) {
        res.status(404).json({ error: 'Order not found in your branch' });
        return;
      }
      const { data: items } = await supabase
        .from('bar_order_items')
        .select('drink_name, quantity, unit_price, total_price, notes')
        .eq('order_id', id);
      let waiterName = '';
      if (order.created_by) {
        const { data: w } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('id', order.created_by)
          .maybeSingle();
        if (w) waiterName = `${w.first_name || ''} ${w.last_name || ''}`.trim();
      }
      detail = {
        source,
        id: String(order.id),
        code: order.order_number || String(order.id),
        short_code: order.order_number ? String(order.order_number).slice(-6) : null,
        outlet: 'Bar',
        waiter_name: waiterName,
        customer_name: order.guest_name || null,
        table_number: order.seat_number || order.room_number || null,
        payment_method: order.payment_method || null,
        payment_status: order.payment_status || null,
        status: order.status || null,
        date: order.created_at,
        paid_at: order.completed_at,
        subtotal: num(order.subtotal),
        total: num(order.total),
        items: (items || []).map((i: any) => ({
          name: i.drink_name || 'Drink',
          quantity: num(i.quantity),
          unit_price: num(i.unit_price),
          total_price: num(i.total_price),
          notes: i.notes || null,
        })),
      };
    } else if (source === 'shift_transaction') {
      const { data: txn, error } = await supabase
        .from('shift_transactions')
        .select('id, branch_id, transaction_number, service_category, sales_point_id, served_by, customer_name, customer_room_number, payment_method, subtotal, discount_amount, tax_amount, total_amount, created_at, is_voided')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!txn || denyIfOtherBranch(txn.branch_id)) {
        res.status(404).json({ error: 'Transaction not found in your branch' });
        return;
      }
      let outlet = txn.service_category || 'POS';
      if (txn.sales_point_id) {
        const { data: sp } = await supabase
          .from('sales_points')
          .select('name, code')
          .eq('id', txn.sales_point_id)
          .maybeSingle();
        if (sp) outlet = sp.name || sp.code || outlet;
      }
      const { data: items } = await supabase
        .from('shift_transaction_items')
        .select('item_name, quantity, unit_price, total_price, service_staff_name, notes')
        .eq('transaction_id', id);
      const waiterName =
        ((items || []).find((i: any) => i.service_staff_name)?.service_staff_name as string) || '';
      detail = {
        source,
        id: String(txn.id),
        code: txn.transaction_number || String(txn.id),
        short_code: txn.transaction_number ? String(txn.transaction_number).slice(-6) : null,
        outlet,
        waiter_name: waiterName,
        customer_name: txn.customer_name || null,
        table_number: txn.customer_room_number || null,
        payment_method: txn.payment_method || null,
        status: txn.is_voided ? 'voided' : 'completed',
        date: txn.created_at,
        subtotal: num(txn.subtotal),
        discount_amount: num(txn.discount_amount),
        tax_amount: num(txn.tax_amount),
        total: num(txn.total_amount),
        items: (items || []).map((i: any) => ({
          name: i.item_name || 'Item',
          quantity: num(i.quantity),
          unit_price: num(i.unit_price),
          total_price: num(i.total_price),
          notes: i.notes || null,
        })),
      };
    } else if (source === 'booking') {
      const { data: b, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!b || denyIfOtherBranch(b.branch_id)) {
        res.status(404).json({ error: 'Booking not found in your branch' });
        return;
      }
      detail = {
        source,
        id: String(b.id),
        code: b.confirmation_number || b.booking_number || String(b.id),
        short_code: b.confirmation_number ? String(b.confirmation_number).slice(-6) : null,
        outlet: 'Rooms / Front Office',
        waiter_name: '',
        customer_name: b.guest_name || null,
        payment_method: b.payment_method || null,
        status: b.status || null,
        date: b.created_at,
        total: num(b.total_amount),
        items: [],
      };
    } else {
      res.status(400).json({ error: 'Unknown transaction source' });
      return;
    }

    res.status(200).json({ success: true, data: detail });
  } catch (error: any) {
    logger.error('getBranchSaleTransaction failed', { error: error.message });
    res.status(500).json({ error: 'Failed to load transaction detail', code: 'INTERNAL_SERVER_ERROR' });
  }
};
