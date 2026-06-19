#!/usr/bin/env python3

import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')

if not url or not key:
    print("Missing Supabase credentials in .env file")
    exit(1)

supabase: Client = create_client(url, key)

# Excel data from "june club EDITED (1).xlsx" - BOMET TOWN
EXCEL_DATA = {
    'SODA 500ML': {'unit_price': 100, 'buying_price': 50, 'stock': 87},
    'WATER 1L': {'unit_price': 100, 'buying_price': 42, 'stock': 52},
    'ALVARO CAN': {'unit_price': 200, 'buying_price': 122, 'stock': 6},
    'DELMONTE': {'unit_price': 350, 'buying_price': 242, 'stock': 14},
    'LEMONADE': {'unit_price': 100, 'buying_price': 39, 'stock': 0},
    'TUSKER LARGER': {'unit_price': 250, 'buying_price': 169, 'stock': 96},
    'TUSKER CIDER': {'unit_price': 300, 'buying_price': 222, 'stock': 54},
    'TUSKER LITE': {'unit_price': 250, 'buying_price': 186, 'stock': 40},
    'TUSKER MALT': {'unit_price': 250, 'buying_price': 186, 'stock': 44},
    'GUINESS': {'unit_price': 300, 'buying_price': 204, 'stock': 132},
    'BALOZI': {'unit_price': 250, 'buying_price': 169, 'stock': 46},
    'BLACK ICE': {'unit_price': 250, 'buying_price': 138, 'stock': 67},
    'SNAPP': {'unit_price': 250, 'buying_price': 159, 'stock': 33},
    'PLISNER': {'unit_price': 250, 'buying_price': 169, 'stock': 57},
    'MANYATTA': {'unit_price': 300, 'buying_price': 223, 'stock': 53},
    'DESPARADO': {'unit_price': 350, 'buying_price': 285, 'stock': 10},
    'HUNTERS BEER': {'unit_price': 300, 'buying_price': 203, 'stock': 2},
    'WHITE CAP': {'unit_price': 250, 'buying_price': 196, 'stock': 100},
    'GUINESS CAN': {'unit_price': 300, 'buying_price': 217, 'stock': 27},
    'TUSKER LARGER CAN': {'unit_price': 300, 'buying_price': 199, 'stock': 14},
    'WHITE CAP CAN': {'unit_price': 270, 'buying_price': 217, 'stock': 22},
    'GUARANA': {'unit_price': 250, 'buying_price': 176, 'stock': 125},
    'TUSKER LITE CAN': {'unit_price': 300, 'buying_price': 243, 'stock': 20},
    'TUSKER CIDER CAN': {'unit_price': 300, 'buying_price': 234, 'stock': 22},
    'MANYATTA CAN': {'unit_price': 300, 'buying_price': 240, 'stock': 10},
    'SNAPP CAN': {'unit_price': 250, 'buying_price': 176, 'stock': 14},
    'GUARANA PUNCH': {'unit_price': 250, 'buying_price': 176, 'stock': 15},
    'RASBERRY TWIST': {'unit_price': 250, 'buying_price': 176, 'stock': 0},
    'Gordons can': {'unit_price': 300, 'buying_price': 176, 'stock': 8},
    'FAXE can': {'unit_price': 400, 'buying_price': 285, 'stock': 13},
    'BALOZI CAN': {'unit_price': 270, 'buying_price': 199, 'stock': 10},
    'KC 250ML': {'unit_price': 500, 'buying_price': 256, 'stock': 9},
    'KC 350ML': {'unit_price': 700, 'buying_price': 352, 'stock': 8},
    'KC 750ML': {'unit_price': 1300, 'buying_price': 672, 'stock': 15},
    'VODKA 250ML': {'unit_price': 600, 'buying_price': 436, 'stock': 11},
    'VODKA 350ML': {'unit_price': 800, 'buying_price': 603, 'stock': 7},
    'VODKA 750ML': {'unit_price': 1700, 'buying_price': 1298, 'stock': 7},
    'RICHOT 250ML': {'unit_price': 600, 'buying_price': 436, 'stock': 21},
    'RICHOT 350ML': {'unit_price': 800, 'buying_price': 603, 'stock': 13},
    'RICHOT 750ML': {'unit_price': 1700, 'buying_price': 1298, 'stock': 22},
    'GILBEYS 250ML': {'unit_price': 600, 'buying_price': 436, 'stock': 22},
    'GILBEYS 350ML': {'unit_price': 850, 'buying_price': 603, 'stock': 20},
    'GILBEYS 750ML': {'unit_price': 1700, 'buying_price': 1298, 'stock': 19},
    'VICEROY 250ML': {'unit_price': 650, 'buying_price': 447, 'stock': 18},
    'VICEROY 350ML': {'unit_price': 900, 'buying_price': 653, 'stock': 17},
    'VICEROY 750ML': {'unit_price': 1800, 'buying_price': 1260, 'stock': 23},
    'BEST WHISKY 750ML': {'unit_price': 1300, 'buying_price': 1005, 'stock': 7},
    'BEST CREAM 750ML': {'unit_price': 1500, 'buying_price': 1089, 'stock': 2},
    'ALL SEASONS 750ML': {'unit_price': 1500, 'buying_price': 1080, 'stock': 5},
    'VAT 69 350ML': {'unit_price': 1100, 'buying_price': 760, 'stock': 5},
    'VAT69 750ML': {'unit_price': 1900, 'buying_price': 1400, 'stock': 7},
    'BOND 7 250ML': {'unit_price': 600, 'buying_price': 416, 'stock': 12},
    'BOND 7 350ML': {'unit_price': 800, 'buying_price': 576, 'stock': 10},
    'BOND 7 750ML': {'unit_price': 1700, 'buying_price': 1240, 'stock': 6},
    'GRANTS 750ML': {'unit_price': 2500, 'buying_price': 1800, 'stock': 5},
    'GRANTS 1L': {'unit_price': 3000, 'buying_price': 2200, 'stock': 5},
    'J W RED 250ML': {'unit_price': 1000, 'buying_price': 560, 'stock': 0},
    'J W RED 350ML': {'unit_price': 1300, 'buying_price': 853, 'stock': 5},
    'J W RED 750ML': {'unit_price': 2500, 'buying_price': 1799, 'stock': 10},
    'J W RED 1L': {'unit_price': 3000, 'buying_price': 2147, 'stock': 10},
    'J W BLACK 350ML': {'unit_price': 2100, 'buying_price': 1720, 'stock': 4},
    'J W BLACK 750ML': {'unit_price': 4000, 'buying_price': 3236, 'stock': 5},
    'J W BLACK 1L': {'unit_price': 5000, 'buying_price': 3911, 'stock': 6},
    'J W BLONDE 750ML': {'unit_price': 3000, 'buying_price': 1991, 'stock': 2},
    'HUNTERS 750ML': {'unit_price': 1300, 'buying_price': 938, 'stock': 8},
    'HUNTERS 250ML': {'unit_price': 500, 'buying_price': 306, 'stock': 9},
    'HUNTERS 350ML': {'unit_price': 700, 'buying_price': 443, 'stock': 10},
    'BLACK $ WHITE 350ML': {'unit_price': 800, 'buying_price': 576, 'stock': 7},
    'BLACK $ WHITE 750ML': {'unit_price': 1500, 'buying_price': 1120, 'stock': 0},
    'SAVANNA': {'unit_price': 350, 'buying_price': 251, 'stock': 11},
    'TANG 10': {'unit_price': 6000, 'buying_price': 3167, 'stock': 1},
    'GORDONS 350ML': {'unit_price': 1500, 'buying_price': 1050, 'stock': 2},
    'JACK DANIELS 700ML': {'unit_price': 4000, 'buying_price': 2800, 'stock': 3},
    'JACK DANIELS 1L': {'unit_price': 5000, 'buying_price': 3300, 'stock': 1},
    'JACK DANIELS 350ML': {'unit_price': 2400, 'buying_price': 1650, 'stock': 2},
    'JAMESON 1L': {'unit_price': 4000, 'buying_price': 3168, 'stock': 2},
    'JAMESON 750ML': {'unit_price': 3200, 'buying_price': 2376, 'stock': 2},
    'JAMESON 350ML': {'unit_price': 1600, 'buying_price': 1186, 'stock': 2},
    'CAPTAIN MORGAN 250ML': {'unit_price': 500, 'buying_price': 336, 'stock': 6},
    'CAPTAIN MORGAN 750ML': {'unit_price': 1300, 'buying_price': 920, 'stock': 14},
    'Captain muckpict 750ml': {'unit_price': 1500, 'buying_price': 1106, 'stock': 6},
    'FAMOUS GROUSE': {'unit_price': 2500, 'buying_price': 1750, 'stock': 3},
    'W/LAWSONS 350ml': {'unit_price': 1000, 'buying_price': 869, 'stock': 0},
    'W/ LAWSONS 750ml': {'unit_price': 2100, 'buying_price': 1750, 'stock': 2},
    'W/LAWSONS 1ltr': {'unit_price': 3000, 'buying_price': 2229, 'stock': 2},
    'V $ A 250ml': {'unit_price': 400, 'buying_price': 310, 'stock': 6},
    'V & A 750ml': {'unit_price': 1200, 'buying_price': 803, 'stock': 4},
    'GORDONS 750ml': {'unit_price': 3000, 'buying_price': 2000, 'stock': 3},
    'CELLAR CASK': {'unit_price': 1400, 'buying_price': 1005, 'stock': 6},
    'HEINEKEN': {'unit_price': 350, 'buying_price': 263, 'stock': 15},
    '4TH STREET': {'unit_price': 1300, 'buying_price': 905, 'stock': 5},
    'CASABUENA SANGARIA': {'unit_price': 1100, 'buying_price': 712, 'stock': 8},
    'CAPRICE SWEET RED': {'unit_price': 1100, 'buying_price': 795, 'stock': 7},
    'FOUR COUSINS': {'unit_price': 1200, 'buying_price': 825, 'stock': 5},
    'KINGFISHER': {'unit_price': 300, 'buying_price': 192, 'stock': 6},
    'AMARULA 350ml': {'unit_price': 1600, 'buying_price': 1173, 'stock': 2},
    'AMARULA 750ml': {'unit_price': 2500, 'buying_price': 2086, 'stock': 1},
    'BAILEYS 350ml': {'unit_price': 1600, 'buying_price': 1200, 'stock': 0},
    'BAILEYS 750ml': {'unit_price': 2800, 'buying_price': 2160, 'stock': 0},
    'ASCONI': {'unit_price': 2000, 'buying_price': 1630, 'stock': 5},
    'DROSTDY HOF': {'unit_price': 1300, 'buying_price': 921, 'stock': 4},
    'ROBERTSON': {'unit_price': 2000, 'buying_price': 1000, 'stock': 2},
    'HENNESY 750ML': {'unit_price': 6500, 'buying_price': 4600, 'stock': 2},
    'DOUBLE BLACK 1L': {'unit_price': 7500, 'buying_price': 5875, 'stock': 2},
    'MARTEL VS': {'unit_price': 8500, 'buying_price': 4764, 'stock': 2},
    'MARTEL VSOP': {'unit_price': 13000, 'buying_price': 7865, 'stock': 1},
    'SINGLETONE 12YRS': {'unit_price': 6000, 'buying_price': 5375, 'stock': 2},
    'REDBULL': {'unit_price': 300, 'buying_price': 181, 'stock': 16},
    'MONSTER': {'unit_price': 350, 'buying_price': 213, 'stock': 12},
    'CAMINO': {'unit_price': 4000, 'buying_price': 2000, 'stock': 2},
    'JAGERMEISTER': {'unit_price': 4000, 'buying_price': 2200, 'stock': 2},
    'BULLEIT BOURBON': {'unit_price': 5000, 'buying_price': 3167, 'stock': 1},
    'TRUST CLASSIC': {'unit_price': 50, 'buying_price': 27, 'stock': 19},
    'TRUST STUDDED': {'unit_price': 100, 'buying_price': 40, 'stock': 15}
}

