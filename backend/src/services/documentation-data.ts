export interface DetailedModuleDoc {
  id: string;
  title: string;
  icon: string;
  description: string;
  features: string[];
  content: string;
  howToUse: string[];
}

export const detailedDocs: DetailedModuleDoc[] = [
  {
    id: 'auditor',
    title: 'Auditor Module',
    icon: 'ShieldCheck',
    description: 'The internal control and compliance hub for verifying system integrity and financial accuracy.',
    features: [
      'Revenue Oversight: Monitoring real-time revenue streams across all branches.',
      'Financial Verification: Reconciling payment gateways (e.g., M-Pesa, Bank) with system records.',
      'Sales Audit: Confirming operational sales records for accuracy and identifying anomalies.',
      'Inventory Audits: Verifying physical stock against system-reported levels.',
      'Compliance Checks: Ensuring all operational activities adhere to company policies.'
    ],
    content: `
      ### Role & Purpose
      The Auditor role is critical for maintaining the financial and operational health of FamousGate Hotels. Unlike managers who focus on performance, the Auditor focuses on **integrity**. They are the second pair of eyes that ensures what is recorded in the system matches reality.

      ### Key Workflows
      #### 1. Revenue Oversight
      Auditors monitor the "Pulse" of the business. By checking the Revenue Oversight dashboard, you can see if a branch is performing as expected. Significant drops or spikes might indicate errors or potential fraud.

      #### 2. Financial Reconciliation
      One of the most important tasks is verifying that money actually hit the bank. Auditors cross-reference the system's "Payments" records with external statements from M-Pesa or Banks. If the system says KES 5,000 was paid, the Auditor must verify it exists in the destination account.

      #### 3. Void & Discount Audit
      Auditors meticulously review voided bills and discounts. High volumes of voids or unauthorized discounts are red flags that require investigation.
    `,
    howToUse: [
      'Navigate to /dashboard/auditor/revenue-oversight daily to check for anomalies.',
      'Use the Financial Verification tool to match system payments with bank statements.',
      'Review Sales Audit reports weekly and flag any discrepancies for manager review.',
      'Conduct spot-checks of inventory by selecting "Inventory Audit" and comparing physical counts.'
    ]
  },
  {
    id: 'branch-storekeeper',
    title: 'Branch Storekeeper',
    icon: 'Package',
    description: 'Managing local branch inventory, ensuring supply availability, and tracking usage.',
    features: [
      'Stock Level Monitoring: Real-time visibility of local warehouse inventory.',
      'Stock Requests: Raising requisitions to the Central Store for replenishment.',
      'Delivery Receipt: Confirming and verifying incoming dispatches from Central.',
      'Usage Recording: Tracking stock out due to sales, kitchen usage, or bar transfers.',
      'Local Stock Takes: Performing regular physical counts to ensure system accuracy.'
    ],
    content: `
      ### Local Inventory Management
      As a Branch Storekeeper, your primary responsibility is ensuring the branch never runs out of critical items while maintaining accurate records.

      ### Critical Processes
      #### 1. The Requisition Flow
      When stock is low, you must initiate a "Stock Request." Be specific about quantities and urgency. Once Central approves it, you will see it as a "Pending Delivery."

      #### 2. Receiving Goods
      Never confirm a delivery without a physical count. When a dispatch note arrives, verify every item. If there is a discrepancy (e.g., 10 requested, 8 received), mark it in the system before confirming.

      #### 3. Tracking "Stock Out"
      Items leave the store for various reasons:
      - **Kitchen Usage**: Moving ingredients to the kitchen.
      - **Bar Usage**: Moving drinks to the POS area.
      - **Damage/Wastage**: Recording items that can no longer be sold.
    `,
    howToUse: [
      'Check the "Low Stock Alerts" every morning to plan your requests.',
      'Create a "Stock Request" for items reaching the reorder point.',
      'When a vehicle arrives, open "Incoming Dispatches," verify items, and hit "Confirm Receipt."',
      'Record all "Kitchen Usage" or "Bar Transfers" immediately to keep stock levels live.'
    ]
  },
  {
    id: 'central-storekeeper',
    title: 'Central Storekeeper',
    icon: 'Truck',
    description: 'The warehouse master responsible for the entire supply chain and branch fulfillment.',
    features: [
      'Master Catalog Management: Creating and maintaining SKU details and categories.',
      'Procurement: Managing suppliers, purchase orders, and receiving bulk shipments.',
      'Branch Fulfillment: Reviewing, approving, and dispatching requests from branches.',
      'Logistics Management: Assigning vehicles and drivers to delivery notes.',
      'Global Inventory Oversight: Managing the main warehouse stock levels.'
    ],
    content: `
      ### The Heart of Logistics
      The Central Storekeeper manages the "Master Inventory." You are responsible for ensuring the Central Warehouse is stocked and that all branches receive their supplies on time.

      ### Key Operations
      #### 1. Request Processing
      Branches depend on you. View "Pending Requests" daily. You can approve the full amount, partial amounts based on availability, or reject with a valid reason.

      #### 2. Dispatching & Logistics
      Once a request is approved, you must "Create Dispatch." This involves selecting the items, assigning a Vehicle (Fleet) and a Driver. The system generates a "Dispatch Note" which must travel with the goods.

      #### 3. Supplier Management
      Managing relationships with vendors is key. Use the Procurement module to track Purchase Orders (POs) and ensure that when items arrive at Central, they are correctly "Received" into the system.
    `,
    howToUse: [
      'Review all "Pending Branch Requests" every morning at 9:00 AM.',
      'Use the "Dispatch" tool to bundle approved requests and assign drivers.',
      'Maintain the "Master Catalog" by adding new items or updating prices as they change.',
      'Run a "Global Stock Report" weekly to identify items needing bulk procurement.'
    ]
  },
  {
    id: 'branch-acc',
    title: 'Branch Accountant',
    icon: 'Landmark',
    description: 'Managing branch-level finances, payments, bankings, and local expenditure.',
    features: [
      'Banking Records: Recording cash/cheque deposits into the company bank accounts.',
      'Bill Settlements: Processing and verifying payments for guest bills.',
      'Credit Management: Tracking staff and corporate credit bills and collections.',
      'Petty Cash: Managing local operational expenses and top-up requests.',
      'Shift Review: Reconciling cashier shift reports with actual collections.'
    ],
    content: `
      ### Financial Accuracy at the Branch
      The Branch Accountant ensures that all revenue collected at the branch is accounted for and securely banked. You act as the financial gatekeeper for the branch.

      ### Essential Workflows
      #### 1. Daily Banking
      When cash and cheques are collected from cashiers, they must be banked. You are responsible for recording the **Bank Slip Number** and **Date** in the "Record Banking" module. This creates a traceable link between the branch and the bank.

      #### 2. Credit Bill Management
      Some guests or staff may have "Credit Facilities." You must track these bills in the "Credit Bills" section. For staff, these are often deducted later from payroll. For corporate clients, you must track when the invoice is paid.

      #### 3. Petty Cash Control
      Minor branch expenses (e.g., buying small supplies) are paid through Petty Cash. Every cent must be backed by a receipt and recorded in the system.
    `,
    howToUse: [
      'Reconcile cashier shifts every evening using the "Shift Review" tool.',
      'Record all bank deposits immediately after returning from the bank.',
      'Audit the "Petty Cash" tin daily and ensure total cash + receipts = float amount.',
      'Follow up on "Pending Credit Bills" every Monday to ensure timely collection.'
    ]
  },
  {
    id: 'reception',
    title: 'Reception Module',
    icon: 'Bed',
    description: 'The front-facing operational module for managing guest stays and room inventory.',
    features: [
      'Reservation Management: Booking and tracking future guest stays.',
      'Guest Check-In: Smooth onboarding of guests with ID verification and room assignment.',
      'Room Status Oversight: Real-time view of Clean, Dirty, and Occupied rooms.',
      'Bill Generation: Consolidating accommodation and service charges for check-out.',
      'Guest Database: Maintaining a history of guest preferences and records.'
    ],
    content: `
      ### The Guest Experience
      Reception is the first and last point of contact for guests. Accuracy here ensures a professional image and prevents lost revenue.

      ### Core Processes
      #### 1. The Check-In Process
      Always verify the guest's ID. When checking in, assign a "Clean" room from the pool. Ensure the "Rate Plan" (e.g., Bed & Breakfast vs Half Board) is correct as this affects billing.

      #### 2. Room Status Coordination
      You must watch the "Room Map" closely. When a guest checks out, the room automatically becomes "Dirty." It remains unavailable for check-in until the Housekeeping module marks it as "Clean."

      #### 3. Billing & Check-Out
      Before a guest leaves, pull up their "Folio." This summarizes all charges: room, restaurant, bar, and any other services. Ensure all payments are recorded before closing the booking.
    `,
    howToUse: [
      'Use the "Reservations Calendar" to manage bookings and avoid overbooking.',
      'Always update the "Guest ID" and "Contact Number" during check-in for security.',
      'Coordinate with Housekeeping via the "Room Status" dash if a guest needs an early check-in.',
      'Generate the "Expected Arrivals" report every morning to prepare for the day.'
    ]
  },
  {
    id: 'superadmin',
    title: 'Superadmin Module',
    icon: 'Shield',
    description: 'The master control center for system configuration, security, and global oversight.',
    features: [
      'User Identity Management: Creating accounts and assigning roles/permissions.',
      'Branch Configuration: Managing branch details, departments, and settings.',
      'Global Audit Logs: Complete history of every action taken in the system.',
      'System Configuration: Setting global parameters like tax rates and currencies.',
      'Security Oversight: Monitoring login attempts and system health.'
    ],
    content: `
      ### Technical Governance
      The Superadmin is responsible for the overall setup and security of FamousGate Hotels. This role is typically for IT managers or system owners.

      ### Responsibilities
      #### 1. Role-Based Access Control (RBAC)
      The most critical task is ensuring users have the *correct* permissions. Never give more access than needed. For example, a Receptionist should not have "Delete User" permissions.

      #### 2. Branch Hierarchy
      Superadmins manage the relationships between branches. They define which branch is the "Central Warehouse" and which are "Operational Branches."

      #### 3. Auditing the Auditors
      The Global Audit Log is the "black box" of the system. If something goes wrong, the Superadmin uses these logs to see exactly who did what and when.
    `,
    howToUse: [
      'Deactivate users immediately upon their exit from the company.',
      'Monitor "Audit Logs" weekly for any unauthorized or suspicious activity.',
      'Update "System Settings" only after coordinating with the General Manager.',
      'Use the "Manage Branches" tool to add or modify location details as the business grows.'
    ]
  },
  {
    id: 'bar-pos',
    title: 'Restaurant & Bar POS',
    icon: 'Utensils',
    description: 'Detailed service-point interface for taking food and beverage orders and managing table tabs.',
    features: [
      'Point of Sale (POS): Touch-optimized interface for quick ordering.',
      'Table Management: Visual layout of restaurant tables and their current status.',
      'Kitchen/Bar Printing: Automated communication with preparation areas.',
      'Order Modification: Handling voids, edits, and special guest requests.',
      'Bill Splitting: Interactive tools for splitting checks by item or person.'
    ],
    content: `
      ### F&B Operational Flow
      The Restaurant & Bar POS is the main tool for service staff. It bridges the gap between the guest at the table and the kitchen staff at the stove.

      ### Core Functions
      #### 1. Opening a Tab
      Select the table from the map. Every item ordered is added to this table's "Open Tab."

      #### 2. Order Communication
      When you "Save" or "Send" an order, the system instantly prints chits in the Kitchen or Bar. No more walking back and forth to deliver orders.

      #### 3. Service Status
      The system tracks "Preparation Time." If a dish is not marked ready on the Kitchen Display, it shows up as "Pending" on your POS, helping you manage guest expectations.
    `,
    howToUse: [
      'Always start by selecting the correct Table or Room number.',
      'Use "Special Instructions" for allergies or dietary requirements.',
      'Check the "Ready for Pickup" notification before heading to the kitchen.',
      'Close bills only when payment is confirmed or "Posted to Room".'
    ]
  },
  {
    id: 'manager',
    title: 'Managerial Oversight',
    icon: 'TrendingUp',
    description: 'Oversight tools for Branch Managers and GMs to monitor performance and drive results.',
    features: [
      'Performance Dashboards: Real-time KPIs for revenue, occupancy, and costs.',
      'Staff Scheduling: Managing rosters and attendance for the branch.',
      'Operational Approvals: Authorizing requisitions, voids, and high-value payments.',
      'Branch Reports: Generating daily, weekly, and monthly operational summaries.',
      'Asset Tracking: Monitoring maintenance and status of branch equipment.'
    ],
    content: `
      ### Leading Branch Operations
      Managers use FamousGate Hotels to make data-driven decisions. You move from doing tasks to overseeing outcomes.

      ### Priorities
      #### 1. Operational Rhythm
      Check the "Dashboard" every morning. Look at yesterday's revenue and today's expected occupancy. Use this to adjust staffing levels.

      #### 2. Control & Approvals
      The system routes critical actions to you for approval. For example, a large Stock Request from your Storekeeper requires your "Manager Approval" before it reaches Central Store.

      #### 3. People Management
      Review "Attendance" and "Leave" requests. Ensure your team is correctly scheduled and that labor costs are within budget.
    `,
    howToUse: [
      'Review and "Approve" all pending Stock Requests by 10:00 AM daily.',
      'Use the "KPI Dashboard" to identify low-performing areas and address them.',
      'Monitor "Staff Attendance" in real-time to ensure adequate coverage.',
      'Review "Wastage Reports" weekly to identify areas for cost reduction.'
    ]
  },
  {
    id: 'hr',
    title: 'HR & Personnel',
    icon: 'Users',
    description: 'Complete lifecycle management of company employees from onboarding to payroll.',
    features: [
      'Employee Profiles: Central database of ID, KRA PIN, Bank Details, and Role.',
      'Payroll Engine: Automatic calculation of salaries, NSSF, SHIF, and Housing Levy.',
      'Leave Management: Workflow for applying and approving time off.',
      'Attendance Registry: Digital clock-in/out terminal for all staff.',
      'Performance Records: Tracking employee history and role changes.'
    ],
    content: `
      ### Managing our People
      The HR module ensures that all staff are correctly registered and that their compensation is processed accurately and legally.

      ### Key Pillars
      #### 1. Statutory Compliance
      FamousGate Hotels automatically calculates required deductions:
      - **NSSF**: Tier I and II retirement savings.
      - **SHIF**: The Social Health Insurance Fund.
      - **Housing Levy**: Government-mandated contribution.
      - **PAYE**: Tax deductions based on current KRA brackets.

      #### 2. Attendance & Punctuality
      Staff use the "Digital Terminal" to clock in. As HR, you must audit these logs. The system flags "Late In" or "Early Out" based on their assigned shifts.

      #### 3. Payroll Cycle
      At the end of the month, "Run Payroll." The system gathers attendance data, applies any "Adjustments" (like advances or credit bill deductions), and generates payslips.
    `,
    howToUse: [
      'Ensure every new staff member has their "KRA PIN" and "Bank Details" entered immediately.',
      'Review and "Approve" leave requests timely to help Managers with scheduling.',
      'Check "Attendance Logs" weekly for any unverified clock-outs.',
      'Generate and "Email Payslips" immediately after payroll approval.'
    ]
  },
  {
    id: 'general-cashier',
    title: 'General Cashier Module',
    icon: 'Wallet',
    description: 'The centralized revenue hub for bill settlement, payment verification, and master shift management.',
    features: [
      'Centralized Bill Settlement: Lookup and close bills from any department (Hotel, Restaurant, Bar).',
      'Multi-Mode Payment: Handling Cash, M-Pesa, Card, and Credit settlements.',
      'Payment Verification: Real-time M-Pesa API integration to verify transaction codes.',
      'Shift Master: Managing "Logbook" and "End of Day" tallies across all revenue points.',
      'Bill Lookup: Searching for unpaid bills by Guest Name, Room, or Order Number.'
    ],
    content: `
      ### The Final Transaction Point
      The General Cashier module is where all operational revenue is finalized. It is the primary interface for bill settlement and financial reconciliation.

      ### Critical Responsibilities
      #### 1. Bill Consolidation
      Guests may have room charges, spa treatments, and restaurant bills. You use "Bill Lookup" to consolidate these into one final settlement.

      #### 2. Payment Integrity
      Every M-Pesa payment must be verified. The system allows you to search for payments by amount or reference to ensure the guest has actually sent the money.

      #### 3. Shift Accountability
      Closing a shift is a rigorous process. You must reconcile your Physical Cash with the "System Expected" amount. Any discrepancies are logged as Overages or Shortages for the Accountant.
    `,
    howToUse: [
      'Use the "Unpaid Bills" list to monitor outstanding payments across the branch.',
      'Always verify M-Pesa codes via the "Verify Payment" tool before closing a bill.',
      'Print a "POS Receipt" for every transaction—duplicates can be accessed via "History".',
      'Follow the "Shift Closure" checklist to ensure all collections are handed over correctly.'
    ]
  },
  {
    id: 'famousgate-services',
    title: 'FamousGate Service POS',
    icon: 'RefreshCw',
    description: 'Dedicated POS interfaces for specialized service points such as Spa, Specialty Bars, and Lounges.',
    features: [
      'Niche POS Layouts: Customized interfaces for Spa treatments, Bar drinks, or Club services.',
      'Sales Point Logic: Each point has a unique code (e.g., SPA, EXEC_BAR) for accurate tracking.',
      'Service to Bill: Orders are instantly converted to bills that can be paid on-site or "Posted to Room".',
      'Outlet Inventory: Tracking stock specifically allocated to the individual service point.',
      'Specialty Reporting: Analyzing performance per specific service outlet.'
    ],
    content: `
      ### Outlet-Specific Operations
      FamousGate Hotels operates multiple specialty outlets. These "Service Points" require dedicated POS logic to handle specific services (like massage sessions or premium beverage pours).

      ### Workflow Differences
      #### 1. Service Recording
      Unlike a restaurant where you order by plate, Service POS points often handle "Sessions" or "Specialty Pours." The interface is optimized for these specific SKU types.

      #### 2. Localized Responsibility
      Each Service Point is its own cost center. The cashier at these points manages their own local mini-shift, which eventually rolls up into the main branch report.

      #### 3. Posting to Room
      Common in Spas and Specialty Bars, "Post to Room" is a key feature here. It allows guests to enjoy services without carrying cash, with the cost appearing on their main hotel folio.
    `,
    howToUse: [
      'Verify the "Sales Point Code" on your login to ensure you are in the correct outlet.',
      'For Spa services, ensure the correct "Technician" is assigned to the service for commission tracking.',
      'Use the "Inventory" tab to check local stock levels before taking large orders.',
      'When posting to a room, verify the guest name and room number twice.'
    ]
  },
  {
    id: 'kitchen-display',
    title: 'Kitchen Display System (KDS)',
    icon: 'Layout',
    description: 'Real-time order visualization for kitchen staff to manage food preparation and timing.',
    features: [
      'Live Order Feed: Orders appear instantly as they are saved at the POS.',
      'Preparing Status: Marking orders as "In Progress" to inform servers.',
      'Ready Alerts: Notifying the server as soon as the food is ready for pickup.',
      'Timing Tracking: Monitoring how long each dish takes to prepare.',
      'Item Categorization: Separating Starters, Mains, and Sides for logical workflow.'
    ],
    content: `
      ### Cooking with Coordination
      The KDS replaces traditional paper chits. It ensures that no order is lost and that the kitchen works in perfect sync with the restaurant.

      ### Workflow
      #### 1. Order Arrival
      New orders appear at the top of the grid. They indicate the **Table Number**, **Items**, and any **Special Instructions** (e.g., "No onions").

      #### 2. Preparation
      When the chef starts cooking, tap "Start Preparing." This updates the POS status, so the Waiter knows the order is being handled.

      #### 3. Bumping Orders
      When the dish is finished, tap "Mark Ready." This "Bumps" the order from the main display and alerts the Waiter to pick it up.
    `,
    howToUse: [
      'Keep the display clear by tapping "Mark Ready" as soon as the food hits the pass.',
      'Watch the "Elapsed Time" timers—red indicates the order is taking too long.',
      'Use the "Grid View" for high-volume periods to see more orders at once.',
      'Read "Special Requests" carefully—they are highlighted for your attention.'
    ]
  },
  {
    id: 'kitchen-ops',
    title: 'Kitchen Operations',
    icon: 'Activity',
    description: 'Back-of-house management for recipes, wastage, and kitchen inventory requisitions.',
    features: [
      'Kitchen Requisitions: Requesting ingredients from the Branch Store.',
      'Recipe Management: Documenting ingredients and costs for menu items.',
      'Wastage Tracking: Recording spoiled or burned ingredients to adjust stock.',
      'Kitchen Stock: Tracking "Sub-Store" inventory levels within the kitchen.',
      'Usage Analysis: Comparing expected vs actual ingredient consumption.'
    ],
    content: `
      ### Beyond the Stove
      Kitchen Operations handle the "Science" and "Stock" behind the food. It ensures profitability by managing ingredients and reducing waste.

      ### Key Tasks
      #### 1. Requesting Ingredients
      The kitchen doesn't manage bulk stock; the Storekeeper does. Use "Requisitions" to request what you need for the day (e.g., 5kg Beef, 10kg Onions).

      #### 2. Recording Wastage
      Food waste is money lost. If ingredients spoil or a dish is prepared incorrectly, it must be recorded as "Wastage." This helps management identify patterns (e.g., poor storage or training issues).

      #### 3. Kitchen Inventory
      Keep track of your "Kitchen Stock." At the end of the day, your physical ingredients should match what the system says you have left after accounting for the day's sales.
    `,
    howToUse: [
      'Submit your "Daily Requisition" before 10:00 AM to give the Storekeeper time to prepare.',
      'Document every instance of "Wastage" with a specific reason (e.g., "Spoilage" or "Overcooked").',
      'Follow the "Standard Recipes" to ensure consistent quality and cost control.',
      'Conduct a "Kitchen Stock-Take" every Sunday evening.'
    ]
  }
];
