# Requirements Document: Branch Manager Analytics and Reporting Module

## Introduction

The Branch Manager Analytics and Reporting Module provides comprehensive visibility into branch-specific sales performance, transactions, and operational data for the FamousGates Hotel Management System. This module enables branch managers to monitor real-time sales metrics, generate detailed reports, and analyze business performance through an intuitive dashboard interface with advanced filtering capabilities.

The system integrates with the existing Python-based analytics service (FastAPI) and unifies data from multiple sources including bookings, restaurant orders, shift transactions, and payment records while maintaining strict branch-level data isolation in a multi-tenant architecture.

## Glossary

- **Branch_Manager**: A user with the `branch_manager` role who manages operations for a single hotel branch
- **Sales_Dashboard**: The primary analytics interface displaying aggregated sales metrics and performance data
- **Analytics_Service**: The Python FastAPI microservice located in `analytics-service/` that handles report generation and data processing
- **Supabase_Client**: The database client used for querying PostgreSQL through Supabase with Row Level Security (RLS)
- **Filter_Engine**: The component that processes dynamic filter combinations for date ranges, payment methods, and categories
- **Report_Generator**: The PDF generation service using ReportLab for creating branded reports
- **Data_Aggregator**: The backend service that unifies data from bookings, restaurant_orders, shift_transactions, and booking_payments tables
- **Branch_Isolation**: The security mechanism ensuring users only access data for their assigned branch_id
- **Transaction_Record**: Any sales record from bookings, restaurant_orders, or shift_transactions tables
- **Payment_Method**: The payment type enum including 'cash', 'card', 'mpesa' (mobile money)
- **Order_Type**: The transaction category enum including 'walk_in', 'online', 'booking', 'room_service', 'dine_in', 'takeaway'
- **Date_Range_Filter**: A filter allowing selection of custom, daily, weekly, monthly, or yearly time periods
- **Sales_Metric**: Aggregated numerical data including total_sales, transaction_count, average_transaction_value
- **PDF_Template**: Branded document template with FamousGates logo, colors, and formatting
- **Query_Optimizer**: Database indexing and query planning mechanism for handling large datasets
- **Cache_Layer**: Performance optimization storing frequently accessed aggregated data
- **Background_Job**: Asynchronous task for generating heavy reports without blocking the UI

## Requirements

### Requirement 1: Sales Dashboard Interface

**User Story:** As a Branch Manager, I want to access a dedicated analytics dashboard, so that I can monitor my branch's sales performance at a glance.

#### Acceptance Criteria

1. THE Sales_Dashboard SHALL display on a dedicated page within the Branch Manager panel
2. THE Sales_Dashboard SHALL show daily total sales for the current branch
3. THE Sales_Dashboard SHALL show monthly total sales for the current branch
4. THE Sales_Dashboard SHALL show yearly total sales for the current branch
5. THE Sales_Dashboard SHALL display transaction count for each time period
6. THE Sales_Dashboard SHALL display average transaction value for each time period
7. THE Sales_Dashboard SHALL update metrics within 30 seconds of new transaction creation
8. WHERE the Branch Manager has no transactions, THE Sales_Dashboard SHALL display zero values with an empty state message
9. THE Sales_Dashboard SHALL load initial metrics within 2 seconds on standard network conditions

### Requirement 2: Advanced Filtering System

**User Story:** As a Branch Manager, I want to filter sales data by multiple criteria, so that I can analyze specific segments of my business performance.

#### Acceptance Criteria

