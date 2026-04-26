/**
 * Food Control & Financial Intelligence Engine - TypeScript Types
 * 
 * This file contains all TypeScript interfaces and types for the food control system
 */

// =====================================================
// RECIPE TYPES
// =====================================================

export interface RecipeIngredient {
  id: string;
  menuItemId: string;
  ingredientId: string;
  ingredientName: string;
  quantityPerPortion: number;
  unit: string;
  costPerUnit: number;
  isLocked: boolean;
}

export interface RecipeChangeLog {
  id: string;
  recipeId: number;
  changedBy: string;
  oldQuantity?: number;
  newQuantity?: number;
  oldData?: any;
  newData?: any;
  reason: string;
  approvedBy?: string;
  branchId: number;
  changedAt: string;
}

// =====================================================
// STOCK ISSUE TYPES
// =====================================================

export type IssuedTo = 'kitchen' | 'buffet' | 'catering' | 'bar';
export type ReferenceType = 'POS' | 'BUFFET' | 'CATERING' | 'BAR' | 'MANUAL';

export interface StockIssue {
  id: string;
  ingredientId?: number;
  itemSku: string;
  quantityIssued: number;
  issuedTo: IssuedTo;
  referenceType: ReferenceType;
  referenceId?: string;
  shiftId?: number;
  issuedBy: string;
  receivedBy?: string;
  notes?: string;
  branchId: number;
  createdAt: string;
}

export interface CreateStockIssueInput {
  itemSku: string;
  quantityIssued: number;
  issuedTo: IssuedTo;
  referenceType: ReferenceType;
  referenceId?: string;
  shiftId?: number;
  receivedBy?: string;
  notes?: string;
}

// =====================================================
// WASTE LOG TYPES
// =====================================================

export type WasteReason = 'spillage' | 'spoilage' | 'over_production' | 'theft' | 'expired' | 'contamination' | 'other';

export interface WasteLog {
  id: string;
  ingredientId?: number;
  itemSku: string;
  quantityWasted: number;
  reason: WasteReason;
  description?: string;
  estimatedValue?: number;
  photoUrl?: string;
  shiftId?: number;
  loggedBy: string;
  approvedBy?: string;
  approvalNotes?: string;
  branchId: number;
  createdAt: string;
}

export interface CreateWasteLogInput {
  itemSku: string;
  quantityWasted: number;
  reason: WasteReason;
  description?: string;
  estimatedValue?: number;
  photoUrl?: string;
  shiftId?: number;
}

// =====================================================
// BUFFET TYPES
// =====================================================

export type BuffetType = 'breakfast' | 'lunch' | 'dinner' | 'conference' | 'custom';
export type BuffetStatus = 'planned' | 'active' | 'closed' | 'cancelled';

export interface BuffetMenuItem {
  id: string;
  buffetId: string;
  menuItemId?: string;
  menuItemName: string;
  portionPerGuest: number;
  recipeId?: number;
  ingredients?: RecipeIngredient[];
}

export interface BuffetEvent {
  id: string;
  name: string;
  buffetType: BuffetType;
  pricePerPerson: number;
  expectedGuests: number;
  actualGuests?: number;
  shiftId?: number;
  openedBy?: string;
  closedBy?: string;
  openedAt?: string;
  closedAt?: string;
  status: BuffetStatus;
  notes?: string;
  branchId: number;
  menuItems?: BuffetMenuItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateBuffetInput {
  name: string;
  buffetType: BuffetType;
  pricePerPerson: number;
  expectedGuests: number;
  shiftId?: number;
  notes?: string;
  menuItems?: {
    menuItemId?: string;
    menuItemName: string;
    portionPerGuest: number;
    recipeId?: number;
  }[];
}

export interface CloseBuffetInput {
  actualGuests: number;
  notes?: string;
}

// =====================================================
// CATERING TYPES
// =====================================================

export type CateringStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'invoiced';

export interface CateringMenuItem {
  id: string;
  eventId: string;
  menuItemId?: string;
  menuItemName: string;
  quantityExpected: number;
  quantityActual?: number;
  recipeId?: number;
}

export interface CateringStockAllocation {
  id: string;
  eventId: string;
  ingredientId?: number;
  itemSku: string;
  itemName: string;
  quantityAllocated: number;
  quantityReturned: number;
  quantityUsed: number;
  unitCost?: number;
  totalCost?: number;
  allocatedBy?: string;
  allocatedAt: string;
  branchId: number;
}

export interface CateringEvent {
  id: string;
  eventNumber: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  eventName?: string;
  eventDate: string;
  eventTime?: string;
  location: string;
  expectedGuests: number;
  actualGuests?: number;
  agreedPrice: number;
  depositPaid: number;
  balanceDue: number;
  leadChef?: string;
  cateringManager?: string;
  status: CateringStatus;
  shiftId?: number;
  notes?: string;
  branchId: number;
  createdBy?: string;
  menuItems?: CateringMenuItem[];
  stockAllocations?: CateringStockAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCateringEventInput {
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  eventName?: string;
  eventDate: string;
  eventTime?: string;
  location: string;
  expectedGuests: number;
  agreedPrice: number;
  depositPaid?: number;
  leadChef?: string;
  cateringManager?: string;
  notes?: string;
  menuItems?: {
    menuItemId?: string;
    menuItemName: string;
    quantityExpected: number;
    recipeId?: number;
  }[];
}

export interface AllocateStockInput {
  allocations: {
    itemSku: string;
    itemName: string;
    quantityAllocated: number;
    unitCost?: number;
  }[];
}

export interface RecordActualInput {
  actualGuests: number;
  returns: {
    allocationId: string;
    quantityReturned: number;
  }[];
  notes?: string;
}

// =====================================================
// VARIANCE TYPES
// =====================================================

export type VarianceReason = 'wastage' | 'spillage' | 'theft' | 'over_portioning' | 'measurement_error' | 'approved_extra' | 'other';
export type VarianceStatus = 'pending' | 'explained' | 'approved' | 'flagged';

export interface TheoreticalUsage {
  ingredientId?: number;
  itemSku: string;
  ingredientName: string;
  unit: string;
  theoreticalQty: number;
  actualQty: number;
  variance: number;
  varianceCost: number;
  costPerUnit: number;
  status: 'ok' | 'warning' | 'critical';
}

export interface FoodVariance {
  id: string;
  shiftId: number;
  ingredientId?: number;
  itemSku: string;
  itemName: string;
  referenceType: 'POS' | 'BUFFET' | 'CATERING';
  referenceId?: string;
  theoreticalUsage: number;
  actualUsage: number;
  variance: number;
  varianceCost?: number;
  varianceReason?: VarianceReason;
  reasonDescription?: string;
  requiresExplanation: boolean;
  explainedBy?: string;
  explainedAt?: string;
  status: VarianceStatus;
  flaggedBy?: string;
  flaggedAt?: string;
  branchId: number;
  createdAt: string;
}

export interface FoodVarianceReport {
  shiftId: number;
  referenceType: 'POS' | 'BUFFET' | 'CATERING';
  referenceId?: string;
  items: TheoreticalUsage[];
  totalVarianceCost: number;
  flaggedItems: TheoreticalUsage[];
  generatedAt: string;
}

export interface ExplainVarianceInput {
  varianceReason: VarianceReason;
  reasonDescription: string;
}

// =====================================================
// SHIFT P&L TYPES
// =====================================================

export type ShiftFinancialStatus = 'draft' | 'pending_accountant' | 'accountant_reviewed' | 'auditor_approved' | 'flagged';

export interface ShiftPnL {
  id: string;
  shiftId: number;
  branchId: number;
  
