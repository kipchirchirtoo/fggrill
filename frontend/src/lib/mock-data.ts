import { UserRole } from './auth-context';

// Mock Branches
export const mockBranches = [
  {
    id: 1,
    name: 'Famous Gate Bomet (Central)',
    code: 'FGB-HQ',
    location: 'Bomet Town',
    is_central_warehouse: true,
    is_main_branch: true,
    status: 'active',
    stock_value: 5200000,
    staff_count: 45,
    room_count: 0
  },
  {
    id: 2,
    name: 'Famous Gate Bomet Town',
    code: 'FGB-BMT',
    location: 'Bomet Town Center',
    is_central_warehouse: false,
    is_main_branch: false,
    status: 'active',
    stock_value: 1200000,
    staff_count: 12,
    room_count: 25
  },
  {
    id: 3,
    name: 'Famous Gate Kericho',
    code: 'FGB-KER',
    location: 'Kericho Town',
    is_central_warehouse: false,
    is_main_branch: false,
    status: 'active',
    stock_value: 1800000,
    staff_count: 18,
    room_count: 35
  },
  {
    id: 4,
    name: 'Famous Gate Kapsoit',
    code: 'FGB-KAP',
    location: 'Kapsoit Center',
    is_central_warehouse: false,
    is_main_branch: false,
    status: 'active',
    stock_value: 950000,
    staff_count: 8,
    room_count: 15
  },
  {
    id: 5,
    name: 'Famous Gate Mogogosiek',
    code: 'FGB-MOG',
    location: 'Mogogosiek Town',
    is_central_warehouse: false,
    is_main_branch: false,
    status: 'active',
    stock_value: 850000,
    staff_count: 7,
    room_count: 12
  },
  {
    id: 6,
    name: 'Famous Gate Litein',
    code: 'FGB-LIT',
    location: 'Litein Town',
    is_central_warehouse: false,
    is_main_branch: false,
    status: 'active',
    stock_value: 1100000,
    staff_count: 10,
    room_count: 20
  }
];

// Mock Inventory Items
export const mockInventoryItems = [
  { id: '1', name: 'Premium Rice (25kg)', sku: 'FOOD-RIC-001', quantity: 45, unit_cost: 3500, category: 'Food', status: 'active', min_level: 10 },
  { id: '2', name: 'Cooking Oil (20L)', sku: 'FOOD-OIL-001', quantity: 12, unit_cost: 4200, category: 'Food', status: 'low', min_level: 15 },
  { id: '3', name: 'Wheat Flour (2kg)', sku: 'FOOD-WHT-001', quantity: 150, unit_cost: 220, category: 'Food', status: 'active', min_level: 50 },
  { id: '4', name: 'Sugar (50kg)', sku: 'FOOD-SUG-001', quantity: 8, unit_cost: 6500, category: 'Food', status: 'active', min_level: 5 },
  { id: '5', name: 'Toilet Paper (Bale)', sku: 'HK-TP-001', quantity: 35, unit_cost: 1800, category: 'Housekeeping', status: 'active', min_level: 10 },
  { id: '6', name: 'Cleaning Detergent (5L)', sku: 'HK-DET-001', quantity: 4, unit_cost: 850, category: 'Housekeeping', status: 'low', min_level: 8 },
  { id: '7', name: 'Bed Sheets (Queen)', sku: 'LIN-SHT-001', quantity: 120, unit_cost: 1200, category: 'Linen', status: 'active', min_level: 20 },
  { id: '8', name: 'Towels (Bath)', sku: 'LIN-TWL-001', quantity: 200, unit_cost: 800, category: 'Linen', status: 'active', min_level: 30 },
  { id: '9', name: 'Guest Soap (Small)', sku: 'AMN-SOP-001', quantity: 500, unit_cost: 15, category: 'Amenities', status: 'active', min_level: 100 },
  { id: '10', name: 'Mineral Water (500ml)', sku: 'BEV-WTR-001', quantity: 240, unit_cost: 30, category: 'Beverages', status: 'active', min_level: 48 },
  { id: '11', name: 'Soda (300ml)', sku: 'BEV-SOD-001', quantity: 140, unit_cost: 40, category: 'Beverages', status: 'active', min_level: 48 },
  { id: '12', name: 'Milk (500ml)', sku: 'FOOD-MLK-001', quantity: 20, unit_cost: 65, category: 'Food', status: 'low', min_level: 30 },
  { id: '13', name: 'Beef (kg)', sku: 'FOOD-BEF-001', quantity: 15, unit_cost: 650, category: 'Food', status: 'active', min_level: 10 },
  { id: '14', name: 'Chicken (Whole)', sku: 'FOOD-CHK-001', quantity: 25, unit_cost: 800, category: 'Food', status: 'active', min_level: 10 },
  { id: '15', name: 'Gas Cylinder (45kg)', sku: 'ENG-GAS-001', quantity: 2, unit_cost: 4500, category: 'Energy', status: 'low', min_level: 3 },
];

