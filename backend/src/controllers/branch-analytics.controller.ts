// Branch Analytics Controller
// Handles all analytics requests for branch managers

import { Request, Response } from 'express';
import axios from 'axios';
import { z } from 'zod';
import {
  BranchSalesRequest,
  BranchSalesResponse,
  ExportRequest,
  PaymentMethod,
  OrderType,
  ServiceCategory
} from '../types/analytics.types';
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
    if (userRole === 'branch_manager' && userBranchId !== requestData.branch_id) {
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
    logger.error('Error fetching branch sales analytics', {
      error: error.message,
      stack: error.stack,
      user_id: (req as any).user?.id
    });

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
  try {
    const { branch_id, period } = req.query;

    if (!branch_id) {
      res.status(400).json({
        error: 'branch_id is required',
        code: 'MISSING_PARAMETER'
      });
      return;
    }

    const branchId = parseInt(branch_id as string, 10);
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

    if (userRole === 'branch_manager' && userBranchId !== branchId) {
      res.status(403).json({
        error: 'Access denied. You can only view analytics for your assigned branch.',
        code: 'BRANCH_ACCESS_DENIED'
      });
      return;
    }

    // Calculate date range based on period (default: today)
    const today = new Date();
    let start_date: string;
    let end_date: string = today.toISOString().split('T')[0];

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

    const requestData: BranchSalesRequest = {
      branch_id: branchId,
      start_date,
      end_date
    };

    logger.info('Fetching branch sales summary', {
      user_id: (req as any).user?.id,
      branch_id: branchId,
      period
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
        period,
        date_range: { start: start_date, end: end_date }
      }
    });
  } catch (error: any) {
    logger.error('Error fetching branch sales summary', {
      error: error.message,
      user_id: (req as any).user?.id
    });

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

    const requestData: ExportRequest = validationResult.data;

    // Verify user has access to this branch
    const userBranchId = (req as any).user?.branch_id;
    const userRole = (req as any).user?.role;

    if (userRole === 'branch_manager' && userBranchId !== requestData.branch_id) {
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
      `${ANALYTICS_SERVICE_URL}/api/reports/branch-sales-pdf`,
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

    const requestData: ExportRequest = validationResult.data;

    // Verify user has access to this branch
    const userBranchId = (req as any).user?.branch_id;
    const userRole = (req as any).user?.role;

    if (userRole === 'branch_manager' && userBranchId !== requestData.branch_id) {
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
      `${ANALYTICS_SERVICE_URL}/api/reports/branch-sales-csv`,
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