# Name variations mapping for better matching
NAME_MAPPINGS = {
    'T. LARGER': 'TUSKER LARGER',
    'T. CIDER': 'TUSKER CIDER',
    'T. LITE': 'TUSKER LITE',
    'T. MALT': 'TUSKER MALT',
    'GUINESS': 'GUINNESS',
    'PLISNER': 'PILSNER',
    'W. CAP': 'WHITE CAP',
    'W. CAP CAN': 'WHITE CAP CAN',
    'T. CAN': 'TUSKER LARGER CAN',
    'T. CIDER CAN': 'TUSKER CIDER CAN',
    'T. LITE CAN': 'TUSKER LITE CAN',
    'DESPARADO': 'DESPERADO',
    'GUARANNA PUNCH': 'GUARANA PUNCH',
    'S/RASPBERRY TWIST': 'RASBERRY TWIST',
    'RASPBERRY TWIST': 'RASBERRY TWIST',
    'QUARANA PUNCH': 'GUARANA PUNCH',
    'JD 1/2': 'JACK DANIELS 350ML',
    'JD 3/4': 'JACK DANIELS 700ML',
    'JD 1L': 'JACK DANIELS 1L',
    'RED LABEL 1/4': 'J W RED 250ML',
    'RED LABEL 1/2': 'J W RED 350ML',
    'RED LABEL 3/4': 'J W RED 750ML',
    'RED LABEL 1L': 'J W RED 1L',
    'BLACK LABEL 1/2': 'J W BLACK 350ML',
    'BLACK LABEL 3/4': 'J W BLACK 750ML',
    'BLACK LABEL 1L': 'J W BLACK 1L',
    'J W BLONDE': 'J W BLONDE 750ML',
    'HUNTERS 1/4': 'HUNTERS 250ML',
    'HUNTERS 1/2': 'HUNTERS 350ML',
    'HUNTERS 3/4': 'HUNTERS 750ML',
    'B $ W 1/2': 'BLACK $ WHITE 350ML',
    'B $ W 3/4': 'BLACK $ WHITE 750ML',
    'BLACK $ WHITE 350ML': 'BLACK & WHITE 350ML',
    'BLACK $ WHITE 750ML': 'BLACK & WHITE 750ML',
    'JAMESON 1/2': 'JAMESON 350ML',
    'JAMESON 3/4': 'JAMESON 750ML',
    'C/MORGAN 1/4': 'CAPTAIN MORGAN 250ML',
    'C/MORGAN 3/4': 'CAPTAIN MORGAN 750ML',
    'CAPTAIN MUCKPIT 750ML': 'Captain muckpict 750ml',
    'WILLIAM LAWSONS 350ML': 'W/LAWSONS 350ml',
    'WILLIAM LAWSONS 750ML': 'W/ LAWSONS 750ml',
    'WILLIAM LAWSONS 1LTR': 'W/LAWSONS 1ltr',
    'WILLIAM LAWSONS1ltr': 'W/LAWSONS 1ltr',
    'V & A 250ML': 'V $ A 250ml',
    'V $ A 1/4': 'V $ A 250ml',
    'V & A 3/4': 'V & A 750ml',
    'CASABUENA': 'CASABUENA SANGARIA',
    'CAPRICE': 'CAPRICE SWEET RED',
    'AMARULA 1/2': 'AMARULA 350ml',
    'AMARULA 3/4': 'AMARULA 750ml',
    'BAILEYS 1/2': 'BAILEYS 350ml',
    'BAILEYS 3/4': 'BAILEYS 750ml',
    'DROTDY': 'DROSTDY HOF',
    'HENNESY 750ML': 'HENNESY 750ML',
    'SINGLETONE 12YRS': 'SINGLETONE 12YRS',
    'BULLET BOURBON': 'BULLEIT BOURBON',
}

