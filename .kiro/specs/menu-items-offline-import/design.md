# Design Document: Menu Items Offline Import

## Overview

This design implements automatic menu item caching for the Electron POS application, mirroring the existing user auto-import pattern. The system will fetch menu items and categories from Supabase and cache them in the local SQLite database, enabling full offline POS functionality.

The implementation follows the established pattern in `electron/main.js` where user data is automatically imported on startup (around line 970) and synchronized every 30 minutes. We will add parallel logic for menu items immediately after the user import logic.

### Key Design Decisions

1. **Reuse Existing Pattern**: Follow the exact same structure as user auto-import for consistency and maintainability
2. **Two-Phase Import**: Import categories first, then menu items (to maintain referential integrity)
3. **Incremental Sync**: Only fetch and update new/changed items during background sync
4. **Non-Blocking**: All import operations run asynchronously without blocking the UI
5. **Graceful Degradation**: Errors during import do not prevent application startup

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Electron Main Process                    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Menu Import System (main.js)               │    │
│  │                                                     │    │
│  │  ┌──────────────────┐    ┌──────────────────┐    │    │
│  │  │ Initial Import   │    │ Background Sync  │    │    │
│  │  │ (on startup)     │    │ (every 30 min)   │    │    │
│  │  └────────┬─────────┘    └────────┬─────────┘    │    │
│  │           │                       │               │    │
│  │           └───────────┬───────────┘               │    │
│  │                       │                           │    │
│  │              ┌────────▼────────┐                  │    │
│  │              │ performMenuSync │                  │    │
│  │              └────────┬────────┘                  │    │
│  │                       │                           │    │
│  └───────────────────────┼───────────────────────────┘    │
│                          │                                │
│         ┌────────────────┼────────────────┐              │
│         │                │                │              │
│         ▼                ▼                ▼              │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ Supabase │    │ Database │    │   IPC    │          │
│  │  Client  │    │  Module  │    │ Handlers │          │
│  └──────────┘    └──────────┘    └──────────┘          │
│         │                │                │              │
└─────────┼────────────────┼────────────────┼──────────────┘
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ Supabase │    │  SQLite  │    │ Renderer │
    │   Cloud  │    │ Database │    │ Process  │
    └──────────┘    └──────────┘    └──────────┘
