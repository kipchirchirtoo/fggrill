import { Pool } from 'pg';
import { logger } from '../utils/logger';
import notificationService from './notification.service';
import { emailService } from './email.service';
import { pool } from '../config/pg';

interface StockAlert {
  sku: string;
  name: string;
  category: string;
  current_stock: number;
  reorder_level: number;
  branch_id?: number;
  branch_name?: string;
}

interface ComplianceAlert {
  id: string;
  branch_id: number;
  branch_name: string;
  category: string;
  requirement: string;
  due_date: string;
  days_remaining: number;
}

interface BudgetVarianceAlert {
  id: number;
  branch_id: number;
  branch_name: string;
  category: string;
  name: string;
  budgeted_amount: number;
  actual_amount: number;
  variance: number;
  variance_percentage: number;
}

interface PerformanceAlert {
  branch_id: number;
  branch_name: string;
  metric: string;
  current_value: number;
  target_value: number;
  threshold: number;
}

class AlertsService {
  private db: Pool;

  constructor() {
    this.db = pool;
  }

  /**
   * Check for low stock across central warehouse and branches
   */
  async checkLowStock(): Promise<number> {
    try {
      // Get low stock items from central warehouse
      const centralQuery = `
        SELECT 
          i.sku, 
          i.name, 
          i.category, 
          i.central_stock as current_stock, 
          i.reorder_level
        FROM inventory_items i
        WHERE i.central_stock <= i.reorder_level
      `;

      // Get low stock items from branches
      const branchQuery = `
        SELECT 
          i.sku, 
          i.name, 
          i.category, 
          bs.quantity as current_stock, 
          i.reorder_level,
          bs.branch_id,
          b.name as branch_name
        FROM branch_stock bs
        JOIN inventory_items i ON bs.item_sku = i.sku
        JOIN branches b ON bs.branch_id = b.id
        WHERE bs.quantity <= i.branch_reorder_level
      `;

      let centralAlerts: StockAlert[] = [];
      let branchAlerts: StockAlert[] = [];
      
      try {
        const centralResult = await this.db.query(centralQuery);
        centralAlerts = centralResult.rows;
      } catch (dbError) {
        logger.warn('Database unavailable for central stock check');
      }
      
      try {
        const branchResult = await this.db.query(branchQuery);
        branchAlerts = branchResult.rows;
      } catch (dbError) {
        logger.warn('Database unavailable for branch stock check');
      }

      // Send central warehouse alerts
      for (const alert of centralAlerts) {
        await this.sendLowStockAlert(alert, true);
      }

      // Send branch alerts
      for (const alert of branchAlerts) {
        await this.sendLowStockAlert(alert, false);
      }

      return centralAlerts.length + branchAlerts.length;
    } catch (error) {
      logger.error('Error checking low stock:', error);
      return 0;
    }
  }

