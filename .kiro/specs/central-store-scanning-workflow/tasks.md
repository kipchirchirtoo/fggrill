# Implementation Plan: Central Store Scanning & Inventory Workflow

## Overview

This implementation plan covers the end-to-end development of the Central Store Scanning & Inventory Workflow system, including database schema, backend APIs, mobile screens (React Native), web dashboards (Next.js 14), and notification integration. The system enables barcode-based inventory tracking from central warehouse receiving through dispatch, delivery verification, and auditor oversight.

**Technology Stack:**
- Backend: Node.js/Express with TypeScript
- Database: PostgreSQL/Supabase with Row Level Security
- Mobile: React Native with Expo (expo-camera, expo-image-picker)
- Web: Next.js 14 with App Router
- Storage: Supabase Storage for documents
- Notifications: Supabase Realtime

**Implementation Priority:**
1. Database schema and migrations
2. Backend API endpoints
3. Mobile screens (central store, branch store, auditor)
4. Web dashboard pages
5. Notification system integration
6. POS barcode integration

## Tasks

- [x] 1. Database Schema and Migrations
  - [x] 1.1 Create inventory items and barcodes tables
    - Create `inventory_items` table with columns: id, name, description, category, unit, quantity, branch_id, created_at, updated_at, created_by
    - Create `item_barcodes` table with columns: id, item_id, barcode_value, barcode_type, generated_at, printed_at
    - Add unique constraint on `item_barcodes.barcode_value`
    - Add foreign key from `item_barcodes.item_id` to `inventory_items.id`
    - Create indexes on frequently queried columns
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 16.1, 16.2, 16.3_
  
  - [x] 1.2 Create dispatches and OTP tables
    - Create `dispatches` table with columns: id, dispatch_number, status (enum: Pending, In Transit, Completed, Audited), source_branch_id, destination_branch_id, driver_id, created_by, created_at, updated_at
    - Create `dispatch_items` table with columns: id, dispatch_id, item_id, quantity, notes
    - Create `dispatch_otps` table with columns: id, dispatch_id, driver_otp, branch_otp, driver_otp_used_at, branch_otp_used_at, expires_at, created_at
    - Add check constraints for OTP format (D-XXXX for driver, B-XXXX for branch)
    - Add foreign keys and indexes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 17.1, 17.2, 17.3, 17.4_
  
  - [x] 1.3 Create document storage and audit tables
    - Create `dispatch_documents` table with columns: id, dispatch_id, document_url, document_type, file_size, uploaded_by, uploaded_at
    - Create `dispatch_audit_log` table with columns: id, dispatch_id, action, performed_by, notes, created_at
    - Add foreign keys and indexes
    - Create Supabase Storage bucket `dispatch-documents` with 5MB file size limit
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 18.1, 18.2_
  
  - [x] 1.4 Create POS barcode tables
    - Create `pos_barcodes` table with columns: id, transaction_id, order_id, bill_id, barcode_value, generated_at
    - Add unique constraint on `pos_barcodes.barcode_value`
    - Add indexes on transaction_id, order_id, bill_id
    - _Requirements: 8.1, 8.2, 8.3, 9.1, 9.2_
  
  - [x] 1.5 Set up Row Level Security (RLS) policies
    - Create RLS policy for `inventory_items`: central_storekeeper can insert/update, branch_storekeeper can read for their branch
    - Create RLS policy for `dispatches`: central_storekeeper can create, branch_storekeeper can read for their branch, auditors can read all
    - Create RLS policy for `dispatch_documents`: branch_storekeeper can upload for their branch, auditors can read all
    - Create RLS policy for `dispatch_audit_log`: auditors can insert, all authenticated users can read
    - Test RLS policies with different user roles
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 20.1, 20.2, 20.3, 20.4, 20.5_
  
  - [x] 1.6 Create database functions and triggers
    - Create function `generate_barcode()` that generates UUID-based barcode with prefix
    - Create function `generate_otp(prefix TEXT)` that generates 4-digit OTP with prefix (D- or B-)
    - Create trigger to auto-generate dispatch_number on insert
    - Create trigger to log status transitions in dispatch_audit_log
    - Create function to validate OTP format and expiry
    - _Requirements: 1.3, 3.2, 3.3, 3.4, 17.1, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

