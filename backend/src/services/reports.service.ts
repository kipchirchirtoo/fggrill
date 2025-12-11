import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { emailService } from './email.service';
import { pool } from '../config/pg';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Report types for scheduled reports
type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';

// Report definitions
interface ReportDefinition {
  name: string;
  description: string;
  formats: ('pdf' | 'excel')[];
  recipients: {
    roles?: string[];
    emails?: string[];
  };
  endpoint: string;
  schedule: ReportPeriod[];
}

class ReportsService {
  private db: Pool;
  private pythonServiceUrl: string;
  private scheduledReports: ReportDefinition[];

  constructor() {
    this.db = pool;
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
    
    // Define scheduled reports
    this.scheduledReports = [
      {
        name: 'Branch Performance Summary',
        description: 'Summary of key performance metrics across all branches',
        formats: ['pdf', 'excel'],
        recipients: {
          roles: ['CENTRAL_OPERATIONS_MANAGER', 'GENERAL_MANAGER']
        },
        endpoint: '/api/reports/generate/branded-pdf?reportType=branch_performance',
        schedule: ['daily', 'weekly']
      },
      {
        name: 'Staff Overview',
        description: 'Overview of staff performance and attendance',
        formats: ['pdf', 'excel'],
        recipients: {
          roles: ['CENTRAL_OPERATIONS_MANAGER', 'HR_MANAGER']
        },
        endpoint: '/api/reports/generate/branded-pdf?reportType=staff_overview',
        schedule: ['weekly']
      },
      {
        name: 'Compliance Summary',
        description: 'Summary of compliance status across all branches',
        formats: ['pdf'],
        recipients: {
          roles: ['CENTRAL_OPERATIONS_MANAGER', 'GENERAL_MANAGER']
        },
        endpoint: '/api/reports/generate/branded-pdf?reportType=compliance',
        schedule: ['weekly']
      },
      {
        name: 'Inventory Status',
        description: 'Current inventory levels and stock alerts',
        formats: ['pdf', 'excel'],
        recipients: {
          roles: ['CENTRAL_OPERATIONS_MANAGER', 'CENTRAL_STOREKEEPER']
        },
        endpoint: '/api/reports/generate/branded-pdf?reportType=inventory',
        schedule: ['daily', 'weekly']
      },
      {
        name: 'Budget vs Actual',
        description: 'Comparison of budgeted vs actual expenses',
        formats: ['pdf', 'excel'],
        recipients: {
          roles: ['CENTRAL_OPERATIONS_MANAGER', 'FINANCE_MANAGER']
        },
        endpoint: '/api/reports/generate/branded-pdf?reportType=budget_variance',
        schedule: ['weekly', 'monthly']
      }
    ];
  }

  /**
   * Generate scheduled reports based on period
   */
  async generateScheduledReports(period: ReportPeriod): Promise<number> {
    try {
      // Filter reports that should be generated for this period
      const reportsToGenerate = this.scheduledReports.filter(
        report => report.schedule.includes(period)
      );
      
      let generatedCount = 0;
      
      // Generate each report
      for (const report of reportsToGenerate) {
        for (const format of report.formats) {
          try {
            await this.generateAndSendReport(report, format, period);
            generatedCount++;
          } catch (error) {
            logger.error(`Error generating ${format} report for ${report.name}:`, error);
          }
        }
      }
      
      return generatedCount;
    } catch (error) {
      logger.error('Error generating scheduled reports:', error);
      return 0;
    }
  }

