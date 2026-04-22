# Requirements Document: Central Store Scanning & Inventory Workflow

## Introduction

The Central Store Scanning & Inventory Workflow system provides end-to-end inventory tracking from central warehouse receiving through dispatch, delivery, and branch verification. The system enables barcode-based item identification, secure dual-OTP delivery verification, document management, auditor oversight, and POS integration for seamless operations across FamousGates Hotels locations.

## Glossary

- **Central_Store_System**: The inventory management system managing item receiving, barcode generation, and dispatch creation
- **Barcode_Generator**: Component that generates unique barcodes for inventory items
- **Barcode_Scanner**: Mobile device camera-based component that reads barcodes
- **OTP_Generator**: Component that generates time-bound one-time passwords with prefixes (D-XXXX for drivers, B-XXXX for branches)
- **Dispatch**: A delivery record containing items, destination branch, assigned driver, and dual OTPs
- **Driver_OTP**: One-time password (format: D-XXXX) used by drivers to mark delivery as "In Transit"
- **Branch_OTP**: One-time password (format: B-XXXX) used by branch storekeepers to complete delivery
- **Stock_Sheet**: Physical document signed by driver and branch storekeeper, uploaded as proof of delivery
- **Notification_Service**: Real-time notification system using Supabase Realtime
- **Auditor_Dashboard**: Interface for auditors to review deliveries and uploaded documents
- **POS_Barcode**: Barcode encoding order/bill ID for quick retrieval at point of sale
- **Document_Storage**: Supabase Storage bucket for uploaded stock sheets and delivery documents
- **Workflow_Status**: Dispatch lifecycle states (Pending, In Transit, Completed, Audited)

## Requirements

### Requirement 1: Item Receiving and Barcode Management

**User Story:** As a central storekeeper, I want to receive items and generate unique barcodes, so that I can track inventory throughout the supply chain.

#### Acceptance Criteria

1. WHEN a central storekeeper selects an existing item from inventory, THE Central_Store_System SHALL retrieve the item details
2. WHEN a central storekeeper creates a new item, THE Central_Store_System SHALL validate required fields and store the item in inventory_items table
3. WHEN a barcode is requested for an item, THE Barcode_Generator SHALL create a unique barcode using UUID-based generation with prefix
4. WHEN a barcode is generated, THE Central_Store_System SHALL associate the barcode with the item record
5. WHEN a barcode label is printed, THE Central_Store_System SHALL format the barcode for physical label printing
6. WHEN an item is received, THE Notification_Service SHALL notify all auditors of the new item

### Requirement 2: Barcode Scanning

**User Story:** As a central storekeeper or branch storekeeper, I want to scan barcodes using my mobile device, so that I can quickly identify items without manual entry.

#### Acceptance Criteria

1. WHEN a user opens the barcode scanner, THE Barcode_Scanner SHALL request camera permissions
2. IF camera permissions are denied, THEN THE Central_Store_System SHALL provide manual barcode entry as fallback
3. WHEN a barcode is scanned successfully, THE Barcode_Scanner SHALL decode the barcode value
4. WHEN a barcode value is decoded, THE Central_Store_System SHALL retrieve the associated item details
5. IF a scanned barcode does not match any item, THEN THE Central_Store_System SHALL display an error message
6. WHEN a barcode scan fails, THE Central_Store_System SHALL allow retry or manual entry

### Requirement 3: Dispatch Creation with Dual OTP Generation

**User Story:** As a central storekeeper, I want to create dispatches with automatic OTP generation, so that deliveries are secure and verifiable.

#### Acceptance Criteria

1. WHEN a central storekeeper creates a dispatch, THE Central_Store_System SHALL require items, destination branch, and assigned driver
2. WHEN a dispatch is created, THE OTP_Generator SHALL generate a Driver_OTP with format D-XXXX
3. WHEN a dispatch is created, THE OTP_Generator SHALL generate a Branch_OTP with format B-XXXX
4. WHEN OTPs are generated, THE Central_Store_System SHALL set expiry time to 24 hours from creation
5. WHEN a dispatch is saved, THE Central_Store_System SHALL store the dispatch with status "Pending"
6. WHEN a dispatch is created, THE Central_Store_System SHALL display both Driver_OTP and Branch_OTP to the central storekeeper
7. WHEN a dispatch is created, THE Notification_Service SHALL notify the destination branch storekeeper

### Requirement 4: Driver OTP Verification and In-Transit Status

**User Story:** As a driver, I want to enter my OTP to mark delivery as in transit, so that the system tracks my active deliveries.

#### Acceptance Criteria

