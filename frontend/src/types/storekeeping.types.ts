// Storekeeping Module Types - Simplified

export interface StoreItem {
  sku: string;
  description: string;
  retail_price: number;
  quantity: number;
  last_updated?: string;
  is_active: boolean;
}

export interface ShopItem {
  id: string;
  shop_user_id: string;
  item_sku: string;
  quantity: number;
  last_updated?: string;
  item?: StoreItem;
  shop_user?: any; // User type
}

export interface TransferItem {
  id: string;
  shop_user_id: string;
  item_sku: string;
  quantity: number;
  ordered: boolean;
  last_updated?: string;
  created_at?: string;
  item?: StoreItem;
  shop_user?: any; // User type
}

export interface AppConfig {
  id: number;
  edit_lock: boolean;
  allow_uploads: boolean;
  allow_upload_deletions: boolean;
  allow_email_notifications: boolean;
  records_per_page: number;
}

// Dashboard Stats (Simplified)
export interface StorekeepingStats {
  totalItems: number;
  lowStockItems: number;
  orderedTransfers: number;
  myShopItems: number;
}

// Legacy types kept to prevent immediate build errors in other files, 
// but should be phased out or are unused in the new module.
export interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

// Request Types
export interface CreateItemRequest {
  sku: string;
  description: string;
  retail_price: number;
  quantity: number;
}

export interface TransferItemRequest {
  sku: string;
  transfer_quantity: number;
}

export interface CompleteTransferRequest {
  sku: string;
  quantity: number;
  shop_user_id: string;
  cancel: boolean;
}
