# Design Document: Kyogong Cash Float Tracking System

## Overview

The Kyogong Cash Float Tracking System provides real-time monitoring and management of cash drawer balances for cashiers across all Kyogong sales points (Spa, Reception, Executive Bar, Sports Bar). The system automatically tracks cash movements throughout a shift, calculates expected closing balances, identifies variances, and maintains a complete audit trail of all cash-related transactions.

### Key Objectives

- Provide real-time visibility into cash drawer balances during active shifts
- Automatically update float based on cash receipts and change given
- Calculate expected closing cash to facilitate shift reconciliation
- Support supervisor adjustments with full audit trail
- Ensure data integrity through atomic operations and concurrency control
- Persist float state across sessions and page refreshes

### Integration Points

The system integrates with existing Kyogong infrastructure:

- **Shift Management**: Extends `cashier_shifts` table with float tracking fields
- **Transaction Processing**: Hooks into `shift_transactions` creation to update float
- **Frontend Cashier Interface**: Adds Float Display component to payment UI
- **Database**: Uses PostgreSQL row-level locking for concurrency control

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Float Display│  │ Payment Form │  │ Shift Summary│      │
│  │  Component   │  │  Component   │  │  Component   │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer                                 │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Float Tracking Controller                           │   │
│  │  - getCurrentFloat()                                 │   │
│  │  - updateFloatOnTransaction()                        │   │
│  │  - adjustFloat()                                     │   │
│  │  - getFloatHistory()                                 │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                        │
│  ┌──────────────────┴───────────────────────────────────┐   │
│  │  Transaction Controller (Enhanced)                   │   │
│  │  - createTransaction() + float update hook           │   │
│  └──────────────────┬───────────────────────────────────┘   │
└─────────────────────┼──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ cashier_shifts   │  │ float_history    │                │
│  │ (enhanced)       │  │ (new table)      │                │
│  │                  │  │                  │                │
│  │ + current_float  │  │ - timestamp      │                │
│  │ + expected_cash  │  │ - amount_change  │                │
│  │ + float_version  │  │ - resulting_float│                │
│  └──────────────────┘  │ - transaction_ref│                │
│                        │ - adjustment_type│                │
│                        └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Shift Opening**: Cashier sets opening float → stored in `opening_float` and `current_float`
2. **Cash Transaction**: Transaction created → float update triggered → `current_float` increased by net cash
3. **Change Given**: Change calculated → `current_float` decreased by change amount
4. **Float Display**: Frontend polls/subscribes → retrieves `current_float` → displays to cashier
5. **Shift Closing**: Cashier counts cash → variance calculated → shift closed with reconciliation data
6. **Supervisor Adjustment**: Supervisor makes adjustment → `current_float` updated → audit record created

### Concurrency Strategy

The system uses optimistic locking with version numbers to handle concurrent transactions:

- Each shift has a `float_version` field that increments on every float update
- Float updates include version check: `WHERE id = ? AND float_version = ?`
- If version mismatch detected, transaction retries up to 3 times
- Failed retries trigger error notification to cashier

## Components and Interfaces

### Backend Components

#### 1. Float Tracking Controller

**File**: `backend/src/controllers/kyogong/float-tracking.controller.ts`

```typescript
interface FloatTrackingController {
  // Get current float for active shift
  getCurrentFloat(req: Request, res: Response): Promise<Response>;
  
  // Update float based on transaction (internal use)
  updateFloatOnTransaction(
    shiftId: string,
    cashReceived: number,
    changeGiven: number,
    transactionId: string
  ): Promise<void>;
  
  // Manual float adjustment (supervisor only)
  adjustFloat(req: Request, res: Response): Promise<Response>;
  
  // Get float history for shift
  getFloatHistory(req: Request, res: Response): Promise<Response>;
  
  // Export float history to CSV
  exportFloatHistory(req: Request, res: Response): Promise<Response>;
}
```

**Key Methods**:

- `getCurrentFloat`: Returns current float, opening float, expected closing cash for active shift
- `updateFloatOnTransaction`: Called internally when cash transaction completes; updates float atomically
- `adjustFloat`: Allows supervisors to make manual adjustments with reason and audit trail
- `getFloatHistory`: Returns chronological log of all float changes for a shift
- `exportFloatHistory`: Generates CSV export of float history for record keeping

#### 2. Enhanced Transaction Controller

**File**: `backend/src/controllers/kyogong/transactions.controller.ts` (modified)

The existing `createTransaction` method will be enhanced to:

1. Calculate net cash change (cash received - change given)
2. Call `updateFloatOnTransaction` after transaction is saved
3. Handle rollback if float update fails
4. Return updated float in transaction response

```typescript
// Pseudo-code addition to createTransaction
const netCashChange = cash_amount - (cash_amount - total_amount);
await updateFloatOnTransaction(shift_id, cash_amount, changeAmount, transaction.id);
```

#### 3. Float History Service

**File**: `backend/src/services/kyogong/float-history.service.ts`

```typescript
interface FloatHistoryService {
  // Record float change
  recordFloatChange(
    shiftId: string,
    amountChange: number,
    resultingFloat: number,
    changeType: 'TRANSACTION' | 'ADJUSTMENT' | 'OPENING' | 'CLOSING',
    referenceId?: string,
    reason?: string,
    userId?: string
  ): Promise<void>;
  
  // Get history with filters
  getHistory(
    shiftId: string,
    filters?: {
      startTime?: Date;
      endTime?: Date;
      changeType?: string;
    }
  ): Promise<FloatHistoryEntry[]>;
}
```

### Frontend Components

#### 1. Float Display Component

**File**: `frontend/src/components/kyogong/FloatDisplay.tsx`

```typescript
interface FloatDisplayProps {
  shiftId: string;
  refreshTrigger?: number; // Increment to force refresh
}

interface FloatDisplayState {
  currentFloat: number;
  openingFloat: number;
  expectedClosingCash: number;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date;
}
```

**Features**:
- Displays current float prominently with KES currency formatting
- Shows opening float and expected closing cash
- Auto-refreshes every 5 seconds or on transaction completion
- Visual loading indicator during updates
- Error state with retry option
- Optimistic UI updates with rollback on failure

#### 2. Payment Form Enhancement

**File**: `frontend/src/components/kyogong/PaymentForm.tsx` (modified)

Enhancements:
- Integrate FloatDisplay component when "Cash" payment method selected
- Calculate and display change amount in real-time
- Validate cash received >= bill total
- Show updated float after transaction completes
- Handle float update errors gracefully

#### 3. Shift Summary Component

**File**: `frontend/src/components/kyogong/ShiftSummary.tsx` (modified)

Enhancements:
- Display opening float, total cash in, total change given
- Show expected closing cash calculation breakdown
- Highlight cash variance if non-zero
- Link to float history view
- Export float history button

#### 4. Float Adjustment Modal

**File**: `frontend/src/components/kyogong/FloatAdjustmentModal.tsx`

```typescript
interface FloatAdjustmentModalProps {
  shiftId: string;
  currentFloat: number;
  onAdjustmentComplete: () => void;
}

interface FloatAdjustmentForm {
  adjustmentAmount: number; // Can be positive or negative
  reason: string; // Required
  authorizationCode?: string; // For large adjustments
}
```

**Features**:
- Input for adjustment amount (positive or negative)
- Required reason field
- Preview of resulting float
- Supervisor authorization required
- Confirmation dialog before applying

#### 5. Float History View

**File**: `frontend/src/components/kyogong/FloatHistoryView.tsx`

```typescript
interface FloatHistoryViewProps {
  shiftId: string;
}

interface FloatHistoryEntry {
  timestamp: Date;
  changeType: 'TRANSACTION' | 'ADJUSTMENT' | 'OPENING' | 'CLOSING';
  amountChange: number;
  resultingFloat: number;
  transactionRef?: string;
  reason?: string;
  performedBy?: string;
}
```

**Features**:
- Chronological list of all float changes
- Filter by time range and change type
- Color-coded entries (green for increases, red for decreases)
- Click transaction ref to view transaction details
- Export to CSV button

### API Endpoints

