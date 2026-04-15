# 🧠 ANTIGRAVITY STRICT ENGINEERING RULES (NO REGRESSION MODE)

---

## 🔴 CORE PRINCIPLE

YOU ARE NOT ALLOWED TO APPLY LOCAL FIXES.

Every change must be:
- analyzed globally
- applied consistently
- validated across the entire codebase

---

## 🔥 ANTI-REGRESSION RULE (MOST IMPORTANT)

Before fixing ANY bug:

1. Identify the ROOT CAUSE (not symptoms)
2. Search for ALL usages across the codebase
3. Identify dependencies and side effects
4. Apply fix to ALL related files
5. Validate system-wide consistency

❌ NEVER fix one file only  
❌ NEVER patch blindly  

---

## 🟠 API & SCHEMA CONTRACT RULES

- ALL API requests MUST match defined TypeScript interfaces
- NEVER guess request/response structure
- NEVER use `any`
- ALL API calls MUST go through a centralized apiClient
- DO NOT use fetch() inside components

If schema changes:
→ update ALL usages globally

---

## 🟡 AUTHENTICATION RULES

- Authorization headers MUST be handled ONLY in interceptors
- DO NOT manually set Authorization headers anywhere else
- ALWAYS ensure token is present for protected endpoints
- NEVER cache auth endpoints (/login, /auth, /me)

---

## 🟢 ARCHITECTURE RULES

- Use domain-based structure:
  (auth, users, inventory, pos, etc.)

- Each file must have ONE responsibility
- Max file size: 300–500 lines
- NO mixing of concerns across modules

---

## 🔵 ROLE-BASED ACCESS CONTROL (RBAC)

- Verify user role BEFORE calling any protected API
- Ensure frontend matches backend permissions
- Prevent unauthorized endpoint access

---

## 🟣 API STANDARDIZATION

ALL API functions must follow:

export const example = (data) =>
  apiClient.post("/endpoint", data)

❌ No inline fetch  
❌ No mixed patterns  
❌ No duplicated logic  

---

## ⚫ ERROR HANDLING RULE

- DO NOT use scattered try/catch in API calls
- Use centralized interceptor error handling only

---

## 🧪 VALIDATION RULE (AFTER EVERY CHANGE)

You MUST verify:

✔ No type errors  
✔ No broken imports  
✔ All API calls match schema  
✔ Auth flow works  
✔ No duplicate logic introduced  
✔ No endpoint mismatches  

If ANY fail → task is NOT complete

---

## 🔶 CHANGE SAFETY RULE

Before modifying any function:

- Find ALL references
- Check ALL callers
- Check ALL dependent modules

---

## 🚫 STRICT PROHIBITIONS

- DO NOT quick fix
- DO NOT modify unrelated files
- DO NOT introduce new patterns if one exists
- DO NOT guess system behavior
- DO NOT ignore existing architecture

---

## 🧠 WORKFLOW RULE

For EVERY task:

1. Create implementation plan
2. Analyze full codebase impact
3. Apply changes globally
4. Validate system integrity
5. Only then finalize

---

## 🧠 FINAL RULE

You are not a coder.

You are a SYSTEM ENGINEER.

Your job is:
- maintain consistency
- prevent regressions
- enforce architecture

If the system becomes unstable after your change,
YOU FAILED the task.
# ⚙️ BUGFIX_RULES.md — FamousGates AI Assistant Rules
# Load this as a Cursor Project Rule / Windsurf Rule / Copilot Instruction file
# These rules are NON-NEGOTIABLE and override all default AI behavior

---

## 🔴 RULE 0 — THE PRIME DIRECTIVE

**"Fix the root cause. Never the symptom. Never break what is already working."**

If fixing a bug in File A would break File B, you must fix both in the same operation,
or you must explicitly state: *"I cannot fix this safely without also changing [File B]."*

---

## 🔴 RULE 1 — READ BEFORE YOU WRITE

Before editing any file, you MUST read:
1. The file you are about to change (full content)
2. Every file that imports from that file
3. The Supabase table definition for any table touched by that file
4. The corresponding TypeScript type/interface for that table

**You are forbidden from editing a file you have not fully read in this session.**

---

## 🔴 RULE 2 — ONE BUG PER EDIT

Each code edit must fix exactly one bug or one tightly-coupled cluster of bugs.
Do not refactor, rename, or "clean up" unrelated code in the same edit.

> ❌ WRONG: Fix the invoice lookup AND rename variables AND reorganize imports  
> ✅ RIGHT: Fix the invoice lookup only

---

## 🔴 RULE 3 — SCHEMA IS THE SOURCE OF TRUTH

The Supabase database schema is the **single source of truth**.
TypeScript types, Zod schemas, API payloads, and form fields must all conform to it.

When there is a mismatch, the fix order is always:
```
DB Schema → TypeScript Types → Zod Schemas → API Handlers → Frontend Forms
```

