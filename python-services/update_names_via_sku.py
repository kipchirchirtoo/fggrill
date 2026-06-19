#!/usr/bin/env python3
"""
Update POS outlet item names via SKU (unique constraint-safe approach)
"""
from supabase import create_client
import re

SUPABASE_URL = "https://rvoaowhxyweswwuxbrzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2b2Fvd2h4eXdlc3d3dXhicnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQzNjI3OCwiZXhwIjoyMDk3MDEyMjc4fQ.0VTY3prtXfuV8HDpz1xz8T30gikf-MnNeN9PwG4Z0Ns"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def standardize_name(name):
    """Convert name to UPPERCASE with ML sizes"""
    standardized = name.upper()
    
    # Replace fractions
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
    standardized = standardized.replace('T. ', 'TUSKER ')
    standardized = standardized.replace('W. CAP', 'WHITE CAP')
    
    # Clean up
    standardized = re.sub(r'\s+', ' ', standardized).strip()
    
    return standardized

print('=' * 100)
print('UPDATING POS OUTLET NAMES - APPROACH: Update by primary key (id)')
print('=' * 100)

# Get outlet
response = supabase.table('pos_outlets').select('id').eq('branch_id', 2).eq('outlet_type', 'main_bar').eq('is_active', True).limit(1).execute()
outlet_id = response.data[0]['id']
print(f'✅ Outlet ID: {outlet_id}\n')

# Get current state
items = supabase.table('pos_outlet_items').select('id, name, sku, menu_item_id').eq('outlet_id', outlet_id).order('name').execute()
print(f'Found {len(items.data)} items\n')

# Update each item individually by ID
print('-' * 100)
updated = 0
failed = 0

for item in items.data:
    old_name = item['name']
    new_name = standardize_name(old_name)
    
    if old_name != new_name:
        try:
            # Update by ID only - avoid unique constraint on outlet_id+sku
            result = supabase.table('pos_outlet_items')\
                .update({'name': new_name})\
                .eq('id', item['id'])\
                .execute()
            
            if result.data:
                print(f'✅ {old_name:<50} → {new_name}')
                updated += 1
            else:
                print(f'❌ FAILED: {old_name:<50} (No data returned)')
                failed += 1
                
        except Exception as e:
            print(f'❌ ERROR: {old_name:<50} - {str(e)}')
            failed += 1

print('-' * 100)
print(f'\n📊 Results:')
print(f'   ✅ Successfully updated: {updated}')
print(f'   ❌ Failed: {failed}')
print(f'   Total processed: {updated + failed}')

# Final verification - fresh query
print('\n' + '=' * 100)
print('FINAL VERIFICATION (Fresh Query):')
print('=' * 100)

verify = supabase.table('pos_outlet_items').select('name').eq('outlet_id', outlet_id).order('name').limit(30).execute()

for item in verify.data:
    name = item['name']
    has_fraction = '/' in name
    has_lowercase = any(c.islower() for c in name) 
    needs_fix = has_fraction or has_lowercase
    marker = "❌" if needs_fix else "✅"
    print(f'{marker} {name}')

print('=' * 100)