```
GET    /api/kyogong/shifts/:shift_id/float
       - Get current float information
       - Response: { currentFloat, openingFloat, expectedClosingCash, lastUpdated }

POST   /api/kyogong/shifts/:shift_id/float/adjust
       - Make manual float adjustment (supervisor only)
       - Body: { adjustmentAmount, reason, authorizationCode? }
       - Response: { updatedFloat, adjustmentId }

GET    /api/kyogong/shifts/:shift_id/float/history
       - Get float history with optional filters
       - Query: { startTime?, endTime?, changeType? }
       - Response: { history: FloatHistoryEntry[] }

GET    /api/kyogong/shifts/:shift_id/float/history/export
       - Export float history to CSV
       - Response: CSV file download
```

## Data Models

### Enhanced cashier_shifts Table

```sql
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS current_float DECIMAL(10,2);
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS expected_cash DECIMAL(10,2);
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS total_change_given DECIMAL(10,2) DEFAULT 0;
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS float_version INTEGER DEFAULT 0;
ALTER TABLE cashier_shifts ADD COLUMN IF NOT EXISTS last_float_update TIMESTAMP WITH TIME ZONE;
```

**Field Descriptions**:

- `current_float`: Real-time cash amount in drawer (updated on every cash transaction)
- `expected_cash`: Calculated expected closing cash (opening_float + total_cash_in - total_change_given)
- `total_change_given`: Cumulative change given during shift
- `float_version`: Optimistic locking version number (increments on each float update)
- `last_float_update`: Timestamp of last float modification

**Existing Fields Used**:
- `opening_float`: Initial cash amount (already exists as `opening_cash_float`)
- `closing_float`: Actual counted cash at shift end (already exists as `closing_cash_counted`)
- `cash_variance`: Difference between expected and actual (already exists)
- `total_cash_in`: Total cash received (already exists as `cash_sales`)

### New float_history Table

```sql
CREATE TABLE IF NOT EXISTS float_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shift_id UUID REFERENCES cashier_shifts(id) ON DELETE CASCADE NOT NULL,
    
    -- Change details
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('TRANSACTION', 'ADJUSTMENT', 'OPENING', 'CLOSING', 'VOID')),
    amount_change DECIMAL(10,2) NOT NULL,
    resulting_float DECIMAL(10,2) NOT NULL,
    
    -- Reference information
    transaction_id UUID REFERENCES shift_transactions(id),
    adjustment_reason TEXT,
    performed_by UUID REFERENCES users(id),
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_float_history_shift ON float_history(shift_id);
CREATE INDEX idx_float_history_timestamp ON float_history(timestamp);
CREATE INDEX idx_float_history_type ON float_history(change_type);
```

**Field Descriptions**:

- `shift_id`: Reference to the cashier shift
- `timestamp`: When the float change occurred
- `change_type`: Category of change (transaction, manual adjustment, etc.)
- `amount_change`: Delta applied to float (positive or negative)
- `resulting_float`: Float value after this change
- `transaction_id`: Reference to transaction if change_type is TRANSACTION
- `adjustment_reason`: Explanation for manual adjustments
- `performed_by`: User who performed the action (for adjustments)

### Enhanced shift_transactions Table

No schema changes required. The existing fields are sufficient:

- `cash_amount`: Cash received from customer
- `total_amount`: Bill total
- Change amount calculated as: `cash_amount - total_amount` (when cash_amount > total_amount)

### Data Relationships

```
cashier_shifts (1) ──< (many) float_history
    │
    └──< (many) shift_transactions
```

- One shift has many float history entries
- One shift has many transactions
- Float history entries may reference transactions


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Net Cash Change Calculation

*For any* cash transaction where cash is received and change may be given, the net cash change SHALL equal (cash received - change amount), where change amount equals max(0, cash received - bill total).

**Validates: Requirements 3.2, 4.1, 4.4**

### Property 2: Float Update Reflects Net Change

*For any* cash transaction, the current float after the transaction SHALL equal the float before the transaction plus the net cash change.

**Validates: Requirements 2.1, 4.2**

