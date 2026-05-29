// Branch Analytics Controller
// Handles all analytics requests for branch managers

import { Request, Response } from 'express';
import axios from 'axios';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { Parser } from 'json2csv';
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
      .select('id, branch_id, total_amount, payment_method, order_type, created_at, status')
      .eq('branch_id', requestData.branch_id)
      .gte('created_at', startTimestamp)
      .lte('created_at', endTimestamp)
      .not('status', 'eq', 'cancelled'),
    supabase
      .from('shift_transactions')
      .select('id, branch_id, total_amount, payment_method, service_category, created_at, is_voided')
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
    total_amount: Number(order.total_amount || 0),
    status: String(order.status || 'completed'),
    source: 'restaurant'
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
      source: 'shift_transaction'
    }));

  const transactions = [...bookingTransactions, ...restaurantTransactions, ...shiftTransactions]
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

const buildFallbackBranchSalesPdf = async (response: BranchSalesResponse): Promise<Buffer> => {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text('Branch Sales Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Branch: ${response.metadata.branch_name}`);
    doc.text(`Period: ${response.metadata.date_range.start} to ${response.metadata.date_range.end}`);
    doc.text(`Generated: ${new Date(response.metadata.generated_at).toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(12).text('Summary', { underline: true });
    doc.fontSize(10).text(`Total Sales: KES ${response.data.summary.total_sales.toLocaleString()}`);
    doc.text(`Transactions: ${response.data.summary.transaction_count.toLocaleString()}`);
    doc.text(`Average Value: KES ${response.data.summary.avg_transaction_value.toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(12).text('Recent Transactions', { underline: true });
    doc.moveDown(0.5);

    response.data.transactions?.slice(0, 40).forEach((transaction) => {
      if (doc.y > 740) {
        doc.addPage();
      }

      doc
        .fontSize(9)
        .text(
          `${buildDateKey(transaction.transaction_date)} | ${transaction.source} | ${String(transaction.category)} | ${String(transaction.payment_method)} | KES ${Number(transaction.total_amount || 0).toLocaleString()}`
        );
    });

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