  /**
   * Send low stock alert notification and email
   */
  private async sendLowStockAlert(alert: StockAlert, isCentral: boolean): Promise<void> {
    try {
      const title = isCentral
        ? `Low Stock Alert: ${alert.name}`
        : `Low Stock Alert: ${alert.name} at ${alert.branch_name}`;

      const message = isCentral
        ? `Central warehouse stock for ${alert.name} (${alert.sku}) is low. Current stock: ${alert.current_stock}, Reorder level: ${alert.reorder_level}`
        : `Branch ${alert.branch_name} stock for ${alert.name} (${alert.sku}) is low. Current stock: ${alert.current_stock}, Reorder level: ${alert.reorder_level}`;

      // Create notification for central operations team
      await notificationService.notifyRole('CENTRAL_OPERATIONS_MANAGER', title, message, {
        type: 'warning',
        category: 'inventory',
        priority: 'high',
        actionUrl: isCentral 
          ? '/dashboard/central-operations/warehouse/inventory' 
          : `/dashboard/central-operations/branch-oversight/comparison?branch=${alert.branch_id}`,
        metadata: { sku: alert.sku, currentStock: alert.current_stock, reorderLevel: alert.reorder_level }
      });

      // For branch alerts, also notify branch storekeepers
      if (!isCentral && alert.branch_id) {
        await notificationService.notifyBranch(alert.branch_id, title, message, {
          type: 'warning',
          category: 'inventory',
          priority: 'high',
          actionUrl: '/dashboard/storekeeping/inventory',
          metadata: { sku: alert.sku, currentStock: alert.current_stock, reorderLevel: alert.reorder_level }
        });

        // Get branch managers and storekeepers for email alerts
        const usersQuery = `
          SELECT u.id, u.name, u.email, u.role 
          FROM users u
          WHERE u.branch_id = $1 AND u.role IN ('BRANCH_MANAGER', 'STOREKEEPER')
        `;
        const { rows: users } = await this.db.query(usersQuery, [alert.branch_id]);
        
        // Send email to branch staff
        for (const user of users) {
          await emailService.sendEmail({
            to: user.email,
            subject: title,
            text: message,
            html: `
              <h2>Low Stock Alert</h2>
              <p>Dear ${user.name},</p>
              <p>${message}</p>
              <p>Please reorder this item soon.</p>
              <p>Thank you,<br>FG Grill Management System</p>
            `
          });
        }
      }

      // Get central operations team emails for central warehouse alerts
      if (isCentral) {
        const usersQuery = `
          SELECT u.id, u.name, u.email, u.role 
          FROM users u
          WHERE u.role = 'CENTRAL_OPERATIONS_MANAGER' OR u.role = 'CENTRAL_STOREKEEPER'
        `;
        const { rows: users } = await this.db.query(usersQuery);
        
        // Send email to central operations team
        for (const user of users) {
          await emailService.sendEmail({
            to: user.email,
            subject: title,
            text: message,
            html: `
              <h2>Low Stock Alert</h2>
              <p>Dear ${user.name},</p>
              <p>${message}</p>
              <p>Please reorder this item soon.</p>
              <p>Thank you,<br>FG Grill Management System</p>
            `
          });
        }
      }

    } catch (error) {
      logger.error('Error sending low stock alert:', error);
    }
  }

  /**
   * Check for compliance items nearing expiration
   */
  async checkComplianceExpiry(daysThreshold: number = 14): Promise<number> {
    try {
      const query = `
        SELECT 
          bc.id,
          bc.branch_id,
          b.name as branch_name,
          cr.category,
          cr.requirement,
          bc.due_date,
          EXTRACT(DAY FROM (bc.due_date - CURRENT_DATE)) as days_remaining
        FROM branch_compliance bc
        JOIN compliance_requirements cr ON bc.requirement_id = cr.id
        JOIN branches b ON bc.branch_id = b.id
        WHERE 
          bc.status IN ('pending', 'compliant') 
          AND bc.due_date IS NOT NULL
          AND bc.due_date > CURRENT_DATE
          AND bc.due_date <= (CURRENT_DATE + INTERVAL '${daysThreshold} days')
      `;

      let alerts: ComplianceAlert[] = [];
      
      try {
        const result = await this.db.query<ComplianceAlert>(query);
        alerts = result.rows;
      } catch (dbError) {
        logger.warn('Database unavailable for compliance check');
        return 0;
      }

      // Send compliance expiry alerts
      for (const alert of alerts) {
        await this.sendComplianceExpiryAlert(alert);
      }

      return alerts.length;
    } catch (error) {
      logger.error('Error checking compliance expiry:', error);
      return 0;
    }
  }