```

### Data Flow

1. **Startup Flow**:
   - App initializes database
   - After 2 seconds, check if menu cache is empty
   - If empty, fetch categories and items from Supabase
   - Store in local SQLite tables
   - Log results

2. **Background Sync Flow**:
   - Every 30 minutes, check for new/updated menu items
   - Compare Supabase data with local cache
   - Update only changed items
   - Log sync statistics

3. **Frontend Access Flow**:
   - Frontend calls `cache:getMenuItems` IPC handler
   - Handler queries local SQLite database
   - Returns cached menu items filtered by branch_id

## Components and Interfaces

### 1. Menu Sync Function

**Function**: `performMenuSync()`

**Purpose**: Core function that fetches menu data from Supabase and caches it locally

**Location**: `electron/main.js` (new function, added after `performUserSync`)

**Signature**:
```javascript
async function performMenuSync(branchId = null) {
  // Returns: { success: boolean, categoriesCount: number, itemsCount: number, error?: string }
}
```

**Behavior**:
- Creates Supabase client using hardcoded credentials
- Fetches all categories from `restaurant_menu_categories`
- Fetches menu items from `restaurant_menu_items` (filtered by branch_id if provided)
- Stores categories in `restaurant_menu_categories` table
- Stores items in `restaurant_menu_items` table
- Returns summary statistics

**Error Handling**:
- Catches and logs all errors
- Returns error details in result object
- Does not throw exceptions (graceful degradation)

### 2. Initial Import Logic

**Location**: `electron/main.js` in `app.on('ready')` handler

**Timing**: Executes 2 seconds after app startup (after user import)

**Pseudocode**:
```javascript
setTimeout(async () => {
  try {
    if (!db) return;
    
    // Check if menu cache is empty
    const categoryCount = get('SELECT COUNT(*) as count FROM restaurant_menu_categories');
    const itemCount = get('SELECT COUNT(*) as count FROM restaurant_menu_items');
    
    if ((categoryCount?.count || 0) === 0 || (itemCount?.count || 0) === 0) {
      console.log('[Menu Auto-Import] Cache empty, importing from Supabase...');
      const result = await performMenuSync();
      
      if (result.success) {
        console.log(`[Menu Auto-Import] ✓ Imported ${result.categoriesCount} categories and ${result.itemsCount} items`);
      } else {
        console.error('[Menu Auto-Import] Failed:', result.error);
      }
    } else {
      console.log(`[Menu Auto-Import] Found ${categoryCount?.count} categories and ${itemCount?.count} items, skipping import`);
    }
  } catch (err) {
    console.error('[Menu Auto-Import] Error:', err.message);
  }
}, 2000);
```

### 3. Background Sync Logic

**Location**: `electron/main.js` in `app.on('ready')` handler

**Timing**: Starts 5 seconds after app startup, runs every 30 minutes

**Pseudocode**:
```javascript
setTimeout(async () => {
  try {
    console.log('[Menu Background Sync] Starting...');
    
    // Initial sync
    await performMenuSync();
    
    // Set up interval
    setInterval(async () => {
      console.log('[Menu Background Sync] Running scheduled sync...');
      await performMenuSync();
    }, 30 * 60 * 1000);
  } catch (err) {
    console.error('[Menu Background Sync] Failed to start:', err);
  }
}, 5000);
```

### 4. IPC Handlers

**Existing Handlers** (no changes needed):
- `cache:menuItems` - Already exists for caching menu items
- `cache:getMenuItems` - Already exists for retrieving cached items

**New Handler**: `autosync:syncMenuNow`

**Purpose**: Allow manual triggering of menu sync from frontend

**Signature**:
```javascript
ipcMain.handle('autosync:syncMenuNow', async (_, branchId = null) => {
  console.log('[Menu Auto-Sync] Manual sync triggered');
  return await performMenuSync(branchId);
});
```

### 5. Database Integration

**Tables Used** (already exist in database.js):
- `restaurant_menu_categories` - Stores menu categories
- `restaurant_menu_items` - Stores menu items

**Operations**:
- `INSERT OR REPLACE` for upserting categories and items
- `SELECT COUNT(*)` for checking cache status
- `SELECT` for retrieving cached data

## Data Models

### Menu Category

**Supabase Table**: `restaurant_menu_categories`

**Fields**:
```javascript
{
  id: string,              // Primary key (UUID)
  name: string,            // Category name (e.g., "Appetizers")
  description: string,     // Optional description
  sort_order: number,      // Display order
  is_active: boolean,      // Whether category is active
  is_bar: boolean         // Whether this is a bar category
}
```

**SQLite Storage**: Stored as-is in `restaurant_menu_categories` table

### Menu Item

**Supabase Table**: `restaurant_menu_items`

**Fields**:
```javascript
{
  id: string,              // Primary key (UUID)
  category_id: string,     // Foreign key to category
  branch_id: number,       // Branch identifier (nullable)
  name: string,            // Item name
  description: string,     // Item description
  price: number,           // Item price
  image_url: string,       // Optional image URL
  is_available: boolean,   // Whether item is available
  is_vegetarian: boolean,  // Dietary flag
  is_spicy: boolean,       // Dietary flag
  preparation_time: number, // Minutes to prepare
  created_at: string,      // ISO timestamp
  updated_at: string       // ISO timestamp
}
```

**SQLite Storage**: Stored as-is in `restaurant_menu_items` table

### Sync Result

**Structure**:
```javascript
{
  success: boolean,           // Whether sync succeeded
  categoriesCount: number,    // Number of categories synced
  itemsCount: number,         // Number of items synced
  error?: string             // Error message if failed
}
```

## Correctness Properties


A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Import Round-Trip Consistency

*For any* set of menu categories and items fetched from Supabase, after caching them locally and retrieving them via the IPC handler, the retrieved data should match the original Supabase data in all fields.

**Validates: Requirements 1.3, 6.1, 8.1, 8.2, 8.4**

### Property 2: Branch Filtering Correctness

*For any* branch_id query, all returned menu items should either have a matching branch_id or have a null branch_id (indicating availability for all branches).

**Validates: Requirements 2.1, 2.2, 6.2**

### Property 3: Category-First Import Ordering

*For any* import operation, all categories must be stored in the Local_Cache before any menu items that reference those categories are stored.

**Validates: Requirements 4.1, 4.2**

### Property 4: Empty Cache Triggers Import

*For any* application startup where the Local_Cache contains zero menu categories or zero menu items, the Menu_Import_System should initiate a fetch from Supabase.

**Validates: Requirements 1.1**

### Property 5: Non-Empty Cache Skips Import

*For any* application startup where the Local_Cache contains at least one menu category and one menu item, the Menu_Import_System should skip the initial import and not query Supabase.

**Validates: Requirements 1.4**

### Property 6: Incremental Sync Updates

*For any* menu item that exists in both Supabase and Local_Cache, after a sync operation, the Local_Cache version should match the Supabase version in all fields.

**Validates: Requirements 3.3, 8.3**

### Property 7: New Item Detection

*For any* menu item that exists in Supabase but not in Local_Cache, after a sync operation, that item should exist in Local_Cache with all fields matching Supabase.

**Validates: Requirements 3.2**

### Property 8: Error Resilience

*For any* error condition (network failure, authentication failure, database write failure), the Menu_Import_System should log the error, return a failure result, and allow the application to continue running without crashing.

**Validates: Requirements 1.5, 5.1, 5.2, 5.3, 5.5**

### Property 9: Sync Result Completeness

*For any* sync operation (successful or failed), the returned result object should contain a success boolean, counts of categories and items processed, and an error message if applicable.

**Validates: Requirements 5.4, 10.2**

### Property 10: Supabase Configuration Consistency

*For any* Supabase client creation, the Menu_Import_System should use the hardcoded SUPABASE_URL and should use SUPABASE_SERVICE_ROLE_KEY if available, otherwise falling back to SUPABASE_ANON_KEY.

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 11: Scheduled Sync Interval

*For any* background sync operation, the Auto_Sync should execute at 30-minute intervals after the initial sync, regardless of whether previous syncs succeeded or failed.

**Validates: Requirements 3.1, 3.5**

### Property 12: Non-Blocking Import

*For any* import operation (initial or background), the main window should open and be interactive while the import is in progress.

**Validates: Requirements 9.2**

### Property 13: Manual and Automatic Sync Equivalence

*For any* menu data state in Supabase, manual sync (via IPC) and automatic sync should produce identical results in the Local_Cache.

**Validates: Requirements 10.1, 10.3**

### Property 14: Batch Operation Efficiency

*For any* import operation processing multiple menu items, all items should be inserted using a single database transaction rather than individual transactions per item.

**Validates: Requirements 9.4**

### Property 15: Referential Integrity Preservation

*For any* menu item with a category_id, after import, the referenced category must exist in the Local_Cache restaurant_menu_categories table.

**Validates: Requirements 4.2**

## Error Handling

### Error Categories

1. **Authentication Errors**
   - Missing Supabase credentials
   - Invalid API keys
   - **Handling**: Log descriptive error, return failure result, skip import

2. **Network Errors**
   - Connection timeout
   - DNS resolution failure
   - HTTP errors (4xx, 5xx)
   - **Handling**: Log error with details, return failure result, retry at next interval

3. **Database Errors**
   - Write failures
   - Constraint violations
   - Disk space issues
   - **Handling**: Log specific item that failed, continue processing remaining items, return partial success

4. **Data Validation Errors**
   - Missing required fields
   - Invalid data types
   - Orphaned references (item without category)
   - **Handling**: Log validation error, skip invalid item, continue processing

### Error Logging Format

All errors should be logged with the following structure:
```javascript
console.error('[Menu Auto-Import] <Operation>: <Error Message>', {
  errorType: 'authentication|network|database|validation',
  details: { /* relevant context */ }
});
```

### Recovery Strategies

1. **Transient Errors** (network, temporary database issues)
   - Log error
   - Return failure result
   - Retry at next scheduled interval
   - Do not block application startup

2. **Persistent Errors** (missing credentials, invalid configuration)
   - Log error once
   - Disable auto-sync to prevent log spam
   - Require manual intervention

3. **Partial Failures** (some items fail to import)
   - Log each failure
   - Continue processing remaining items
   - Return success with error count in result

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs
- Both approaches are complementary and necessary for full validation

### Unit Testing Focus

Unit tests should cover:
- Specific example scenarios (e.g., importing a known set of 3 categories and 10 items)
- Edge cases (empty database, null branch_ids, missing categories)
- Error conditions (network failures, authentication errors, database write failures)
- Integration points (IPC handlers, database operations, Supabase client creation)

Unit tests should NOT attempt to cover all possible input combinations—that's the role of property tests.

### Property-Based Testing

**Library**: Use `fast-check` for JavaScript/Node.js property-based testing

**Configuration**: Each property test must run a minimum of 100 iterations to ensure adequate randomization coverage

**Test Tagging**: Each property test must include a comment tag referencing the design document property:
```javascript
// Feature: menu-items-offline-import, Property 1: Import Round-Trip Consistency
```

**Property Test Structure**:
```javascript
const fc = require('fast-check');

