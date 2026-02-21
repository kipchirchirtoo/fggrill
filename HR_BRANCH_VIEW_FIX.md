# HR Branch View Enhancement

## Problem
HR Manager role cannot view data for each branch separately. Currently, HR pages show all data across all branches without branch filtering.

## Solution
Add branch selection capability to HR dashboard and all HR pages, similar to how Auditor and other roles can filter by branch.

## Changes Needed

### 1. Update HR Dashboard (`frontend/src/app/dashboard/hr/page.tsx`)
- Add `BranchSelector` component
- Add branch filtering to all API calls
- Show branch-specific stats

### 2. Update HR Staff Attendance (`frontend/src/app/dashboard/hr/staff-attendance/page.tsx`)
- Add branch filter
- Filter staff by selected branch

### 3. Update Other HR Pages
- Employees page
- Leave management page
- Payroll page
- Salaries page

### 4. Backend Updates
- Ensure HR_MANAGER role has access to branch data
- Update staff API to support branch filtering

## Implementation