1. WHEN a driver enters a Driver_OTP, THE Central_Store_System SHALL validate the OTP format matches D-XXXX
2. WHEN a Driver_OTP is validated, THE Central_Store_System SHALL verify the OTP exists and has not expired
3. IF a Driver_OTP is expired, THEN THE Central_Store_System SHALL reject the OTP and display expiry message
4. IF a Driver_OTP has already been used, THEN THE Central_Store_System SHALL reject the OTP and display usage message
5. WHEN a valid Driver_OTP is entered, THE Central_Store_System SHALL update dispatch status to "In Transit"
6. WHEN dispatch status changes to "In Transit", THE Notification_Service SHALL notify the branch storekeeper
7. WHEN dispatch status changes to "In Transit", THE Notification_Service SHALL notify all auditors

### Requirement 5: Branch OTP Verification and Delivery Completion

**User Story:** As a branch storekeeper, I want to enter the branch OTP to complete delivery, so that I can confirm receipt of items.

#### Acceptance Criteria

1. WHEN a branch storekeeper enters a Branch_OTP, THE Central_Store_System SHALL validate the OTP format matches B-XXXX
2. WHEN a Branch_OTP is validated, THE Central_Store_System SHALL verify the OTP exists and has not expired
3. IF a Branch_OTP is expired, THEN THE Central_Store_System SHALL reject the OTP and display expiry message
4. IF a Branch_OTP has already been used, THEN THE Central_Store_System SHALL reject the OTP and display usage message
5. WHEN a valid Branch_OTP is entered, THE Central_Store_System SHALL update dispatch status to "Completed"
6. WHEN dispatch status changes to "Completed", THE Notification_Service SHALL notify the central storekeeper
7. WHEN dispatch status changes to "Completed", THE Notification_Service SHALL notify all auditors

### Requirement 6: Stock Sheet Document Upload

**User Story:** As a branch storekeeper, I want to upload signed stock sheets, so that there is documented proof of delivery.

#### Acceptance Criteria

1. WHEN a branch storekeeper selects a document to upload, THE Central_Store_System SHALL validate the file type is image or PDF
2. WHEN a document is selected, THE Central_Store_System SHALL validate the file size does not exceed 5MB
3. IF a file exceeds 5MB, THEN THE Central_Store_System SHALL compress the image before upload
4. WHEN a document is uploaded, THE Document_Storage SHALL store the file in Supabase Storage
5. WHEN a document is stored, THE Central_Store_System SHALL associate the document URL with the dispatch record
6. WHEN a document upload completes, THE Notification_Service SHALL notify the central storekeeper
7. WHEN a document upload completes, THE Notification_Service SHALL notify all auditors

### Requirement 7: Auditor Review and Verification

**User Story:** As an auditor, I want to review all deliveries and uploaded documents, so that I can verify compliance and flag discrepancies.

#### Acceptance Criteria

1. WHEN an auditor accesses the Auditor_Dashboard, THE Central_Store_System SHALL display all dispatches with their current status
2. WHEN an auditor selects a dispatch, THE Central_Store_System SHALL display dispatch details including items, driver, branch, and timestamps
3. WHEN an auditor views a dispatch, THE Central_Store_System SHALL display all uploaded Stock_Sheet documents
4. WHEN an auditor clicks a document, THE Document_Storage SHALL retrieve and display the document
5. WHEN an auditor approves a delivery, THE Central_Store_System SHALL update the dispatch status to "Audited"
6. WHEN an auditor flags a discrepancy, THE Central_Store_System SHALL record the discrepancy details
7. WHEN an auditor takes action, THE Notification_Service SHALL notify the central storekeeper and branch storekeeper

### Requirement 8: POS Barcode Generation

**User Story:** As a branch storekeeper or cashier, I want to generate barcodes for orders and bills, so that transactions can be quickly retrieved at POS.

#### Acceptance Criteria

1. WHEN a transaction is created, THE Central_Store_System SHALL generate a unique transaction identifier
2. WHEN a POS_Barcode is requested, THE Barcode_Generator SHALL encode the order ID or bill ID
3. WHEN a POS_Barcode is generated, THE Central_Store_System SHALL display the barcode for scanning
4. WHEN a POS_Barcode is printed, THE Central_Store_System SHALL format the barcode for receipt or label printing

### Requirement 9: POS Barcode Scanning and Bill Retrieval

**User Story:** As a cashier, I want to scan transaction barcodes to retrieve bills instantly, so that I can process payments quickly.

#### Acceptance Criteria