  /**
   * Send compliance expiry alert notification and email
   */
  private async sendComplianceExpiryAlert(alert: ComplianceAlert): Promise<void> {
    try {
      const title = `Compliance Alert: ${alert.requirement}`;
      const message = `${alert.requirement} for ${alert.branch_name} expires in ${alert.days_remaining} days (${new Date(alert.due_date).toLocaleDateString()})`;

      // Create notification for central operations team
      await notificationService.notifyRole('CENTRAL_OPERATIONS_MANAGER', title, message, {
        type: 'warning',
        category: 'compliance',
        priority: alert.days_remaining < 7 ? 'high' : 'medium',
        actionUrl: `/dashboard/central-operations/branch-oversight/compliance?branch=${alert.branch_id}`,
        metadata: { 
          id: alert.id, 
          dueDate: alert.due_date, 
          daysRemaining: alert.days_remaining 
        }
      });

      // Notify branch managers
      await notificationService.notifyBranch(alert.branch_id, title, message, {
        type: 'warning',
        category: 'compliance',
        priority: alert.days_remaining < 7 ? 'high' : 'medium',
        actionUrl: '/dashboard/branch/compliance',
        metadata: { 
          id: alert.id, 
          dueDate: alert.due_date, 
          daysRemaining: alert.days_remaining 
        }
      });

      // Get branch manager emails
      const usersQuery = `
        SELECT u.id, u.name, u.email, u.role 
        FROM users u
        WHERE u.branch_id = $1 AND u.role = 'BRANCH_MANAGER'
      `;
      const { rows: branchUsers } = await this.db.query(usersQuery, [alert.branch_id]);
      
      // Get compliance team emails
      const complianceUsersQuery = `
        SELECT u.id, u.name, u.email, u.role 
        FROM users u
        WHERE u.role = 'CENTRAL_OPERATIONS_MANAGER'
      `;
      const { rows: complianceUsers } = await this.db.query(complianceUsersQuery);
      
      const allUsers = [...branchUsers, ...complianceUsers];
      
      // Send email to branch managers and compliance team
      for (const user of allUsers) {
        await emailService.sendEmail({
          to: user.email,
          subject: title,
          text: message,
          html: `
            <h2>Compliance Alert</h2>
            <p>Dear ${user.name},</p>
            <p>${message}</p>
            <p>Please ensure this compliance requirement is addressed before expiry.</p>
            <p>Thank you,<br>FG Grill Management System</p>
          `
        });
      }

    } catch (error) {
      logger.error('Error sending compliance expiry alert:', error);
    }
  }

  /**
   * Check for budget variances exceeding threshold
   */
  async checkBudgetVariances(percentThreshold: number = 10): Promise<number> {
    try {
      const query = `
        SELECT 
          b.id,
          b.branch_id,
          br.name as branch_name,
          b.category,
          b.name,
          b.budgeted_amount,
          b.actual_amount,
          (b.actual_amount - b.budgeted_amount) as variance,
          CASE 
            WHEN b.budgeted_amount = 0 THEN 0
            ELSE ABS((b.actual_amount - b.budgeted_amount) / b.budgeted_amount * 100)
          END as variance_percentage
        FROM budgets b
        JOIN branches br ON b.branch_id = br.id
        WHERE 
          ABS((b.actual_amount - b.budgeted_amount) / 
              CASE WHEN b.budgeted_amount = 0 THEN 1 ELSE b.budgeted_amount END * 100) >= $1
      `;

      let alerts: BudgetVarianceAlert[] = [];
      
      try {
        const result = await this.db.query<BudgetVarianceAlert>(query, [percentThreshold]);
        alerts = result.rows;
      } catch (dbError) {
        logger.warn('Database unavailable for budget variance check');
        return 0;
      }

      // Send budget variance alerts
      for (const alert of alerts) {
        await this.sendBudgetVarianceAlert(alert);
      }

      return alerts.length;
    } catch (error) {
      logger.error('Error checking budget variances:', error);
      return 0;
    }
  }

