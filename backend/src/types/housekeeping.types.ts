// =====================================================
// ENHANCED HOUSEKEEPING MODULE - TYPE DEFINITIONS
// =====================================================

// =====================================================
// ENUMS
// =====================================================

export enum HKRoomStatus {
  VACANT_CLEAN = 'vacant_clean',
  VACANT_DIRTY = 'vacant_dirty',
  OCCUPIED_CLEAN = 'occupied_clean',
  OCCUPIED_DIRTY = 'occupied_dirty',
  OUT_OF_ORDER = 'out_of_order',
  OUT_OF_SERVICE = 'out_of_service',
  INSPECTED = 'inspected',
  CLEANING_IN_PROGRESS = 'cleaning_in_progress',
  DO_NOT_DISTURB = 'do_not_disturb',
  STAY_OVER = 'stay_over',
  CHECKOUT = 'checkout',
  EARLY_MAKEUP = 'early_makeup',
  LATE_CHECKOUT = 'late_checkout',
  TURNDOWN_PENDING = 'turndown_pending',
  TURNDOWN_COMPLETE = 'turndown_complete'
}

export enum HKTaskType {
  CHECKOUT_FULL_CLEAN = 'checkout_full_clean',
  CHECKOUT_VIP_CLEAN = 'checkout_vip_clean',
  STAY_OVER_SERVICE = 'stay_over_service',
  STAY_OVER_FULL = 'stay_over_full',
  DEEP_CLEAN = 'deep_clean',
  TURNDOWN_SERVICE = 'turndown_service',
  INSPECTION = 'inspection',
  TOUCH_UP = 'touch_up',
  LINEN_CHANGE = 'linen_change',
  RESTOCK_AMENITIES = 'restock_amenities',
  PUBLIC_AREA_CLEAN = 'public_area_clean',
  EMERGENCY_CLEAN = 'emergency_clean',
  GUEST_REQUEST = 'guest_request',
  PRE_ARRIVAL_VIP = 'pre_arrival_vip'
}

export enum HKPriority {
  CRITICAL = 'critical',
  URGENT = 'urgent',
  HIGH = 'high',
  NORMAL = 'normal',
  LOW = 'low'
}

export enum HKTaskStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  PENDING_INSPECTION = 'pending_inspection',
  INSPECTION_PASSED = 'inspection_passed',
  INSPECTION_FAILED = 'inspection_failed',
  REWORK_REQUIRED = 'rework_required',
  CANCELLED = 'cancelled',
  SKIPPED = 'skipped'
}

export enum HKInspectionResult {
  PASSED = 'passed',
  PASSED_WITH_NOTES = 'passed_with_notes',
  FAILED = 'failed',
  NEEDS_REWORK = 'needs_rework'
}

export enum HKShiftType {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
  EVENING = 'evening',
  NIGHT = 'night',
  SPLIT = 'split'
}

export enum HKLinenStatus {
  CLEAN_AVAILABLE = 'clean_available',
  IN_USE = 'in_use',
  SOILED_COLLECTED = 'soiled_collected',
  IN_LAUNDRY = 'in_laundry',
  DAMAGED = 'damaged',
  RETIRED = 'retired'
}

export enum HKLostFoundStatus {
  FOUND = 'found',
  GUEST_CONTACTED = 'guest_contacted',
  CLAIMED = 'claimed',
  SHIPPED = 'shipped',
  UNCLAIMED = 'unclaimed',
  DISPOSED = 'disposed',
  STORED = 'stored'
}

export enum HKMaintenanceStatus {
  SUBMITTED = 'submitted',
  ACKNOWLEDGED = 'acknowledged',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  VERIFIED = 'verified',
  CANCELLED = 'cancelled'
}

export enum HKSupplyRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FULFILLED = 'fulfilled',
  PARTIALLY_FULFILLED = 'partially_fulfilled',
  CANCELLED = 'cancelled'
}

// =====================================================
// INTERFACES
// =====================================================

