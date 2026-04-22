# Central Store Scanning & Inventory Workflow

## Overview

Implement a comprehensive receiving, dispatch, and delivery tracking system for FamousGates Hotels with barcode scanning, dual OTP verification, and auditor oversight.

## Goals

1. Streamline item receiving with barcode generation and scanning
2. Implement secure delivery tracking with Driver and Branch OTPs
3. Enable auditor verification of deliveries with document uploads
4. Integrate barcode scanning at POS for bill retrieval
5. Provide real-time notifications across all stakeholders

## Scope

### In Scope
- Receiving Items module with barcode management
- Dispatch system with dual OTP generation
- Delivery tracking (In Transit → Completed)
- Branch storekeeper verification with image upload
- Auditor dashboard (web + mobile)
- POS barcode integration for bill retrieval
- Multi-channel notification system
- Role-based access control

### Out of Scope
- QR code implementation (future enhancement)
- Offline mode for mobile app (future enhancement)
- AI-based stock sheet verification (future enhancement)
- Delivery timeline tracking (future enhancement)

## Success Criteria

1. Central storekeepers can receive items and generate/scan barcodes
2. Dispatches generate unique Driver and Branch OTPs
3. Drivers can mark deliveries "In Transit" with Driver OTP
4. Branch storekeepers can complete deliveries with Branch OTP and upload signed sheets
5. Auditors can view all deliveries and uploaded documents
6. POS cashiers can scan barcodes to retrieve bills instantly
7. All stakeholders receive real-time notifications
8. System maintains audit trail of all operations

## Stakeholders

- **Central Storekeeper**: Receives items, manages inventory, creates dispatches
- **Driver**: Delivers items, enters Driver OTP
- **Branch Storekeeper**: Receives deliveries, enters Branch OTP, uploads documents
- **Auditor**: Reviews deliveries, verifies documentation
- **Cashier**: Scans barcodes at POS for bill retrieval
- **System Admin**: Manages users and system configuration

## Technical Stack

- **Frontend**: Next.js 14, React Query, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Supabase)
- **Mobile**: React Native
- **Real-time**: Supabase Realtime / Socket.io
- **File Storage**: Supabase Storage
- **Barcode**: JsBarcode (generation), react-native-camera (scanning)

## Dependencies

- Existing inventory_items table
- Existing users table with roles
- Existing branch enum type
- Existing authentication system
- Supabase Storage bucket configuration

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Barcode collision | High | Use UUID-based barcode generation with prefix |
| OTP security | High | Time-bound OTPs (24h expiry), one-time use only |
| Image upload size | Medium | Client-side compression, 5MB limit |
| Real-time notification lag | Medium | Fallback to polling, retry logic |
| Mobile camera permissions | Medium | Clear permission prompts, fallback manual entry |

## Constraints

- Must maintain consistency with existing central-store logic
- Must respect existing RBAC patterns
- Must follow snake_case for DB columns
- Must use existing branch enum values
- Must not break existing GRN/PO workflows