- [x] 2. Backend API - Item Receiving and Barcode Management
  - [x] 2.1 Implement POST /api/store/items/receive endpoint
    - Create route handler in `backend/src/routes/storekeeping.routes.ts`
    - Validate request body: item_name, category, unit, quantity, branch_id
    - Insert item into `inventory_items` table
    - Generate barcode using `generate_barcode()` function
    - Insert barcode into `item_barcodes` table
    - Return item details with barcode
    - Handle errors: duplicate items, invalid branch_id, database errors
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 15.1, 15.2, 15.3_
  
  - [x] 2.2 Implement GET /api/store/items endpoint
    - Create route handler to list inventory items
    - Support query parameters: branch_id, category, search
    - Apply RLS filtering based on user role
    - Return paginated results with item details and barcode
    - _Requirements: 1.1, 20.1, 20.2, 20.3_
  
  - [x] 2.3 Implement GET /api/store/barcodes/:barcode endpoint
    - Create route handler to retrieve item by barcode
    - Validate barcode format
    - Query `item_barcodes` joined with `inventory_items`
    - Return item details or 404 if not found
    - _Requirements: 2.4, 2.5, 16.5_

- [x] 3. Backend API - Dispatch Creation and OTP Generation
  - [x] 3.1 Implement POST /api/store/dispatches endpoint
    - Create route handler in `backend/src/routes/storekeeping.routes.ts`
    - Validate request body: items (array), destination_branch_id, driver_id
    - Insert dispatch into `dispatches` table with status "Pending"
    - Insert items into `dispatch_items` table
    - Generate Driver OTP (D-XXXX) and Branch OTP (B-XXXX) using `generate_otp()` function
    - Set OTP expiry to 24 hours from creation
    - Insert OTPs into `dispatch_otps` table
    - Return dispatch details with both OTPs
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 17.1, 17.2_
  
  - [x] 3.2 Implement GET /api/store/dispatches endpoint
    - Create route handler to list dispatches
    - Support query parameters: status, branch_id, date_range
    - Apply RLS filtering based on user role
    - Return dispatches with items, driver info, and status
    - _Requirements: 7.1, 20.1, 20.3, 20.4_
  
  - [x] 3.3 Implement GET /api/store/dispatches/:id endpoint
    - Create route handler to get single dispatch details
    - Include dispatch items, OTP status (without revealing unused OTPs), documents, audit log
    - Apply RLS filtering
    - Return 404 if not found or unauthorized
    - _Requirements: 7.2, 7.3, 14.7_

- [x] 4. Backend API - Driver OTP Verification
  - [x] 4.1 Implement POST /api/store/dispatches/:id/verify-driver-otp endpoint
    - Create route handler in `backend/src/routes/storekeeping.routes.ts`
    - Validate request body: driver_otp
    - Validate OTP format matches D-XXXX
    - Query `dispatch_otps` for matching dispatch_id and driver_otp
    - Check if OTP exists, has not expired, and has not been used
    - If valid, update dispatch status to "In Transit"
    - Mark driver_otp_used_at with current timestamp
    - Log action in `dispatch_audit_log`
    - Return success with updated dispatch status
    - Handle errors: invalid format, expired OTP, already used, not found
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 15.4, 17.2, 17.3, 17.4, 19.2_

- [x] 5. Backend API - Branch OTP Verification
  - [x] 5.1 Implement POST /api/store/dispatches/:id/verify-branch-otp endpoint
    - Create route handler in `backend/src/routes/storekeeping.routes.ts`
    - Validate request body: branch_otp
    - Validate OTP format matches B-XXXX
    - Query `dispatch_otps` for matching dispatch_id and branch_otp
    - Check if OTP exists, has not expired, and has not been used
    - Verify driver OTP was used first (status must be "In Transit")
    - If valid, update dispatch status to "Completed"
    - Mark branch_otp_used_at with current timestamp
    - Log action in `dispatch_audit_log`
    - Return success with updated dispatch status
    - Handle errors: invalid format, expired OTP, already used, not found, invalid status transition
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 15.4, 17.2, 17.3, 17.4, 19.3_

- [x] 6. Backend API - Document Upload
  - [x] 6.1 Implement POST /api/store/dispatches/:id/upload-document endpoint
    - Create route handler with multer middleware for file upload
    - Validate file type (image/jpeg, image/png, application/pdf)
    - Validate file size (max 5MB)
    - If image exceeds 5MB, compress using sharp library
    - Upload file to Supabase Storage bucket `dispatch-documents`
    - Generate secure URL for uploaded file
    - Insert record into `dispatch_documents` table
    - Log action in `dispatch_audit_log`
    - Return document URL and metadata
    - Handle errors: invalid file type, file too large, upload failure
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 15.5, 18.1, 18.2_
  
  - [x] 6.2 Implement GET /api/store/dispatches/:id/documents endpoint
    - Create route handler to list documents for a dispatch
    - Verify user authorization (RLS)
    - Return array of document metadata with secure URLs
    - _Requirements: 7.3, 7.4, 18.3, 18.4_

