export interface DetailedModuleDoc {
  id: string;
  title: string;
  category: string;
  role: string;
  purpose: string;
  components: { name: string; description: string; actions: string[] }[];
  workflows: { title: string; steps: string[]; outcome: string }[];
  advancedFeatures: { name: string; description: string }[];
  troubleshooting: { issue: string; resolution: string }[];
  operationalFlow: string;
}

export const detailedDocs: DetailedModuleDoc[] = [
  {
    id: 'auditor',
    title: 'Auditor & Compliance Hub',
    category: 'INTEGRITY',
    role: 'Financial Auditor / Compliance Officer',
    purpose: 'To ensure every transaction in FamousGate Hotels is accurate, authorized, and verifiable.',
    components: [
      {
        name: 'Revenue Oversight Dashboard',
        description: 'A high-level view of all revenue streams filtered by branch, date, and payment method.',
        actions: ['Filter by date range', 'Export to Excel', 'View trend lines']
      },
      {
        name: 'Financial Verification Tool',
        description: 'Interface for matching manual bank entries with system-recorded payments.',
        actions: ['Mark as Verified', 'Flag Discrepancy', 'Attach Bank Slip']
      }
    ],
    workflows: [
      {
        title: 'Daily Reconciliation Flow',
        steps: [
          'Pull system revenue report for the previous 24 hours.',
          'Identify all M-Pesa and Card payments in the log.',
          'Verify these payments appear in the relevant bank/provider statements.',
          'Mark each transaction as "Verified" in the Auditor module.'
        ],
        outcome: 'Discrepancy-free financial records.'
      }
    ],
    advancedFeatures: [
      { name: 'Anomaly Detection', description: 'System flags unusually high discount rates or void patterns for immediate review.' }
    ],
    troubleshooting: [
      { issue: 'Payment not found in bank statement', resolution: 'Check if payment was sent to the wrong branch till or if provider delay exists.' }
    ],
    operationalFlow: 'The Auditor starts the day by reviewing the previous day’s revenue. They cross-reference the digital records with physical banking slips and provider statements (M-Pesa, Card). Any discrepancies are immediately flagged to the Branch Manager and Accountant.'
  },
  {
    id: 'branch-storekeeper',
    title: 'Branch Storekeeper Module',
    category: 'SUPPLY CHAIN',
    role: 'Local Warehouse Manager',
    purpose: 'Managing local branch inventory, ensuring supply availability, and tracking usage.',
    components: [
      {
        name: 'Stock Request Portal',
        description: 'Electronic requisition system for ordering supplies from Central Store.',
        actions: ['Browse Master Catalog', 'Specify Quantities', 'Track Request Status']
      },
      {
        name: 'Delivery Verification Screen',
        description: 'Interface for confirming receipt of goods from Central Store.',
        actions: ['Record Received Qty', 'Flag Damages', 'Sign Off Digitally']
      }
    ],
    workflows: [
      {
        title: 'Replenishment Flow',
        steps: [
          'Identify items falling below the re-order point via "Low Stock Alerts".',
          'Create a "Stock Request" and submit for Manager approval.',
          'Once approved by Branch Manager, it goes to Central Store for fulfillment.',
          'Receive physical goods, verify quantities on the "Delivery Confirmation" screen, and update local stock.'
        ],
        outcome: 'Maintained stock levels with no operational downtime.'
      }
    ],
    advancedFeatures: [
      { name: 'Internal Transfer Logic', description: 'Enables moving stock between departments like Bar to Kitchen for specific event needs.' }
    ],
    troubleshooting: [
      { issue: 'Stock levels don’t match physical count', resolution: 'Check if usage (wastage/sales) was recorded correctly or run a Re-sync.' }
    ],
    operationalFlow: 'The Storekeeper maintains the local pulse of supplies. They ensure that the Kitchen never runs out of ingredients and the Bar never runs out of drinks. Every item movement, whether incoming from Central or outgoing to a department, must be logged.'
  },
  {
    id: 'central-storekeeper',
    title: 'Central Storekeeper Module',
    category: 'LOGISTICS',
    role: 'Central Warehouse Master',
    purpose: 'The warehouse master responsible for the entire supply chain and branch fulfillment.',
    components: [
      {
        name: 'Branch Request Queue',
        description: 'Consolidated view of all stock requests from all hotel branches.',
        actions: ['Approve/Reject Requests', 'Partial Fulfill', 'Calculate Priority']
      },
      {
        name: 'Fleet Dispatch Manager',
        description: 'Logistics tool for assigning vehicles and drivers to deliveries.',
        actions: ['Select Vehicle', 'Assign Driver', 'Print Dispatch Note']
      }
    ],
    workflows: [
      {
        title: 'Dispatch & Logistics Flow',
        steps: [
          'Review pending branch requests and check Central Warehouse availability.',
          'Approve requests and generate a "Pick List" for the warehouse team.',
          'Once items are packed, create a "Dispatch Record" in the system.',
          'Assign a fleet vehicle and driver to the dispatch note.',
          'Complete the dispatch, which notifies the receiving branch.'
        ],
        outcome: 'Efficient distribution of goods across the enterprise.'
      }
    ],
    advancedFeatures: [
      { name: 'Supplier Performance Tracking', description: 'Audits how quickly suppliers fulfill Purchase Orders compared to their lead times.' }
    ],
    troubleshooting: [
      { issue: 'Out of stock at Central', resolution: 'Raise a bulk Purchase Order to the main supplier immediately.' }
    ],
    operationalFlow: 'The Central Storekeeper is the master controller of the company’s inventory assets. They balance the needs of all branches while managing the main repository of goods.'
  },
  {
    id: 'branch-acc',
    title: 'Branch Accountant',
    category: 'FINANCE',
    role: 'Branch Financial Officer',
    purpose: 'Managing branch-level finances, payments, bankings, and local expenditure.',
    components: [
      {
        name: 'Banking Record Module',
        description: 'Digital register for tracking all cash and cheque deposits.',
        actions: ['Log Deposit', 'Record Slip No', 'Upload Receipt Photo']
      },
      {
        name: 'Petty Cash Manager',
        description: 'Tracking and replenishment tool for local branch expenses.',
        actions: ['Issue Cash', 'Verify Receipt', 'Request Top-up']
      }
    ],
    workflows: [
      {
        title: 'End of Day Reconciliation',
        steps: [
          'Collect shift reports from all cashiers.',
          'Verify total cash, m-pesa, and card receipts matching the system expected total.',
          'Identify any "Variances" (Shortages/Overages) and log them.',
          'Prepare the banking slip for the day’s cash collection.'
        ],
        outcome: 'Finalized and audited branch financial daily report.'
      }
    ],
    advancedFeatures: [
      { name: 'Credit Bill Ageing', description: 'System tracks outstanding corporate and staff credits by age (30/60/90 days).' }
    ],
    troubleshooting: [
      { issue: 'Cash shortage', resolution: 'Interview the cashier, check for unrecorded transactions, and log the shortage in their account.' }
    ],
    operationalFlow: 'The Branch Accountant ensures the financial loop is closed every day. No money leaves or enters the branch without being recorded in the system.'
  },
  {
    id: 'reception',
    title: 'Reception Module',
    category: 'OPERATIONS',
    role: 'Front Office Agent / Receptionist',
    purpose: 'The front-facing operational module for managing guest stays and room inventory.',
    components: [
      {
        name: 'Room Status Map',
        description: 'Visual grid of all rooms, categorized by status (Clean, Dirty, Occupied).',
        actions: ['Check-In Guest', 'Change Status', 'View Room Details']
      },
      {
        name: 'Reservation Calendar',
        description: 'Timeline view of all future and past bookings.',
        actions: ['New Booking', 'Edit dates', 'Cancel Reservation']
      }
    ],
    workflows: [
      {
        title: 'Seamless Check-In Flow',
        steps: [
          'Greet guest and search for their reservation or create a walk-in.',
          'Verify ID/Passport and record details in the system.',
          'Select an available "Clean" room from the room map.',
          'Complete check-in, which notifies Housekeeping and activates the guest folio.'
        ],
        outcome: 'Guest correctly onboarded and room status updated to "Occupied".'
      }
    ],
    advancedFeatures: [
      { name: 'Folio Management', description: 'Consolidates all guest charges from restaurant, bar, and laundry into one final bill.' }
    ],
    troubleshooting: [
      { issue: 'Room not ready', resolution: 'Contact Housekeeping via the internal status dash to prioritize the clean-up.' }
    ],
    operationalFlow: 'Reception is the face of FamousGate Hotels. The team ensures that every guest has a smooth arrival and departure while maintaining 100% room occupancy accuracy.'
  },
  {
    id: 'superadmin',
    title: 'Superadmin Module',
    category: 'GOVERNANCE',
    role: 'System Administrator',
    purpose: 'Global control over system roles, security, and branch configurations.',
    components: [
      {
        name: 'User Management',
        description: 'The master list of all employees and their access levels.',
        actions: ['Add User', 'Deactivate Account', 'Edit Profile']
      },
      {
        name: 'System Audit Logs',
        description: 'A searchable log of all important system actions.',
        actions: ['Filter by User', 'Filter by Action', 'Export Logs']
      }
    ],
    workflows: [
      {
        title: 'Security Audit Flow',
        steps: [
          'Open the Global Audit logs weekly.',
          'Search for sensitive actions like "Delete Reservation" or "Manual Discount".',
          'Verify these actions were performed by authorized managers.',
          'Flag any suspicious login attempts from unrecognized IP addresses.'
        ],
        outcome: 'Maintained system security and accountability.'
      }
    ],
    advancedFeatures: [
      { name: 'Custom Permission Builder', description: 'Create unique roles by toggling over 50 individual system permissions.' }
    ],
    troubleshooting: [
      { issue: 'Branch not showing data', resolution: 'Check branch activation status and verified user assignment to that branch.' }
    ],
    operationalFlow: 'Superadmins act as the guardians of the system data. They configure the environment to match the specific operational needs of FamousGate Hotels.'
  },
  {
    id: 'bar-pos',
    title: 'Restaurant & Bar POS',
    category: 'SALES',
    role: 'Waiter / Barman / Service Staff',
    purpose: 'Detailed service-point interface for taking food and beverage orders and managing table tabs.',
    components: [
      {
        name: 'Digital Table Map',
        description: 'Visual layout of the restaurant/bar floor showing open and closed tables.',
        actions: ['Open Table', 'Close Bill', 'Split Items']
      },
      {
        name: 'Touch Order Interface',
        description: 'Speed-optimized menu for quick item selection and customization.',
        actions: ['Add to Cart', 'Apply Topping', 'Send to Kitchen']
      }
    ],
    workflows: [
      {
        title: 'Order to Table Flow',
        steps: [
          'Select a table or "Open Tab" for the customer.',
          'Punch in items (Drinks/Food) using the touch interface.',
          'Hit "Send" to automatically print chits for the Kitchen and Bar.',
          'Track order through "Preparing" and "Ready" statuses on the status board.'
        ],
        outcome: 'Accurate order communication and timely service.'
      }
    ],
    advancedFeatures: [
      { name: 'Inventory sync', description: 'Instantly reduces item counts as sales are made to prevent selling out-of-stock items.' }
    ],
    troubleshooting: [
      { issue: 'Wrong item sent', resolution: 'Use the "Void with Reason" function immediately and notify the supervisor.' }
    ],
    operationalFlow: 'The POS is the engine of service. Staff use it to maintain speed during peak hours while ensuring that every item served is accounted for financially.'
  },
  {
    id: 'manager',
    title: 'Managerial Oversight',
    category: 'LEADERSHIP',
    role: 'Branch Manager / GM',
    purpose: 'Oversight tools for Branch Managers and GMs to monitor performance and drive results.',
    components: [
      {
        name: 'KPI Performance Dash',
        description: 'Real-time metrics on revenue, room occupancy, and average basket value.',
        actions: ['Compare with Target', 'View Historical Trends', 'Branch Ranking']
      },
      {
        name: 'Managerial Approval Queue',
        description: 'In-app notification system for actions requiring higher authorization.',
        actions: ['Approve Rebate', 'Authorize Discount', 'Approve Expense']
      }
    ],
    workflows: [
      {
        title: 'Operational Drill-Down',
        steps: [
          'Open the Performance Dashboard every morning.',
          'Identify departments with low revenue or high wastage.',
          'Drill down into individual transactions to understand the root cause.',
          'Schedule a team briefing to address issues and set corrective targets.'
        ],
        outcome: 'Data-driven leadership and operational improvement.'
      }
    ],
    advancedFeatures: [
      { name: 'Forecasting Engine', description: 'Uses historical data to predict next week’s occupancy and ingredient needs.' }
    ],
    troubleshooting: [
      { issue: 'Dashboard showing zero data', resolution: 'Verify that previous day sales were successfully synced and closed by cashiers.' }
    ],
    operationalFlow: 'Managers lead by looking at the numbers and the people. The system provides the visibility they need to steer the branch toward profitability.'
  },
  {
    id: 'hr',
    title: 'HR & Personnel',
    category: 'TALENT',
    role: 'HR Manager / Payroll Officer',
    purpose: 'Complete lifecycle management of company employees from onboarding to payroll.',
    components: [
      {
        name: 'Employee Master File',
        description: 'The secure repository for all employee documents and certifications.',
        actions: ['Upload Contract', 'Track Leave Balance', 'Issue Warning']
      },
      {
        name: 'Payroll Processor',
        description: 'Automated engine for calculating net pay and statutory deductions.',
        actions: ['Calculate Payroll', 'Generate Payslips', 'Export KRA/NSSF reports']
      }
    ],
    workflows: [
      {
        title: 'Monthly Payroll Cycle',
        steps: [
          'Audit attendance logs from the digital clocking terminals.',
          'Review approved leave requests and overtime claims.',
          'Run the payroll engine to calculate statutory deductions (SHIF, NSSF, PAYE).',
          'Generate and distribute digital payslips to all employees.'
        ],
        outcome: 'Accurate, compliant, and timely payment to staff.'
      }
    ],
    advancedFeatures: [
      { name: 'Automatic Tax Brackets', description: 'System stays updated with the latest KRA tax laws to ensure 100% compliance.' }
    ],
    troubleshooting: [
      { issue: 'Incorrect deduction', resolution: 'Check employee profile for manual adjustments or incorrect statutory tier assignment.' }
    ],
    operationalFlow: 'The HR team ensures that FamousGate Hotels is a compliant employer and that every staff member is fairly rewarded for their contribution.'
  },
  {
    id: 'general-cashier',
    title: 'General Cashier Module',
    category: 'REVENUE',
    role: 'Central Cashier',
    purpose: 'The centralized revenue hub for bill settlement, payment verification, and master shift management.',
    components: [
      {
        name: 'Settlement Desk',
        description: 'Multi-payment interface for clearing complex guest bills.',
        actions: ['Select Payment Method', 'Apply Voucher', 'Partial Settlement']
      },
      {
        name: 'M-Pesa Verification Portal',
        description: 'Live API connection to Safaricom to verify transaction legitimacy.',
        actions: ['Check Reference', 'Verify Amount', 'Search by Phone']
      }
    ],
    workflows: [
      {
        title: 'Master Shift Closure',
        steps: [
          'Finish all pending bill settlements.',
          'Download the system "Trial Balance" for the current shift.',
          'Count physical cash and match against the system expected total.',
          'Generate the final "Shift Report" and hand over to the Accountant.'
        ],
        outcome: 'Zero-variance shift handover and secure revenue collection.'
      }
    ],
    advancedFeatures: [
      { name: 'Split Settlement', description: 'Allows a guest to pay part of the bill in Cash and part via M-Pesa or Card.' }
    ],
    troubleshooting: [
      { issue: 'Transaction code not found', resolution: 'Ask guest to refresh their M-Pesa messages or check for a reversal from Safaricom.' }
    ],
    operationalFlow: 'General Cashiers are the final financial checkpoint. They ensure that for every service provided, the correct payment has been collected.'
  },
  {
    id: 'famousgate-services',
    title: 'FamousGate Service POS',
    category: 'SERVICES',
    role: 'Spa Therapist / Specialist Staff',
    purpose: 'Dedicated POS interfaces for specialized service points such as Spa, Specialty Bars, and Lounges.',
    components: [
      {
        name: 'Service Booking Board',
        description: 'Appointment-based interface for tracking sessions and therapists.',
        actions: ['Book Session', 'Assign Staff', 'Track Duration']
      },
      {
        name: 'Outlet Sales Interface',
        description: 'Niche-specific product list (e.g., Spa Oils, Premium Pours).',
        actions: ['Sell Service', 'Sell Product', 'Post to Room Folio']
      }
    ],
    workflows: [
      {
        title: 'Professional Service Flow',
        steps: [
          'Verify the guest identity and room number.',
          'Select the specific service (e.g., Massage) or product being purchased.',
          'Assign the therapist/staff member providing the service.',
          'Charge the service directly or "Post to Room" for later settlement.'
        ],
        outcome: 'Seamless guest service experience with automated tracking.'
      }
    ],
    advancedFeatures: [
      { name: 'Commission Engine', description: 'Automatically calculates staff commissions based on the services they performed.' }
    ],
    troubleshooting: [
      { issue: 'Guest name not found', resolution: 'Check if they have officially checked in at the main Reception.' }
    ],
    operationalFlow: 'Service POS points are designed for high-end guest interactions, allowing for personalized service tracking and flexible billing.'
  },
  {
    id: 'kitchen-display',
    title: 'Kitchen Display System (KDS)',
    category: 'KITCHEN',
    role: 'Head Chef / Kitchen Staff',
    purpose: 'Real-time order visualization for kitchen staff to manage food preparation and timing.',
    components: [
      {
        name: 'Live Order Grid',
        description: 'Large-font display of all active orders with preparation timers.',
        actions: ['Accept Order', 'Bump Order', 'View Recipes']
      },
      {
        name: 'Production Summary',
        description: 'Aggregated view of how many steaks or burgers are needed across all tables.',
        actions: ['Check Total Counts', 'Prioritize Cooking']
      }
    ],
    workflows: [
      {
        title: 'Kitchen Production Flow',
        steps: [
          'Watch the grid for new incoming orders from POS.',
          'Tap "Start" to notify servers that preparation has begun.',
          'Follow the digital item card for special guest instructions.',
          'Tap "Complete" when done to alert the waiter for pickup.'
        ],
        outcome: 'Reduced "Order to Table" wait times and improved food quality.'
      }
    ],
    advancedFeatures: [
      { name: 'Station Routing', description: 'Automatically sends Grill items to the Grill screen and Pastries to the Pastries screen.' }
    ],
    troubleshooting: [
      { issue: 'Order taking too long', resolution: 'The system highlights the ticket in Red—assign more chefs to that specific table.' }
    ],
    operationalFlow: 'The KDS is the brain of the kitchen. It removes the stress of lost tickets and ensure the kitchen produces exactly what the guest asked for.'
  },
  {
    id: 'kitchen-ops',
    title: 'Kitchen Operations',
    category: 'KITCHEN',
    role: 'Executive Chef / Store Coord',
    purpose: 'Back-of-house management for recipes, wastage, and kitchen inventory requisitions.',
    components: [
      {
        name: 'Recipe Costing Tool',
        description: 'Detailed breakdown of ingredient costs for every menu item.',
        actions: ['Adjust Recipe', 'Calculate Margin', 'Update Prices']
      },
      {
        name: 'Wastage Register',
        description: 'Interface for logging burned, spoiled, or returned food items.',
        actions: ['Log Waste', 'Specify Reason', 'Get Mgr Approval']
      }
    ],
    workflows: [
      {
        title: 'Stock Control Flow',
        steps: [
          'Calculate daily needs and raise a "Kitchen Requisition" to the Storekeeper.',
          'At the end of service, record any items that were wasted or spoiled.',
          'The system calculates the "Variance" between items sold and ingredients used.',
          'Review the usage report to optimize future ordering.'
        ],
        outcome: 'Minimized cost of sales and reduced food waste.'
      }
    ],
    advancedFeatures: [
      { name: 'Inventory Depletion Logic', description: 'Automatically deducts individual ingredients (e.g., 200g Beef) from stock when a Burger is sold.' }
    ],
    troubleshooting: [
      { issue: 'High ingredient variance', resolution: 'Audit recipe measurements and ensure every single waste item is being logged.' }
    ],
    operationalFlow: 'Kitchen Operations ensure that the kitchen is not just cooking, but operating as a profitable business unit.'
  }
];
