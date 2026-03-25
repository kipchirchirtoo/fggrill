import os
from dotenv import load_dotenv
load_dotenv()

import sys
sys.path.insert(0, '.')
from reports.database_fetcher import DatabaseFetcher

fetcher = DatabaseFetcher()
data = fetcher.fetch_report_data('revenue_reconciliation', {
    'start_date': '2026-01-01',
    'end_date': '2026-03-24'
})

print(f"total_revenue (payments): {data['total_revenue']}")
print(f"sales (theoretical):      {data['sales']}")
print(f"variance:                 {data['variance']}")
print(f"transactions count:       {len(data['transactions'])}")
print(f"departments: {data['departments']}")
print(f"payment_modes: {data['payment_modes']}")