// Mock Stock Requests
export const mockStockRequests = [
  { id: 'REQ-001', request_number: 'REQ-2024-001', from_branch: 'FGB-KER', status: 'pending', items_count: 5, priority: 'HIGH', created_at: new Date().toISOString() },
  { id: 'REQ-002', request_number: 'REQ-2024-002', from_branch: 'FGB-LIT', status: 'approved', items_count: 3, priority: 'NORMAL', created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'REQ-003', request_number: 'REQ-2024-003', from_branch: 'FGB-KAP', status: 'completed', items_count: 8, priority: 'NORMAL', created_at: new Date(Date.now() - 172800000).toISOString() },
  { id: 'REQ-004', request_number: 'REQ-2024-004', from_branch: 'FGB-BMT', status: 'pending', items_count: 2, priority: 'URGENT', created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'REQ-005', request_number: 'REQ-2024-005', from_branch: 'FGB-MOG', status: 'rejected', items_count: 1, priority: 'LOW', created_at: new Date(Date.now() - 432000000).toISOString() },
];

// Mock Dispatches
export const mockDispatches = [
  { id: 'DIS-001', dispatch_number: 'DIS-2024-001', to_branch: 'FGB-KER', status: 'in_transit', items_count: 5, created_at: new Date().toISOString(), estimated_delivery: new Date(Date.now() + 3600000).toISOString() },
  { id: 'DIS-002', dispatch_number: 'DIS-2024-002', to_branch: 'FGB-LIT', status: 'pending', items_count: 3, created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: 'DIS-003', dispatch_number: 'DIS-2024-003', to_branch: 'FGB-KAP', status: 'delivered', items_count: 8, created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: 'DIS-004', dispatch_number: 'DIS-2024-004', to_branch: 'FGB-BMT', status: 'in_transit', items_count: 12, created_at: new Date(Date.now() - 1800000).toISOString(), estimated_delivery: new Date(Date.now() + 1800000).toISOString() },
];

// Mock Staff
export const mockStaff = [
  { id: '1', name: 'John Doe', role: UserRole.GENERAL_MANAGER, branch: 'FGB-HQ', status: 'active', email: 'gm@famousgate.com' },
  { id: '2', name: 'Jane Smith', role: UserRole.BRANCH_MANAGER, branch: 'FGB-KER', status: 'active', email: 'bm.ker@famousgate.com' },
  { id: '3', name: 'Alice Johnson', role: UserRole.RECEPTIONIST, branch: 'FGB-KER', status: 'active', email: 'rec.ker@famousgate.com' },
  { id: '4', name: 'Bob Brown', role: UserRole.HOUSEKEEPING, branch: 'FGB-KER', status: 'active', email: 'hk.ker@famousgate.com' },
  { id: '5', name: 'Charlie Davis', role: UserRole.RESTAURANT, branch: 'FGB-KER', status: 'active', email: 'res.ker@famousgate.com' },
  { id: '6', name: 'Diana Evans', role: UserRole.ACCOUNTANT, branch: 'FGB-HQ', status: 'active', email: 'acc@famousgate.com' },
  { id: '7', name: 'Evan Wilson', role: UserRole.MAINTENANCE, branch: 'FGB-HQ', status: 'active', email: 'maint@famousgate.com' },
  { id: '8', name: 'Frank Thomas', role: UserRole.CENTRAL_STOREKEEPER, branch: 'FGB-HQ', status: 'active', email: 'store@famousgate.com' },
  { id: '9', name: 'Grace Lee', role: UserRole.BRANCH_STOREKEEPER, branch: 'FGB-KER', status: 'active', email: 'store.ker@famousgate.com' },
  { id: '10', name: 'Henry White', role: UserRole.AUDITOR, branch: 'FGB-HQ', status: 'active', email: 'audit@famousgate.com' },
  { id: '11', name: 'Ivy Green', role: UserRole.HOUSEKEEPING, branch: 'FGB-KER', status: 'active', email: 'hk2.ker@famousgate.com' },
  { id: '12', name: 'Jack Black', role: UserRole.RECEPTIONIST, branch: 'FGB-LIT', status: 'active', email: 'rec.lit@famousgate.com' },
];