// Staff Profile
export interface IHKStaffProfile {
  id: string;
  userId: string;
  staffCode: string;
  designation: string;
  assignedFloors: number[];
  assignedSections: string[];
  maxRoomsPerShift: number;
  maxCreditsPerShift: number;
  skills: string[];
  certifications: ICertification[];
  languages: string[];
  avgCleaningTimeMinutes?: number;
  qualityScore?: number;
  tasksCompletedToday: number;
  tasksCompletedMonth: number;
  isAvailable: boolean;
  currentTaskId?: string;
  currentRoomNumber?: string;
  lastLocationUpdate?: Date;
  hireDate?: Date;
  probationEndDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
}

export interface ICertification {
  name: string;
  issuedDate: Date;
  expiryDate?: Date;
  issuedBy: string;
}

// Task
export interface IHKTask {
  id: string;
  taskNumber: string;
  roomId: string;
  roomNumber: string;
  floorNumber: number;
  taskType: HKTaskType;
  priority: HKPriority;
  status: HKTaskStatus;
  assignedTo?: string;
  assignedAt?: Date;
  assignedBy?: string;
  estimatedDurationMinutes: number;
  scheduledStart?: Date;
  dueBy?: Date;
  startedAt?: Date;
  pausedAt?: Date;
  resumedAt?: Date;
  completedAt?: Date;
  actualDurationMinutes?: number;
  creditValue: number;
  completedBy?: string;
  completionNotes?: string;
  completionPhotos: string[];
  requiresInspection: boolean;
  inspectionId?: string;
  isGuestPresent: boolean;
  isVip: boolean;
  guestPreferences: Record<string, any>;
  specialInstructions?: string;
  suppliesUsed: ISupplyUsage[];
  issuesReported: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isRework: boolean;
  originalTaskId?: string;
  reworkCount: number;
  // Joined fields
  room?: any;
  assignee?: IHKStaffProfile;
  inspection?: IHKInspection;
  checklist?: IHKTaskChecklist;
}

export interface ISupplyUsage {
  supplyId: string;
  supplyName?: string;
  quantity: number;
}

