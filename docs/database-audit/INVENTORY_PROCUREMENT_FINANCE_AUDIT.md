# Inventory, Procurement, Finance, POS And Governance Audit

Generated: 2026-06-14T16:30:53.317Z

| Domain |Missing Tables/Views |Missing Columns |Missing Indexes |Critical Findings |
| --- |--- |--- |--- |--- |
| Inventory |72 |1242 |222 |1238 |
| Procurement/AP |21 |315 |72 |281 |
| Finance/Cashier |44 |799 |98 |329 |
| POS/Outlet |44 |699 |126 |386 |
| Audit/Governance |26 |364 |51 |17 |

## Notes

- Inventory and procurement fixes must preserve journal-ledger movement rules.
- Supplier/payment fixes should prefer existing `store_supplier_*` tables over duplicate legacy AP tables.
- POS/outlet fixes must preserve branch isolation and avoid cross-branch outlet names.