// Mock Rooms
export const mockRooms = [
  { id: '101', room_number: '101', type: 'Standard', status: 'occupied', floor: 1, guest_name: 'John Guest', price: 3500, clean_status: 'clean' },
  { id: '102', room_number: '102', type: 'Standard', status: 'available', floor: 1, guest_name: null, price: 3500, clean_status: 'clean' },
  { id: '103', room_number: '103', type: 'Standard', status: 'dirty', floor: 1, guest_name: null, price: 3500, clean_status: 'dirty' },
  { id: '104', room_number: '104', type: 'Standard', status: 'maintenance', floor: 1, guest_name: null, price: 3500, clean_status: 'dirty' },
  { id: '105', room_number: '105', type: 'Deluxe', status: 'occupied', floor: 1, guest_name: 'Sarah VIP', price: 5500, clean_status: 'clean' },
  { id: '201', room_number: '201', type: 'Deluxe', status: 'available', floor: 2, guest_name: null, price: 5500, clean_status: 'clean' },
  { id: '202', room_number: '202', type: 'Deluxe', status: 'occupied', floor: 2, guest_name: 'Mike Traveler', price: 5500, clean_status: 'clean' },
  { id: '203', room_number: '203', type: 'Executive', status: 'reserved', floor: 2, guest_name: 'Corporate Client', price: 8500, clean_status: 'clean' },
  { id: '204', room_number: '204', type: 'Executive', status: 'available', floor: 2, guest_name: null, price: 8500, clean_status: 'clean' },
  { id: '301', room_number: '301', type: 'Suite', status: 'occupied', floor: 3, guest_name: 'Honeymoon Couple', price: 12000, clean_status: 'clean' },
];

// Mock Bookings
export const mockBookings = [
  { id: 'BK-001', guest_name: 'John Guest', room_number: '101', room_type: 'Standard', status: 'checked_in', check_in_date: new Date().toISOString(), check_out_date: new Date(Date.now() + 86400000).toISOString(), amount: 3500, payment_status: 'paid', phone: '0712345678' },
  { id: 'BK-002', guest_name: 'Sarah VIP', room_number: '105', room_type: 'Deluxe', status: 'checked_in', check_in_date: new Date().toISOString(), check_out_date: new Date(Date.now() + 172800000).toISOString(), amount: 11000, payment_status: 'paid', phone: '0722345678' },
  { id: 'BK-003', guest_name: 'Mike Traveler', room_number: '202', room_type: 'Deluxe', status: 'checked_in', check_in_date: new Date(Date.now() - 86400000).toISOString(), check_out_date: new Date().toISOString(), amount: 5500, payment_status: 'pending', phone: '0733345678' },
  { id: 'BK-004', guest_name: 'Corporate Client', room_number: '203', room_type: 'Executive', status: 'confirmed', check_in_date: new Date(Date.now() + 86400000).toISOString(), check_out_date: new Date(Date.now() + 259200000).toISOString(), amount: 17000, payment_status: 'paid', phone: '0744345678' },
  { id: 'BK-005', guest_name: 'Future Guest', room_number: '201', room_type: 'Deluxe', status: 'confirmed', check_in_date: new Date(Date.now() + 172800000).toISOString(), check_out_date: new Date(Date.now() + 345600000).toISOString(), amount: 11000, payment_status: 'deposit', phone: '0755345678' },
  { id: 'BK-006', guest_name: 'Past Guest', room_number: '102', room_type: 'Standard', status: 'checked_out', check_in_date: new Date(Date.now() - 172800000).toISOString(), check_out_date: new Date(Date.now() - 86400000).toISOString(), amount: 3500, payment_status: 'paid', phone: '0766345678' },
  { id: 'BK-007', guest_name: 'Cancelled Guest', room_number: '104', room_type: 'Standard', status: 'cancelled', check_in_date: new Date().toISOString(), check_out_date: new Date(Date.now() + 86400000).toISOString(), amount: 3500, payment_status: 'refunded', phone: '0777345678' },
  { id: 'BK-008', guest_name: 'Pending Guest', room_number: 'TBD', room_type: 'Executive', status: 'pending', check_in_date: new Date(Date.now() + 432000000).toISOString(), check_out_date: new Date(Date.now() + 518400000).toISOString(), amount: 8500, payment_status: 'pending', phone: '0788345678' },
];