1. WHEN a cashier scans a POS_Barcode, THE Barcode_Scanner SHALL decode the transaction identifier
2. WHEN a transaction identifier is decoded, THE Central_Store_System SHALL query the database for the associated bill
3. IF a bill is found, THEN THE Central_Store_System SHALL display the complete bill details
4. IF no bill is found, THEN THE Central_Store_System SHALL display a "Bill not found" error message
5. WHEN bill details are displayed, THE Central_Store_System SHALL show order items, amounts, and payment status

### Requirement 10: Real-Time Notifications

**User Story:** As a system user, I want to receive real-time notifications for relevant events, so that I stay informed of workflow progress.

#### Acceptance Criteria

1. WHEN a dispatch is created, THE Notification_Service SHALL send notifications to the destination branch storekeeper
2. WHEN a dispatch status changes to "In Transit", THE Notification_Service SHALL send notifications to the branch storekeeper and auditors
3. WHEN a dispatch status changes to "Completed", THE Notification_Service SHALL send notifications to the central storekeeper and auditors
4. WHEN a document is uploaded, THE Notification_Service SHALL send notifications to the central storekeeper and auditors
5. WHEN an auditor takes action, THE Notification_Service SHALL send notifications to the central storekeeper and branch storekeeper
6. WHEN a notification is sent, THE Notification_Service SHALL deliver it via Supabase Realtime subscriptions
7. IF a user is offline, THEN THE Notification_Service SHALL queue notifications for delivery when the user reconnects

### Requirement 11: Role-Based Access Control

**User Story:** As a system administrator, I want to enforce role-based permissions, so that users can only access features appropriate to their role.

#### Acceptance Criteria

1. WHEN a central_storekeeper user logs in, THE Central_Store_System SHALL grant access to receiving, dispatch creation, and central dashboard
2. WHEN a branch_storekeeper user logs in, THE Central_Store_System SHALL grant access to delivery completion, document upload, and branch dashboard
3. WHEN a driver user logs in, THE Central_Store_System SHALL grant access to Driver_OTP entry and delivery status view
4. WHEN an auditor user logs in, THE Central_Store_System SHALL grant access to the Auditor_Dashboard and all delivery records
5. WHEN a cashier user logs in, THE Central_Store_System SHALL grant access to POS barcode scanning and bill retrieval
6. WHEN a user attempts to access a restricted feature, THE Central_Store_System SHALL deny access and display an authorization error

### Requirement 12: Mobile Application Functionality

**User Story:** As a field user (driver, branch storekeeper, auditor), I want to use mobile apps for my tasks, so that I can work efficiently on the go.

#### Acceptance Criteria

1. THE Central_Store_System SHALL provide a React Native mobile application for central storekeepers
2. THE Central_Store_System SHALL provide a React Native mobile application for branch storekeepers
3. THE Central_Store_System SHALL provide a React Native mobile application for auditors
4. WHEN a mobile app is opened, THE Central_Store_System SHALL authenticate the user
5. WHEN a mobile app is used, THE Central_Store_System SHALL provide camera access for barcode scanning
6. WHEN a mobile app is used, THE Central_Store_System SHALL provide image capture and upload for stock sheets
7. WHEN a mobile app loses connectivity, THE Central_Store_System SHALL display offline status and queue operations

### Requirement 13: Web Dashboard Functionality

**User Story:** As a system user, I want to access web dashboards for comprehensive management, so that I can perform detailed operations and reporting.

#### Acceptance Criteria

1. THE Central_Store_System SHALL provide a Next.js web dashboard for central storekeepers
2. THE Central_Store_System SHALL provide a Next.js web dashboard for branch storekeepers
3. THE Central_Store_System SHALL provide a Next.js web dashboard for auditors
4. THE Central_Store_System SHALL provide a Next.js web dashboard for cashiers
5. WHEN a web dashboard is accessed, THE Central_Store_System SHALL authenticate the user
6. WHEN a web dashboard is used, THE Central_Store_System SHALL display real-time updates via Supabase Realtime
7. WHEN a web dashboard displays data, THE Central_Store_System SHALL scope data to the user's branch (where applicable)

### Requirement 14: Audit Trail and Logging

**User Story:** As an auditor or system administrator, I want complete audit trails of all operations, so that I can track accountability and investigate issues.

#### Acceptance Criteria

1. WHEN an item is received, THE Central_Store_System SHALL log the user, timestamp, and item details
2. WHEN a dispatch is created, THE Central_Store_System SHALL log the creator, timestamp, items, driver, and branch
3. WHEN a Driver_OTP is used, THE Central_Store_System SHALL log the timestamp and user
4. WHEN a Branch_OTP is used, THE Central_Store_System SHALL log the timestamp and user
5. WHEN a document is uploaded, THE Central_Store_System SHALL log the uploader, timestamp, and document reference
6. WHEN an auditor takes action, THE Central_Store_System SHALL log the auditor, timestamp, and action details
7. WHEN audit logs are queried, THE Central_Store_System SHALL return logs filtered by date range, user, or dispatch

