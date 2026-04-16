---
inclusion: always
---

# FamousGates Development Rules

**Stack:** Next.js 14 · Supabase · Node.js · Flask · Tauri v2 · React Native

## Core Principles

**Prime Directive:** Fix root causes, not symptoms. Never break working functionality.

**Read Before Write:** Before editing any file, read:
1. The target file (complete content)
2. All files that import from it
3. Supabase table definitions for affected tables
4. Corresponding TypeScript types/interfaces

**One Bug Per Edit:** Fix exactly one bug or tightly-coupled cluster. No unrelated refactoring, renaming, or cleanup in the same edit.

**Ripple Effect Check:** Before committing changes, verify:
- All import sites updated if function signature changed
- All consumers updated if TypeScript type changed
- All references updated if DB column renamed
- All frontend consumers updated if API response shape changed
- All forms provide newly required Zod schema fields

## Database & Schema

**Schema is Source of Truth:** Fix order is always:
```
DB Schema → TypeScript Types → Zod Schemas → API Handlers → Frontend Forms
```

Never change DB schema to match broken frontend code. Always change code to match correct schema.

**TypeScript Types:**
- Never use `any`, `// @ts-ignore`, or `as unknown as T` as fixes
- Every Supabase table has exactly one canonical TypeScript type
- Types live in single shared file (e.g., `types/database.ts`)
- All modules import from that file—no duplicate definitions

## Supabase Patterns

**Authentication:**
```typescript
// ❌ NEVER — security vulnerability
const { data: { session } } = await supabase.auth.getSession()

// ✅ ALWAYS — server-validated
const { data: { user } } = await supabase.auth.getUser()
```

**SSR Cookie Handling:**
```typescript
// ❌ NEVER — deprecated
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
cookies: { get, set, remove }

// ✅ ALWAYS — correct SSR pattern
import { createServerClient } from '@supabase/ssr'
cookies: { getAll, setAll }
```

**Client Keys:**
- Client/browser: anon key only
- Server-side API routes: service_role key only

**RLS & Branch Scoping:**
```typescript
// ❌ NEVER — data leak across branches
supabase.from('orders').select('*')

// ✅ ALWAYS — scoped to current branch
supabase.from('orders').select('*').eq('branch_id', currentBranchId)
```

**Schema Cache:** If PGRST error or 406 on existing table, reload Supabase schema cache via Dashboard → API → Reload.

## API Patterns

**Error Handling:**
```typescript
try {
  const result = await apiCall()
} catch (error) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  toast.error(message)
}
```

Never swallow errors or only log to console. Always surface to user.

**Loading State:**
```typescript
const [isLoading, setIsLoading] = useState(false)
setIsLoading(true)
try { ... } finally { setIsLoading(false) }
```

**HTTP Methods:**
- POST → create new record
- PUT → replace entire record
- PATCH → update specific fields
- DELETE → remove record (ID in URL, not body)

**Protected Routes:**
```typescript
headers: {
  'Authorization': `Bearer ${session.access_token}`,
  'Content-Type': 'application/json'
}
```

**Response Shapes:**
```typescript
// Success
{ data: T, message?: string }

// Error
{ error: string, code?: string, field?: string }
```

Never expose raw Supabase/PostgreSQL errors to client.

## Forms & Validation

**Modal Lifecycle:**
```typescript
// Reset on open
useEffect(() => {
  if (isOpen) form.reset(defaultValues)
}, [isOpen])

// Disable during submission
<Button disabled={isSubmitting || isLoading} type="submit">

// Show field errors
{errors.fieldName && <p className="text-red-500 text-sm">{errors.fieldName.message}</p>}
```

**Zod Schemas:**
- Mirror DB column names exactly (snake_case, not camelCase)
- Nullable DB columns → `.optional()` in Zod
- Required DB columns → `.min(1)` or equivalent in Zod
- Match DB types: `NUMERIC` → `z.number()`, `UUID` → `z.string().uuid()`, `INT` → `z.number().int()`

**Payload Sanitization:**
```typescript
const { uiOnlyField, ...payload } = formValues
await createRecord(payload)
```

## Backend Patterns

**Node.js API Routes:**
- Validate request body before processing
- Return consistent response shapes
- Verify JWT in middleware
- Never expose raw database errors

**Flask Microservices:**
```python
# Accept JSON
data = request.get_json()

# CORS headers for Next.js origin
# Return HTTP 400 (bad input), 401 (auth), 500 (server error)

# Response format
return jsonify({"data": result}), 200
return jsonify({"error": "Description"}), 400
```

## React Query

**Query Keys:**
```typescript
// ✅ Include all variables affecting query
useQuery({ queryKey: ['orders', branchId, status], ... })
```

**Invalidation:**
```typescript
queryClient.invalidateQueries({ queryKey: ['orders'] })
queryClient.invalidateQueries({ queryKey: ['invoices'] })
```

**UI States:**
```typescript
if (isLoading) return <Skeleton />
if (isError) return <ErrorState message={error.message} />
if (!data?.length) return <EmptyState />
```

**Data Transformation:**
```typescript
useQuery({ ..., select: (data) => data.filter(x => x.active) })
```

## Naming Conventions

```
DB columns:       snake_case    (branch_id, created_at)
TypeScript types: snake_case    (match DB exactly)
Zod fields:       snake_case    (match DB exactly)
API payloads:     snake_case    (consistent with DB)
React props:      camelCase     (tableId, branchId)
React state:      camelCase     (isLoading, hasError)
Constants:        SCREAMING_SNAKE_CASE
```

**Common Bug:** Using `branchId` (camelCase) in Supabase query where column is `branch_id` (snake_case). This silently fails.

## Code Quality

**Eliminate on touched lines:**
- `console.log()` in production paths
- Magic strings/numbers (use constants/enums)
- Nested ternaries (use if/else or early returns)
- Empty catch blocks (always handle or rethrow)
- Unexplained `@ts-ignore` (fix issue or document why)

## Definition of Done

A fix is complete when:
- Root cause fixed (not symptom)
- No TypeScript errors in changed files
- No console errors for affected flow
- No related files broken
- Loading, error, and empty states handled
- Success feedback shown to user

## Error Message Safety

```typescript
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return 'An unexpected error occurred'
}

toast.error(getErrorMessage(error))
```