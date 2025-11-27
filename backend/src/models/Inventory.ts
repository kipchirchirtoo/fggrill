import { supabase } from '../config/database';
import crypto from 'crypto';

export enum InventoryCategory {
  HOUSEKEEPING = 'housekeeping',
  FOOD = 'food',
  BEVERAGE = 'beverage',
  MAINTENANCE = 'maintenance',
  AMENITIES = 'amenities',
  OFFICE = 'office',
  OTHER = 'other'
}

export interface IStockMovement {
  id: string;
  type: 'in' | 'out' | 'transfer' | 'adjustment';
  quantity: number;
  date: Date;
  reference?: string;
  performedBy: string;
  notes?: string;
  cost?: number;
  location?: string;
}

export interface IPurchaseOrder {
  id: string;
  orderNumber: string;
  supplier: string;
  items: Array<{
    item: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  orderDate: Date;
  expectedDeliveryDate?: Date;
  actualDeliveryDate?: Date;
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';
  approvedBy?: string;
  totalAmount: number;
  notes?: string;
}

export interface IInventoryItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: InventoryCategory;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unitCost: number;
  location?: string;
  supplier?: string;
  barcode?: string;
  expiryDate?: Date;
  stockMovements: IStockMovement[];
  purchaseOrders: IPurchaseOrder[];
  createdAt: Date;
  updatedAt: Date;
}

export class InventoryItem implements IInventoryItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: InventoryCategory;
  unit: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unitCost: number;
  location?: string;
  supplier?: string;
  barcode?: string;
  expiryDate?: Date;
  stockMovements: IStockMovement[];
  purchaseOrders: IPurchaseOrder[];
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<IInventoryItem>) {
    this.id = data.id || crypto.randomUUID();
    this.code = data.code || '';
    this.name = data.name || '';
    this.description = data.description;
    this.category = data.category || InventoryCategory.OTHER;
    this.unit = data.unit || 'unit';
    this.currentStock = data.currentStock || 0;
    this.minimumStock = data.minimumStock || 0;
    this.maximumStock = data.maximumStock || 100;
    this.unitCost = data.unitCost || 0;
    this.location = data.location;
    this.supplier = data.supplier;
    this.barcode = data.barcode;
    this.expiryDate = data.expiryDate;
    this.stockMovements = data.stockMovements || [];
    this.purchaseOrders = data.purchaseOrders || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  static async findById(id: string): Promise<InventoryItem | null> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return new InventoryItem(data);
  }

  static async findByCode(code: string): Promise<InventoryItem | null> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) return null;
    return new InventoryItem(data);
  }

  static async findByCategory(category: InventoryCategory): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('category', category);

    if (error || !data) return [];
    return data.map(item => new InventoryItem(item));
  }

  static async findLowStock(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .filter('current_stock', 'lte', 'minimum_stock');

    if (error || !data) return [];
    return data.map(item => new InventoryItem(item));
  }

  async save(): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from('inventory_items')
      .upsert([
        {
          id: this.id,
          code: this.code,
          name: this.name,
          description: this.description,
          category: this.category,
          unit: this.unit,
          current_stock: this.currentStock,
          minimum_stock: this.minimumStock,
          maximum_stock: this.maximumStock,
          unit_cost: this.unitCost,
          location: this.location,
          supplier: this.supplier,
          barcode: this.barcode,
          expiry_date: this.expiryDate,
          stock_movements: this.stockMovements,
          purchase_orders: this.purchaseOrders,
          updated_at: new Date()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return new InventoryItem(data);
  }

  async delete(): Promise<void> {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', this.id);

    if (error) throw error;
  }

  async addStockMovement(movement: Omit<IStockMovement, 'id' | 'date'>): Promise<void> {
    const newMovement = {
      ...movement,
      id: crypto.randomUUID(),
      date: new Date()
    };

    // Update current stock
    const quantityChange = movement.type === 'in' ? movement.quantity : -movement.quantity;
    this.currentStock += quantityChange;

    // Add movement to history
    this.stockMovements = [...(this.stockMovements || []), newMovement];

    await this.save();
  }

  async createPurchaseOrder(order: Omit<IPurchaseOrder, 'id' | 'orderDate' | 'status'>): Promise<void> {
    const newOrder = {
      ...order,
      id: crypto.randomUUID(),
      orderDate: new Date(),
      status: 'draft' as const
    };

    this.purchaseOrders = [...(this.purchaseOrders || []), newOrder];
    await this.save();
  }

  async updatePurchaseOrder(orderId: string, updates: Partial<IPurchaseOrder>): Promise<void> {
    this.purchaseOrders = (this.purchaseOrders || []).map(order =>
      order.id === orderId ? { ...order, ...updates } : order
    );
    await this.save();
  }

  async receivePurchaseOrder(orderId: string): Promise<void> {
    const order = this.purchaseOrders?.find(o => o.id === orderId);
    if (!order) throw new Error('Purchase order not found');

    // Update order status
    order.status = 'received';
    order.actualDeliveryDate = new Date();

    // Add stock movements for received items
    for (const item of order.items) {
      await this.addStockMovement({
        type: 'in',
        quantity: item.quantity,
        performedBy: order.approvedBy || 'system',
        reference: order.orderNumber,
        cost: item.unitPrice,
        notes: `Received from PO ${order.orderNumber}`
      });
    }

    await this.save();
  }

  async transfer(quantity: number, toLocation: string, performedBy: string): Promise<void> {
    if (quantity > this.currentStock) {
      throw new Error('Insufficient stock for transfer');
    }

    await this.addStockMovement({
      type: 'transfer',
      quantity,
      performedBy,
      location: toLocation,
      notes: `Transferred to ${toLocation}`
    });
  }

  async adjustStock(quantity: number, reason: string, performedBy: string): Promise<void> {
    const adjustment = quantity - this.currentStock;
    await this.addStockMovement({
      type: 'adjustment',
      quantity: Math.abs(adjustment),
      performedBy,
      notes: reason
    });
  }

  isLowStock(): boolean {
    return this.currentStock <= this.minimumStock;
  }

  needsReorder(): boolean {
    return this.currentStock <= this.minimumStock && !this.hasPendingOrders();
  }

  hasPendingOrders(): boolean {
    return this.purchaseOrders?.some(order => 
      ['pending', 'approved', 'ordered'].includes(order.status)
    ) || false;
  }

  getValueOnHand(): number {
    return this.currentStock * this.unitCost;
  }
}
