# Changelog

All notable changes to the FamousGate Hotels Management System will be documented in this file.

## [3.5.0] - 2026-06-18

### Added - Restaurant Operations Enhancement
- **Dual Receipt Printing**: POS orders now print TWO receipts simultaneously
  - Customer Bill: Given to customer at table
  - Kitchen Captain Order: Printed copy for kitchen preparation
  - Both receipts share same order number, barcode, and short code for easy reference
- **Lina AI Comprehensive Data Fetch**: New backend endpoint for fetching all payment/cashier/shift data
  - Endpoint: `POST /api/finance/lina/comprehensive-fetch`
  - Fetches from 16+ database tables for complete financial analysis
  - Silent background data fetching for auditor comparison

### Changed - Financial Workspace Redesign
- **Merged Financial Workspace**: Combined Financial Workspace and Daily Close into single unified screen
  - Branch Accountant now has streamlined single-screen workflow
  - Enters all financial data (revenue, payments, banking, COGS, expenses) in one place
  - Dynamic banking entries with add/remove functionality
- **Lina AI Data Hidden from Branch Accountant**: Security and workflow improvement
  - Lina AI data now fetched silently in background (not displayed in BA UI)
  - Prevents manipulation and maintains data integrity
  - BA enters values independently without AI reference
- **Enhanced Auditor Daily Close Review**: New comprehensive review screen
  - Shows Branch Accountant values vs Lina AI values side-by-side
  - Automatic discrepancy flagging with variance indicators
  - Orange badges highlight fields with differences
  - Approve/Flag actions with notes for complete audit trail

### Removed
- **Financial Workspace Section**: Removed standalone financial workspace screen
  - Functionality merged into Daily Close screen
  - Updated navigation and routing accordingly
  - Cleaned up unused components

### Fixed
- **Flutter Compilation Errors**: Fixed Autocomplete widget and Row overflow issues
  - Removed conflicting `textEditingController` in Branch Storekeeper dashboard
  - Wrapped text in `Flexible` widget to prevent overflow
- **Unused Imports**: Removed `financial_close_screen.dart` import from branch accountant dashboard
- **Banking Reference Security**: Removed banking slip reference visibility from Branch Accountant UI

### Technical Improvements
- Updated Flutter app version to 3.5.0+5
- Updated backend version to 3.5.0
- Updated frontend version to 3.5.0
- All builds verified and ready for deployment
- Backend TypeScript compilation successful
- GitHub Actions ready for CI/CD pipeline

### Complete Flow Documentation
- **POS → Kitchen → Cashier → Branch Accountant → Auditor**: Full restaurant operations flow
  - Waiter creates order in POS, prints customer bill + kitchen captain order
  - Kitchen receives order on KDS, manages preparation workflow
  - Cashier processes payment after service
  - Branch Accountant reviews daily financial data and submits
  - Auditor compares BA entries vs Lina AI data and approves/flags
- **Merge Bills Functionality**: Verified working in unified POS module
- **Captain Order Detection**: POS orders correctly identified in KDS

---

## [3.3.2] - 2026-06-17

### Previous Release
- Restaurant module enhancements
- KDS improvements
- Multi-branch support refinements

---

## Version Format
`MAJOR.MINOR.PATCH+BUILD`
- MAJOR: Breaking changes
- MINOR: New features, backward compatible
- PATCH: Bug fixes
- BUILD: Build number (increments with each build)
