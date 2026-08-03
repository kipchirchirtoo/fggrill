export type InventoryPostingDocumentType =
  | 'GRN'
  | 'MIN'
  | 'TRF'
  | 'STK'
  | 'SPL'
  | 'REQ'
  | 'ADJ'
  | 'REV';

export type InventoryPostingLocationType =
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

export type InventoryPostingMovementType =
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

export type InventoryReservationAction = 'reserve' | 'release' | 'fulfill';

export interface InventoryPostingLocationInput {
  branchId?: number | null;
  departmentCode?: string | null;
  locationCode?: string | null;
  locationName?: string | null;
  locationType: InventoryPostingLocationType;
  metadata?: Record<string, unknown>;
  outletId?: string | null;
}

export interface InventoryPostingReservationInput {
  action: InventoryReservationAction;
  allowBackorder?: boolean;
  expiresAt?: string | null;
  quantity?: number | null;
  reason?: string | null;
}

export interface InventoryPostingLineInput {
  allowNegativeOverride?: boolean;
  itemName?: string | null;
  itemSku: string;
  metadata?: Record<string, unknown>;
  movementType?: InventoryPostingMovementType;
  quantity: number;
  reservation?: InventoryPostingReservationInput | null;
  sourceLocation: InventoryPostingLocationInput;
  destinationLocation: InventoryPostingLocationInput;
  unitCost?: number | null;
}

export interface InventoryPostingInput {
  actorId: string;
  branchId?: number | null;
  businessDate?: string | null;
  documentDate?: string | null;
  documentType: InventoryPostingDocumentType;
  idempotencyKey: string;
  lines: InventoryPostingLineInput[];
  metadata?: Record<string, unknown>;
  reason: string;
  shiftCode?: string | null;
  sourceId?: string | null;
  sourceTable: string;
}

export interface InventoryPostingResult {
  document: {
    document_id: string;
    document_number: string;
    document_type: InventoryPostingDocumentType;
    posted_at: string;
    posting_status: 'posted' | 'reversed';
    reversal_of_document_id: string | null;
  };
  idempotentReplay?: boolean;
  lines: Array<{
    item_sku: string;
    movement_id: string;
    previous_source_quantity: number | null;
    new_source_quantity: number | null;
    previous_destination_quantity: number | null;
    new_destination_quantity: number | null;
    quantity: number;
  }>;
}
