# Discrepancy Aggregate Endpoint

## Route

`GET /finance/discrepancies/aggregate`

Provides a unified snapshot of key discrepancy signals (cashier logbooks, stock takes, cashier shifts, discrepancy flags, audit exceptions, food control variances, inventory governance alerts, financial variance deltas, payroll anomalies) for the auditor dashboard.

## Authorization

Requires one of:
- `super_admin`
- `director`
- `general_manager`
- `auditor`
- `accountant`
- `branch_accountant`

Branch-scoped roles are automatically restricted by `applyBranchFilter()`.

## Query Parameters

| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `branch_id` | `number` | *(optional)* | Force aggregation for a specific branch (globals only). Branch-scoped roles use their assigned branch automatically. |
| `lookback_days` | `number` | `DISCREPANCY_LOOKBACK_DAYS` env or `90` | Window for historical queries (stock takes, logbooks, shifts, flags, exceptions). |
| `pending_hours` | `number` | `LOGBOOK_FLAG_MIN_PENDING_HOURS` env or `24` | Threshold for marking logbooks/shifts as overdue. |
| `limit` | `number` | `30` | Maximum number of list items returned in sub-sections (`top_overdue`, `top_variances`, `recent`). |
| `include` | `string` | *(all)* | Optional comma-separated list to include long-tail sections: `food_control`, `inventory`, `financial`, `payroll`. When omitted, all sections are returned. |

## Response Structure

```json
{
  "success": true,
  "meta": {
    "generated_at": "2026-07-06T10:23:45.219Z",
    "branch_scope": { "type": "branch", "branch_id": 2 },
    "lookback_days": 90,
    "pending_hours": 24
  },
  "data": {
    "cashier_logbooks": {
      "summary": {
        "total": 40,
        "awaiting_accountant": 6,
        "awaiting_audit": 26,
        "approved_total": 8,
        "overdue_pending": 31,
        "high_variance": 30,
        "max_variance": 53240
      },
      "top_overdue": [
        {
          "id": "b6540721-9416-4a3a-a7e1-7fa3aaa2ab7e",
          "branch_id": 2,
          "branch_name": "BOMET TOWN",
          "status": "pending_audit",
          "log_date": "2026-06-18T21:00:00.000Z",
          "updated_at": "2026-06-28T10:53:15.939Z",
          "submitted_at": "2026-06-23T06:31:07.753Z",
          "variance": 41480
        }
      ]
    },
    "stock_takes": {
      "summary": {
        "open": 10,
        "completed": 0,
        "completed_recent": 0,
        "completed_stale": 0,
        "high_variance_recent": 0,
        "max_variance": 0,
        "last_completed_at": null
      },
      "branches_missing_recent": [
        {
          "branch_id": 2,
          "branch_name": "BOMET TOWN",
          "last_completed_at": null
        }
      ],
      "top_variances": []
    },
    "cashier_shifts": {
      "summary": {
        "open_or_flagged": 0,
        "closed": 0,
        "overdue_open": 0,
        "high_variance_recent": 0,
        "total_abs_variance": 0
      }
    },
    "discrepancy_flags": {
      "summary": {
        "open": 20,
        "investigating": 0,
        "resolved": 0,
        "dismissed": 0,
        "critical": 1,
        "overdue_open": 0
      },
      "recent": [
        {
          "id": "f13b...",
          "branch_id": 2,
          "branch_name": "BOMET TOWN",
          "flag_type": "CASHIER_LOGBOOK_VARIANCE",
          "severity": "high",
          "status": "open",
          "description": "Cashier logbook variance of KES 41,480",
          "metadata": { "cashier_logbook_id": "..." },
          "created_at": "2026-07-02T08:20:16.194Z"
        }
      ]
    },
    "audit_exceptions": {
      "summary": {
        "open": 0,
        "critical": 0,
        "last_detected_at": null
      }
    },
    "food_control": {
      "summary": {
        "total_items": 12,
        "critical": 4,
        "requires_explanation": 6,
        "unresolved_value": 182350,
        "latest_shift": 8125
      },
      "top_variances": [
        {
          "id": "94ac...",
          "branch_id": 2,
          "branch_name": "BOMET TOWN",
          "variance_value": 48500,
          "variance_pct": 42.5,
          "variance_date": "2026-07-05",
          "reference_type": "POS",
          "item_sku": "KIT-001",
          "status": "critical"
        }
      ]
    },
    "inventory_governance": {
      "summary": {
        "open_alerts": 18,
        "critical_alerts": 3,
        "pending_adjustments": 5,
        "pending_dispatches": 4,
        "pending_requests": 6
      },
      "recent": [
        {
          "id": "inv-883",
          "exception_type": "critical_variance",
          "severity": "critical",
          "status": "open",
          "title": "Stock take variance: KIT-001",
          "description": "Variance KES 48,500 requires review",
          "source_table": "stock_take_investigations",
          "source_id": "883",
          "created_at": "2026-07-05T10:32:11.123Z"
        }
      ]
    },
    "financial_variance": {
      "summary": {
        "revenue_variance": -154000,
        "cash_variance": -32000,
        "banking_variance": -54000,
        "variance_pct": -12.4,
        "requires_explanation": true
      },
      "details": [
        {
          "component": "Revenue",
          "variance": -154000,
          "possible_causes": []
        }
      ]
    },
    "payroll_anomalies": {
      "summary": {
        "total_batches": 2,
        "flagged_batches": 1,
        "spike_flags": 3,
        "overtime_flags": 1,
        "duplicate_flags": 1
      },
      "flagged_staff": [
        {
          "staff_id": "STAFF-221",
          "staff_name": "John Kip",
          "flag_type": "spike",
          "detail": "Net pay increased 45% vs previous month",
          "batch_id": "payroll-batch-72"
        }
      ]
    }
  }
}
```

## Notes

- All date fields are ISO8601 strings.
- `variance` fields are absolute KES amounts; consuming clients should display currency/formatting.
- Missing optional tables (e.g., cashier shifts not enabled in an environment) return zeroed summaries with empty lists. Inventory governance and food control sections degrade gracefully if migrations/tables are absent (see `warnings` array in the response).
- For large dashboards, cache responses briefly (e.g., 60 seconds) to reduce load.
