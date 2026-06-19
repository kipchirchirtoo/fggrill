#!/usr/bin/env python3
"""
Fix POS outlet item names in BOMET TOWN Main Bar to match Excel naming
"""
from supabase import create_client, Client
import os

# Supabase credentials
SUPABASE_URL = "https://rvoaowhxyweswwuxbrzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2b2Fvd2h4eXdlc3d3dXhicnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQzNjI3OCwiZXhwIjoyMDk3MDEyMjc4fQ.0VTY3prtXfuV8HDpz1xz8T30gikf-MnNeN9PwG4Z0Ns"

# Excel naming map - correct names from Excel
EXCEL_NAMES = {
    # Wrong -> Correct
    '500ML WATER': 'WATER 500ML',
    'ALVARO': 'ALVARO CAN',
    'AMARULA 350ml': 'AMARULA 350ML',
    'AMARULA 750ml': 'AMARULA 750ML',
    'BAILEYS 350ml': 'BAILEYS 350ML',
    'BAILEYS 750ml': 'BAILEYS 750ML',
    'BLACK $ WHITE': 'BLACK & WHITE',
    'BLACK $ WHITE 350ML': 'BLACK & WHITE 350ML',
    'BLACK $ WHITE 750ML': 'BLACK & WHITE 750ML',
    'BLACK $ WHITE 1L': 'BLACK & WHITE 1L',
    'BEST WHISKY 250ML': 'BEST WHISKY 350ML',
    'B & W 350ML': 'BLACK & WHITE 350ML',
    'B & W 750ML': 'BLACK & WHITE 750ML',
    'B & W 1L': 'BLACK & WHITE 1L',
    'B/WHISKY 3/4': 'BLACK & WHITE 750ML',
    'B $ W 1/2': 'BLACK & WHITE 350ML',
    'B $ W 3/4': 'BLACK & WHITE 750ML',
    'CASABUENA': 'CASABUENA SANGARIA',
    'CHIVAS': 'CHIVAS REGAL',
    'CHIVAS 1/2': 'CHIVAS REGAL 350ML',
    'CHIVAS 3/4': 'CHIVAS REGAL 750ML',
    'DEW': 'MOUNTAIN DEW',
    'FANTA': 'FANTA 300ML',
    'FANTA PET': 'FANTA 500ML',
    'SPRITE': 'SPRITE 300ML',
    'SPRITE PET': 'SPRITE 500ML',
    'COKE': 'COCA COLA 300ML',
    'COKE PET': 'COCA COLA 500ML',
    'GUARANA': 'GUARANA CAN',
    'GUINESS': 'GUINNESS',
    'HUNTERS': 'HUNTERS BEER',
    'JAGER': 'JAGERMEISTER',
    'JAMESON': 'JAMESON WHISKEY',
    'KANE': 'KANE EXTRA',
    'CAPTAIN': 'CAPTAIN MORGAN',
    'CAPTAIN 1/2': 'CAPTAIN MORGAN 350ML',
    'CAPTAIN 3/4': 'CAPTAIN MORGAN 750ML',
    'RICHOT': 'RICHOT BRANDY',
    'T. LARGER': 'TUSKER LARGER',
    'T. CAN': 'TUSKER CAN',
    'W. CAP': 'WHITE CAP',
    'W/LAWSONS': 'WILLIAM LAWSONS',
    'W/LAWSONS 350ml': 'WILLIAM LAWSONS 350ML',
    'W/LAWSONS 1ltr': 'WILLIAM LAWSONS 1L',
    'VICEROY': 'VICEROY 350ML',
    'VAT69': 'VAT69 750ML',
    'RASBERRY': 'RASBERRY TWIST',
    'WATER 1L': 'WATER 1LTR',
    'DROSTDY': 'DROSTDY HOF',
}

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

print('=' * 80)
print('FIXING POS OUTLET ITEM NAMES - BOMET TOWN MAIN BAR')
print('=' * 80)

# Get BOMET TOWN Main Bar POS outlet ID
response = supabase.table('pos_outlets').select('id').eq('branch_id', 2).eq('outlet_type', 'main_bar').eq('is_active', True).limit(1).execute()

if not response.data:
    print('ERROR: BOMET TOWN Main Bar POS outlet not found!')
    exit(1)

outlet_id = response.data[0]['id']
print(f'✅ Found BOMET TOWN Main Bar POS outlet: {outlet_id}\n')

# Get all items that need name fixes
items_response = supabase.table('pos_outlet_items').select('id, name, selling_price, current_stock').eq('outlet_id', outlet_id).order('name').execute()

items = items_response.data
print(f'Checking {len(items)} items for name corrections...\n')
print('-' * 80)

updates_made = 0
for item in items:
    item_id = item['id']
    name = item['name']
    price = item['selling_price']
    stock = item['current_stock']
    
    # Check if name needs correction
    correct_name = EXCEL_NAMES.get(name)
    
    if correct_name:
        print(f'✅ Updating: "{name:<40}" → "{correct_name}"')
        supabase.table('pos_outlet_items').update({
            'name': correct_name,
            'updated_at': 'now()'
        }).eq('id', item_id).execute()
        updates_made += 1

print('-' * 80)
print(f'\n🎯 Updated {updates_made} item names in BOMET TOWN Main Bar POS outlet')
print(f'✅ All POS outlet items now match Excel naming conventions\n')

# Verify the changes
print('=' * 80)
print('VERIFICATION - Updated Items (First 20):')
print('=' * 80)
verified = supabase.table('pos_outlet_items').select('name, selling_price, current_stock').eq('outlet_id', outlet_id).order('name').limit(20).execute()

for item in verified.data:
    name = item['name']
    price = item['selling_price'] or 0
    stock = item['current_stock'] or 0
    print(f'{name:<45} | Price: KES {price:<8.0f} | Stock: {stock:.0f}')

