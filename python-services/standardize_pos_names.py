#!/usr/bin/env python3
"""
Standardize ALL POS outlet item names to match Excel format:
- Uppercase
- 350ML instead of 1/2
- 750ML instead of 3/4
- 1L instead of 1/4 (for small bottles like Bond 7)
"""
from supabase import create_client
import re

SUPABASE_URL = "https://rvoaowhxyweswwuxbrzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2b2Fvd2h4eXdlc3d3dXhicnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQzNjI3OCwiZXhwIjoyMDk3MDEyMjc4fQ.0VTY3prtXfuV8HDpz1xz8T30gikf-MnNeN9PwG4Z0Ns"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def standardize_name(name):
    """Convert name to Excel standard format"""
    # First convert to uppercase
    standardized = name.upper()
    
    # Replace fractions with ML sizes
    standardized = re.sub(r'\b1/2\b', '350ML', standardized)
    standardized = re.sub(r'\b3/4\b', '750ML', standardized)
    standardized = re.sub(r'\b1/4\b', '250ML', standardized)  # Small bottles
    standardized = re.sub(r'\b1L\b', '1LTR', standardized)
    standardized = re.sub(r'\b1LTR\b', '1L', standardized)  # Keep as 1L
    
    # Fix common abbreviations
    standardized = standardized.replace('ML', 'ML').replace('ml', 'ML')
    standardized = standardized.replace('LITER', 'L').replace('LITRE', 'L').replace('LTR', 'L')
    
    # Specific fixes
    standardized = standardized.replace('B/CREAM', 'BEST CREAM')
    standardized = standardized.replace('B/WHISKY', 'BEST WHISKY')
    standardized = standardized.replace('B&S', 'BLACK & WHITE')
    standardized = standardized.replace('H2O', 'WATER')
    standardized = standardized.replace('GUINESS', 'GUINNESS')
    standardized = standardized.replace('DROTDY', 'DROSTDY HOF')
    standardized = standardized.replace('CASABUENA', 'CASABUENA SANGARIA')
    standardized = standardized.replace('DESPARADO', 'DESPARADO')
    
    # Fix any double spaces
    standardized = re.sub(r'\s+', ' ', standardized).strip()
    
    return standardized

print('=' * 80)
print('STANDARDIZING POS OUTLET ITEM NAMES - BOMET TOWN MAIN BAR')
print('=' * 80)

# Get outlet
response = supabase.table('pos_outlets').select('id').eq('branch_id', 2).eq('outlet_type', 'main_bar').eq('is_active', True).limit(1).execute()
outlet_id = response.data[0]['id']
print(f'✅ Found outlet: {outlet_id}\n')

# Get all items
items_response = supabase.table('pos_outlet_items').select('id, name').eq('outlet_id', outlet_id).order('name').execute()
print(f'Processing {len(items_response.data)} items...\n')
print('-' * 80)

updated = 0
for item in items_response.data:
    item_id = item['id']
    old_name = item['name']
    new_name = standardize_name(old_name)
    
    if old_name != new_name:
        print(f'✅ "{old_name:<45}" → "{new_name}"')
        supabase.table('pos_outlet_items').update({
            'name': new_name
        }).eq('id', item_id).execute()
        updated += 1

print('-' * 80)
print(f'\n🎯 Updated {updated} item names')
print(f'✅ All names now in UPPERCASE with ML sizes (350ML, 750ML, 1L)\n')

# Show sample
print('=' * 80)
print('VERIFICATION - Sample of Standardized Names:')
print('=' * 80)
verified = supabase.table('pos_outlet_items').select('name, selling_price').eq('outlet_id', outlet_id).order('name').limit(30).execute()

for item in verified.data:
    print(f"{item['name']:<50} KES {item['selling_price'] or 0:.0f}")
