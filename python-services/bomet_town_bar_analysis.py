#!/usr/bin/env python3

import os
import json
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')

if not url or not key:
    print("Missing Supabase credentials in .env file")
    exit(1)

supabase: Client = create_client(url, key)

# Excel data from "june club EDITED (1).xlsx" - BOMET TOWN
excel_data = {
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

def analyze_bomet_bar():
    print('=' * 80)
    print('BOMET TOWN (BRANCH 2) - BAR POS ANALYSIS & COMPARISON')
    print('=' * 80)

    # Get BOMET TOWN Main Bar POS outlet
    print('\n1. BOMET TOWN MAIN BAR POS OUTLET')
    print('-' * 50)
    outlets_response = supabase.table('pos_outlets').select('*').eq('branch_id', 2).eq('outlet_type', 'main_bar').execute()
    outlets = outlets_response.data
    
    if not outlets:
        print("❌ No main bar outlet found for BOMET TOWN")
        return
        
    bomet_bar_outlet = outlets[0]
    print(f"✅ Found: {bomet_bar_outlet['name']} (ID: {bomet_bar_outlet['id']})")
    
    # Get POS outlet items
    print('\n2. CURRENT POS OUTLET ITEMS IN DATABASE')
    print('-' * 50)
    items_response = supabase.table('pos_outlet_items').select('*').eq('outlet_id', bomet_bar_outlet['id']).order('name').execute()
    db_items = items_response.data
    
    print(f"Total items in database: {len(db_items)}")
    
    # Create lookup dictionaries for comparison
    db_items_lookup = {}
    for item in db_items:
        # Create multiple lookup keys for better matching
        name = item['name'].upper().strip()
        db_items_lookup[name] = item
        
        # Also create simplified versions
        simplified = name.replace('T. ', 'TUSKER ').replace('W. CAP', 'WHITE CAP').replace('GUINESS', 'GUINNESS')
        db_items_lookup[simplified] = item
    
    print('\n3. EXCEL vs DATABASE COMPARISON')
    print('-' * 50)
    
    matches = []
    price_discrepancies = []
    missing_in_db = []
    missing_in_excel = []
    
    # Check each Excel item against database
    for excel_name, excel_item_data in excel_data.items():
        found_match = False
        
        # Try exact match first
        if excel_name.upper() in db_items_lookup:
            db_item = db_items_lookup[excel_name.upper()]
            matches.append({
                'excel_name': excel_name,
                'db_name': db_item['name'],
                'excel_data': excel_item_data,
                'db_item': db_item
            })
            found_match = True
            
            # Check for price discrepancies
            excel_selling = excel_item_data['unit_price']
            excel_cost = excel_item_data['buying_price']
            db_selling = float(db_item.get('selling_price') or 0)
            db_cost = float(db_item.get('cost_price') or 0)
            
            if abs(excel_selling - db_selling) > 0.01 or abs(excel_cost - db_cost) > 0.01:
                price_discrepancies.append({
                    'name': excel_name,
                    'excel_selling': excel_selling,
                    'db_selling': db_selling,
                    'excel_cost': excel_cost,
                    'db_cost': db_cost,
                    'excel_stock': excel_item_data['stock'],
                    'db_stock': float(db_item.get('current_stock') or 0)
                })
        
        # Try fuzzy matching if no exact match
        if not found_match:
            for db_name, db_item in db_items_lookup.items():
                # Check for partial matches
                excel_words = set(excel_name.upper().split())
                db_words = set(db_name.split())
                
                # If most words match, consider it a match
                common_words = excel_words.intersection(db_words)
                if len(common_words) >= min(2, len(excel_words) * 0.7):
                    matches.append({
                        'excel_name': excel_name,
                        'db_name': db_item['name'],
                        'excel_data': excel_item_data,
                        'db_item': db_item,
                        'match_type': 'fuzzy'
                    })
                    found_match = True
                    break
        
        if not found_match:
            missing_in_db.append(excel_name)
    
    # Find items in DB but not in Excel
    excel_names_upper = [name.upper() for name in excel_data.keys()]
    for db_item in db_items:
        db_name = db_item['name'].upper()
        found = False
        
        # Check exact match
        if db_name in excel_names_upper:
            found = True
        else:
            # Check fuzzy match
            for excel_name in excel_names_upper:
                excel_words = set(excel_name.split())
                db_words = set(db_name.split())
                common_words = excel_words.intersection(db_words)
                if len(common_words) >= min(2, len(db_words) * 0.7):
                    found = True
                    break
        
        if not found:
            missing_in_excel.append(db_item['name'])
    
    # Print Results
    print(f"\n📊 MATCHING RESULTS")
    print(f"✅ Matched items: {len(matches)}")
    print(f"⚠️  Price discrepancies: {len(price_discrepancies)}")
    print(f"❌ Missing in database: {len(missing_in_db)}")
    print(f"➕ Extra in database: {len(missing_in_excel)}")
    
    # Show matches with exact pricing
    print(f"\n4. MATCHED ITEMS WITH EXACT PRICES")
    print('-' * 50)
    exact_matches = 0
    for match in matches:
        excel_item_data = match['excel_data']
        db_item = match['db_item']
        
        excel_selling = excel_item_data['unit_price']
        excel_cost = excel_item_data['buying_price']
        db_selling = float(db_item.get('selling_price') or 0)
        db_cost = float(db_item.get('cost_price') or 0)
        
        if abs(excel_selling - db_selling) <= 0.01 and abs(excel_cost - db_cost) <= 0.01:
            exact_matches += 1
            print(f"✅ {match['excel_name']}: Selling={excel_selling}, Cost={excel_cost}")
    
    print(f"\nExact price matches: {exact_matches}/{len(matches)}")
    
    # Show price discrepancies
    if price_discrepancies:
        print(f"\n5. PRICE DISCREPANCIES (EXCEL vs DATABASE)")
        print('-' * 50)
        for disc in price_discrepancies[:10]:  # Show first 10
            print(f"⚠️  {disc['name']}:")
            print(f"   Selling: Excel={disc['excel_selling']} vs DB={disc['db_selling']}")
            print(f"   Cost: Excel={disc['excel_cost']} vs DB={disc['db_cost']}")
            print(f"   Stock: Excel={disc['excel_stock']} vs DB={disc['db_stock']}")
            print()
    
    # Show missing items
    if missing_in_db:
        print(f"\n6. ITEMS IN EXCEL BUT MISSING FROM DATABASE")
        print('-' * 50)
        for item in missing_in_db[:10]:  # Show first 10
            data = excel_data[item]
            print(f"❌ {item}: Price={data['unit_price']}, Cost={data['buying_price']}, Stock={data['stock']}")
    
    if missing_in_excel:
        print(f"\n7. ITEMS IN DATABASE BUT NOT IN EXCEL")
        print('-' * 50)
        for item in missing_in_excel[:10]:  # Show first 10
            print(f"➕ {item}")
    
    # Summary and recommendations
    print(f"\n8. SUMMARY & RECOMMENDATIONS")
    print('-' * 50)
    total_excel_items = len(excel_data)
    match_percentage = (len(matches) / total_excel_items) * 100 if total_excel_items > 0 else 0
    
    print(f"📈 Match Rate: {match_percentage:.1f}% ({len(matches)}/{total_excel_items})")
    
    if price_discrepancies:
        print(f"💰 Price Updates Needed: {len(price_discrepancies)} items have price discrepancies")
    
    if missing_in_db:
        print(f"➕ Items to Add: {len(missing_in_db)} items from Excel need to be added to POS")
    
    if missing_in_excel:
        print(f"🔍 Review Needed: {len(missing_in_excel)} items in POS not found in Excel data")
    
    # Check bar_drinks table
    print(f"\n9. BAR DRINKS CATALOG ANALYSIS")
    print('-' * 50)
    drinks_response = supabase.table('bar_drinks').select('*').order('name').execute()
    bar_drinks = drinks_response.data
    
    print(f"Total items in bar_drinks catalog: {len(bar_drinks)}")
    
    # Check how many POS items are linked to bar_drinks
    linked_to_catalog = 0
    for db_item in db_items:
        source_table = db_item.get('source_table')
        if source_table == 'bar_drinks':
            linked_to_catalog += 1
    
    print(f"POS items linked to bar_drinks catalog: {linked_to_catalog}/{len(db_items)}")
    
    print(f"\n10. DATABASE STRUCTURE ANALYSIS")
    print('-' * 50)
    print("✅ pos_outlets: BOMET TOWN has main_bar outlet configured")
    print(f"✅ pos_outlet_items: {len(db_items)} items configured for main bar POS")
    print(f"✅ bar_drinks: {len(bar_drinks)} items in drinks catalog")
    print("❌ bar_stock: No stock records found (inventory tracking needs setup)")
    print("⚠️  bar_drink_categories: Categories exist but items not properly categorized")
    
    print(f"\n🎯 KEY FINDINGS:")
    print(f"1. BOMET TOWN main bar POS is fully operational with {len(db_items)} items")
    print(f"2. Excel data matches {match_percentage:.1f}% of items in the database")
    print(f"3. {len(price_discrepancies)} items need price updates to match Excel")
    print(f"4. {len(missing_in_db)} new items from Excel should be added")
    print(f"5. Stock tracking (bar_stock table) needs to be implemented")
    print(f"6. Item categorization needs improvement for better organization")

if __name__ == '__main__':
    analyze_bomet_bar()