1. THE Filter_Engine SHALL provide date range selection with options: custom, daily, weekly, monthly, yearly
2. WHEN a custom date range is selected, THE Filter_Engine SHALL validate that the end date is after the start date
3. THE Filter_Engine SHALL provide product/service category filters including: rooms, restaurant, spa, bar, conference, dynamic_services
4. THE Filter_Engine SHALL provide payment method filters including: cash, card, mpesa, mixed
5. THE Filter_Engine SHALL provide order type filters including: walk_in, online, booking, room_service, dine_in, takeaway
6. THE Filter_Engine SHALL allow multiple filters to be applied simultaneously
7. WHEN filters are applied, THE Sales_Dashboard SHALL update displayed metrics within 3 seconds
8. THE Filter_Engine SHALL persist selected filters in browser session storage
9. WHEN the page is refreshed, THE Filter_Engine SHALL restore previously selected filters from session storage
10. THE Filter_Engine SHALL execute filtered queries with response time under 5 seconds for datasets up to 100,000 records

### Requirement 3: Comprehensive Data Coverage

**User Story:** As a Branch Manager, I want all revenue sources included in analytics, so that I have a complete view of branch performance.

#### Acceptance Criteria

1. THE Data_Aggregator SHALL include data from the bookings table
2. THE Data_Aggregator SHALL include data from the restaurant_orders table
3. THE Data_Aggregator SHALL include data from the shift_transactions table
4. THE Data_Aggregator SHALL include data from the booking_payments table
5. THE Data_Aggregator SHALL join tables using correct foreign key relationships without data duplication
6. THE Data_Aggregator SHALL filter all queries by the Branch Manager's assigned branch_id
7. THE Data_Aggregator SHALL exclude voided transactions (where is_voided = true)
8. THE Data_Aggregator SHALL exclude cancelled bookings (where status = 'cancelled')
9. THE Data_Aggregator SHALL calculate total_amount from bookings.total_amount, restaurant_orders.total_amount, and shift_transactions.total_amount
10. THE Data_Aggregator SHALL map payment methods consistently across all source tables
11. FOR ALL aggregated data, THE Data_Aggregator SHALL ensure no cross-branch data leakage occurs

### Requirement 4: Reporting Engine

**User Story:** As a Branch Manager, I want to generate downloadable reports, so that I can share performance data with stakeholders and maintain records.

#### Acceptance Criteria

1. THE Report_Generator SHALL create reports with sales summaries including total revenue, transaction count, and average transaction value
2. THE Report_Generator SHALL create reports with transaction breakdowns grouped by payment method
3. THE Report_Generator SHALL create reports with transaction breakdowns grouped by order type
4. THE Report_Generator SHALL create reports with transaction breakdowns grouped by date
5. THE Report_Generator SHALL create reports with trend analysis showing period-over-period comparisons
6. THE Report_Generator SHALL integrate with the Python Analytics_Service at `analytics-service/app.py`
7. THE Report_Generator SHALL apply all active Filter_Engine selections to generated reports
8. WHEN a report is requested, THE Report_Generator SHALL return a downloadable file within 10 seconds for datasets up to 10,000 records
9. WHERE report generation exceeds 10 seconds, THE Report_Generator SHALL use a Background_Job and notify the user when complete
10. THE Report_Generator SHALL include report generation timestamp in ISO 8601 format
11. THE Report_Generator SHALL include branch identification (branch name and branch_id) in all reports

### Requirement 5: PDF Report Generation

**User Story:** As a Branch Manager, I want professionally branded PDF reports, so that I can present data in official documents.

#### Acceptance Criteria

1. THE PDF_Template SHALL include the FamousGates logo in the header
2. THE PDF_Template SHALL use FamousGates brand colors (primary and secondary colors from brand guidelines)
3. THE PDF_Template SHALL include report title, generation date, and branch name in the header
4. THE PDF_Template SHALL display data in structured tables with column headers
5. THE PDF_Template SHALL include summary sections with key metrics highlighted
6. THE PDF_Template SHALL include page numbers in the footer
7. THE PDF_Template SHALL include branch_id and report generation timestamp in the footer
8. THE PDF_Template SHALL use readable fonts with minimum 10pt size for body text
9. THE PDF_Template SHALL optimize layout for A4 paper size in portrait orientation
10. THE PDF_Template SHALL handle tables spanning multiple pages with repeated headers
11. THE PDF_Template SHALL generate files under 5MB for reports with up to 1,000 transactions