- [x] 7. Backend API - Auditor Review
  - [x] 7.1 Implement GET /api/auditor/deliveries endpoint
    - Create route handler in `backend/src/routes/auditor.routes.ts`
    - List all dispatches with status "Completed" or "Audited"
    - Support query parameters: status, branch_id, date_range
    - Include dispatch details, items, documents count, audit status
    - Return paginated results
    - _Requirements: 7.1, 11.4_
  
  - [x] 7.2 Implement POST /api/auditor/deliveries/:id/review endpoint
    - Create route handler to approve or flag dispatch
    - Validate request body: action (approve/flag), notes
    - If action is "approve", update dispatch status to "Audited"
    - If action is "flag", insert discrepancy record with notes
    - Log action in `dispatch_audit_log`
    - Return updated dispatch status
    - _Requirements: 7.5, 7.6, 14.6_

- [x] 8. Backend API - POS Barcode Integration
  - [x] 8.1 Implement POST /api/store/barcodes/generate endpoint
    - Create route handler in `backend/src/routes/barcode.routes.ts`
    - Validate request body: transaction_id, order_id OR bill_id
    - Generate unique barcode using UUID
    - Insert into `pos_barcodes` table
    - Return barcode value and metadata
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [x] 8.2 Implement GET /api/store/barcodes/scan/:barcode endpoint
    - Create route handler to retrieve transaction by barcode
    - Query `pos_barcodes` for matching barcode_value
    - If found, retrieve associated bill/order details
    - Return complete transaction details
    - Return 404 if barcode not found
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 9. Checkpoint - Backend APIs Complete
  - Ensure all backend API endpoints are implemented and tested
  - Verify error handling returns user-friendly messages
  - Verify RLS policies are enforced on all endpoints
  - Test OTP generation, validation, and expiry logic
  - Test document upload with various file types and sizes
  - Ask the user if questions arise

- [x] 10. Mobile App - Central Store Receiving Screen
  - [x] 10.1 Create ReceivingScreen.tsx in famousgate-mobile/src/screens/central-store/
    - Create screen component with item selection/creation form
    - Add barcode scanner integration using expo-camera
    - Add manual barcode entry fallback
    - Implement item form: name, category, unit, quantity
    - Add "Generate Barcode" button that calls POST /api/store/items/receive
    - Display generated barcode with QR code visualization
    - Add "Print Label" button (prepare for future printer integration)
    - Show success message with item details
    - Handle errors: camera permissions, API errors, validation errors
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.6, 12.5, 15.1, 15.2_
  
  - [x] 10.2 Add navigation to ReceivingScreen from CSDashboardScreen
    - Add "Receive Items" button/card on central store dashboard
    - Configure navigation in central store stack navigator
    - _Requirements: 12.1_

- [x] 11. Mobile App - Enhanced Dispatch OTP Screen
  - [x] 11.1 Enhance DispatchOTPScreen.tsx to show both OTPs
    - Modify existing DispatchOTPScreen.tsx to display both Driver OTP and Branch OTP
    - Add separate cards for Driver OTP (D-XXXX) and Branch OTP (B-XXXX)
    - Add visual distinction: Driver OTP in blue, Branch OTP in green
    - Update "Share" functionality to include both OTPs with clear labels
    - Add copy-to-clipboard buttons for each OTP
    - Display expiry time for both OTPs
    - Show dispatch number and destination branch
    - _Requirements: 3.6, 3.7_
  
  - [x] 11.2 Update CreateDispatchScreen to pass both OTPs
    - Modify CreateDispatchScreen.tsx to receive both OTPs from API response
    - Pass both driver_otp and branch_otp to DispatchOTPScreen navigation
    - _Requirements: 3.2, 3.3_

