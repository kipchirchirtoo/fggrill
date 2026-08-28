# Guide: Replacing Raw SQL Workarounds with Supabase Queries

## Overview
This guide helps you replace raw SQL workarounds in controllers with proper Supabase ORM queries.

## Common Patterns to Replace

### Pattern 1: Raw SQL with Parameter Binding
**Before:**
```typescript
const queryStr = 'SELECT * FROM credit_bills WHERE branch_id = $1';
const params = [branchId];
const { rows } = await db.query(queryStr, params);
```

**After:**
```typescript
const { data, error } = await supabase
  .from('credit_bills')
  .select('*')
  .eq('branch_id', branchId);
```

### Pattern 2: Complex JOINs
**Before:**
```typescript
const queryStr = `
  SELECT cb.*, u.first_name, u.last_name 
  FROM credit_bills cb
  JOIN users u ON cb.staff_id = u.id
  WHERE cb.branch_id = $1
`;
```

**After:**
```typescript
const { data, error } = await supabase
  .from('credit_bills')
  .select(`
    *,
    staff:staff_id(first_name, last_name)
  `)
  .eq('branch_id', branchId);
```

### Pattern 3: Dynamic WHERE Clauses
**Before:**
```typescript
let queryStr = 'SELECT * FROM credit_bills WHERE 1=1';
const params = [];

if (branchId) {
  queryStr += ' AND branch_id = $' + (params.length + 1);
  params.push(branchId);
}

if (status) {
  queryStr += ' AND status = $' + (params.length + 1);
  params.push(status);
}

const { rows } = await db.query(queryStr, params);
```

**After:**
```typescript
let query = supabase.from('credit_bills').select('*');

if (branchId) query = query.eq('branch_id', branchId);
if (status) query = query.eq('status', status);
if (staffId) query = query.eq('staff_id', staffId);

const { data, error } = await query;
```

### Pattern 4: Aggregations
**Before:**
```typescript
const queryStr = `
  SELECT COUNT(*) as total,
         SUM(amount) as total_amount
  FROM credit_bills
  WHERE branch_id = $1
`;
```

**After:**
```typescript
const { data, error } = await supabase
  .from('credit_bills')
  .select('amount')
  .eq('branch_id', branchId);

const total = data?.length || 0;
const totalAmount = data?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
```

### Pattern 5: Pagination
**Before:**
```typescript
const queryStr = 'SELECT * FROM credit_bills LIMIT $1 OFFSET $2';
const params = [limit, offset];
const { rows } = await db.query(queryStr, params);
```

**After:**
```typescript
const { data, error } = await supabase
  .from('credit_bills')
  .select('*')
  .range(offset, offset + limit - 1);
```

## Step-by-Step Replacement Process

### 1. Identify Raw SQL Workarounds
Search for these patterns in your codebase:
- `db.query(`
- `executing raw SQL`
- `raw SQL fix`
- `.backup` files (indicates previous attempts)

### 2. Understand the Query
- What tables are involved?
- What filters are applied?
- What joins are needed?
- What is the expected output?

### 3. Convert to Supabase Query
- Use `.from()` to specify the table
- Use `.select()` to specify columns
- Use `.eq()`, `.in()`, `.gt()`, `.lt()` for filters
- Use `.select()` with nested syntax for joins
- Use `.range()` for pagination

### 4. Test the Replacement
- Verify the output matches the original
- Check error handling
- Ensure performance is acceptable

### 5. Remove the Old Code
- Delete the raw SQL implementation
- Remove console.log statements like "executing raw SQL fix"
- Update any related type definitions

## Specific File Replacements

### cashier.controller.ts - getCreditBills
**Location:** Line ~2487
**Current:** Uses raw SQL with dynamic WHERE clauses
**Replacement:** Use Supabase query builder with conditional filters

### Other Controllers
Search for all instances of "executing raw SQL fix" and replace them systematically.

## Benefits of Supabase Queries

1. **Type Safety**: Better TypeScript integration
2. **Security**: Automatic SQL injection prevention
3. **Maintainability**: Easier to read and modify
4. **Consistency**: Uniform query patterns across codebase
5. **Performance**: Supabase optimizes queries automatically
6. **RLS Support**: Respects Row Level Security policies

## Common Supabase Query Patterns

### Basic Select
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*');
```

### With Filters
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('column', value)
  .gt('date', '2024-01-01')
  .in('status', ['active', 'pending']);
```

### With Joins
```typescript
const { data, error } = await supabase
  .from('bookings')
  .select(`
    *,
    guest:guest_id(*),
    room:room_id(*)
  `);
```

### With Ordering
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .order('created_at', { ascending: false });
```

### With Pagination
```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .range(0, 9); // First 10 records
```

## Error Handling

Always handle Supabase errors properly:

```typescript
const { data, error } = await supabase
  .from('table_name')
  .select('*');

if (error) {
  logger.error('Query failed:', error);
  return res.status(500).json({
    success: false,
    message: 'Failed to fetch data',
    error: error.message
  });
}

return res.status(200).json({
  success: true,
  data
});
```

## Migration Checklist

- [ ] Identify all raw SQL workarounds
- [ ] Convert each to Supabase queries
- [ ] Test each replacement
- [ ] Remove console.log statements
- [ ] Update error handling
- [ ] Run integration tests
- [ ] Deploy to staging
- [ ] Monitor for issues
- [ ] Deploy to production
