// =====================================================
// STOREKEEPING MODULE - SIMPLIFIED MODELS
// =====================================================

// Retaining Enums for compatibility with existing code that might import them, 
// but they are not used in the new simple logic.
export enum ItemCategory {
  FOOD = 'food',
  BEVERAGE = 'beverage',
  LINEN = 'linen',
  TOILETRIES = 'toiletries',
  CLEANING_SUPPLIES = 'cleaning_supplies',
  MAINTENANCE_ITEMS = 'maintenance_items',
  OFFICE_SUPPLIES = 'office_supplies',
  KITCHEN_EQUIPMENT = 'kitchen_equipment',
  AMENITIES = 'amenities',
  OTHER = 'other'
}

export enum UnitOfMeasurement {
  PIECES = 'pieces',
  KG = 'kg',
  GRAMS = 'grams',
  LITERS = 'liters',
  ML = 'ml',
  BOXES = 'boxes',
  CARTONS = 'cartons',
  PACKETS = 'packets',
  BOTTLES = 'bottles',
  CANS = 'cans',
  ROLLS = 'rolls',
  SETS = 'sets',
  PAIRS = 'pairs',
  UNITS = 'units'
}

// ... [Other Enums omitted for brevity but can be kept if needed] ...

// =====================================================
// NEW SIMPLE INTERFACES
// =====================================================

export interface IItem {
  sku: string;
  description: string;
  retail_price: number;
  quantity: number;
  last_updated?: Date;
  is_active: boolean;
}

export interface IShopItem {
  id: string;
  shop_user_id: string;
  item_sku: string;
  quantity: number;
  last_updated?: Date;
  
  // Relations
  item?: IItem;
  shop_user?: any; // User interface
}

export interface ITransferItem {
  id: string;
  shop_user_id: string;
  item_sku: string;
  quantity: number;
  ordered: boolean;
  last_updated?: Date;
  created_at?: Date;

  // Relations
  item?: IItem;
  shop_user?: any;
}

export interface IAppConfig {
  id: number;
  edit_lock: boolean;
  allow_uploads: boolean;
  allow_upload_deletions: boolean;
  allow_email_notifications: boolean;
  records_per_page: number;
}