- [x] 12. Mobile App - Branch Store Receive Delivery Screen
  - [x] 12.1 Enhance ReceiveDeliveryScreen.tsx for OTP entry and document upload
    - Verify existing ReceiveDeliveryScreen.tsx structure
    - Add Branch OTP entry field with format validation (B-XXXX)
    - Add "Verify OTP" button that calls POST /api/store/dispatches/:id/verify-branch-otp
    - Show dispatch details: items, quantities, driver info
    - Add document upload section using expo-image-picker
    - Support camera capture and gallery selection
    - Add image preview before upload
    - Implement file upload to POST /api/store/dispatches/:id/upload-document
    - Show upload progress indicator
    - Display success message after OTP verification and document upload
    - Handle errors: invalid OTP, expired OTP, upload failure, camera permissions
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 12.2, 12.6, 15.4, 15.5_
  
  - [x] 12.2 Add delivery list screen for branch storekeepers
    - Create screen to list pending and completed deliveries for the branch
    - Filter dispatches by destination_branch_id matching user's branch
    - Show dispatch status, items count, driver name
    - Add navigation to ReceiveDeliveryScreen when tapping a dispatch
    - _Requirements: 12.2, 20.1_

- [x] 13. Mobile App - Auditor Deliveries Screen
  - [x] 13.1 Create AuditorDeliveriesScreen.tsx in famousgate-mobile/src/screens/auditor/
    - Create screen component to list all deliveries
    - Call GET /api/auditor/deliveries endpoint
    - Display dispatches with status, branch, driver, date
    - Add filter options: status (Completed, Audited), branch, date range
    - Show document count badge for each dispatch
    - Add navigation to delivery detail screen on tap
    - Implement pull-to-refresh
    - _Requirements: 7.1, 11.4, 12.3_
  
  - [x] 13.2 Create AuditorDeliveryDetailScreen.tsx
    - Create detail screen showing dispatch information
    - Display items list with quantities
    - Show driver and branch information
    - Display uploaded documents with image viewer
    - Add "View Document" button that opens document in modal
    - Add "Approve" and "Flag Discrepancy" buttons
    - Implement approve action calling POST /api/auditor/deliveries/:id/review
    - Implement flag action with notes input
    - Show audit log history
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 18.4_
  
  - [x] 13.3 Add navigation to AuditorDeliveriesScreen from AuditorDashboardScreen
    - Add "Review Deliveries" button/card on auditor dashboard
    - Configure navigation in auditor stack navigator
    - _Requirements: 12.3_

- [x] 14. Checkpoint - Mobile Screens Complete
  - Ensure all mobile screens are implemented and functional
  - Test barcode scanning on physical device
  - Test camera permissions and fallback flows
  - Test document upload with images and PDFs
  - Test OTP validation with various formats
  - Verify navigation flows between screens
  - Ask the user if questions arise

- [x] 15. Notification System Integration
  - [x] 15.1 Set up Supabase Realtime subscriptions
    - Create notification service in `backend/src/services/notification.service.ts`
    - Implement function to send notifications via Supabase Realtime
    - Configure Realtime channels for different user roles
    - _Requirements: 10.6_
  
  - [x] 15.2 Implement dispatch creation notifications
    - Add notification trigger when dispatch is created
    - Send notification to destination branch storekeeper
    - Include dispatch details: items, driver, expected delivery time
    - _Requirements: 3.7, 10.1_
  
  - [x] 15.3 Implement status change notifications
    - Add notification trigger when dispatch status changes to "In Transit"
    - Send notification to branch storekeeper and auditors
    - Add notification trigger when dispatch status changes to "Completed"
    - Send notification to central storekeeper and auditors
    - _Requirements: 4.6, 4.7, 5.6, 5.7, 10.2, 10.3_
  
  - [x] 15.4 Implement document upload notifications
    - Add notification trigger when document is uploaded
    - Send notification to central storekeeper and auditors
    - _Requirements: 6.6, 6.7, 10.4_
  
  - [x] 15.5 Implement auditor action notifications
    - Add notification trigger when auditor approves or flags dispatch
    - Send notification to central storekeeper and branch storekeeper
    - _Requirements: 7.7, 10.5_
  
  - [x] 15.6 Add notification listeners in mobile apps
    - Implement Realtime subscription in mobile app initialization
    - Add notification display component (toast/banner)
    - Handle notification tap to navigate to relevant screen
    - Store notifications in local state for notification center
    - _Requirements: 10.6, 10.7, 12.7_