  /**
   * Generate and send a specific report
   */
  private async generateAndSendReport(
    report: ReportDefinition, 
    format: 'pdf' | 'excel',
    period: ReportPeriod = 'daily'
  ): Promise<boolean> {
    try {
      // Build the correct endpoint based on format
      let endpoint = '';
      
      if (format === 'pdf') {
        endpoint = report.endpoint;
      } else if (format === 'excel') {
        endpoint = report.endpoint.replace('branded-pdf', 'excel');
      }
      
      // Call Python service to generate the report
      const response = await axios({
        method: 'post',
        url: `${this.pythonServiceUrl}${endpoint}`,
        responseType: 'arraybuffer',
        data: {
          useRealData: true
        }
      });
      
      // Save the report to a temporary file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${report.name.replace(/\s+/g, '_')}_${timestamp}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      const filePath = path.join(__dirname, '../temp', fileName);
      
      // Ensure the temp directory exists
      if (!fs.existsSync(path.join(__dirname, '../temp'))) {
        fs.mkdirSync(path.join(__dirname, '../temp'), { recursive: true });
      }
      
      // Write the file
      fs.writeFileSync(filePath, response.data);
      
      // Get list of recipients
      const recipients = await this.getReportRecipients(report);
      
      // Send email with attachment to each recipient
      for (const recipient of recipients) {
        await emailService.sendEmail({
          to: recipient.email,
          subject: `${period.charAt(0).toUpperCase() + period.slice(1)} ${report.name} Report`,
          html: `
            <h2>${report.name}</h2>
            <p>Dear ${recipient.name},</p>
            <p>Attached is the ${period} ${report.name} report.</p>
            <p>${report.description}</p>
            <p>Thank you,<br>FG Grill Management System</p>
          `,
          text: `${report.name}\n\nDear ${recipient.name},\n\nAttached is the ${period} ${report.name} report.\n\n${report.description}\n\nThank you,\nFG Grill Management System`,
          attachments: [
            {
              filename: fileName,
              path: filePath
            }
          ]
        });
      }
      
      // Delete the temporary file
      fs.unlinkSync(filePath);
      
      return true;
    } catch (error) {
      logger.error(`Error generating and sending report ${report.name}:`, error);
      return false;
    }
  }

  /**
   * Get list of recipients for a report
   */
  private async getReportRecipients(report: ReportDefinition): Promise<Array<{ email: string, name: string }>> {
    const recipients = [];
    
    // Add role-based recipients
    if (report.recipients.roles && report.recipients.roles.length > 0) {
      const roleQuery = `
        SELECT name, email 
        FROM users 
        WHERE role = ANY($1) AND active = true
      `;
      
      const { rows } = await this.db.query(roleQuery, [report.recipients.roles]);
      recipients.push(...rows);
    }
    
    // Add specific email recipients
    if (report.recipients.emails && report.recipients.emails.length > 0) {
      for (const email of report.recipients.emails) {
        // Check if not already added from roles
        if (!recipients.find(r => r.email === email)) {
          recipients.push({ email, name: email.split('@')[0] });
        }
      }
    }
    
    return recipients;
  }

  /**
   * Manual report generation for a specific type
   */
  async generateReport(
    reportType: string,
    format: 'pdf' | 'excel',
    filters: Record<string, any> = {},
    recipient?: { email: string, name: string }
  ): Promise<string | null> {
    try {
      // Find report definition
      const report = this.scheduledReports.find(r => r.name.toLowerCase().includes(reportType.toLowerCase()));
      
      if (!report) {
        logger.error(`Report type not found: ${reportType}`);
        return null;
      }
      
      // Build endpoint based on format
      let endpoint = '';
      
      if (format === 'pdf') {
        endpoint = report.endpoint;
      } else if (format === 'excel') {
        endpoint = report.endpoint.replace('branded-pdf', 'excel');
      }
      
      // Add filters to endpoint
      if (Object.keys(filters).length > 0) {
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(filters)) {
          queryParams.append(key, value);
        }
        endpoint += `&${queryParams.toString()}`;
      }
      
      // Call Python service to generate the report
      const response = await axios({
        method: 'post',
        url: `${this.pythonServiceUrl}${endpoint}`,
        responseType: 'arraybuffer',
        data: {
          useRealData: true,
          filters
        }
      });
      
      // Save the report to a temporary file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${reportType.replace(/\s+/g, '_')}_${timestamp}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      const filePath = path.join(__dirname, '../temp', fileName);
      
      // Ensure the temp directory exists
      if (!fs.existsSync(path.join(__dirname, '../temp'))) {
        fs.mkdirSync(path.join(__dirname, '../temp'), { recursive: true });
      }
      
      // Write the file
      fs.writeFileSync(filePath, response.data);
      
      // Send email if recipient is provided
      if (recipient) {
        await emailService.sendEmail({
          to: recipient.email,
          subject: `${report.name} Report`,
          html: `
            <h2>${report.name}</h2>
            <p>Dear ${recipient.name},</p>
            <p>Attached is the requested ${report.name} report.</p>
            <p>${report.description}</p>
            <p>Thank you,<br>FG Grill Management System</p>
          `,
          text: `${report.name}\n\nDear ${recipient.name},\n\nAttached is the requested ${report.name} report.\n\n${report.description}\n\nThank you,\nFG Grill Management System`,
          attachments: [
            {
              filename: fileName,
              path: filePath
            }
          ]
        });
      }
      
      return filePath;
    } catch (error) {
      logger.error(`Error generating report ${reportType}:`, error);
      return null;
    }
  }
}

export default new ReportsService();
