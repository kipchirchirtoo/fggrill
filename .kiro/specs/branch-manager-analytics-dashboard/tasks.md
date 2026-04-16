# Implementation Tasks: Branch Manager Analytics Dashboard

## Phase 1: Backend Foundation (Node.js API)

### Task 1.1: Create Analytics Types
**File:** `backend/src/types/analytics.types.ts`
- [ ] Define `BranchSalesRequest` interface
- [ ] Define `BranchSalesResponse` interface
- [ ] Define `SalesFilter` interface
- [ ] Define `SalesMetrics` interface
- [ ] Define `PaymentMethodEnum` type
- [ ] Define `OrderTypeEnum` type
- [ ] Define `ServiceCategoryEnum` type

### Task 1.2: Create Analytics Controller
**File:** `backend/src/controllers/branch-analytics.controller.ts`
- [ ] Implement `getBranchSales` function
- [ ] Implement `getBranchSalesSummary` function
- [ ] Implement `exportBranchSalesPDF` function
- [ ] Implement `exportBranchSalesCSV` function
- [ ] Add error handling with proper HTTP status codes
- [ ] Add input validation using Zod
- [ ] Add logging for all operations

### Task 1.3: Create Analytics Routes
**File:** `backend/src/routes/branch-analytics.routes.ts`
- [ ] Create Express router
- [ ] Add POST `/api/analytics/branch-sales` route
- [ ] Add GET `/api/analytics/branch-sales/summary` route
- [ ] Add POST `/api/analytics/branch-sales/export/pdf` route
- [ ] Add POST `/api/analytics/branch-sales/export/csv` route
- [ ] Apply authentication middleware
- [ ] Apply branch isolation middleware
- [ ] Apply role authorization (branch_manager, general_manager, super_admin)

### Task 1.4: Register Routes in Main Server
**File:** `backend/src/server.ts`
- [ ] Import branch analytics routes
- [ ] Register routes with `/api` prefix
- [ ] Verify CORS configuration includes analytics endpoints

## Phase 2: Python Analytics Service

### Task 2.1: Create Branch Sales Analytics Service
**File:** `analytics-service/services/branch_sales_analytics.py`
- [ ] Create `BranchSalesAnalytics` class
- [ ] Implement `aggregate_sales_data` method
- [ ] Implement `apply_filters` method
- [ ] Implement `calculate_metrics` method
- [ ] Implement `get_daily_breakdown` method
- [ ] Implement `get_payment_method_breakdown` method
- [ ] Implement `get_category_breakdown` method
- [ ] Add database connection handling
- [ ] Add error handling and logging
- [ ] Add query optimization with proper indexes

### Task 2.2: Enhance PDF Generator
**File:** `analytics-service/reports/pdf_generator.py`
- [ ] Add `generate_branch_sales_report` method
- [ ] Include FamousGates branding (logo, colors)
- [ ] Add sales summary section
- [ ] Add daily breakdown table
- [ ] Add payment method breakdown chart
- [ ] Add category breakdown chart
- [ ] Add report metadata (branch, date range, timestamp)
- [ ] Add page numbers and footers
- [ ] Optimize for A4 paper size

### Task 2.3: Create CSV Exporter
**File:** `analytics-service/reports/csv_exporter.py`
- [ ] Create `CSVExporter` class
- [ ] Implement `export_branch_sales` method
- [ ] Add column headers
- [ ] Add summary rows (totals, averages)
- [ ] Use UTF-8 encoding
- [ ] Handle special characters properly
- [ ] Add file naming convention

### Task 2.4: Add Analytics Routes to FastAPI
**File:** `analytics-service/app.py`
- [ ] Add POST `/api/analytics/branch-sales` endpoint
- [ ] Add POST `/api/reports/branch-sales-pdf` endpoint
- [ ] Add POST `/api/reports/branch-sales-csv` endpoint
- [ ] Add request validation using Pydantic models
- [ ] Add JWT authentication validation
- [ ] Add branch_id validation
- [ ] Add CORS headers for Next.js origin
- [ ] Add error handling with proper HTTP status codes

## Phase 3: Database Optimization