### Requirement 6: Backend Data Integrity

**User Story:** As a System Architect, I want correct database queries and joins, so that analytics data is accurate and consistent.

#### Acceptance Criteria

1. THE Data_Aggregator SHALL use INNER JOIN for bookings to rooms to ensure valid room references
2. THE Data_Aggregator SHALL use LEFT JOIN for optional relationships (e.g., guest_id in shift_transactions)
3. THE Data_Aggregator SHALL use indexes on branch_id columns for all queried tables
4. THE Data_Aggregator SHALL use indexes on date columns (created_at, transaction_date, check_in_date) for all queried tables
5. THE Data_Aggregator SHALL use indexes on status columns for filtering active records
6. THE Data_Aggregator SHALL aggregate using SUM() for total_amount calculations
7. THE Data_Aggregator SHALL aggregate using COUNT(DISTINCT id) for transaction counts to prevent duplicates
8. THE Data_Aggregator SHALL aggregate using AVG() for average transaction value calculations
9. THE Data_Aggregator SHALL use GROUP BY clauses with all non-aggregated columns in SELECT
10. THE Data_Aggregator SHALL validate that branch_id exists in branches table before executing queries
11. THE Data_Aggregator SHALL use prepared statements to prevent SQL injection
12. THE Data_Aggregator SHALL return error responses with HTTP 400 for invalid query parameters
13. THE Data_Aggregator SHALL return error responses with HTTP 500 for database errors without exposing internal details

### Requirement 7: Scalability and Performance

**User Story:** As a System Administrator, I want optimized query performance, so that the system remains responsive as data volume grows.

#### Acceptance Criteria

1. THE Query_Optimizer SHALL use database indexes on branch_id for all transaction tables
2. THE Query_Optimizer SHALL use database indexes on date columns for all transaction tables
3. THE Query_Optimizer SHALL use database indexes on status columns for all transaction tables
4. THE Query_Optimizer SHALL use composite indexes on (branch_id, created_at) for time-based queries
5. THE Cache_Layer SHALL store aggregated daily metrics for the current day
6. THE Cache_Layer SHALL store aggregated monthly metrics for the current month
7. THE Cache_Layer SHALL invalidate cached data within 60 seconds of new transaction creation
8. THE Cache_Layer SHALL use Redis or in-memory caching for frequently accessed metrics
9. WHERE report generation exceeds 10 seconds, THE Background_Job SHALL process the request asynchronously
10. THE Background_Job SHALL notify the user via UI notification when report generation completes
11. THE Sales_Dashboard SHALL implement pagination for transaction lists with 50 records per page
12. THE Sales_Dashboard SHALL load paginated data within 2 seconds per page
13. THE Query_Optimizer SHALL use EXPLAIN ANALYZE to verify query execution plans during development
14. THE Query_Optimizer SHALL ensure queries execute in under 5 seconds for datasets up to 100,000 records

### Requirement 8: Branch-Level Data Isolation

**User Story:** As a Security Officer, I want strict branch-level data isolation, so that branch managers cannot access other branches' data.

#### Acceptance Criteria

1. THE Supabase_Client SHALL apply Row Level Security (RLS) policies to all transaction tables
2. THE Supabase_Client SHALL filter all queries by the authenticated user's assigned branch_id
3. THE Supabase_Client SHALL retrieve the user's branch_id from the users table on authentication
4. THE Supabase_Client SHALL reject queries that attempt to access data from other branches with HTTP 403
5. THE Data_Aggregator SHALL validate branch_id matches the authenticated user's branch before executing queries
6. THE Data_Aggregator SHALL log all data access attempts with user_id, branch_id, and timestamp
7. THE Data_Aggregator SHALL prevent SQL injection through parameterized queries
8. THE Data_Aggregator SHALL prevent branch_id tampering by validating against the authenticated session
9. IF a Branch Manager attempts to access another branch's data, THEN THE Supabase_Client SHALL return an empty result set
10. THE Supabase_Client SHALL use server-side authentication with `supabase.auth.getUser()` not `getSession()`

