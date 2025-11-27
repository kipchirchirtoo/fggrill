export type Branch = 'Bomet' | 'Kapsoit' | 'Kericho' | 'Mogogosiek' | 'Litein' | 'Bomet Town' | 'Kaplong';

export type Category =
  | 'Food & Beverage'
  | 'Housekeeping'
  | 'Sauna & Wellness'
  | 'Administration'
  | 'Maintenance';

export type SubCategory = {
  'Food & Beverage': 'Bar Stock-Alcoholic' | 'Bar Stock-Non-alcoholic' | 'Kitchen Supplies' | 'Restaurant Items';
  'Housekeeping': 'Linens & Bedding' | 'Cleaning Supplies' | 'Guest Amenities';
  'Sauna & Wellness': 'Towels & Robes' | 'Spa Products' | 'Maintenance Supplies';
  'Administration': 'Stationery' | 'Office Supplies' | 'Printing Materials';
  'Maintenance': 'Electrical' | 'Plumbing' | 'General Repair';
}[Category];

export interface InventoryItem {
  id: string;
  item_id: string;
  name: string;
  category: Category;
  sub_category: SubCategory;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  reorderPoint: number;
  unitCost: number;
  supplier_id: string;
  branches: Branch[];
  location: string;
  created_at: string;
  updated_at: string;
}

export interface StockLevel {
  branch: Branch;
  item_id: string;
  current_quantity: number;
  last_updated: string;
}

export interface StockTransfer {
  transfer_id: string;
  from_branch: Branch;
  to_branch: Branch;
  items: {
    item_id: string;
    quantity: number;
  }[];
  status: 'pending' | 'approved' | 'in_transit' | 'completed' | 'cancelled';
  requested_by: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequisition {
  requisition_id: string;
  branch: Branch;
  department: string;
  items: {
    item_id: string;
    quantity: number;
    urgency: 'low' | 'medium' | 'high';
  }[];
  status: 'pending' | 'approved' | 'ordered' | 'received' | 'rejected';
  requested_by: string;
  approved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ConsumptionRecord {
  record_id: string;
  branch: Branch;
  department: string;
  item_id: string;
  quantity: number;
  consumption_date: string;
  recorded_by: string;
  notes?: string;
}

export interface BarInventory extends InventoryItem {
  par_stock: number;
  is_cocktail_ingredient: boolean;
  alcohol_percentage?: number;
  bottle_size?: string;
}

export interface SaunaInventory extends InventoryItem {
  is_reusable: boolean;
  replacement_cycle?: number; // in days
  treatment_type?: string;
}

export interface RoomInventory extends InventoryItem {
  is_minibar_item: boolean;
  is_amenity: boolean;
  room_type?: string[];
}