// Mock Housekeeping Tasks
export const mockHousekeepingTasks = [
  { id: 'TSK-001', type: 'cleaning', room_number: '103', status: 'pending', priority: 'high', assigned_to: 'Ivy Green', created_at: new Date().toISOString(), description: 'Full cleaning required' },
  { id: 'TSK-002', type: 'inspection', room_number: '101', status: 'completed', priority: 'normal', assigned_to: 'Bob Brown', created_at: new Date(Date.now() - 3600000).toISOString(), description: 'Routine inspection' },
  { id: 'TSK-003', type: 'maintenance', room_number: '104', status: 'in_progress', priority: 'high', assigned_to: 'Evan Wilson', created_at: new Date(Date.now() - 7200000).toISOString(), description: 'Fix leaking tap' },
  { id: 'TSK-004', type: 'cleaning', room_number: '202', status: 'pending', priority: 'normal', assigned_to: 'Ivy Green', created_at: new Date().toISOString(), description: 'Refresh towels' },
  { id: 'TSK-005', type: 'deep_clean', room_number: '301', status: 'scheduled', priority: 'low', assigned_to: 'Bob Brown', created_at: new Date(Date.now() + 86400000).toISOString(), description: 'Monthly deep clean' },
];

// Mock Finance Data
export const mockFinanceData = {
  today: { revenue: 145000, expenses: 45000, profit: 100000 },
  week: { revenue: 850000, expenses: 320000, profit: 530000 },
  month: { revenue: 3200000, expenses: 1400000, profit: 1800000 },
  recent_transactions: [
    { id: 'TRX-001', type: 'income', category: 'Accommodation', amount: 15000, description: 'Room 101 Payment', date: new Date().toISOString() },
    { id: 'TRX-002', type: 'expense', category: 'Supplies', amount: 5000, description: 'Kitchen Supplies', date: new Date(Date.now() - 3600000).toISOString() },
    { id: 'TRX-003', type: 'income', category: 'Restaurant', amount: 2500, description: 'Table 4 Bill', date: new Date(Date.now() - 7200000).toISOString() },
    { id: 'TRX-004', type: 'expense', category: 'Maintenance', amount: 1200, description: 'Light bulbs', date: new Date(Date.now() - 10800000).toISOString() },
    { id: 'TRX-005', type: 'income', category: 'Accommodation', amount: 8500, description: 'Room 203 Deposit', date: new Date(Date.now() - 14400000).toISOString() },
  ]
};

// Helper to generate stats
export const generateDashboardStats = () => {
  return {
    totalRooms: mockRooms.length,
    occupiedRooms: mockRooms.filter(r => r.status === 'occupied').length,
    availableRooms: mockRooms.filter(r => r.status === 'available').length,
    occupancyRate: Math.round((mockRooms.filter(r => r.status === 'occupied').length / mockRooms.length) * 100),
    todayArrivals: mockBookings.filter(b => b.status === 'confirmed' || b.status === 'pending').length,
    todayDepartures: mockBookings.filter(b => b.status === 'checked_in' && new Date(b.check_out_date).getDate() === new Date().getDate()).length,
    pendingRequests: mockStockRequests.filter(r => r.status === 'pending').length,
    lowStockItems: mockInventoryItems.filter(i => i.status === 'low').length,
    staffCount: mockStaff.length,
    stockValue: mockInventoryItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0)
  };
};