- [x] 16. Web Dashboard - Central Store Pages
  - [x] 16.1 Create central store dashboard page in Next.js
    - Create page at `app/central-store/dashboard/page.tsx`
    - Display key metrics: pending dispatches, items received today, low stock alerts
    - Add quick action buttons: Receive Items, Create Dispatch, View History
    - Implement real-time updates using Supabase Realtime
    - _Requirements: 13.1, 13.5, 13.6_
  
  - [x] 16.2 Create item receiving page
    - Create page at `app/central-store/receive/page.tsx`
    - Implement item form with validation using Zod
    - Add barcode generation and display
    - Add print label functionality
    - Show recent items received
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 13.1_
  
  - [x] 16.3 Create dispatch management page
    - Create page at `app/central-store/dispatches/page.tsx`
    - List all dispatches with filters: status, branch, date range
    - Add "Create Dispatch" button
    - Show dispatch details in modal/drawer
    - Display both OTPs for pending dispatches
    - _Requirements: 3.1, 3.6, 13.1, 13.6_

- [x] 17. Web Dashboard - Branch Store Pages
  - [x] 17.1 Create branch store dashboard page
    - Create page at `app/branch-store/dashboard/page.tsx`
    - Display pending deliveries for the branch
    - Show recent receipts and stock levels
    - Add quick action buttons: Receive Delivery, View Stock
    - Implement real-time updates
    - _Requirements: 13.2, 13.6, 20.1_
  
  - [x] 17.2 Create delivery receiving page
    - Create page at `app/branch-store/receive/page.tsx`
    - List pending deliveries for the branch
    - Add OTP entry form with validation
    - Add document upload with drag-and-drop
    - Show delivery details and items
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 13.2_

- [x] 18. Web Dashboard - Auditor Pages
  - [x] 18.1 Create auditor dashboard page
    - Create page at `app/auditor/dashboard/page.tsx`
    - Display deliveries requiring review
    - Show key metrics: completed deliveries, flagged discrepancies
    - Add filters: status, branch, date range
    - _Requirements: 13.3, 13.6_
  
  - [x] 18.2 Create delivery review page
    - Create page at `app/auditor/deliveries/[id]/page.tsx`
    - Display complete dispatch details
    - Show uploaded documents with viewer
    - Add approve/flag actions with notes
    - Display audit log history
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 13.3_

- [x] 19. Web Dashboard - POS/Cashier Pages
  - [x] 19.1 Create POS barcode generation page
    - Create page at `app/pos/barcode/page.tsx`
    - Add form to generate barcode for order/bill
    - Display generated barcode with QR code
    - Add print functionality
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 13.4_
  
  - [x] 19.2 Create POS barcode scanning page
    - Create page at `app/pos/scan/page.tsx`
    - Add barcode scanner using webcam
    - Add manual barcode entry
    - Display retrieved bill details
    - Add "Process Payment" button
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 13.4_

- [x] 20. Final Integration and Testing
  - [x] 20.1 End-to-end workflow testing
    - Test complete flow: item receiving → dispatch creation → driver OTP → branch OTP → document upload → auditor review
    - Verify all notifications are sent and received
    - Test with multiple branches and users
    - Verify RLS policies prevent unauthorized access
    - _Requirements: All requirements_
  
  - [x] 20.2 Error handling and edge cases
    - Test expired OTP scenarios
    - Test invalid OTP format scenarios
    - Test file upload failures
    - Test network errors and offline scenarios
    - Verify error messages are user-friendly
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_
  
  - [x] 20.3 Performance optimization
    - Add database indexes for frequently queried columns
    - Optimize image compression for document uploads
    - Implement pagination for large lists
    - Add caching for static data
    - _Requirements: 6.3, 18.1_
  
  - [x] 20.4 Security audit
    - Verify all endpoints require authentication
    - Test RLS policies with different user roles
    - Verify OTP security (single-use, expiry)
    - Test file upload security (type validation, size limits)
    - Verify document URLs are secure and authorized
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 17.1, 17.2, 17.3, 17.4, 17.5, 18.3_

- [x] 21. Final Checkpoint - Complete System Verification
  - Ensure all features are implemented and tested
  - Verify all requirements are met
  - Test on multiple devices (iOS, Android, web browsers)
  - Verify accessibility compliance (WCAG 2.1 AA)
  - Ensure all tests pass
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Implementation follows priority order: database → backend → mobile → web
- All code must follow FamousGates development rules (snake_case for DB, RLS enforcement, error handling)
- Mobile screens use existing patterns from famousgate-mobile/src/screens/
- Backend APIs follow existing patterns in backend/src/routes/
- Web pages use Next.js 14 App Router with server components where possible