### Property 3: Cash Accumulation Across Transactions

*For any* sequence of cash transactions in a shift, the total cash in SHALL equal the sum of all cash received amounts, and the current float SHALL equal opening float plus sum of all net cash changes.

**Validates: Requirements 2.3, 2.4, 14.5**

### Property 4: Float Non-Negativity Invariant

*For any* float update operation (transaction or adjustment), the resulting current float SHALL be greater than or equal to zero.

**Validates: Requirements 3.5**

### Property 5: Expected Closing Cash Calculation

*For any* shift with transactions, the expected closing cash SHALL equal (opening float + total cash in - total change given), and this value SHALL be recalculated and persisted after each cash transaction.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 6: Opening Float Initialization

*For any* newly opened shift, the current float SHALL equal the opening float, and the opening float SHALL be a positive number.

**Validates: Requirements 6.2, 6.3, 6.4**

### Property 7: Cash Variance Calculation

*For any* closed shift, the cash variance SHALL equal (closing float counted - expected closing cash), and this value SHALL be stored in the shift record.

**Validates: Requirements 8.2, 8.3**

### Property 8: Shift Closure Independence from Variance

*For any* shift closure attempt with any variance amount (including large variances), the closure operation SHALL succeed and store the variance.

**Validates: Requirements 8.5**

### Property 9: Summary Calculations Accuracy

*For any* shift summary, the displayed total cash received SHALL equal the sum of all transaction cash amounts, the total change given SHALL equal the sum of all change amounts, and the net cash change SHALL equal (total received - total change).

**Validates: Requirements 9.2, 9.3, 9.4, 9.6**

### Property 10: Non-Cash Payment Float Isolation

*For any* transaction paid by non-cash methods (M-Pesa, card, bank transfer), the current float SHALL remain unchanged. For split payments, the float SHALL increase only by the cash portion.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 11: Float Persistence Round-Trip

*For any* active shift, retrieving the shift data from the database SHALL return the current float value that was last persisted, ensuring state survives page refreshes and re-authentication.

**Validates: Requirements 11.1, 11.2, 11.3, 5.5**

### Property 12: Cash Input Validation

*For any* cash transaction input, the system SHALL reject the transaction if: (a) cash received is not a positive number, (b) cash received is less than bill total, or (c) cash amount has more than 2 decimal places.

**Validates: Requirements 12.1, 12.2, 12.4, 12.5**

### Property 13: Adjustment Recording Completeness

*For any* float adjustment, the system SHALL record the adjustment in float history with timestamp, amount, reason, and performing user, and SHALL update both current float and expected closing cash by the adjustment amount.

**Validates: Requirements 13.2, 13.3, 13.4**

### Property 14: Adjustment History Inclusion

*For any* shift with adjustments, the shift summary SHALL include all adjustment records in the float history.

**Validates: Requirements 13.5**

### Property 15: Float History Completeness

*For any* float change (transaction, adjustment, opening, or closing), the system SHALL create a history entry containing timestamp, change type, amount change, resulting float, and reference information.

**Validates: Requirements 15.1, 15.2, 15.3**

### Property 16: Float History Export Round-Trip

*For any* shift's float history, exporting to CSV and parsing the CSV SHALL preserve all essential data fields (timestamp, change type, amount, resulting float, reference).

**Validates: Requirements 15.5**

### Property 17: Transaction Record Completeness

*For any* cash transaction, the transaction record SHALL contain the cash received amount and the calculated change amount.

**Validates: Requirements 2.2, 3.4**

### Property 18: Currency Formatting Consistency

*For any* monetary amount displayed in the float display, the formatted string SHALL include the KES currency code and proper thousand separators (e.g., "KES 12,345.67").

**Validates: Requirements 1.4**

## Error Handling

### Input Validation Errors

**Scenario**: Invalid cash amounts entered
- **Detection**: Frontend validation before submission + backend validation on receipt
- **Response**: Display clear error message, prevent transaction creation, retain form state
- **Recovery**: User corrects input and resubmits

**Scenario**: Cash received less than bill total
- **Detection**: Backend validation in transaction controller
- **Response**: Return 400 error with message "Insufficient payment: received KES X, required KES Y"
- **Recovery**: User enters correct amount