Never change the DB schema to match broken frontend code.
Always change the frontend/backend code to match the correct DB schema.

---

## 🔴 RULE 4 — TYPESCRIPT TYPES ARE CONTRACTS

- Never use `any` as a fix. Find or create the correct type.
- Never use `// @ts-ignore` as a fix. Fix the underlying type error.
- Never use `as unknown as SomeType` to cast around a type error. Fix the shape.
- Every Supabase table must have exactly one canonical TypeScript type.
- That type must live in a single shared file (e.g., `types/database.ts`).
- All modules must import from that file — no duplicate/diverging type definitions.

---

## 🔴 RULE 5 — SUPABASE RULES (MANDATORY)

### Auth
```typescript
// ❌ NEVER — security vulnerability, can be spoofed
const { data: { session } } = await supabase.auth.getSession()

// ✅ ALWAYS — server-validated
const { data: { user } } = await supabase.auth.getUser()
```

### SSR Cookie Handling
```typescript
// ❌ NEVER — deprecated, breaks session state
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
cookies: { get, set, remove }  // individual cookie methods

// ✅ ALWAYS — correct SSR pattern
import { createServerClient } from '@supabase/ssr'
cookies: { getAll, setAll }  // bulk cookie methods only
```

### Client Types
```typescript
// ❌ NEVER use service_role key on the client/browser side
// ✅ ALWAYS use anon key on the client
// ✅ ALWAYS use service_role key ONLY in server-side API routes
```

### RLS & Branch Scoping
```typescript
// ❌ NEVER — fetches data from ALL branches (data leak)
supabase.from('orders').select('*')

// ✅ ALWAYS — scoped to the current branch
supabase.from('orders').select('*').eq('branch_id', currentBranchId)
```

### Schema Cache
```typescript
// If you see PGRST error or 406 on a table that exists:
// You must reload the Supabase schema cache via Dashboard → API → Reload
// OR add the schema explicitly to the Supabase client config
```

---

## 🔴 RULE 6 — API CALL RULES

Every API call (fetch, axios, supabase query) must:

```typescript
// ✅ Have error handling
try {
  const result = await apiCall()
  // handle success
} catch (error) {
  // NEVER: catch (error) {}  ← swallowed error
  // NEVER: catch (error) { console.log(error) }  ← not surfaced to user
  // ALWAYS:
  const message = error instanceof Error ? error.message : 'An unexpected error occurred'
  toast.error(message)
  // log to error monitoring if available
}

// ✅ Have loading state management
const [isLoading, setIsLoading] = useState(false)
setIsLoading(true)
try { ... } finally { setIsLoading(false) }

// ✅ Have the correct HTTP method
// POST   → create new record
// PUT    → replace entire record
// PATCH  → update specific fields only
// DELETE → remove record (send ID in URL, not body)

// ✅ Send Authorization header on protected routes
headers: {
  'Authorization': `Bearer ${session.access_token}`,
  'Content-Type': 'application/json'
}
```

---

## 🔴 RULE 7 — MODAL & FORM RULES

Every modal must:

```typescript
// ✅ Reset form on open AND on close
useEffect(() => {
  if (isOpen) form.reset(defaultValues)
}, [isOpen])

// ✅ Disable submit button while loading
<Button disabled={isSubmitting || isLoading} type="submit">

// ✅ Show field-level validation errors
{errors.fieldName && <p className="text-red-500 text-sm">{errors.fieldName.message}</p>}

// ✅ Handle both create and edit modes explicitly
// Don't merge them into one confusing conditional mess

// ✅ Send only the fields the API/DB expects
// Strip UI-only fields before submitting
const { uiOnlyField, ...payload } = formValues
await createRecord(payload)  // uiOnlyField never reaches the API
```

Every Zod schema must:
```typescript
// ✅ Mirror the DB column names exactly (not camelCase variations of snake_case)
// DB column: branch_id  →  Zod field: branch_id  (not branchId)

// ✅ Mark nullable DB columns as optional in Zod
// DB: description TEXT NULL  →  Zod: description: z.string().optional()

// ✅ Mark required DB columns as required in Zod
// DB: name VARCHAR NOT NULL  →  Zod: name: z.string().min(1)

// ✅ Use correct types
// DB: price NUMERIC  →  Zod: price: z.number().positive()
// DB: id UUID        →  Zod: id: z.string().uuid()
// DB: quantity INT   →  Zod: quantity: z.number().int().nonnegative()
```

---

## 🔴 RULE 8 — BACKEND RULES (Node.js & Flask)

### Node.js API Routes
```javascript
// ✅ Always validate request body before processing
// ✅ Always return consistent error shapes:
{ error: string, code?: string, field?: string }

// ✅ Always return consistent success shapes:
{ data: T, message?: string }

// ✅ Never expose raw Supabase/PostgreSQL errors to the client
// Catch → log internally → return sanitized message

// ✅ Always verify JWT in middleware before handler runs
```

