import { supabase } from '../config/database';
import crypto from 'crypto';

export enum ReportType {
  OCCUPANCY = 'occupancy',
  REVENUE = 'revenue',
  INVENTORY = 'inventory',
  MAINTENANCE = 'maintenance',
  HOUSEKEEPING = 'housekeeping',
  GUEST = 'guest',
  STAFF = 'staff',
  AUDIT = 'audit'
}

export enum ReportPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom'
}

export interface IReportFilter {
  field: string;
  operator: 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in' | 'like';
  value: any;
}

export interface IReportSort {
  field: string;
  direction: 'asc' | 'desc';
}

export interface IReportSchedule {
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  dayOfMonth?: number;
  time: string;
  recipients: string[];
  lastRun?: Date;
  nextRun?: Date;
  active: boolean;
}

export interface IReport {
  id: string;
  name: string;
  description?: string;
  type: ReportType;
  period: ReportPeriod;
  startDate?: Date;
  endDate?: Date;
  filters?: IReportFilter[];
  sort?: IReportSort[];
  schedule?: IReportSchedule;
  format: 'pdf' | 'excel' | 'csv';
  data?: any;
  generatedAt?: Date;
  generatedBy?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
  isTemplate: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Report implements IReport {
  id: string;
  name: string;
  description?: string;
  type: ReportType;
  period: ReportPeriod;
  startDate?: Date;
  endDate?: Date;
  filters?: IReportFilter[];
  sort?: IReportSort[];
  schedule?: IReportSchedule;
  format: 'pdf' | 'excel' | 'csv';
  data?: any;
  generatedAt?: Date;
  generatedBy?: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  error?: string;
  isTemplate: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IReport>) {
    this.id = data.id || crypto.randomUUID();
    this.name = data.name || '';
    this.description = data.description;
    this.type = data.type || ReportType.OCCUPANCY;
    this.period = data.period || ReportPeriod.DAILY;
    this.startDate = data.startDate;
    this.endDate = data.endDate;
    this.filters = data.filters;
    this.sort = data.sort;
    this.schedule = data.schedule;
    this.format = data.format || 'pdf';
    this.data = data.data;
    this.generatedAt = data.generatedAt;
    this.generatedBy = data.generatedBy;
    this.status = data.status || 'pending';
    this.error = data.error;
    this.isTemplate = data.isTemplate || false;
    this.createdBy = data.createdBy || '';
    this.updatedBy = data.updatedBy || '';
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async findById(id: string): Promise<Report | null> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return new Report(data);
  }

  static async findByType(type: ReportType): Promise<Report[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('type', type)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(report => new Report(report));
  }

  static async findTemplates(): Promise<Report[]> {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('is_template', true)
      .order('name', { ascending: true });

    if (error || !data) return [];
    return data.map(report => new Report(report));
  }

  async save(): Promise<Report> {
    const { data, error } = await supabase
      .from('reports')
      .upsert([
        {
          id: this.id,
          name: this.name,
          description: this.description,
          type: this.type,
          period: this.period,
          start_date: this.startDate,
          end_date: this.endDate,
          filters: this.filters,
          sort: this.sort,
          schedule: this.schedule,
          format: this.format,
          data: this.data,
          generated_at: this.generatedAt,
          generated_by: this.generatedBy,
          status: this.status,
          error: this.error,
          is_template: this.isTemplate,
          created_by: this.createdBy,
          updated_by: this.updatedBy,
          updated_at: new Date()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return new Report(data);
  }

  async delete(): Promise<void> {
    const { error } = await supabase
      .from('reports')
      .delete()
      .eq('id', this.id);

    if (error) throw error;
  }

  async generateReport(): Promise<void> {
    try {
      this.status = 'generating';
      await this.save();

      // Generate report data based on type
      switch (this.type) {
        case ReportType.OCCUPANCY:
          await this.generateOccupancyReport();
          break;
        case ReportType.REVENUE:
          await this.generateRevenueReport();
          break;
        case ReportType.INVENTORY:
          await this.generateInventoryReport();
          break;
        case ReportType.MAINTENANCE:
          await this.generateMaintenanceReport();
          break;
        case ReportType.HOUSEKEEPING:
          await this.generateHousekeepingReport();
          break;
        case ReportType.GUEST:
          await this.generateGuestReport();
          break;
        case ReportType.STAFF:
          await this.generateStaffReport();
          break;
        case ReportType.AUDIT:
          await this.generateAuditReport();
          break;
      }

      this.status = 'completed';
      this.generatedAt = new Date();
      await this.save();
    } catch (error) {
      this.status = 'failed';
      this.error = error instanceof Error ? error.message : 'Unknown error';
      await this.save();
      throw error;
    }
  }

  private async generateOccupancyReport(): Promise<void> {
    // Implement occupancy report generation logic
  }

  private async generateRevenueReport(): Promise<void> {
    // Implement revenue report generation logic
  }

  private async generateInventoryReport(): Promise<void> {
    // Implement inventory report generation logic
  }

  private async generateMaintenanceReport(): Promise<void> {
    // Implement maintenance report generation logic
  }

  private async generateHousekeepingReport(): Promise<void> {
    // Implement housekeeping report generation logic
  }

  private async generateGuestReport(): Promise<void> {
    // Implement guest report generation logic
  }

  private async generateStaffReport(): Promise<void> {
    // Implement staff report generation logic
  }

  private async generateAuditReport(): Promise<void> {
    // Implement audit report generation logic
  }
}