  /**
   * Send budget variance alert notification and email
   */
  private async sendBudgetVarianceAlert(alert: BudgetVarianceAlert): Promise<void> {
    try {
      const isOverBudget = alert.actual_amount > alert.budgeted_amount;
      const title = `Budget Alert: ${alert.name} ${isOverBudget ? 'Over Budget' : 'Under Budget'}`;
      const message = `${alert.name} for ${alert.branch_name} is ${isOverBudget ? 'over' : 'under'} budget by ${Math.abs(alert.variance).toLocaleString()} (${alert.variance_percentage.toFixed(1)}%)`;

      // Create notification for central operations team
      await notificationService.notifyRole('CENTRAL_OPERATIONS_MANAGER', title, message, {
        type: 'warning',
        category: 'budget',
        priority: alert.variance_percentage >= 20 ? 'high' : 'medium',
        actionUrl: `/dashboard/central-operations/strategic-planning/budgets?branch=${alert.branch_id}`,
        metadata: { 
          id: alert.id,
          budgeted: alert.budgeted_amount,
          actual: alert.actual_amount,
          variance: alert.variance,
          variancePercentage: alert.variance_percentage
        }
      });

      // Notify branch managers
      await notificationService.notifyBranch(alert.branch_id, title, message, {
        type: 'warning',
        category: 'budget',
        priority: alert.variance_percentage >= 20 ? 'high' : 'medium',
        actionUrl: '/dashboard/branch/finances',
        metadata: { 
          id: alert.id,
          budgeted: alert.budgeted_amount,
          actual: alert.actual_amount,
          variance: alert.variance,
          variancePercentage: alert.variance_percentage
        }
      });

      // Get branch manager and finance emails
      const usersQuery = `
        SELECT u.id, u.name, u.email, u.role 
        FROM users u
        WHERE (u.branch_id = $1 AND u.role = 'BRANCH_MANAGER') OR
              u.role IN ('CENTRAL_OPERATIONS_MANAGER', 'FINANCE_MANAGER')
      `;
      const { rows: users } = await this.db.query(usersQuery, [alert.branch_id]);
      
      // Send email to branch managers and finance team
      for (const user of users) {
        await emailService.sendEmail({
          to: user.email,
          subject: title,
          text: message,
          html: `
            <h2>Budget Variance Alert</h2>
            <p>Dear ${user.name},</p>
            <p>${message}</p>
            <p>Budgeted: ${alert.budgeted_amount.toLocaleString()}</p>
            <p>Actual: ${alert.actual_amount.toLocaleString()}</p>
            <p>Variance: ${alert.variance.toLocaleString()} (${alert.variance_percentage.toFixed(1)}%)</p>
            <p>Please review this budget line item.</p>
            <p>Thank you,<br>FG Grill Management System</p>
          `
        });
      }

    } catch (error) {
      logger.error('Error sending budget variance alert:', error);
    }
  }

  /**
   * Check for performance metrics below threshold
   */
  async checkPerformanceMetrics(thresholdPercent: number = 15): Promise<number> {
    try {
      // Get branch performance metrics
      const query = `
        SELECT 
          bpm.branch_id,
          b.name as branch_name,
          'revenue' as metric,
          bpm.revenue as current_value,
          bpm.revenue_target as target_value,
          CASE 
            WHEN bpm.revenue_target = 0 THEN 0
            ELSE ((bpm.revenue_target - bpm.revenue) / bpm.revenue_target * 100)
          END as threshold
        FROM branch_performance_metrics bpm
        JOIN branches b ON bpm.branch_id = b.id
        WHERE 
          bpm.period_end >= CURRENT_DATE - INTERVAL '7 days' AND
          bpm.period_end <= CURRENT_DATE AND
          bpm.revenue_target > 0 AND
          ((bpm.revenue_target - bpm.revenue) / bpm.revenue_target * 100) >= $1

        UNION

        SELECT 
          bpm.branch_id,
          b.name as branch_name,
          'customer_satisfaction' as metric,
          bpm.customer_satisfaction as current_value,
          4.0 as target_value,
          ((4.0 - bpm.customer_satisfaction) / 4.0 * 100) as threshold
        FROM branch_performance_metrics bpm
        JOIN branches b ON bpm.branch_id = b.id
        WHERE 
          bpm.period_end >= CURRENT_DATE - INTERVAL '7 days' AND
          bpm.period_end <= CURRENT_DATE AND
          ((4.0 - bpm.customer_satisfaction) / 4.0 * 100) >= $1

        UNION

        SELECT 
          bpm.branch_id,
          b.name as branch_name,
          'staff_efficiency' as metric,
          bpm.staff_efficiency as current_value,
          80.0 as target_value,
          ((80.0 - bpm.staff_efficiency) / 80.0 * 100) as threshold
        FROM branch_performance_metrics bpm
        JOIN branches b ON bpm.branch_id = b.id
        WHERE 
          bpm.period_end >= CURRENT_DATE - INTERVAL '7 days' AND
          bpm.period_end <= CURRENT_DATE AND
          ((80.0 - bpm.staff_efficiency) / 80.0 * 100) >= $1
      `;

      let alerts: PerformanceAlert[] = [];
      
      try {
        const result = await this.db.query<PerformanceAlert>(query, [thresholdPercent]);
        alerts = result.rows;
      } catch (dbError) {
        logger.warn('Database unavailable for performance metrics check');
        return 0;
      }

      // Send performance alerts
      for (const alert of alerts) {
        await this.sendPerformanceAlert(alert);
      }

      return alerts.length;
    } catch (error) {
      logger.error('Error checking performance metrics:', error);
      return 0;
    }
  }