### Requirement 15: Data Validation and Error Handling

**User Story:** As a system user, I want clear error messages and validation, so that I can correct mistakes and complete tasks successfully.

#### Acceptance Criteria

1. WHEN required fields are missing, THE Central_Store_System SHALL display field-specific error messages
2. WHEN invalid data is entered, THE Central_Store_System SHALL display validation error messages
3. WHEN a database operation fails, THE Central_Store_System SHALL display a user-friendly error message without exposing technical details
4. WHEN an OTP validation fails, THE Central_Store_System SHALL display the specific reason (expired, already used, invalid format, not found)
5. WHEN a file upload fails, THE Central_Store_System SHALL display the failure reason and allow retry
6. WHEN a network error occurs, THE Central_Store_System SHALL display a connectivity error and provide retry option
7. WHEN an error occurs, THE Central_Store_System SHALL log the error details for debugging

### Requirement 16: Barcode Uniqueness and Collision Prevention

**User Story:** As a system administrator, I want guaranteed barcode uniqueness, so that items are never confused or misidentified.

#### Acceptance Criteria

1. WHEN a barcode is generated, THE Barcode_Generator SHALL use UUID-based generation
2. WHEN a barcode is generated, THE Barcode_Generator SHALL include a prefix to identify barcode type
3. WHEN a barcode is stored, THE Central_Store_System SHALL enforce database uniqueness constraint
4. IF a barcode collision occurs, THEN THE Barcode_Generator SHALL regenerate a new barcode
5. WHEN a barcode is validated, THE Central_Store_System SHALL verify the barcode exists in the database

### Requirement 17: OTP Security and Expiration

**User Story:** As a security administrator, I want OTPs to be time-bound and single-use, so that unauthorized access is prevented.

#### Acceptance Criteria

1. WHEN an OTP is generated, THE OTP_Generator SHALL set expiry time to 24 hours from creation
2. WHEN an OTP is validated, THE Central_Store_System SHALL check if the current time is before expiry time
3. WHEN an OTP is successfully used, THE Central_Store_System SHALL mark the OTP as used
4. WHEN an OTP is validated, THE Central_Store_System SHALL check if the OTP has already been used
5. WHEN an OTP expires, THE Central_Store_System SHALL prevent its use and require dispatch recreation

### Requirement 18: Document Storage and Retrieval

**User Story:** As a branch storekeeper or auditor, I want reliable document storage and retrieval, so that proof of delivery is always accessible.

#### Acceptance Criteria

1. WHEN a document is uploaded, THE Document_Storage SHALL store the file in Supabase Storage
2. WHEN a document is stored, THE Document_Storage SHALL generate a secure URL
3. WHEN a document URL is requested, THE Document_Storage SHALL verify user authorization
4. WHEN an authorized user requests a document, THE Document_Storage SHALL return the document
5. WHEN a document is deleted, THE Document_Storage SHALL remove the file from storage and update the dispatch record

### Requirement 19: Workflow Status Transitions

**User Story:** As a system user, I want clear workflow status progression, so that I understand the current state of each dispatch.

#### Acceptance Criteria

1. WHEN a dispatch is created, THE Central_Store_System SHALL set initial status to "Pending"
2. WHEN a Driver_OTP is validated, THE Central_Store_System SHALL transition status from "Pending" to "In Transit"
3. WHEN a Branch_OTP is validated, THE Central_Store_System SHALL transition status from "In Transit" to "Completed"
4. WHEN an auditor approves a delivery, THE Central_Store_System SHALL transition status from "Completed" to "Audited"
5. THE Central_Store_System SHALL prevent invalid status transitions (e.g., "Pending" directly to "Completed")
6. WHEN a status transition occurs, THE Central_Store_System SHALL record the transition timestamp

### Requirement 20: Branch Scoping and Data Isolation

**User Story:** As a branch storekeeper, I want to see only data relevant to my branch, so that I can focus on my responsibilities without confusion.

#### Acceptance Criteria

1. WHEN a branch storekeeper queries dispatches, THE Central_Store_System SHALL filter results to the user's assigned branch
2. WHEN a branch storekeeper views items, THE Central_Store_System SHALL display items relevant to the branch
3. WHEN a central storekeeper queries dispatches, THE Central_Store_System SHALL display dispatches for all branches
4. WHEN an auditor queries dispatches, THE Central_Store_System SHALL display dispatches for all branches
5. WHEN data is displayed, THE Central_Store_System SHALL enforce Row Level Security (RLS) policies based on user role and branch