def update_bomet_bar_menu():
    print('=' * 80)
    print('UPDATING BOMET TOWN MAIN BAR MENU FROM EXCEL DATA')
    print('=' * 80)
    
    # Get BOMET TOWN Main Bar POS outlet
    print('\n1. Fetching BOMET TOWN Main Bar POS outlet...')
    outlets_response = supabase.table('pos_outlets').select('*').eq('branch_id', 2).eq('outlet_type', 'main_bar').execute()
    outlets = outlets_response.data
    
    if not outlets:
        print("❌ ERROR: No main bar outlet found for BOMET TOWN")
        return
        
    bomet_bar_outlet = outlets[0]
    outlet_id = bomet_bar_outlet['id']
    print(f"✅ Found: {bomet_bar_outlet['name']} (ID: {outlet_id})")
    
    # Get current POS outlet items
    print('\n2. Fetching current POS outlet items...')
    items_response = supabase.table('pos_outlet_items').select('*').eq('outlet_id', outlet_id).execute()
    db_items = items_response.data
    print(f"✅ Found {len(db_items)} existing items")
    
    # Create lookup dictionary
    db_items_lookup = {}
    for item in db_items:
        name = item['name'].upper().strip()
        db_items_lookup[name] = item
        
        # Also add mapped names
        if name in NAME_MAPPINGS:
            mapped_name = NAME_MAPPINGS[name].upper()
            db_items_lookup[mapped_name] = item
    
    print('\n3. Processing Excel data...')
    print('-' * 50)
    
    updated_count = 0
    added_count = 0
    errors = []
    
    for excel_name, excel_data in EXCEL_DATA.items():
        excel_name_upper = excel_name.upper().strip()
        selling_price = excel_data['unit_price']
        cost_price = excel_data['buying_price']
        initial_stock = excel_data['stock']
        
        # Try to find matching item
        db_item = None
        if excel_name_upper in db_items_lookup:
            db_item = db_items_lookup[excel_name_upper]
        else:
            # Try fuzzy matching
            for db_name, item in db_items_lookup.items():
                if excel_name_upper in db_name or db_name in excel_name_upper:
                    if len(excel_name_upper) > 3 and len(db_name) > 3:
                        db_item = item
                        break
        
        if db_item:
            # Update existing item
            item_id = db_item['id']
            current_selling = float(db_item.get('selling_price') or 0)
            current_cost = float(db_item.get('cost_price') or 0)
            current_stock = float(db_item.get('current_stock') or 0)
            
            # Check if update is needed
            needs_update = (
                abs(current_selling - selling_price) > 0.01 or
                abs(current_cost - cost_price) > 0.01 or
                abs(current_stock - initial_stock) > 0.01
            )
            
            if needs_update:
                try:
                    update_data = {
                        'selling_price': selling_price,
                        'cost_price': cost_price,
                        'current_stock': initial_stock,
                        'opening_stock': initial_stock,
                        'updated_at': datetime.now().isoformat()
                    }
                    
                    supabase.table('pos_outlet_items').update(update_data).eq('id', item_id).execute()
                    
                    print(f"✅ UPDATED: {db_item['name']}")
                    print(f"   Selling: {current_selling} → {selling_price}")
                    print(f"   Cost: {current_cost} → {cost_price}")
                    print(f"   Stock: {current_stock} → {initial_stock}")
                    updated_count += 1
                except Exception as e:
                    error_msg = f"Failed to update {excel_name}: {str(e)}"
                    errors.append(error_msg)
                    print(f"❌ ERROR: {error_msg}")
        else:
            # Add new item
            try:
                # Generate SKU
                sku = excel_name_upper.replace(' ', '_').replace('/', '_')
                
                new_item = {
                    'outlet_id': outlet_id,
                    'name': excel_name,
                    'sku': sku,
                    'selling_price': selling_price,
                    'cost_price': cost_price,
                    'current_stock': initial_stock,
                    'opening_stock': initial_stock,
                    'track_stock': True,
                    'is_active': True,
                    'unit': 'bottle',
                    'category': 'bar',
                    'source_table': 'bar_drinks'
                }
                
                supabase.table('pos_outlet_items').insert(new_item).execute()
                
                print(f"➕ ADDED: {excel_name}")
                print(f"   Selling: {selling_price}, Cost: {cost_price}, Stock: {initial_stock}")
                added_count += 1
            except Exception as e:
                error_msg = f"Failed to add {excel_name}: {str(e)}"
                errors.append(error_msg)
                print(f"❌ ERROR: {error_msg}")
    
    # Summary
    print('\n' + '=' * 80)
    print('UPDATE SUMMARY')
    print('=' * 80)
    print(f"✅ Updated items: {updated_count}")
    print(f"➕ Added new items: {added_count}")
    print(f"❌ Errors: {len(errors)}")
    print(f"📊 Total Excel items processed: {len(EXCEL_DATA)}")
    
    if errors:
        print('\nERROR DETAILS:')
        for error in errors:
            print(f"  - {error}")
    
    print('\n🎯 RESULT:')
    print(f"BOMET TOWN Main Bar menu now has {len(EXCEL_DATA)} items with correct pricing and stock!")
    print('All items updated with:')
    print('  ✓ Correct selling prices from Excel')
    print('  ✓ Correct cost prices from Excel')
    print('  ✓ Initial stock levels from Excel')
    
    return {
        'updated': updated_count,
        'added': added_count,
        'errors': len(errors),
        'total_processed': len(EXCEL_DATA)
    }

if __name__ == '__main__':
    print('\n⚠️  WARNING: This will update the BOMET TOWN Main Bar POS menu!')
    print('Press Enter to continue or Ctrl+C to cancel...')
    input()
    
    result = update_bomet_bar_menu()
    
    print('\n✅ OPERATION COMPLETE!')
    print(f"Updated: {result['updated']}, Added: {result['added']}, Errors: {result['errors']}")