### Task 3.1: Create Database Indexes
**File:** `backend/migrations/add_analytics_indexes.sql`
- [ ] Create index on `bookings(branch_id, created_at)`
- [ ] Create index on `bookings(status)`
- [ ] Create index on `restaurant_orders(branch_id, created_at)`
- [ ] Create index on `restaurant_orders(status)`
- [ ] Create index on `shift_transactions(branch_id, transaction_date)`
- [ ] Create index on `booking_payments(booking_id)`
- [ ] Create index on `booking_payments(payment_date)`
- [ ] Add composite indexes for common filter combinations

### Task 3.2: Verify RLS Policies
**File:** `backend/scripts/verify-analytics-rls.ts`
- [ ] Verify RLS enabled on bookings table
- [ ] Verify RLS enabled on restaurant_orders table
- [ ] Verify RLS enabled on shift_transactions table
- [ ] Verify RLS enabled on booking_payments table
- [ ] Test branch isolation with sample queries
- [ ] Document RLS policy structure

## Phase 4: Frontend Implementation

### Task 4.1: Create Analytics Page
**File:** `frontend/app/dashboard/branch-manager/analytics/page.tsx`
- [ ] Create page component with authentication check
- [ ] Add role-based access control
- [ ] Implement data fetching with React Query
- [ ] Add loading states
- [ ] Add error states
- [ ] Add empty states
- [ ] Implement filter state management
- [ ] Add session storage for filter persistence

### Task 4.2: Create Sales Metrics Cards Component
**File:** `frontend/app/dashboard/branch-manager/analytics/components/SalesMetricsCards.tsx`
- [ ] Display total sales with currency formatting
- [ ] Display transaction count
- [ ] Display average transaction value
- [ ] Add loading skeleton
- [ ] Add error state
- [ ] Add responsive design (mobile, tablet, desktop)
- [ ] Add icons for visual appeal

### Task 4.3: Create Filter Panel Component
**File:** `frontend/app/dashboard/branch-manager/analytics/components/FilterPanel.tsx`
- [ ] Add date range picker with presets (daily, weekly, monthly, yearly, custom)
- [ ] Add payment method multi-select
- [ ] Add category multi-select
- [ ] Add order type multi-select
- [ ] Add Apply button
- [ ] Add Reset button
- [ ] Implement filter validation
- [ ] Add session storage persistence
- [ ] Add responsive design

### Task 4.4: Create Sales Chart Component
**File:** `frontend/app/dashboard/branch-manager/analytics/components/SalesChart.tsx`
- [ ] Integrate Chart.js or Recharts library
- [ ] Create line chart for daily sales trend
- [ ] Add responsive design
- [ ] Add tooltips on hover
- [ ] Add legend
- [ ] Add loading state
- [ ] Add empty state

### Task 4.5: Create Payment Method Chart Component
**File:** `frontend/app/dashboard/branch-manager/analytics/components/PaymentMethodChart.tsx`
- [ ] Create pie chart for payment method distribution
- [ ] Add percentages in legend
- [ ] Add tooltips on hover
- [ ] Add responsive design
- [ ] Add loading state
- [ ] Add empty state

### Task 4.6: Create Category Breakdown Chart Component
**File:** `frontend/app/dashboard/branch-manager/analytics/components/CategoryBreakdownChart.tsx`
- [ ] Create bar chart for sales by category
- [ ] Sort by total sales descending
- [ ] Add responsive design
- [ ] Add tooltips on hover
- [ ] Add loading state
- [ ] Add empty state

### Task 4.7: Create Transaction Table Component
**File:** `frontend/app/dashboard/branch-manager/analytics/components/TransactionTable.tsx`
- [ ] Create paginated table (50 rows per page)
- [ ] Add columns: Date, Category, Payment Method, Amount, Status
- [ ] Implement column sorting
- [ ] Add loading state with skeleton rows
- [ ] Add empty state
- [ ] Add responsive design (horizontal scroll on mobile)
- [ ] Format currency values
- [ ] Format dates consistently

### Task 4.8: Create Export Buttons Component
**File:** `frontend/app/dashboard/branch-manager/analytics/components/ExportButtons.tsx`
- [ ] Add PDF Export button
- [ ] Add CSV Export button
- [ ] Implement file download handling
- [ ] Add loading states during generation
- [ ] Add success notifications
- [ ] Add error notifications
- [ ] Disable buttons while loading

## Phase 5: Testing

