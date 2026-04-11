const fs = require('fs');
const path = require('path');

// Map of folder paths to page titles
const pageTitles = {
  // Dashboard root
  'dashboard/admin': 'Admin Dashboard',
  'dashboard/admin/audit': 'Audit',
  'dashboard/admin/bar/menu': 'Bar Menu',
  'dashboard/admin/channels': 'Channels',
  'dashboard/admin/checkin': 'Check-in',
  'dashboard/admin/docs': 'Documentation',
  'dashboard/admin/drivers': 'Drivers',
  'dashboard/admin/finance': 'Finance',
  'dashboard/admin/finance/budgets': 'Budgets',
  'dashboard/admin/finance/expenses': 'Expenses',
  'dashboard/admin/fleet': 'Fleet Management',
  'dashboard/admin/guests': 'Guests',
  'dashboard/admin/housekeeping': 'Housekeeping',
  'dashboard/admin/hr-payroll': 'HR & Payroll',
  'dashboard/admin/id-cards': 'ID Cards',
  'dashboard/admin/inventory': 'Inventory',
  'dashboard/admin/kyogong/services': 'Kyogong Services',
  'dashboard/admin/maintenance': 'Maintenance',
  'dashboard/admin/rates': 'Rates',
  'dashboard/admin/reports': 'Reports',
  'dashboard/admin/reservations': 'Reservations',
  'dashboard/admin/restaurant': 'Restaurant',
  'dashboard/admin/restaurant/menu': 'Restaurant Menu',
  'dashboard/admin/restaurant/pos-control': 'POS Control',
  'dashboard/admin/rooms': 'Rooms',
  'dashboard/admin/settings': 'Settings',
  'dashboard/admin/staff': 'Staff',
  'dashboard/admin/staff/attendance': 'Staff Attendance',
  'dashboard/admin/storekeeping': 'Storekeeping',
  'dashboard/admin/storekeeping/branch': 'Branch Store',
  'dashboard/admin/storekeeping/central': 'Central Store',
  'dashboard/admin/storekeeping/stock-takes': 'Stock Takes',
  'dashboard/admin/storekeeping/transfers': 'Transfers',
  'dashboard/admin/suppliers': 'Suppliers',
  'dashboard/admin/system/branches': 'Branches',
  'dashboard/admin/system/departments': 'Departments',
  'dashboard/admin/system/roles/migration': 'Role Migration',
  'dashboard/admin/users': 'Users',
  'dashboard/admin/vehicles': 'Vehicles',
  'dashboard/admin/wastage': 'Wastage',
  
  // Auditor
  'dashboard/auditor': 'Auditor Dashboard',
  'dashboard/auditor/approvals': 'Approvals',
  'dashboard/auditor/audit-reports': 'Audit Reports',
  'dashboard/auditor/banking': 'Banking',
  'dashboard/auditor/bar-stock': 'Bar Stock',
  'dashboard/auditor/branch-audit': 'Branch Audit',
  'dashboard/auditor/branch-audit/business-mpesa': 'Business M-Pesa',
  'dashboard/auditor/branch-audit/credit-bills': 'Credit Bills',
  'dashboard/auditor/branch-audit/invoices': 'Invoices',
  'dashboard/auditor/branch-audit/stock-take': 'Stock Take',
  'dashboard/auditor/branch-audit/void-bills': 'Void Bills',
  'dashboard/auditor/financial-verification': 'Financial Verification',
  'dashboard/auditor/financial-verification/logs': 'Verification Logs',
  'dashboard/auditor/invoices': 'Invoices',
  'dashboard/auditor/kitchen-requisitions': 'Kitchen Requisitions',
  'dashboard/auditor/kitchen-usage': 'Kitchen Usage',
  'dashboard/auditor/kitchen-wastage': 'Kitchen Wastage',
  'dashboard/auditor/ledger': 'Ledger',
  'dashboard/auditor/orders': 'Orders',
  'dashboard/auditor/payroll-approvals': 'Payroll Approvals',
  'dashboard/auditor/purchases': 'Purchases',
  'dashboard/auditor/revenue-oversight': 'Revenue Oversight',
  'dashboard/auditor/sales': 'Sales',
  'dashboard/auditor/search': 'Search',
  'dashboard/auditor/shift-verification': 'Shift Verification',
  'dashboard/auditor/sold-items': 'Sold Items',
  'dashboard/auditor/staff-audit': 'Staff Audit',
  'dashboard/auditor/stock': 'Stock',
  
  // Bar
  'dashboard/bar': 'Bar',
  'dashboard/bar/cashier': 'Bar Cashier',
  'dashboard/bar/inventory': 'Bar Inventory',
  'dashboard/bar/inventory/morning-count': 'Morning Count',
  'dashboard/bar/orders': 'Bar Orders',
  'dashboard/bar/pos': 'Bar POS',
  'dashboard/bar/tabs': 'Bar Tabs',
  
  // Branch Accounting
  'dashboard/branch-accounting': 'Branch Accounting',
  'dashboard/branch-accounting/banking': 'Banking',
  'dashboard/branch-accounting/bookings': 'Bookings',
  'dashboard/branch-accounting/credit-bills': 'Credit Bills',
  'dashboard/branch-accounting/credit-bills/customer': 'Customer Credit',
  'dashboard/branch-accounting/financials': 'Financials',
  'dashboard/branch-accounting/food-control': 'Food Control',
  'dashboard/branch-accounting/invoices': 'Invoices',
  'dashboard/branch-accounting/logbooks': 'Logbooks',
  'dashboard/branch-accounting/payments': 'Payments',
  'dashboard/branch-accounting/purchases': 'Purchases',
  'dashboard/branch-accounting/record-banking': 'Record Banking',
  'dashboard/branch-accounting/shift-review': 'Shift Review',
  'dashboard/branch-accounting/stock-take': 'Stock Take',
  
  // Branch Manager
  'dashboard/branch-manager': 'Branch Manager',
  'dashboard/branch-manager/arrivals': 'Arrivals',
  'dashboard/branch-manager/attendance': 'Attendance',
  'dashboard/branch-manager/bar-menu': 'Bar Menu',
  'dashboard/branch-manager/checkin': 'Check-in',
  'dashboard/branch-manager/departures': 'Departures',
  'dashboard/branch-manager/guests': 'Guests',
  'dashboard/branch-manager/housekeeping': 'Housekeeping',
  'dashboard/branch-manager/maintenance': 'Maintenance',
  'dashboard/branch-manager/menu': 'Menu',
  'dashboard/branch-manager/reports': 'Reports',
  'dashboard/branch-manager/reservations': 'Reservations',
  'dashboard/branch-manager/reservations/new': 'New Reservation',
  'dashboard/branch-manager/restaurant': 'Restaurant',
  'dashboard/branch-manager/rooms': 'Rooms',
  'dashboard/branch-manager/sold-items': 'Sold Items',
  'dashboard/branch-manager/staff': 'Staff',
  'dashboard/branch-manager/stock': 'Stock',
  'dashboard/branch-manager/stock-out': 'Stock Out',
  'dashboard/branch-manager/wastage': 'Wastage',
  
  // Branch Operations
  'dashboard/branch-operations': 'Branch Operations',
  'dashboard/branch-operations/communications': 'Communications',
  'dashboard/branch-operations/communications/announcements': 'Announcements',
  'dashboard/branch-operations/communications/messages': 'Messages',
  'dashboard/branch-operations/communications/notifications': 'Notifications',
  'dashboard/branch-operations/financials': 'Financials',
  'dashboard/branch-operations/financials/budget': 'Budget',
  'dashboard/branch-operations/financials/expenses': 'Expenses',
  'dashboard/branch-operations/financials/reports': 'Reports',
  'dashboard/branch-operations/financials/revenue': 'Revenue',
  'dashboard/branch-operations/inventory': 'Inventory',
  'dashboard/branch-operations/inventory/stock-takes': 'Stock Takes',
  'dashboard/branch-operations/operations/reservations': 'Reservations',
  'dashboard/branch-operations/operations/rooms': 'Rooms',
  'dashboard/branch-operations/staff': 'Staff',
  'dashboard/branch-operations/staff/attendance': 'Attendance',
  'dashboard/branch-operations/staff/schedule': 'Schedule',
  
  // Branch Store
  'dashboard/branch-store': 'Branch Store',
  'dashboard/branch-store/kitchen-requisitions': 'Kitchen Requisitions',
  'dashboard/branch-store/kitchen-usage': 'Kitchen Usage',
  'dashboard/branch-store/receive': 'Receive',
  'dashboard/branch-store/reports': 'Reports',
  'dashboard/branch-store/requests': 'Requests',
  'dashboard/branch-store/stock': 'Stock',
  'dashboard/branch-store/stock-out': 'Stock Out',
  'dashboard/branch-store/stock-takes': 'Stock Takes',
  'dashboard/branch-store/suppliers': 'Suppliers',
  
  // Cashier
  'dashboard/cashier': 'Cashier',
  
  // Central Store
  'dashboard/central-store': 'Central Store',
  'dashboard/central-store/bar-items': 'Bar Items',
  'dashboard/central-store/dispatch': 'Dispatch',
  'dashboard/central-store/dispatch/new': 'New Dispatch',
  'dashboard/central-store/drivers': 'Drivers',
  'dashboard/central-store/foodstuffs': 'Foodstuffs',
  'dashboard/central-store/inventory': 'Inventory',
  'dashboard/central-store/packing': 'Packing',
  'dashboard/central-store/procurement/grn': 'GRN',
  'dashboard/central-store/procurement/grn/new': 'New GRN',
  'dashboard/central-store/receiving': 'Receiving',
  'dashboard/central-store/reports': 'Reports',
  'dashboard/central-store/requests': 'Requests',
  'dashboard/central-store/stationery': 'Stationery',
  'dashboard/central-store/suppliers': 'Suppliers',
  'dashboard/central-store/suppliers/grn': 'Supplier GRN',
  'dashboard/central-store/suppliers/invoices': 'Supplier Invoices',
  'dashboard/central-store/suppliers/payments': 'Supplier Payments',
  'dashboard/central-store/suppliers/purchase-orders': 'Purchase Orders',
  'dashboard/central-store/suppliers/reports': 'Supplier Reports',
  'dashboard/central-store/vehicles': 'Vehicles',
  
  // Employee
  'dashboard/employee/portal': 'Employee Portal',
  
  // Facilities
  'dashboard/facilities': 'Facilities',
  'dashboard/facilities/housekeeping/inspections': 'Inspections',
  'dashboard/facilities/housekeeping/lost-found': 'Lost & Found',
  'dashboard/facilities/housekeeping/tasks': 'Tasks',
  'dashboard/facilities/inventory': 'Inventory',
  'dashboard/facilities/maintenance/assets': 'Assets',
  'dashboard/facilities/maintenance/schedule': 'Schedule',
  'dashboard/facilities/maintenance/work-orders': 'Work Orders',
  'dashboard/facilities/quality-compliance': 'Quality & Compliance',
  'dashboard/facilities/rooms': 'Rooms',
  'dashboard/facilities/staff-management': 'Staff Management',
  
  // GM
  'dashboard/gm': 'General Manager',
  'dashboard/gm/branches': 'Branches',
  'dashboard/gm/compare': 'Compare',
  'dashboard/gm/finance': 'Finance',
  'dashboard/gm/leave-requests': 'Leave Requests',
  'dashboard/gm/reports': 'Reports',
  'dashboard/gm/reservations': 'Reservations',
  'dashboard/gm/staff': 'Staff',
  
  // Housekeeping
  'dashboard/housekeeping': 'Housekeeping',
  'dashboard/housekeeping/inspections': 'Inspections',
  'dashboard/housekeeping/inventory': 'Inventory',
  'dashboard/housekeeping/lost-found': 'Lost & Found',
  'dashboard/housekeeping/reports': 'Reports',
  'dashboard/housekeeping/rooms': 'Rooms',
  'dashboard/housekeeping/scheduling': 'Scheduling',
  'dashboard/housekeeping/staff': 'Staff',
  'dashboard/housekeeping/tasks': 'Tasks',
  'dashboard/housekeeping/workflows': 'Workflows',
  
  // HR
  'dashboard/hr': 'Human Resources',
  'dashboard/hr/adjustments': 'Adjustments',
  'dashboard/hr/attendance': 'Attendance',
  'dashboard/hr/employees': 'Employees',
  'dashboard/hr/employees/add': 'Add Employee',
  'dashboard/hr/leave': 'Leave',
  'dashboard/hr/payroll': 'Payroll',
  'dashboard/hr/performance': 'Performance',
  'dashboard/hr/policies': 'Policies',
  'dashboard/hr/salaries': 'Salaries',
  'dashboard/hr/staff-attendance': 'Staff Attendance',
  'dashboard/hr/terminal': 'Terminal',
  
  // Inventory
  'dashboard/inventory/audit': 'Inventory Audit',
  'dashboard/inventory/branch': 'Branch Inventory',
  'dashboard/inventory/central-store': 'Central Store Inventory',
  
  // Kitchen
  'dashboard/kitchen': 'Kitchen',
  
  // Kitchen Operations
  'dashboard/kitchen-operations': 'Kitchen Operations',
  'dashboard/kitchen-operations/food-controls': 'Food Controls',
  'dashboard/kitchen-operations/recipes': 'Recipes',
  'dashboard/kitchen-operations/requisitions': 'Requisitions',
  'dashboard/kitchen-operations/stock': 'Stock',
  'dashboard/kitchen-operations/usage': 'Usage',
  'dashboard/kitchen-operations/wastage': 'Wastage',
  
  // Kyogong
  'dashboard/kyogong/executive-bar': 'Executive Bar',
  'dashboard/kyogong/reception': 'Reception',
  'dashboard/kyogong/spa': 'Spa',
  'dashboard/kyogong/sports-bar': 'Sports Bar',
  
  // Maintenance
  'dashboard/maintenance': 'Maintenance',
  'dashboard/maintenance/assets': 'Assets',
  'dashboard/maintenance/orders': 'Orders',
  'dashboard/maintenance/schedule': 'Schedule',
  
  // Manager
  'dashboard/manager': 'Manager',
  'dashboard/manager/guests': 'Guests',
  'dashboard/manager/reports': 'Reports',
  'dashboard/manager/reservations': 'Reservations',
  'dashboard/manager/rooms': 'Rooms',
  'dashboard/manager/staff': 'Staff',
  
  // POS Kitchen
  'dashboard/pos-kitchen': 'POS & Kitchen',
  
  // Procurement
  'dashboard/procurement': 'Procurement',
  
  // Profile
  'dashboard/profile': 'Profile',
  
  // Reception
  'dashboard/reception': 'Reception',
  'dashboard/reception/checkin': 'Check-in',
  'dashboard/reception/guests': 'Guests',
  'dashboard/reception/housekeeping': 'Housekeeping',
  'dashboard/reception/reservations': 'Reservations',
  'dashboard/reception/rooms': 'Rooms',
  
  // Reports
  'dashboard/reports/analytics': 'Analytics',
  'dashboard/reports/revenue': 'Revenue',
  
  // Settings
  'dashboard/settings': 'Settings',
  
  // Storekeeping
  'dashboard/storekeeping': 'Storekeeping',
  'dashboard/storekeeping/branch': 'Branch',
  'dashboard/storekeeping/central': 'Central',
  'dashboard/storekeeping/drivers': 'Drivers',
  'dashboard/storekeeping/grn': 'GRN',
  'dashboard/storekeeping/inventory': 'Inventory',
  'dashboard/storekeeping/purchase-orders': 'Purchase Orders',
  'dashboard/storekeeping/reports': 'Reports',
  'dashboard/storekeeping/stock-takes': 'Stock Takes',
  'dashboard/storekeeping/suppliers': 'Suppliers',
  'dashboard/storekeeping/transfers': 'Transfers',
  'dashboard/storekeeping/vehicles': 'Vehicles',
  'dashboard/storekeeping/wastage': 'Wastage',
  
  // Super Admin
  'dashboard/super/admin/security': 'Security',
  
  // Superadmin
  'dashboard/superadmin/audit-logs': 'Audit Logs',
  'dashboard/superadmin/behavior-intelligence': 'Behavior Intelligence',
  
  // Docs
  'docs/architecture': 'Architecture',
  'docs/installation': 'Installation',
  'docs/roles/bar': 'Bar Role',
  'docs/roles/branch-manager': 'Branch Manager Role',
  'docs/roles/cashier': 'Cashier Role',
  'docs/roles/finance': 'Finance Role',
  'docs/roles/housekeeping': 'Housekeeping Role',
  'docs/roles/pos-kitchen': 'POS Kitchen Role',
  'docs/roles/reception': 'Reception Role',
  'docs/roles/superadmin': 'Superadmin Role',
  'docs/technical/backend': 'Backend',
  'docs/technical/database': 'Database',
  'docs/technical/frontend': 'Frontend',
  'docs/technical/python-services': 'Python Services',
};

console.log('Page title mapping created with', Object.keys(pageTitles).length, 'entries');
console.log('Sample entries:', Object.entries(pageTitles).slice(0, 5));