  /**
   * Send performance alert notification and email
   */
  private async sendPerformanceAlert(alert: PerformanceAlert): Promise<void> {
    try {
      const metricName = alert.metric.charAt(0).toUpperCase() + alert.metric.slice(1).replace('_', ' ');
      const title = `Performance Alert: ${alert.branch_name} ${metricName}`;
      const message = `${alert.branch_name} ${metricName} is below target: ${alert.current_value.toFixed(1)} vs target ${alert.target_value.toFixed(1)} (${alert.threshold.toFixed(1)}% below target)`;

      // Create notification for central operations team
      await notificationService.notifyRole('CENTRAL_OPERATIONS_MANAGER', title, message, {
        type: 'warning',
        category: 'performance',
        priority: alert.threshold >= 25 ? 'high' : 'medium',
        actionUrl: `/dashboard/central-operations/branch-oversight/performance?branch=${alert.branch_id}`,
        metadata: { 
          metric: alert.metric,
          current: alert.current_value,
          target: alert.target_value,
          threshold: alert.threshold
        }
      });

      // Notify branch managers
      await notificationService.notifyBranch(alert.branch_id, title, message, {
        type: 'warning',
        category: 'performance',
        priority: alert.threshold >= 25 ? 'high' : 'medium',
        actionUrl: '/dashboard/branch/performance',
        metadata: { 
          metric: alert.metric,
          current: alert.current_value,
          target: alert.target_value,
          threshold: alert.threshold
        }
      });

      // Get branch manager emails
      const usersQuery = `
        SELECT u.id, u.name, u.email, u.role 
        FROM users u
        WHERE (u.branch_id = $1 AND u.role = 'BRANCH_MANAGER') OR
              u.role IN ('CENTRAL_OPERATIONS_MANAGER', 'GENERAL_MANAGER')
      `;
      const { rows: users } = await this.db.query(usersQuery, [alert.branch_id]);
      
      // Send email to branch managers and central operations
      for (const user of users) {
        await emailService.sendEmail({
          to: user.email,
          subject: title,
          text: message,
          html: `
            <h2>Performance Alert</h2>
            <p>Dear ${user.name},</p>
            <p>${message}</p>
            <p>Metric: ${metricName}</p>
            <p>Current Value: ${alert.current_value.toFixed(1)}</p>
            <p>Target: ${alert.target_value.toFixed(1)}</p>
            <p>Performance Gap: ${alert.threshold.toFixed(1)}%</p>
            <p>Please review branch performance and take necessary action.</p>
            <p>Thank you,<br>FG Grill Management System</p>
          `
        });
      }

    } catch (error) {
      logger.error('Error sending performance alert:', error);
    }
  }
}

export default new AlertsService();