**Scenario**: Opening float not provided or invalid
- **Detection**: Backend validation in shift opening
- **Response**: Return 400 error, prevent shift opening
- **Recovery**: User provides valid opening float

### Float Update Errors

**Scenario**: Float update fails due to database error
- **Detection**: Database operation exception caught in float tracking controller
- **Response**: Rollback transaction, return 500 error, log error details
- **Recovery**: Frontend displays error, retains previous float value, offers retry button

**Scenario**: Optimistic locking conflict (concurrent updates)
- **Detection**: Version mismatch in UPDATE WHERE float_version = ?
- **Response**: Retry update up to 3 times with exponential backoff
- **Recovery**: If retries succeed, operation completes. If all fail, return 409 error and notify user

**Scenario**: Float would become negative
- **Detection**: Check in float update logic before applying change
- **Response**: Return 400 error "Insufficient float: operation would result in negative balance"
- **Recovery**: Supervisor must add float adjustment before proceeding

### Persistence Errors

**Scenario**: Database connection lost during transaction
- **Detection**: Database connection exception
- **Response**: Transaction automatically rolled back, return 503 error
- **Recovery**: Frontend shows "Connection lost" message, queues operation for retry when connection restored

**Scenario**: Float history recording fails
- **Detection**: Insert into float_history fails
- **Response**: Log error but don't fail the transaction (history is audit trail, not critical path)
- **Recovery**: Background job attempts to reconstruct missing history entries from transaction log

### Authorization Errors

**Scenario**: Non-supervisor attempts float adjustment
- **Detection**: Role check in adjustFloat endpoint
- **Response**: Return 403 Forbidden error
- **Recovery**: User must request supervisor to perform adjustment

**Scenario**: Adjustment without reason provided
- **Detection**: Backend validation in adjustFloat
- **Response**: Return 400 error "Adjustment reason is required"
- **Recovery**: User provides reason and resubmits

### Data Integrity Errors

**Scenario**: Shift not found or already closed
- **Detection**: Query returns no active shift
- **Response**: Return 404 error "No active shift found"
- **Recovery**: User must open new shift

**Scenario**: Transaction references non-existent shift
- **Detection**: Foreign key constraint or explicit check
- **Response**: Return 400 error "Invalid shift reference"
- **Recovery**: Application bug - log error for investigation

### Error Logging Strategy

All errors are logged with:
- Timestamp
- User ID and session ID
- Shift ID and transaction ID (if applicable)
- Error type and message
- Stack trace (for 500 errors)
- Request payload (sanitized)

Critical errors (data integrity issues, repeated concurrency failures) trigger alerts to system administrators.

## Testing Strategy

### Dual Testing Approach

The system will employ both unit testing and property-based testing to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, error conditions, and integration points
- **Property tests**: Verify universal properties across all inputs through randomized testing

Together, these approaches provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness across a wide input space.

### Property-Based Testing

**Framework**: We will use **fast-check** (for TypeScript/JavaScript) to implement property-based tests.

**Configuration**:
- Each property test will run a minimum of 100 iterations with randomized inputs
- Each test will be tagged with a comment referencing the design property
- Tag format: `// Feature: kyogong-cash-float-tracking, Property {number}: {property_text}`

**Property Test Examples**:

