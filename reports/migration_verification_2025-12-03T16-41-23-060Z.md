# Multi-Branch Migration Verification Report

Generated: 2025-12-03T16:41:23.073Z

## 1. Branch Table Structure

✅ Branch table exists with the following structure:

| Column | Data Type |
| ------ | --------- |
| id | integer |
| name | character varying |
| code | character varying |
| location | character varying |
| address | text |
| phone | character varying |
| email | character varying |
| is_main_branch | boolean |
| status | character varying |
| created_at | timestamp with time zone |
| updated_at | timestamp with time zone |
| branch_type | character varying |
| number_of_rooms | integer |
| settings | jsonb |
| timezone | character varying |
| currency | character varying |
| logo_url | text |
| opening_date | date |

## 2. Branch Configuration

Total branches: 3

## 3. Tables with Branch ID

Found 6 tables with branch_id column:

```
- branch_features
- branch_settings
- staff_profiles
- stock_levels
- stock_requests
- user_branch_access
```

## 4. User Role Migration

Found 0 role migrations:

| ID | From Role | To Role | Status | Users Affected | Completed |
| -- | --------- | ------- | ------ | -------------- | --------- |

## Error During Verification

An error occurred during the verification process: column "role" does not exist