// Checklist
export interface IHKChecklistTemplate {
  id: string;
  name: string;
  taskType: HKTaskType;
  roomType?: string;
  sections: IChecklistSection[];
  totalEstimatedTime: number;
  isActive: boolean;
  branchId?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChecklistSection {
  section: string;
  items: IChecklistItem[];
}

export interface IChecklistItem {
  item: string;
  required: boolean;
  photoRequired?: boolean;
  timeEstimate: number;
}

export interface IHKTaskChecklist {
  id: string;
  taskId: string;
  templateId?: string;
  completedItems: ICompletedChecklistItem[];
  completionPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompletedChecklistItem {
  section: string;
  item: string;
  completed: boolean;
  completedAt?: Date;
  notes?: string;
  photoUrl?: string;
}

// Inspection
export interface IHKInspection {
  id: string;
  inspectionNumber: string;
  taskId?: string;
  roomId: string;
  roomNumber: string;
  inspectionType: string;
  cleanlinessScore?: number;
  tidinessScore?: number;
  bathroomScore?: number;
  amenitiesScore?: number;
  linensScore?: number;
  maintenanceScore?: number;
  overallScore?: number;
  result?: HKInspectionResult;
  deficiencies: IDeficiency[];
  photos: string[];
  inspectedBy: string;
  inspectedAt: Date;
  notes?: string;
  requiresRework: boolean;
  reworkTaskId?: string;
  createdAt: Date;
  // Joined fields
  inspector?: IHKStaffProfile;
  task?: IHKTask;
}

export interface IDeficiency {
  category: string;
  description: string;
  severity: 'minor' | 'moderate' | 'major';
  photoUrl?: string;
}

// Linen
export interface IHKLinenType {
  id: string;
  name: string;
  category: string;
  size?: string;
  color?: string;
  material?: string;
  expectedUses: number;
  parLevelCentral: number;
  parLevelFloor: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHKLinenInventory {
  id: string;
  linenTypeId: string;
  batchCode?: string;
  purchaseDate?: Date;
  locationType: string;
  locationId?: string;
  branchId: string;
  status: HKLinenStatus;
  condition: string;
  useCount: number;
  lastUsedAt?: Date;
  lastWashedAt?: Date;
  currentRoomId?: string;
  assignedToCart?: string;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  linenType?: IHKLinenType;
}

export interface IHKLinenTransaction {
  id: string;
  linenTypeId: string;
  transactionType: string;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  taskId?: string;
  roomId?: string;
  staffId?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
}

// Lost and Found
export interface IHKLostFound {
  id: string;
  itemNumber: string;
  itemDescription: string;
  itemCategory: string;
  estimatedValue?: number;
  isValuable: boolean;
  foundLocation: string;
  roomId?: string;
  floorNumber?: number;
  photos: string[];
  foundBy: string;
  foundAt: Date;
  status: HKLostFoundStatus;
  storageLocation?: string;
  storageBin?: string;
  potentialGuestId?: string;
  guestName?: string;
  guestContact?: string;
  contactAttempts: IContactAttempt[];
  claimedBy?: string;
  claimedAt?: Date;
  claimedSignature?: string;
  returnedBy?: string;
  disposalDate?: Date;
  disposalMethod?: string;
  disposalNotes?: string;
  retentionDays: number;
  retentionEndDate?: Date;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  foundByStaff?: IHKStaffProfile;
}

export interface IContactAttempt {
  date: string;
  method: 'phone' | 'email' | 'sms';
  result: 'no_answer' | 'left_message' | 'contacted' | 'wrong_number';
  notes?: string;
}

// Maintenance Request
export interface IHKMaintenanceRequest {
  id: string;
  requestNumber: string;
  roomId?: string;
  roomNumber?: string;
  locationDescription?: string;
  category: string;
  subcategory?: string;
  description: string;
  priority: HKPriority;
  isSafetyIssue: boolean;
  impactsRoomAvailability: boolean;
  photos: string[];
  reportedBy: string;
  reportedAt: Date;
  status: HKMaintenanceStatus;
  assignedTo?: string;
  assignedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  completedBy?: string;
  resolutionNotes?: string;
  resolutionPhotos: string[];
  verifiedBy?: string;
  verifiedAt?: Date;
  slaDueAt?: Date;
  slaBreached: boolean;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  reporter?: IHKStaffProfile;
}

// Guest Request
export interface IHKGuestRequest {
  id: string;
  requestNumber: string;
  roomId: string;
  roomNumber: string;
  guestName?: string;
  bookingId?: string;
  requestType: string;
  description: string;
  itemsRequested: IRequestedItem[];
  preferredTime?: string;
  preferredDate?: Date;
  priority: HKPriority;
  isVip: boolean;
  source: string;
  receivedBy?: string;
  status: HKTaskStatus;
  assignedTo?: string;
  assignedAt?: Date;
  completedAt?: Date;
  completedBy?: string;
  completionNotes?: string;
  guestSatisfied?: boolean;
  guestFeedback?: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRequestedItem {
  item: string;
  quantity: number;
}

// Scheduling
export interface IHKShiftDefinition {
  id: string;
  name: string;
  shiftType: HKShiftType;
  startTime: string;
  endTime: string;
  breakDurationMinutes: number;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  isActive: boolean;
  branchId?: string;
  createdAt: Date;
}

export interface IHKStaffSchedule {
  id: string;
  staffId: string;
  shiftId: string;
  scheduleDate: Date;
  actualStartTime?: string;
  actualEndTime?: string;
  assignedFloors: number[];
  assignedSections: string[];
  status: string;
  checkInTime?: Date;
  checkOutTime?: Date;
  breakStartTime?: Date;
  breakEndTime?: Date;
  isOvertime: boolean;
  overtimeHours: number;
  overtimeApprovedBy?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  staff?: IHKStaffProfile;
  shift?: IHKShiftDefinition;
}

export interface IHKLeaveRequest {
  id: string;
  staffId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
  status: string;
  requestedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewNotes?: string;
  createdAt: Date;
  // Joined fields
  staff?: IHKStaffProfile;
}

export interface IHKShiftSwap {
  id: string;
  requesterId: string;
  requesterScheduleId: string;
  targetId: string;
  targetScheduleId: string;
  reason?: string;
  status: string;
  acceptedByTarget?: boolean;
  targetResponseAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  // Joined fields
  requester?: IHKStaffProfile;
  target?: IHKStaffProfile;
}

// Metrics
export interface IHKDailyMetrics {
  id: string;
  metricDate: Date;
  branchId: string;
  totalTasksCreated: number;
  totalTasksCompleted: number;
  totalTasksPending: number;
  totalRooms: number;
  roomsCleaned: number;
  roomsInspected: number;
  roomsOutOfOrder: number;
  inspectionsPassed: number;
  inspectionsFailed: number;
  avgQualityScore?: number;
  avgCheckoutCleanTime?: number;
  avgStayoverCleanTime?: number;
  staffScheduled: number;
  staffPresent: number;
  guestComplaints: number;
  guestCompliments: number;
  lowStockItems: number;
  criticalStockItems: number;
  createdAt: Date;
}

export interface IHKStaffDailyMetrics {
  id: string;
  staffId: string;
  metricDate: Date;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksRework: number;
  totalCleaningTimeMinutes: number;
  avgCleaningTimeMinutes?: number;
  creditsEarned: number;
  inspectionsPassed: number;
  inspectionsFailed: number;
  avgQualityScore?: number;
  shiftStartTime?: Date;
  shiftEndTime?: Date;
  breakDurationMinutes: number;
  wasOnTime: boolean;
  createdAt: Date;
}

// Cart/Pantry Inventory
export interface IHKFloorPantryInventory {
  id: string;
  floorNumber: number;
  branchId: string;
  supplyId: string;
  currentQuantity: number;
  parLevel: number;
  lastRestockedAt?: Date;
  lastRestockedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHKCartInventory {
  id: string;
  cartCode: string;
  assignedTo?: string;
  inventoryItems: ICartInventoryItem[];
  lastLoadedAt?: Date;
  lastLoadedBy?: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICartInventoryItem {
  supplyId: string;
  quantity: number;
  parLevel: number;
}

// Room Status History
export interface IHKRoomStatusHistory {
  id: string;
  roomId: string;
  previousStatus?: HKRoomStatus;
  newStatus: HKRoomStatus;
  changedBy: string;
  reason?: string;
  metadata: Record<string, any>;
  createdAt: Date;
}

// =====================================================
// REQUEST/RESPONSE TYPES
// =====================================================

// Task creation
export interface ICreateTaskRequest {
  roomId: string;
  taskType: HKTaskType;
  priority?: HKPriority;
  assignedTo?: string;
  scheduledStart?: Date;
  dueBy?: Date;
  specialInstructions?: string;
  isVip?: boolean;
  guestPreferences?: Record<string, any>;
}

// Task assignment
export interface IAssignTaskRequest {
  taskId: string;
  assignedTo: string;
  priority?: HKPriority;
  notes?: string;
}

// Bulk assignment
export interface IBulkAssignRequest {
  taskIds: string[];
  assignedTo: string;
}

// Task status update
export interface IUpdateTaskStatusRequest {
  status: HKTaskStatus;
  notes?: string;
  suppliesUsed?: ISupplyUsage[];
  photos?: string[];
}

// Inspection submission
export interface ISubmitInspectionRequest {
  taskId?: string;
  roomId: string;
  inspectionType: string;
  cleanlinessScore: number;
  tidinessScore: number;
  bathroomScore: number;
  amenitiesScore: number;
  linensScore: number;
  maintenanceScore: number;
  deficiencies?: IDeficiency[];
  photos?: string[];
  notes?: string;
}

// Room status update
export interface IUpdateRoomStatusRequest {
  status: HKRoomStatus;
  reason?: string;
  notes?: string;
}

// Maintenance request creation
export interface ICreateMaintenanceRequest {
  roomId?: string;
  locationDescription?: string;
  category: string;
  subcategory?: string;
  description: string;
  priority?: HKPriority;
  isSafetyIssue?: boolean;
  photos?: string[];
}

// Lost & Found creation
export interface ICreateLostFoundRequest {
  itemDescription: string;
  itemCategory: string;
  estimatedValue?: number;
  isValuable?: boolean;
  foundLocation: string;
  roomId?: string;
  photos?: string[];
}

// Guest request creation
export interface ICreateGuestRequest {
  roomId: string;
  requestType: string;
  description: string;
  itemsRequested?: IRequestedItem[];
  preferredTime?: string;
  preferredDate?: Date;
  priority?: HKPriority;
  source: string;
}

// Schedule creation
export interface ICreateScheduleRequest {
  staffId: string;
  shiftId: string;
  scheduleDate: Date;
  assignedFloors?: number[];
  assignedSections?: string[];
  notes?: string;
}

// Dashboard response
export interface IHKDashboardData {
  stats: {
    totalRooms: number;
    vacantClean: number;
    vacantDirty: number;
    checkouts: number;
    cleaningInProgress: number;
    outOfOrder: number;
    pendingTasks: number;
    activeTasks: number;
    completedToday: number;
    urgentPending: number;
    inspectionsPending: number;
    avgCleaningTime: number;
    qualityScore: number;
  };
  roomsByFloor: Record<number, IRoomStatusSummary[]>;
  urgentTasks: IHKTask[];
  staffWorkload: IStaffWorkloadSummary[];
  recentActivity: IActivityItem[];
  supplyAlerts: ISupplyAlert[];
}

export interface IRoomStatusSummary {
  roomId: string;
  roomNumber: string;
  status: HKRoomStatus;
  priority?: HKPriority;
  assignedTo?: string;
  taskStatus?: HKTaskStatus;
  isVip: boolean;
  guestName?: string;
  checkoutTime?: string;
}

export interface IStaffWorkloadSummary {
  staffId: string;
  staffName: string;
  staffCode: string;
  isAvailable: boolean;
  currentRoom?: string;
  activeTasks: number;
  completedToday: number;
  currentCredits: number;
  maxCredits: number;
  qualityScore?: number;
}

export interface IActivityItem {
  id: string;
  type: 'task_completed' | 'inspection' | 'maintenance' | 'guest_request' | 'status_change';
  description: string;
  roomNumber?: string;
  staffName?: string;
  timestamp: Date;
}

export interface ISupplyAlert {
  supplyId: string;
  supplyName: string;
  currentStock: number;
  parLevel: number;
  status: 'low' | 'critical' | 'out_of_stock';
  location: string;
}

// Workload distribution
export interface IWorkloadDistribution {
  totalCredits: number;
  availableStaff: number;
  creditsPerStaff: number;
  distribution: {
    staffId: string;
    staffName: string;
    assignedCredits: number;
    assignedTasks: number;
    capacity: number;
  }[];
}

// Reports
export interface IHKDailyReport {
  date: Date;
  branchId: string;
  branchName: string;
  summary: {
    roomsCleaned: number;
    tasksCompleted: number;
    avgCleaningTime: number;
    inspectionPassRate: number;
    staffPresent: number;
    guestComplaints: number;
  };
  staffPerformance: {
    staffId: string;
    staffName: string;
    roomsCleaned: number;
    avgTime: number;
    qualityScore: number;
    onTime: boolean;
  }[];
  issues: {
    type: string;
    count: number;
    details: string[];
  }[];
  supplyUsage: {
    supplyName: string;
    used: number;
    remaining: number;
  }[];
}

export interface IHKProductivityReport {
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalTasks: number;
    completedTasks: number;
    avgCompletionTime: number;
    onTimeRate: number;
    qualityScore: number;
    reworkRate: number;
  };
  trends: {
    date: Date;
    tasks: number;
    avgTime: number;
    quality: number;
  }[];
  topPerformers: {
    staffId: string;
    staffName: string;
    tasks: number;
    avgTime: number;
    quality: number;
  }[];
}
