export type InventoryLocationType =
  | 'central_store'
  | 'branch_store'
  | 'department'
  | 'pos_outlet'
  | 'supplier'
  | 'customer'
  | 'transit'
  | 'production'
  | 'waste'
  | 'adjustment'
  | 'reservation'
  | 'external';

export type InventoryMovementType =
  | 'purchase_receipt'
  | 'grn_posting'
  | 'branch_requisition_dispatch'
  | 'central_store_packing'
  | 'department_issue'
  | 'pos_issue'
  | 'production_consumption'
  | 'production_output'
  | 'stock_take_adjustment'
  | 'return'
  | 'write_off'
  | 'transfer'
  | 'reservation'
  | 'reservation_release';

export type InventoryReservationStatus =
  | 'reserved'
  | 'released'
  | 'fulfilled'
  | 'expired'
  | 'cancelled';

export interface InventoryLocationInput {
  id?: string;
  branchId?: number | null;
  locationCode?: string;
  locationName?: string;
  locationType?: InventoryLocationType;
  departmentCode?: string | null;
  outletId?: string | null;
  metadata?: Record<string, any>;
}

export interface InventoryItemInput {
  id?: string;
  sku?: string;
  sourceTable?: string;
  sourceItemKey?: string;
  itemName?: string;
  description?: string | null;
  category?: string | null;
  unit?: string;
  isPerishable?: boolean;
  trackingMode?: 'none' | 'batch' | 'lot' | 'serial' | 'expiry';
  supplierReference?: string | null;
  defaultUnitCost?: number;
  metadata?: Record<string, any>;
}

export interface InventoryBatchInput {
  id?: string;
  batchNumber?: string | null;
  lotNumber?: string | null;
  expiryDate?: string | null;
  supplierReference?: string | null;
  supplierId?: string | null;
  receivedDocumentType?: string | null;
  receivedDocumentReference?: string | null;
  unitCost?: number;
  metadata?: Record<string, any>;
}

export interface InventoryMovementInput {
  movementType: InventoryMovementType;
  item: InventoryItemInput;
  batch?: InventoryBatchInput | null;
  sourceLocation: InventoryLocationInput;
  destinationLocation: InventoryLocationInput;
  quantity: number;
  unitCost?: number;
  reason: string;
  documentType: string;
  documentReference: string;
  documentNumber?: string | null;
  reversible?: boolean;
  reversesMovementId?: string | null;
  allowNegative?: boolean;
  metadata?: Record<string, any>;
}

export interface InventoryReservationInput {
  item: InventoryItemInput;
  location: InventoryLocationInput;
  batch?: InventoryBatchInput | null;
  quantity: number;
  sourceDocumentType: string;
  sourceDocumentReference: string;
  sourceDocumentNumber?: string | null;
  reason: string;
  expiresAt?: string | null;
  allowBackorder?: boolean;
  metadata?: Record<string, any>;
}

export interface InventoryBalanceSnapshot {
  currentQuantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  expiredQuantity: number;
  availableQuantity: number;
}
