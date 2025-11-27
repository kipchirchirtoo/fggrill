import { supabase } from '../config/database';
import crypto from 'crypto';

export enum TaskType {
  CHECK_OUT_CLEAN = 'check-out-clean',
  STAY_OVER_CLEAN = 'stay-over-clean',
  DEEP_CLEAN = 'deep-clean',
  TOUCH_UP = 'touch-up',
  INSPECTION = 'inspection'
}

export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum TaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  VERIFIED = 'verified',
  CANCELLED = 'cancelled'
}

export interface IChecklistItem {
  id: string;
  item: string;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
  notes?: string;
  photo?: string;
}

export interface ISupplyUsage {
  id: string;
  itemId: string;
  quantity: number;
}

export interface IHousekeepingTask {
  id: string;
  taskNumber: string;
  roomId: string;
  taskType: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  checklist: IChecklistItem[];
  suppliesUsed: ISupplyUsage[];
  estimatedDuration: number; // in minutes
  actualDuration?: number; // in minutes
  notes?: string;
  photos?: string[];
  inspection?: {
    cleanliness: number;
    tidiness: number;
    bathroom: number;
    amenities: number;
    maintenance: number;
    overall: number;
    inspectedBy: string;
    inspectedAt: Date;
    notes?: string;
    photos?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export class HousekeepingTask implements IHousekeepingTask {
  id: string;
  taskNumber: string;
  roomId: string;
  taskType: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: string;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  verifiedAt?: Date;
  verifiedBy?: string;
  checklist: IChecklistItem[];
  suppliesUsed: ISupplyUsage[];
  estimatedDuration: number;
  actualDuration?: number;
  notes?: string;
  photos?: string[];
  inspection?: {
    cleanliness: number;
    tidiness: number;
    bathroom: number;
    amenities: number;
    maintenance: number;
    overall: number;
    inspectedBy: string;
    inspectedAt: Date;
    notes?: string;
    photos?: string[];
  };
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IHousekeepingTask>) {
    this.id = data.id || crypto.randomUUID();
    this.taskNumber = data.taskNumber || '';
    this.roomId = data.roomId || '';
    this.taskType = data.taskType || TaskType.CHECK_OUT_CLEAN;
    this.priority = data.priority || TaskPriority.MEDIUM;
    this.status = data.status || TaskStatus.PENDING;
    this.assignedTo = data.assignedTo;
    this.assignedAt = data.assignedAt;
    this.startedAt = data.startedAt;
    this.completedAt = data.completedAt;
    this.verifiedAt = data.verifiedAt;
    this.verifiedBy = data.verifiedBy;
    this.checklist = data.checklist || [];
    this.suppliesUsed = data.suppliesUsed || [];
    this.estimatedDuration = data.estimatedDuration || 30;
    this.actualDuration = data.actualDuration;
    this.notes = data.notes;
    this.photos = data.photos;
    this.inspection = data.inspection;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async findById(id: string): Promise<HousekeepingTask | null> {
    const { data, error } = await supabase
      .from('housekeeping_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return new HousekeepingTask(data);
  }

  static async findByRoom(roomId: string): Promise<HousekeepingTask[]> {
    const { data, error } = await supabase
      .from('housekeeping_tasks')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(task => new HousekeepingTask(task));
  }

  static async findByAssignee(assigneeId: string): Promise<HousekeepingTask[]> {
    const { data, error } = await supabase
      .from('housekeeping_tasks')
      .select('*')
      .eq('assigned_to', assigneeId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(task => new HousekeepingTask(task));
  }

  static async findByStatus(status: TaskStatus): Promise<HousekeepingTask[]> {
    const { data, error } = await supabase
      .from('housekeeping_tasks')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(task => new HousekeepingTask(task));
  }

  async save(): Promise<HousekeepingTask> {
    const { data, error } = await supabase
      .from('housekeeping_tasks')
      .upsert([
        {
          id: this.id,
          task_number: this.taskNumber,
          room_id: this.roomId,
          task_type: this.taskType,
          priority: this.priority,
          status: this.status,
          assigned_to: this.assignedTo,
          assigned_at: this.assignedAt,
          started_at: this.startedAt,
          completed_at: this.completedAt,
          verified_at: this.verifiedAt,
          verified_by: this.verifiedBy,
          checklist: this.checklist,
          supplies_used: this.suppliesUsed,
          estimated_duration: this.estimatedDuration,
          actual_duration: this.actualDuration,
          notes: this.notes,
          photos: this.photos,
          inspection: this.inspection,
          updated_at: new Date()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return new HousekeepingTask(data);
  }

  async delete(): Promise<void> {
    const { error } = await supabase
      .from('housekeeping_tasks')
      .delete()
      .eq('id', this.id);

    if (error) throw error;
  }

  async addChecklistItem(item: Omit<IChecklistItem, 'id'>): Promise<void> {
    const newItem = { ...item, id: crypto.randomUUID() };
    this.checklist = [...(this.checklist || []), newItem];
    await this.save();
  }

  async updateChecklistItem(itemId: string, updates: Partial<IChecklistItem>): Promise<void> {
    this.checklist = (this.checklist || []).map(item =>
      item.id === itemId ? { ...item, ...updates } : item
    );
    await this.save();
  }

  async removeChecklistItem(itemId: string): Promise<void> {
    this.checklist = (this.checklist || []).filter(item => item.id !== itemId);
    await this.save();
  }

  async addSupplyUsage(supply: Omit<ISupplyUsage, 'id'>): Promise<void> {
    const newSupply = { ...supply, id: crypto.randomUUID() };
    this.suppliesUsed = [...(this.suppliesUsed || []), newSupply];
    await this.save();
  }

  async updateSupplyUsage(supplyId: string, updates: Partial<ISupplyUsage>): Promise<void> {
    this.suppliesUsed = (this.suppliesUsed || []).map(supply =>
      supply.id === supplyId ? { ...supply, ...updates } : supply
    );
    await this.save();
  }

  async removeSupplyUsage(supplyId: string): Promise<void> {
    this.suppliesUsed = (this.suppliesUsed || []).filter(supply => supply.id !== supplyId);
    await this.save();
  }

  async assign(userId: string): Promise<void> {
    this.assignedTo = userId;
    this.assignedAt = new Date();
    this.status = TaskStatus.ASSIGNED;
    await this.save();
  }

  async start(): Promise<void> {
    this.startedAt = new Date();
    this.status = TaskStatus.IN_PROGRESS;
    await this.save();
  }

  async complete(): Promise<void> {
    this.completedAt = new Date();
    this.status = TaskStatus.COMPLETED;
    if (this.startedAt) {
      this.actualDuration = Math.round(
        (this.completedAt.getTime() - this.startedAt.getTime()) / (1000 * 60)
      );
    }
    await this.save();
  }

  async verify(userId: string): Promise<void> {
    this.verifiedBy = userId;
    this.verifiedAt = new Date();
    this.status = TaskStatus.VERIFIED;
    await this.save();
  }

  async cancel(): Promise<void> {
    this.status = TaskStatus.CANCELLED;
    await this.save();
  }
}