### Flask Microservices
```python
# ✅ Every route that accepts JSON must call request.get_json()
# ✅ Every route must have CORS headers for Next.js origin
# ✅ Never return Python exceptions directly — catch and format them
# ✅ Return HTTP 400 for bad input, 401 for auth failures, 500 for server errors

# ✅ Standard response format:
return jsonify({"data": result}), 200
return jsonify({"error": "Description of what went wrong"}), 400
```

---

## 🔴 RULE 9 — ERROR MESSAGE RULES

```typescript
// ❌ NEVER show raw error objects in toasts
toast.error(error)              // shows "[object Object]"
toast.error(error.message)      // crashes if error is not an Error instance

// ✅ ALWAYS use safe extraction
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

---

## 🔴 RULE 10 — RIPPLE EFFECT RULE (The Most Important Rule)

Before committing any fix, you MUST answer these questions:

```
1. What files import the file I just changed?
2. Do any of those files depend on the specific shape I just modified?
3. If I changed a function signature, did I update ALL call sites?
4. If I changed a TypeScript type, did I update ALL files that use that type?
5. If I changed a DB column name, did I search the ENTIRE codebase for the old name?
6. If I changed an API response shape, did I update ALL frontend consumers?
7. If I added a required field to a Zod schema, does every form that uses it provide that field?
```

**If you cannot answer YES to all applicable questions, do not save the fix yet.**

---

## 🟡 RULE 11 — CODE QUALITY RULES (Enforce During Fixes)

While fixing bugs, also correct these on any line you touch:

```typescript
// ❌ Eliminate all console.log() in production code paths
// ✅ Replace with proper error logging or remove entirely

// ❌ No magic strings/numbers
const STATUS = 'pending'  // magic string
// ✅ Use constants or enums
const ORDER_STATUS = { PENDING: 'pending', CONFIRMED: 'confirmed' } as const

// ❌ No nested ternaries
const x = a ? b ? c : d : e
// ✅ Use explicit if/else or early returns

// ❌ No empty catch blocks
try { ... } catch (e) {}
// ✅ Always handle or rethrow

// ❌ No disabled TypeScript rules without explanation
// @ts-ignore
// ✅ Fix the underlying issue OR add a comment explaining WHY it's disabled
```

---

## 🟡 RULE 12 — NAMING CONVENTIONS

To prevent the type of bugs where frontend and backend disagree on field names:

```
DB columns:         snake_case    (branch_id, created_at, staff_name)
TypeScript types:   snake_case    (match DB exactly for Supabase auto-types)
Zod field names:    snake_case    (match DB exactly)
API payloads:       snake_case    (consistent with DB)
React props:        camelCase     (tableId, branchId — internal component use only)
React state vars:   camelCase     (isLoading, hasError)
Constants:          SCREAMING_SNAKE_CASE
```

**The most common bug in this system:** using `branchId` (camelCase) in a Supabase query
where the column is `branch_id` (snake_case). This silently fails with no results.

---

## 🟡 RULE 13 — REACT QUERY / DATA FETCHING

```typescript
// ✅ Query keys must be arrays and must include all variables that affect the query
useQuery({ queryKey: ['orders', branchId, status], ... })  // NOT just ['orders']

// ✅ After mutations, invalidate ALL related queries
queryClient.invalidateQueries({ queryKey: ['orders'] })
queryClient.invalidateQueries({ queryKey: ['invoices'] })  // if orders affect invoices

// ✅ Always handle isLoading, isError, and empty states in the UI
if (isLoading) return <Skeleton />
if (isError) return <ErrorState message={error.message} />
if (!data?.length) return <EmptyState />

// ✅ Use select to transform data at the query level, not in render
useQuery({ ..., select: (data) => data.filter(x => x.active) })
```

---

## 🟢 RULE 14 — WHAT "DONE" MEANS

A fix is complete only when ALL of the following are true:

```
□ Root cause fixed (not symptom)
□ No TypeScript errors in changed files
□ No console errors in browser for the affected flow
□ No related files broken by the change
□ Loading state handled
□ Error state handled  
□ Empty/null state handled
□ Success feedback shown to user
□ Fix documented in bug report
□ Regression note written
```

---

## 🟢 RULE 15 — SESSION START RITUAL

At the beginning of every new AI session working on this codebase, say:

> *"I am working on the FamousGates Hotel & Restaurant Management System.
> Before I make any changes, I will read the relevant files,
> check the Supabase schema, identify all dependents,
> and follow BUGFIX_RULES.md throughout this session."*

Then load:
1. `BUGFIX_RULES.md` (this file)
2. `SYSTEM_AUDIT_PROMPT.md`
3. The specific module files you are working on
4. The relevant Supabase schema/migration files

---

*BUGFIX_RULES.md — FamousGates Hotels Management System*
*Stack: Next.js 14 · Supabase · Node.js · Flask · Tauri v2 · React Native*
*Enforce these rules in every AI IDE session. No exceptions.*