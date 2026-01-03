import os
from dotenv import load_dotenv
import json

# Set env vars manually
os.environ['SUPABASE_URL'] = 'https://utsvlihpudfraxzcmtle.supabase.co'
os.environ['SUPABASE_SERVICE_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY'

from finance.service import FinanceService

def verify_aggregation():
    service = FinanceService()
    
    print("--- Verifying Cash Flow ---")
    # Check raw date format
    raw_data = service.supabase.table('restaurant_orders').select('created_at').limit(1).execute().data
    if raw_data:
        print(f"Raw created_at format: '{raw_data[0]['created_at']}'")
    
    cash_flow = service.get_cash_flow({})
    print(f"Total Inflow: {cash_flow['summary']['totalInflow']}")
    print(f"Total Outflow: {cash_flow['summary']['totalOutflow']}")
    print(f"Net Cash Flow: {cash_flow['summary']['netCashFlow']}")
    print(f"Periods count: {len(cash_flow['periods'])}")
    for p in cash_flow['periods']:
        print(f"Period: {p['period']}, Inflow: {p['inflow']}, Net: {p['net']}")
    
    print("\n--- Verifying Profit & Loss ---")
    pl = service.get_profit_loss({})
    print(f"Revenue: {pl['revenue']}")
    print(f"Expenses: {pl['operatingExpenses'] + pl['costOfGoods'] + pl['otherExpenses']}")
    print(f"Net Profit: {pl['netProfit']}")
    
    print("\n--- Verifying KPIs ---")
    kpis = service.get_kpis('month')
    for kpi in kpis:
        print(f"{kpi['name']}: {kpi['value']} {kpi['unit']}")
        
    print("\n--- Verifying Forecast ---")
    forecast = service.get_forecast(3)
    for f in forecast:
        print(f"Month: {f['month']}, Revenue: {f['projectedRevenue']}, Profit: {f['projectedProfit']}")

    print("\n--- Verifying Budget Analysis ---")
    budgets = service.get_budget_analysis({})
    for b in budgets:
        print(f"Category: {b['category']}, Budget: {b['budgeted']}, Actual: {b['actual']}")

if __name__ == "__main__":
    verify_aggregation()
