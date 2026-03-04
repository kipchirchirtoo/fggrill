# Bugfix Requirements Document

## Introduction

The supplier detail page at `/dashboard/central-store/suppliers/[id]` returns a 404 error when users attempt to view detailed account information for a supplier. This prevents authorized users (Super Admin, General Manager, Procurement, Central Storekeeper, Auditor) from accessing critical supplier information including purchase orders, invoices, payments, ledger entries, and compliance records.

The root cause is that the backend API endpoint `GET /api/store/suppliers/:id` is not properly registered in the routing configuration, despite the controller function existing and the frontend page being implemented correctly.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user clicks "View Detailed Account" button for a supplier from the suppliers list page THEN the system navigates to `/dashboard/central-store/suppliers/[id]` and displays a 404 error

1.2 WHEN the frontend makes an API call to `GET /api/store/suppliers/:id` THEN the server responds with HTTP 404 (Not Found)

1.3 WHEN the page attempts to load supplier data using `procurementAPI.getSupplier(id)` THEN the API request fails and the page shows "Supplier Not Found" error message

### Expected Behavior (Correct)

2.1 WHEN a user clicks "View Detailed Account" button for a supplier from the suppliers list page THEN the system SHALL navigate to `/dashboard/central-store/suppliers/[id]` and successfully load the supplier detail page

2.2 WHEN the frontend makes an API call to `GET /api/store/suppliers/:id` THEN the server SHALL respond with HTTP 200 and return the supplier data from the `store_suppliers` table

2.3 WHEN the page attempts to load supplier data using `procurementAPI.getSupplier(id)` THEN the API request SHALL succeed and the page SHALL display the supplier's profile, purchase orders, invoices, payments, ledger, and audit trail

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user accesses the suppliers list page at `/dashboard/central-store/suppliers` THEN the system SHALL CONTINUE TO display all suppliers correctly

3.2 WHEN a user creates, updates, or deletes a supplier THEN the system SHALL CONTINUE TO process these operations successfully

3.3 WHEN a user accesses other supplier-related pages (GRN, invoices, payments, purchase orders, reports) THEN the system SHALL CONTINUE TO function correctly

3.4 WHEN the API endpoint `GET /api/store/suppliers` (list all suppliers) is called THEN the system SHALL CONTINUE TO return the complete list of suppliers