### Requirement 9: API Integration Architecture

**User Story:** As a Backend Developer, I want clean API contracts between frontend and Python services, so that integration is maintainable and reliable.

#### Acceptance Criteria

1. THE Analytics_Service SHALL expose a POST endpoint `/api/analytics/branch-sales` accepting branch_id, start_date, end_date, filters
2. THE Analytics_Service SHALL expose a POST endpoint `/api/reports/branch-sales-pdf` accepting branch_id, start_date, end_date, filters
3. THE Analytics_Service SHALL expose a POST endpoint `/api/reports/branch-sales-csv` accepting branch_id, start_date, end_date, filters
4. THE Analytics_Service SHALL validate all request parameters and return HTTP 400 for invalid inputs
5. THE Analytics_Service SHALL return JSON responses with structure: `{ "data": {...}, "metadata": {...} }`
6. THE Analytics_Service SHALL return error responses with structure: `{ "error": "message", "code": "ERROR_CODE" }`
7. THE Analytics_Service SHALL include CORS headers allowing requests from the Next.js frontend origin
8. THE Analytics_Service SHALL require Authorization header with valid JWT token
9. THE Analytics_Service SHALL validate JWT token and extract user_id and branch_id claims
10. THE Analytics_Service SHALL log all API requests with timestamp, user_id, endpoint, and response status
11. THE Analytics_Service SHALL return responses within 5 seconds or return HTTP 202 for async processing
12. THE Analytics_Service SHALL use snake_case for all JSON field names to match database schema

### Requirement 10: Frontend User Experience

**User Story:** As a Branch Manager, I want an intuitive and responsive interface, so that I can efficiently access analytics without technical difficulties.

#### Acceptance Criteria

1. THE Sales_Dashboard SHALL display loading skeletons while fetching data
2. THE Sales_Dashboard SHALL display error messages when data fetching fails
3. THE Sales_Dashboard SHALL display empty state messages when no data matches filters
4. THE Sales_Dashboard SHALL display success notifications when reports are generated
5. THE Sales_Dashboard SHALL disable filter controls while data is loading
6. THE Sales_Dashboard SHALL disable report generation buttons while reports are processing
7. THE Sales_Dashboard SHALL show progress indicators for long-running operations
8. THE Sales_Dashboard SHALL be responsive and functional on desktop screens (1024px and wider)
9. THE Sales_Dashboard SHALL be responsive and functional on tablet screens (768px to 1023px)
10. THE Sales_Dashboard SHALL use accessible color contrast ratios (WCAG AA minimum)
11. THE Sales_Dashboard SHALL provide keyboard navigation for all interactive elements
12. THE Sales_Dashboard SHALL display metric cards with clear labels and values
13. THE Sales_Dashboard SHALL use charts (bar, line, pie) to visualize trends where applicable
14. THE Sales_Dashboard SHALL format currency values with proper locale formatting (e.g., KES 1,234.56)
15. THE Sales_Dashboard SHALL format dates in consistent format (e.g., DD MMM YYYY)

### Requirement 11: Export Functionality

**User Story:** As a Branch Manager, I want to export data in multiple formats, so that I can use the data in other tools and workflows.

#### Acceptance Criteria

1. THE Report_Generator SHALL support PDF export format
2. THE Report_Generator SHALL support CSV export format
3. THE Report_Generator SHALL apply all active filters to exported data
4. THE Report_Generator SHALL include column headers in CSV exports
5. THE Report_Generator SHALL use UTF-8 encoding for CSV exports
6. THE Report_Generator SHALL name exported files with pattern: `branch-sales-{branch_name}-{date_range}-{timestamp}.{ext}`
7. THE Report_Generator SHALL trigger browser download when export is ready
8. THE Report_Generator SHALL include all visible columns from the dashboard in exports
9. THE Report_Generator SHALL include summary rows in CSV exports (total, average, count)
10. THE Report_Generator SHALL limit CSV exports to 50,000 rows to prevent memory issues

