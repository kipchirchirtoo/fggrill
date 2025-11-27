import { supabase } from '../config/database';
import crypto from 'crypto';

export enum MaintenanceType {
  CORRECTIVE = 'corrective',
  PREVENTIVE = 'preventive',
  EMERGENCY = 'emergency',
  INSPECTION = 'inspection'
}

export enum MaintenancePriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum MaintenanceStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in-progress',
  ON_HOLD = 'on-hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface IMaintenanceTask {
  id: string;
  taskNumber: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  title: string;
  assetId?: string;
  location: string;
  description: string;
  reportedBy: string;
  reportedAt: Date;
  assignedTo?: string;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  parts?: Array<{
    id: string;
    name: string;
    quantity: number;
    cost: number;
  }>;
  laborCost?: number;
  totalCost?: number;
  photos?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class MaintenanceTask implements IMaintenanceTask {
  id: string;
  taskNumber: string;
  type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  title: string;
  assetId?: string;
  location: string;
  description: string;
  reportedBy: string;
  reportedAt: Date;
  assignedTo?: string;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  parts?: Array<{
    id: string;
    name: string;
    quantity: number;
    cost: number;
  }>;
  laborCost?: number;
  totalCost?: number;
  photos?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IMaintenanceTask>) {
    this.id = data.id || crypto.randomUUID();
    this.taskNumber = data.taskNumber || '';
    this.type = data.type || MaintenanceType.CORRECTIVE;
    this.priority = data.priority || MaintenancePriority.MEDIUM;
    this.status = data.status || MaintenanceStatus.PENDING;
    this.title = data.title || '';
    this.assetId = data.assetId;
    this.location = data.location || '';
    this.description = data.description || '';
    this.reportedBy = data.reportedBy || '';
    this.reportedAt = data.reportedAt || new Date();
    this.assignedTo = data.assignedTo;
    this.assignedAt = data.assignedAt;
    this.startedAt = data.startedAt;
    this.completedAt = data.completedAt;
    this.estimatedDuration = data.estimatedDuration;
    this.actualDuration = data.actualDuration;
    this.parts = data.parts;
    this.laborCost = data.laborCost;
    this.totalCost = data.totalCost;
    this.photos = data.photos;
    this.notes = data.notes;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async findById(id: string): Promise<MaintenanceTask | null> {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return new MaintenanceTask(data);
  }

  static async findByNumber(taskNumber: string): Promise<MaintenanceTask | null> {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('task_number', taskNumber)
      .single();

    if (error || !data) return null;
    return new MaintenanceTask(data);
  }

  static async findByStatus(status: MaintenanceStatus): Promise<MaintenanceTask[]> {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('status', status)
      .order('reported_at', { ascending: false });

    if (error || !data) return [];
    return data.map(task => new MaintenanceTask(task));
  }

  static async findByAssignee(assigneeId: string): Promise<MaintenanceTask[]> {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .eq('assigned_to', assigneeId)
      .order('reported_at', { ascending: false });

    if (error || !data) return [];
    return data.map(task => new MaintenanceTask(task));
  }

  static async findByDateRange(startDate: Date, endDate: Date): Promise<MaintenanceTask[]> {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .select('*')
      .gte('reported_at', startDate.toISOString())
      .lte('reported_at', endDate.toISOString())
      .order('reported_at', { ascending: false });

    if (error || !data) return [];
    return data.map(task => new MaintenanceTask(task));
  }

  async save(): Promise<MaintenanceTask> {
    const { data, error } = await supabase
      .from('maintenance_tasks')
      .upsert([
        {
          id: this.id,
          task_number: this.taskNumber,
          type: this.type,
          priority: this.priority,
          status: this.status,
          title: this.title,
          asset_id: this.assetId,
          location: this.location,
          description: this.description,
          reported_by: this.reportedBy,
          reported_at: this.reportedAt,
          assigned_to: this.assignedTo,
          assigned_at: this.assignedAt,
          started_at: this.startedAt,
          completed_at: this.completedAt,
          estimated_duration: this.estimatedDuration,
          actual_duration: this.actualDuration,
          parts: this.parts,
          labor_cost: this.laborCost,
          total_cost: this.totalCost,
          photos: this.photos,
          notes: this.notes,
          updated_at: new Date()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return new MaintenanceTask(data);
  }

  async delete(): Promise<void> {
    const { error } = await supabase
      .from('maintenance_tasks')
      .delete()
      .eq('id', this.id);

    if (error) throw error;
  }

  async assign(userId: string): Promise<void> {
    this.assignedTo = userId;
    this.assignedAt = new Date();
    this.status = MaintenanceStatus.ASSIGNED;
    await this.save();
  }

  async start(): Promise<void> {
    this.startedAt = new Date();
    this.status = MaintenanceStatus.IN_PROGRESS;
    await this.save();
  }

  async complete(): Promise<void> {
    this.completedAt = new Date();
    this.status = MaintenanceStatus.COMPLETED;
    if (this.startedAt) {
      this.actualDuration = Math.round(
        (this.completedAt.getTime() - this.startedAt.getTime()) / (1000 * 60)
      );
    }
    await this.save();
  }

  async hold(): Promise<void> {
    this.status = MaintenanceStatus.ON_HOLD;
    await this.save();
  }

  async cancel(): Promise<void> {
    this.status = MaintenanceStatus.CANCELLED;
    await this.save();
  }

  async addPart(part: Omit<NonNullable<MaintenanceTask['parts']>[0], 'id'>): Promise<void> {
    const newPart = { ...part, id: crypto.randomUUID() };
    this.parts = [...(this.parts || []), newPart];
    this.updateCosts();
    await this.save();
  }

  async updatePart(partId: string, updates: Partial<NonNullable<MaintenanceTask['parts']>[0]>): Promise<void> {
    this.parts = (this.parts || []).map(part =>
      part.id === partId ? { ...part, ...updates } : part
    );
    this.updateCosts();
    await this.save();
  }

  async removePart(partId: string): Promise<void> {
    this.parts = (this.parts || []).filter(part => part.id !== partId);
    this.updateCosts();
    await this.save();
  }

  private updateCosts(): void {
    const partsCost = (this.parts || []).reduce(
      (sum, part) => sum + part.quantity * part.cost,
      0
    );
    this.totalCost = (this.laborCost || 0) + partsCost;
  }
}
