#!/usr/bin/env python3

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')

supabase: Client = create_client(url, key)

print('=' * 80)
print('BOMET TOWN MAIN BAR - POST-UPDATE VERIFICATION')
print('=' * 80)

# Get outlet
outlets_response = supabase.table('pos_outlets').select('*').eq('branch_id', 2).eq('outlet_type', 'main_bar').execute()
outlet_id = outlets_response.data[0]['id']

# Get updated items
items_response = supabase.table('pos_outlet_items').select('*').eq('outlet_id', outlet_id).order('name').execute()
items = items_response.data

print(f"\n✅ Total items in BOMET TOWN Main Bar: {len(items)}")

# Check items with stock
items_with_stock = [item for item in items if float(item.get('current_stock', 0)) > 0]
print(f"✅ Items with stock levels set: {len(items_with_stock)}")

# Check items with cost prices
items_with_cost = [item for item in items if float(item.get('cost_price', 0)) > 0]
print(f"✅ Items with cost prices: {len(items_with_cost)}")

# Check items with selling prices
items_with_selling = [item for item in items if float(item.get('selling_price', 0)) > 0]
print(f"✅ Items with selling prices: {len(items_with_selling)}")

# Show sample updated items
print(f"\n📋 SAMPLE OF UPDATED ITEMS:")
print('-' * 80)
sample_items = ['SODA 500ML', 'TUSKER LARGER', 'GUINESS', 'HEINEKEN', 'KC 250ML', 'VODKA 250ML']

for item in items:
    if item['name'].upper() in [s.upper() for s in sample_items]:
        print(f"\n{item['name']}:")
        print(f"  Selling Price: KES {item.get('selling_price', 0)}")
        print(f"  Cost Price: KES {item.get('cost_price', 0)}")
        print(f"  Stock: {item.get('current_stock', 0)} units")
        margin = 0
        if float(item.get('selling_price', 0)) > 0 and float(item.get('cost_price', 0)) > 0:
            margin = ((float(item['selling_price']) - float(item['cost_price'])) / float(item['selling_price'])) * 100
        print(f"  Profit Margin: {margin:.1f}%")

# Show top 10 items by stock
print(f"\n📊 TOP 10 ITEMS BY STOCK LEVEL:")
print('-' * 80)
sorted_by_stock = sorted(items, key=lambda x: float(x.get('current_stock', 0)), reverse=True)[:10]
for i, item in enumerate(sorted_by_stock, 1):
    print(f"{i}. {item['name']}: {item.get('current_stock', 0)} units (Selling: KES {item.get('selling_price', 0)})")

# Calculate total inventory value
total_cost_value = sum(float(item.get('cost_price', 0)) * float(item.get('current_stock', 0)) for item in items)
total_selling_value = sum(float(item.get('selling_price', 0)) * float(item.get('current_stock', 0)) for item in items)

print(f"\n💰 INVENTORY VALUATION:")
print('-' * 80)
print(f"Total Cost Value: KES {total_cost_value:,.2f}")
print(f"Total Selling Value: KES {total_selling_value:,.2f}")
print(f"Potential Profit: KES {(total_selling_value - total_cost_value):,.2f}")
if total_selling_value > 0:
    print(f"Overall Margin: {((total_selling_value - total_cost_value) / total_selling_value * 100):.1f}%")

print(f"\n✅ UPDATE VERIFICATION COMPLETE!")
print('=' * 80)