```typescript
// Feature: kyogong-cash-float-tracking, Property 1: Net Cash Change Calculation
test('net cash change equals cash received minus change', () => {
  fc.assert(
    fc.property(
      fc.float({ min: 0.01, max: 100000 }), // bill total
      fc.float({ min: 0.01, max: 100000 }), // cash received
      (billTotal, cashReceived) => {
        fc.pre(cashReceived >= billTotal); // Only valid payments
        const changeAmount = cashReceived - billTotal;
        const netChange = cashReceived - changeAmount;
        expect(netChange).toBeCloseTo(billTotal, 2);
      }
    ),
    { numRuns: 100 }
  );
});

// Feature: kyogong-cash-float-tracking, Property 3: Cash Accumulation
test('float equals opening plus sum of net changes', () => {
  fc.assert(
    fc.property(
      fc.float({ min: 1000, max: 50000 }), // opening float
      fc.array(fc.record({
        cashReceived: fc.float({ min: 0.01, max: 10000 }),
        billTotal: fc.float({ min: 0.01, max: 10000 })
      }), { minLength: 1, maxLength: 50 }), // transactions
      (openingFloat, transactions) => {
        const validTransactions = transactions.filter(t => t.cashReceived >= t.billTotal);
        fc.pre(validTransactions.length > 0);
        
        const netChanges = validTransactions.map(t => t.billTotal);
        const expectedFloat = openingFloat + netChanges.reduce((a, b) => a + b, 0);
        
        // Simulate processing transactions
        let currentFloat = openingFloat;
        validTransactions.forEach(t => {
          const netChange = t.billTotal;
          currentFloat += netChange;
        });
        
        expect(currentFloat).toBeCloseTo(expectedFloat, 2);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Unit Testing

**Framework**: Jest for backend (Node.js/TypeScript), React Testing Library for frontend

**Test Categories**:

1. **Controller Tests** (`backend/src/controllers/kyogong/float-tracking.controller.test.ts`):
   - Test getCurrentFloat returns correct data structure
   - Test adjustFloat requires supervisor role
   - Test adjustFloat requires reason
   - Test getFloatHistory returns chronological entries
   - Test error responses for invalid inputs

2. **Service Tests** (`backend/src/services/kyogong/float-history.service.test.ts`):
   - Test recordFloatChange creates history entry
   - Test getHistory filters by time range
   - Test getHistory filters by change type

3. **Integration Tests** (`backend/src/controllers/kyogong/transactions.controller.test.ts`):
   - Test createTransaction updates float for cash payment
   - Test createTransaction doesn't update float for M-Pesa
   - Test createTransaction handles split payment correctly
   - Test voidTransaction reverses float update

4. **Frontend Component Tests**:
   - FloatDisplay: Test displays formatted currency
   - FloatDisplay: Test shows loading state
   - FloatDisplay: Test shows error state with retry
   - PaymentForm: Test validates cash >= bill total
   - PaymentForm: Test calculates change correctly
   - ShiftSummary: Test displays all required fields
   - FloatAdjustmentModal: Test requires reason
   - FloatHistoryView: Test displays entries chronologically

5. **Edge Case Tests**:
   - Exact payment (no change): Float increases by bill total
   - Zero opening float: Rejected with validation error
   - Negative adjustment: Float decreases correctly
   - Large variance: Shift closes successfully
   - Empty transaction list: Summary shows zeros

6. **Error Condition Tests**:
   - Underpayment: Transaction rejected
   - Invalid decimal places: Input rejected
   - Concurrent updates: Retry logic works
   - Database error: Transaction rolled back
   - Non-supervisor adjustment: 403 error

### Integration Testing

**Database Integration**:
- Test float updates persist to database
- Test optimistic locking prevents lost updates
- Test foreign key constraints enforced
- Test triggers update shift totals correctly

**API Integration**:
- Test complete transaction flow: create transaction → float updated → history recorded
- Test shift lifecycle: open → transactions → close → variance calculated
- Test adjustment flow: supervisor adjusts → float updated → history recorded

### Test Data Strategy

**Fixtures**:
- Sample shifts with various states (open, closed, approved)
- Sample transactions with different payment methods
- Sample float history entries
- Sample users with different roles (cashier, supervisor, accountant)

**Generators** (for property tests):
- Random valid cash amounts (positive, 2 decimal places)
- Random transaction sequences
- Random payment method combinations
- Random adjustment amounts (positive and negative)

### Coverage Goals

- Line coverage: > 90%
- Branch coverage: > 85%
- Property test iterations: 100 per property
- Integration test scenarios: All critical paths covered

### Continuous Integration

All tests run on:
- Pre-commit hook (unit tests only, fast)
- Pull request (all tests including property tests)
- Main branch merge (full test suite + integration tests)
- Nightly build (extended property test runs with 1000 iterations)