// Feature: menu-items-offline-import, Property 1: Import Round-Trip Consistency
test('imported menu items round-trip correctly', () => {
  fc.assert(
    fc.property(
      fc.array(menuCategoryArbitrary),
      fc.array(menuItemArbitrary),
      async (categories, items) => {
        // 1. Cache the data
        await performMenuSync(/* mock Supabase to return categories and items */);
        
        // 2. Retrieve via IPC
        const retrieved = await ipcHandler('cache:getMenuItems', branchId);
        
        // 3. Verify match
        expect(retrieved).toMatchObject(items);
      }
    ),
    { numRuns: 100 }
  );
});
```

**Generators Needed**:
- `menuCategoryArbitrary`: Generates random valid menu categories
- `menuItemArbitrary`: Generates random valid menu items with valid category references
- `branchIdArbitrary`: Generates random branch IDs including null
- `errorConditionArbitrary`: Generates various error scenarios

### Integration Testing

Integration tests should verify:
- End-to-end flow from Supabase fetch to local cache to IPC retrieval
- Interaction between initial import and background sync
- Behavior across application restarts
- Real database operations (using test database)

### Test Environment Setup

- Use in-memory SQLite database for unit tests
- Mock Supabase client for controlled test scenarios
- Use test fixtures for known menu data sets
- Clean up database state between tests

### Coverage Goals

- **Line Coverage**: Minimum 90% for menu import code
- **Branch Coverage**: Minimum 85% for error handling paths
- **Property Coverage**: All 15 correctness properties must have corresponding property tests
- **Integration Coverage**: All IPC handlers must have integration tests