### Task 5.1: Backend Unit Tests
**File:** `backend/src/controllers/__tests__/branch-analytics.controller.test.ts`
- [ ] Test `getBranchSales` with valid input
- [ ] Test `getBranchSales` with invalid branch_id
- [ ] Test `getBranchSales` with invalid date range
- [ ] Test branch isolation (user cannot access other branch data)
- [ ] Test filter combinations
- [ ] Test error handling

### Task 5.2: Python Service Unit Tests
**File:** `analytics-service/tests/test_branch_sales_analytics.py`
- [ ] Test data aggregation logic
- [ ] Test filter application
- [ ] Test metrics calculation
- [ ] Test PDF generation
- [ ] Test CSV export
- [ ] Test error handling

### Task 5.3: Integration Tests
**File:** `backend/src/test/integration/branch-analytics.test.ts`
- [ ] Test complete API flow (request → response)
- [ ] Test authentication flow
- [ ] Test branch isolation enforcement
- [ ] Test report generation flow
- [ ] Test error scenarios

### Task 5.4: Frontend Component Tests
**Files:** `frontend/app/dashboard/branch-manager/analytics/components/__tests__/*.test.tsx`
- [ ] Test SalesMetricsCards rendering
- [ ] Test FilterPanel interactions
- [ ] Test chart rendering
- [ ] Test table pagination
- [ ] Test export button clicks
- [ ] Test error states
- [ ] Test loading states

### Task 5.5: End-to-End Tests
**File:** `frontend/e2e/branch-analytics.spec.ts`
- [ ] Test complete user workflow (login → dashboard → filter → export)
- [ ] Test report download
- [ ] Test error handling
- [ ] Test responsive design on different screen sizes

### Task 5.6: Performance Tests
**File:** `backend/src/test/performance/analytics-performance.test.ts`
- [ ] Test query execution time with 100k records
- [ ] Test report generation time with 10k records
- [ ] Test concurrent user load (10 users)
- [ ] Verify response times meet requirements (<5 seconds)

## Phase 6: Documentation

### Task 6.1: API Documentation
**File:** `docs/api/branch-analytics.md`
- [ ] Document all API endpoints
- [ ] Add request/response examples
- [ ] Document error codes
- [ ] Add authentication requirements
- [ ] Add rate limiting information

### Task 6.2: User Guide
**File:** `docs/user-guides/branch-manager-analytics.md`
- [ ] Create step-by-step guide for using analytics dashboard
- [ ] Add screenshots
- [ ] Document filter options
- [ ] Document export functionality
- [ ] Add troubleshooting section

### Task 6.3: Developer Guide
**File:** `docs/developer-guides/analytics-implementation.md`
- [ ] Document architecture decisions
- [ ] Document database schema
- [ ] Document query optimization strategies
- [ ] Document caching strategy
- [ ] Add code examples

## Phase 7: Deployment

### Task 7.1: Environment Configuration
- [ ] Add analytics service URL to environment variables
- [ ] Configure CORS settings
- [ ] Configure JWT secret keys
- [ ] Configure database connection strings
- [ ] Configure Redis cache (optional)

### Task 7.2: Database Migration
- [ ] Run index creation migration
- [ ] Verify RLS policies
- [ ] Test with production-like data volume
- [ ] Create rollback plan

### Task 7.3: Service Deployment
- [ ] Deploy Python analytics service
- [ ] Deploy backend API changes
- [ ] Deploy frontend changes
- [ ] Verify all services are running
- [ ] Test end-to-end flow in production

### Task 7.4: Monitoring Setup
- [ ] Add logging for all analytics operations
- [ ] Set up error tracking (Sentry or similar)
- [ ] Set up performance monitoring
- [ ] Create alerts for slow queries
- [ ] Create alerts for high error rates

### Task 7.5: User Acceptance Testing
- [ ] Test with real branch managers
- [ ] Collect feedback
- [ ] Fix critical issues
- [ ] Document known limitations
- [ ] Create training materials

## Success Criteria

- [ ] Dashboard loads in < 2 seconds
- [ ] Filters apply in < 3 seconds
- [ ] Reports generate in < 10 seconds (for < 10k records)
- [ ] Queries execute in < 5 seconds (for < 100k records)
- [ ] Branch isolation is enforced (no cross-branch data leakage)
- [ ] All tests pass (unit, integration, e2e)
- [ ] User acceptance testing completed successfully
- [ ] Documentation is complete and accurate

---

*Implementation Tasks Version 1.0*  
*Created: 2025*  
*Feature: branch-manager-analytics-dashboard*