### Requirement 12: Data Parsing and Serialization

**User Story:** As a Backend Developer, I want robust data parsing and serialization, so that data integrity is maintained across system boundaries.

#### Acceptance Criteria

1. THE Analytics_Service SHALL parse incoming JSON request bodies using `request.get_json()`
2. THE Analytics_Service SHALL validate date strings match ISO 8601 format (YYYY-MM-DD)
3. THE Analytics_Service SHALL validate branch_id is a valid integer
4. THE Analytics_Service SHALL validate filter arrays contain only allowed enum values
5. THE Analytics_Service SHALL serialize Decimal types to float for JSON responses
6. THE Analytics_Service SHALL serialize datetime objects to ISO 8601 strings for JSON responses
7. THE Analytics_Service SHALL serialize UUID objects to string for JSON responses
8. THE Analytics_Service SHALL handle NULL values in database results by converting to None/null in JSON
9. THE Analytics_Service SHALL use a Pretty_Printer to format aggregated data back into JSON for API responses
10. FOR ALL valid data objects, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property)

### Requirement 13: Error Handling and Logging

**User Story:** As a System Administrator, I want comprehensive error handling and logging, so that I can diagnose and resolve issues quickly.

#### Acceptance Criteria

1. THE Analytics_Service SHALL log all incoming requests with timestamp, endpoint, user_id, and parameters
2. THE Analytics_Service SHALL log all database queries with execution time
3. THE Analytics_Service SHALL log all errors with stack traces to application logs
4. THE Analytics_Service SHALL return user-friendly error messages without exposing internal details
5. THE Analytics_Service SHALL return HTTP 400 for client errors (invalid input)
6. THE Analytics_Service SHALL return HTTP 401 for authentication failures
7. THE Analytics_Service SHALL return HTTP 403 for authorization failures (wrong branch)
8. THE Analytics_Service SHALL return HTTP 500 for server errors (database failures)
9. THE Sales_Dashboard SHALL display error messages from API responses to users
10. THE Sales_Dashboard SHALL log JavaScript errors to browser console
11. THE Sales_Dashboard SHALL use try-catch blocks for all async operations
12. THE Sales_Dashboard SHALL display generic error message if API returns no error details

### Requirement 14: Authentication and Authorization

**User Story:** As a Security Officer, I want proper authentication and authorization, so that only authorized branch managers can access their analytics.

#### Acceptance Criteria

1. THE Sales_Dashboard SHALL require user authentication before displaying any data
2. THE Sales_Dashboard SHALL redirect unauthenticated users to the login page
3. THE Sales_Dashboard SHALL verify user role is 'branch_manager', 'general_manager', or 'super_admin'
4. THE Sales_Dashboard SHALL deny access to users with other roles with HTTP 403
5. THE Analytics_Service SHALL validate JWT tokens on all protected endpoints
6. THE Analytics_Service SHALL extract user_id and branch_id from validated JWT claims
7. THE Analytics_Service SHALL reject requests with expired JWT tokens with HTTP 401
8. THE Analytics_Service SHALL reject requests with invalid JWT signatures with HTTP 401
9. THE Analytics_Service SHALL use server-side JWT validation not client-side
10. THE Analytics_Service SHALL log all authentication failures with user_id and IP address

### Requirement 15: Testing and Quality Assurance

**User Story:** As a QA Engineer, I want comprehensive test coverage, so that the system is reliable and bugs are caught early.

#### Acceptance Criteria

