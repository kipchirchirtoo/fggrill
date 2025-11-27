export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  isMainBranch: boolean;
  status: 'active' | 'inactive';
}

export interface StockItem {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  minStock: number;
  maxStock: number;
  reorderPoint: number;
  unitCost: number;
  supplier?: string;
  status: 'active' | 'inactive';
}

export interface BranchStock {
  id: string;
  branchId: string;
  itemId: string;
  currentStock: number;
  lastUpdated: Date;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromBranchId: string;
  toBranchId: string;
  status: 'pending' | 'in-transit' | 'completed' | 'cancelled';
  requestedBy: string;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  completedBy?: string;
  completedAt?: Date;
  notes?: string;
  items: StockTransferItem[];
}

export interface StockTransferItem {
  id?: string;
  transferId?: string;
  itemId: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  receivedQuantity?: number;
  notes?: string;
}

export interface StockAudit {
  id: string;
  auditNumber: string;
  branchId: string;
  status: 'pending' | 'in-progress' | 'completed';
  startedBy: string;
  startedAt: Date;
  completedBy?: string;
  completedAt?: Date;
  notes?: string;
  items: StockAuditItem[];
}

export interface StockAuditItem {
  id: string;
  auditId: string;
  itemId: string;
  systemQuantity: number;
  actualQuantity: number;
  discrepancy: number;
  notes?: string;
}

export interface StockRequest {
  id: string;
  requestNumber: string;
  branchId: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled';
  requestedBy: string;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  fulfilledBy?: string;
  fulfilledAt?: Date;
  notes?: string;
  items: StockRequestItem[];
}

export interface StockRequestItem {
  id?: string;
  requestId?: string;
  itemId: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  fulfilledQuantity?: number;
  notes?: string;
}

export interface StockMovement {
  id: string;
  branchId: string;
  itemId: string;
  quantity: number;
  type: 'in' | 'out' | 'transfer' | 'adjustment';
  referenceId?: string;
  referenceType?: 'transfer' | 'request' | 'audit';
  performedBy: string;
  performedAt: Date;
  notes?: string;
}
