#!/usr/bin/env python3
"""
FORCE update POS outlet item names - Direct approach
"""
from supabase import create_client
import re
import time

SUPABASE_URL = "https://rvoaowhxyweswwuxbrzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2b2Fvd2h4eXdlc3d3dXhicnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQzNjI3OCwiZXhwIjoyMDk3MDEyMjc4fQ.0VTY3prtXfuV8HDpz1xz8T30gikf-MnNeN9PwG4Z0Ns"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def standardize_name(name):
    """Convert name to UPPERCASE with ML sizes"""
    # Convert to uppercase
    standardized = name.upper()
    
    # Replace fractions with ML
    standardized = re.sub(r'\b1/2\b', '350ML', standardized)
    standardized = re.sub(r'\b3/4\b', '750ML', standardized)
    standardized = re.sub(r'\b1/4\b', '250ML', standardized)
    
    # Fix abbreviations
    standardized = standardized.replace('B/CREAM', 'BEST CREAM')
    standardized = standardized.replace('B/WHISKY', 'BEST WHISKY')
    standardized = standardized.replace('B&S', 'BLACK & WHITE')
    standardized = standardized.replace('GUINESS', 'GUINNESS')
    standardized = standardized.replace('DROTDY', 'DROSTDY HOF')
    standardized = standardized.replace('CASABUENA', 'CASABUENA SANGARIA')
    standardized = standardized.replace('DESPARADO', 'DESPERADO')
    standardized = standardized.replace('H2O', 'WATER')
    standardized = standardized.replace('T. ', 'TUSKER ')
    standardized = standardized.replace('W. CAP', 'WHITE CAP')
    standardized = standardized.replace('JD ', 'JACK DANIELS ')
    standardized = standardized.replace('KC ', 'KENYA CANE ')
    standardized = standardized.replace('RED LABEL', 'JOHNNIE WALKER RED LABEL')
    standardized = standardized.replace('BLACK LABEL', 'JOHNNIE WALKER BLACK LABEL')
    standardized = standardized.replace('JW ', 'JOHNNIE WALKER ')
    standardized = standardized.replace('V&A', 'VICEROY & ACACIA')
    standardized = standardized.replace('S/RASPBERRY', 'SMIRNOFF RASPBERRY')
    
    # Clean up double spaces
    standardized = re.sub(r'\s+', ' ', standardized).strip()
    
    return standardized

print('=' * 90)
print('FORCE UPDATING POS OUTLET NAMES - BOMET TOWN MAIN BAR')
print('=' * 90)

# Get outlet
response = supabase.table('pos_outlets').select('id').eq('branch_id', 2).eq('outlet_type', 'main_bar').eq('is_active', True).limit(1).execute()
outlet_id = response.data[0]['id']
print(f'✅ Outlet ID: {outlet_id}\n')

# Get all items
items_response = supabase.table('pos_outlet_items').select('id, name').eq('outlet_id', outlet_id).execute()
print(f'Processing {len(items_response.data)} items...\n')
print('-' * 90)

updated_count = 0
for item in items_response.data:
    item_id = item['id']
    old_name = item['name']
    new_name = standardize_name(old_name)
    
    if old_name != new_name:
        print(f'🔄 Updating: {old_name:<45} → {new_name}')
        
        # Direct update with upsert
        result = supabase.table('pos_outlet_items').update({
            'name': new_name
        }).eq('id', item_id).execute()
        
        # Small delay to avoid rate limiting
        time.sleep(0.05)
        updated_count += 1

print('-' * 90)
print(f'\n✅ Updated {updated_count} items')

# Immediate verification
print('\n' + '=' * 90)
print('IMMEDIATE VERIFICATION:')
print('=' * 90)
time.sleep(1)  # Wait 1 second for DB to sync

verify = supabase.table('pos_outlet_items').select('name').eq('outlet_id', outlet_id).order('name').limit(20).execute()

for item in verify.data:
    has_issue = '/' in item['name'] or any(c.islower() for c in item['name'])
    marker = "❌" if has_issue else "✅"
    print(f'{marker} {item["name"]}')

print('=' * 90)