1. THE Data_Aggregator SHALL have unit tests for all aggregation functions
2. THE Data_Aggregator SHALL have integration tests verifying correct data from all source tables
3. THE Filter_Engine SHALL have unit tests for all filter combinations
4. THE Filter_Engine SHALL have property-based tests verifying filter composition is associative
5. THE Report_Generator SHALL have unit tests for PDF generation with sample data
6. THE Report_Generator SHALL have integration tests verifying reports match filtered data
7. THE Analytics_Service SHALL have API endpoint tests for all routes
8. THE Analytics_Service SHALL have tests verifying branch isolation (no cross-branch data leakage)
9. THE Sales_Dashboard SHALL have component tests for all UI elements
10. THE Sales_Dashboard SHALL have end-to-end tests for complete user workflows
11. THE Query_Optimizer SHALL have performance tests verifying query execution time under 5 seconds for 100,000 records
12. THE Cache_Layer SHALL have tests verifying cache invalidation within 60 seconds

---

## Special Requirements Guidance

### Parser and Serializer Requirements

This feature includes critical data parsing and serialization components:

**Date Range Parser:**
- Parses user-selected date ranges from UI into database query parameters
- Must handle ISO 8601 date strings (YYYY-MM-DD)
- Must validate date range logic (end_date > start_date)

**Filter Parser:**
- Parses filter selections (payment methods, order types, categories) into SQL WHERE clauses
- Must handle arrays of enum values
- Must prevent SQL injection through parameterized queries

**JSON Serializer:**
- Serializes database query results (Decimal, datetime, UUID types) into JSON responses
- Must handle NULL values gracefully
- Must maintain precision for currency values

**CSV Serializer:**
- Serializes aggregated data into CSV format with proper escaping
- Must handle special characters in text fields
- Must use UTF-8 encoding

**Round-Trip Property (CRITICAL):**
- FOR ALL valid date range inputs, parsing → database query → JSON serialization → parsing SHALL produce equivalent date range
- FOR ALL valid filter selections, parsing → SQL WHERE clause → query execution → result serialization SHALL produce data matching the original filter criteria
- FOR ALL valid transaction records, database fetch → JSON serialization → CSV export → parsing SHALL preserve all numeric precision and data integrity

These serializers and parsers are ESSENTIAL for data integrity. Round-trip testing is MANDATORY to catch precision loss, encoding issues, and data corruption bugs.

---

## Implementation Notes

### Database Schema References

The following tables are involved in this feature:

- `bookings` (id, branch_id, total_amount, payment_method, status, check_in_date, created_at)
- `restaurant_orders` (id, branch_id, total_amount, payment_method, status, order_type, created_at)
- `shift_transactions` (id, branch_id, total_amount, payment_method, service_category, transaction_date)
- `booking_payments` (id, booking_id, amount, payment_method, payment_date)
- `branches` (id, name, code)
- `users` (id, branch_id, role)

### Existing Services to Integrate

- **Analytics Service:** `analytics-service/app.py` (FastAPI)
- **PDF Generator:** `analytics-service/reports/pdf_generator.py` (ReportLab)
- **Excel Exporter:** `analytics-service/reports/excel_exporter.py` (openpyxl)
- **Database Config:** `analytics-service/config/database.py` (PostgreSQL connection)

### Technology Stack

- **Frontend:** Next.js 14, React, TypeScript, TailwindCSS
- **Backend:** Python FastAPI, Node.js
- **Database:** PostgreSQL via Supabase
- **Reporting:** ReportLab (PDF), openpyxl (Excel)
- **Authentication:** Supabase Auth with JWT
- **Caching:** Redis (recommended) or in-memory

### Performance Targets

- Dashboard initial load: < 2 seconds
- Filter application: < 3 seconds
- Report generation (< 10k records): < 10 seconds
- Query execution (< 100k records): < 5 seconds
- Cache invalidation: < 60 seconds

### Security Considerations

- All queries MUST filter by authenticated user's branch_id
- Use Row Level Security (RLS) policies on all tables
- Validate JWT tokens server-side using `supabase.auth.getUser()`
- Never expose raw database errors to clients
- Log all data access attempts for audit trail
- Use parameterized queries to prevent SQL injection

---

*Requirements Document Version 1.0*  
*Created: 2025*  
*Feature: branch-manager-analytics-dashboard*  
*Workflow: Requirements-First*