  // Revenue
  posRevenue: number;
  buffetRevenue: number;
  cateringRevenue: number;
  totalRevenue: number;
  
  // COGS
  posTheoreticalCogs: number;
  posActualCogs: number;
  buffetTheoreticalCogs: number;
  buffetActualCogs: number;
  cateringCogs: number;
  theoreticalCogs: number;
  actualCogs: number;
  varianceCost: number;
  
  // Profit
  grossProfitExpected: number;
  grossProfitActual: number;
  
  // KPIs
  foodCostPercentage?: number;
  foodRevenue?: number;
  
  // Workflow
  status: ShiftFinancialStatus;
  generatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  accountantNotes?: string;
  auditorNotes?: string;
}

export interface ReviewShiftPnLInput {
  notes?: string;
}

export interface ApproveShiftPnLInput {
  action: 'approve' | 'flag';
  notes?: string;
}

// =====================================================
// PORTION OUTPUT TYPES
// =====================================================

export interface PortionOutput {
  ingredient: string;
  itemSku: string;
  issuedQty: number;
  expectedPortions: number;
  actualSold: number;
  gap: number;
  gapCost: number;
  unit: string;
}

// =====================================================
// BRANCH CONFIG TYPES
// =====================================================

export interface BranchFoodControlConfig {
  id: string;
  branchId: number;
  varianceThresholdKes: number;
  varianceThresholdPercent: number;
  foodCostAlertThreshold: number;
  allowedWasteReasonCodes: WasteReason[];
  requireManagerApprovalForTheft: boolean;
  autoSubmitToAccountantOnClose: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateBranchConfigInput {
  varianceThresholdKes?: number;
  varianceThresholdPercent?: number;
  foodCostAlertThreshold?: number;
  allowedWasteReasonCodes?: WasteReason[];
  requireManagerApprovalForTheft?: boolean;
  autoSubmitToAccountantOnClose?: boolean;
}

// =====================================================
// REPORT TYPES
// =====================================================

export interface DailyFoodCostReport {
  date: string;
  branchId: number;
  totalRevenue: number;
  totalCogs: number;
  foodCostPercentage: number;
  varianceCost: number;
  shifts: {
    shiftId: number;
    revenue: number;
    cogs: number;
    variance: number;
  }[];
}

export interface ChefPerformanceReport {
  chefId: string;
  chefName: string;
  shiftsWorked: number;
  totalVariance: number;
  averageVariance: number;
  flaggedVariances: number;
  wasteLogged: number;
  totalWasteValue: number;
}

export interface WasteTrackingReport {
  startDate: string;
  endDate: string;
  branchId: number;
  totalWasteValue: number;
  wasteByReason: {
    reason: WasteReason;
    count: number;
    totalValue: number;
  }[];
  topWastedItems: {
    itemSku: string;
    itemName: string;
    totalQuantity: number;
    totalValue: number;
  }[];
}

export interface FoodCostTrendReport {
  branchId: number;
  startDate: string;
  endDate: string;
  dataPoints: {
    date: string;
    foodCostPercentage: number;
    revenue: number;
    cogs: number;
  }[];
  averageFoodCostPercentage: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
