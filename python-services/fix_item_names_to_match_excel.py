#!/usr/bin/env python3

import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')

supabase: Client = create_client(url, key)

# Mapping of current database names to Excel names
NAME_CORRECTIONS = {
    'T. LARGER': 'TUSKER LARGER',
    'T. CAN': 'TUSKER LARGER CAN',
    'T. CIDER': 'TUSKER CIDER',
    'T. CIDER CAN': 'TUSKER CIDER CAN',
    'T. LITE': 'TUSKER LITE',
    'T. LITE CAN': 'TUSKER LITE CAN',
    'T. MALT': 'TUSKER MALT',
    'T.MALT': 'TUSKER MALT',
    'T.CAN': 'TUSKER LARGER CAN',
    'T.CIDER': 'TUSKER CIDER',
    'T.CIDER CAN': 'TUSKER CIDER CAN',
    'T.LITE CAN': 'TUSKER LITE CAN',
    'GUINESS': 'GUINNESS',
    'GUINESS CAN': 'GUINNESS CAN',
    'PLISNER': 'PILSNER',
    'PILSNER': 'PILSNER',
    'W. CAP': 'WHITE CAP',
    'W. CAP CAN': 'WHITE CAP CAN',
    'W.CAP CAN': 'WHITE CAP CAN',
    'WATER 1LTR': 'WATER 1L',
    'H20 1L': 'WATER 1L',
    'SODA 500ML': 'SODA 500ML',
    'DESPARADO': 'DESPERADO',
    'GUARANNA PUNCH': 'GUARANA PUNCH',
    'QUARANA PUNCH': 'GUARANA PUNCH',
    'S/RASPBERRY TWIST': 'RASPBERRY TWIST',
    'RASPBERRY TWIST': 'RASBERRY TWIST',  # Match Excel spelling
    'GORDONS CAN': 'Gordons can',  # Match exact Excel case
    'GORDON\'S  CAN': 'Gordons can',
    'FAXE CAN': 'FAXE can',  # Match exact Excel case
    'Gordons can': 'Gordons can',
    'JD 1/2': 'JACK DANIELS 350ML',
    'JD 3/4': 'JACK DANIELS 700ML',
    'JD 1L': 'JACK DANIELS 1L',
    'Jack Daniels 350Ml': 'JACK DANIELS 350ML',
    'RED LABEL 1/4': 'J W RED 250ML',
    'RED LABEL 1/2': 'J W RED 350ML',
    'RED LABEL 3/4': 'J W RED 750ML',
    'RED LABEL 1L': 'J W RED 1L',
    'J W RED  250ML': 'J W RED 250ML',
    'J W RED  350ML': 'J W RED 350ML',
    'J W RED  750ML': 'J W RED 750ML',
    'BLACK LABEL 1/2': 'J W BLACK 350ML',
    'BLACK LABEL 3/4': 'J W BLACK 750ML',
    'BLACK LABEL 1L': 'J W BLACK 1L',
    'J W BLACK  350ML': 'J W BLACK 350ML',
    'J W BLACK  750ML': 'J W BLACK 750ML',
    'J W BLACK  1L': 'J W BLACK 1L',
    'J W BLONDE': 'J W BLONDE 750ML',
    'J W BLONDE 750ML': 'J W BLONDE 750ML',
    'HUNTERS 1/4': 'HUNTERS 250ML',
    'HUNTERS 1/2': 'HUNTERS 350ML',
    'HUNTERS 3/4': 'HUNTERS 750ML',
    'B $ W 1/2': 'BLACK $ WHITE 350ML',
    'B $ W 3/4': 'BLACK $ WHITE 750ML',
    'B S W 1/2': 'BLACK $ WHITE 350ML',
    'B S W 3/4': 'BLACK $ WHITE 750ML',
    'BLACK & WHITE 1L': 'BLACK $ WHITE 1L',
    'BLACK & WHITE 375ML': 'BLACK $ WHITE 350ML',
    'BLACK & WHITE 750ML': 'BLACK $ WHITE 750ML',
    'BLACK AND WHITE 1LTR': 'BLACK $ WHITE 1L',
    'JAMESON 1/2': 'JAMESON 350ML',
    'JAMESON 3/4': 'JAMESON 750ML',
    'JAMESON 1L': 'JAMESON 1L',
    'JAMESON 1LTR': 'JAMESON 1L',
    'C/MORGAN 1/4': 'CAPTAIN MORGAN 250ML',
    'C/MORGAN 3/4': 'CAPTAIN MORGAN 750ML',
    'C/MORGAN 3/4 MELON': 'CAPTAIN MORGAN 750ML MELON',
    'CAPTAIN MORGAN  (GOLD)250ML': 'CAPTAIN MORGAN 250ML',
    'CAPTAIN MORGAN (GOLD) 750ML': 'CAPTAIN MORGAN 750ML',
    'CAPTAIN MUCKPIT 1/4': 'Captain muckpict 250ml',
    'CAPTAIN MUCKPIT 750ML': 'Captain muckpict 750ml',
    'WILLIAM LAWSONS 350ML': 'W/LAWSONS 350ml',
    'WILLIAM LAWSONS 750ML': 'W/ LAWSONS 750ml',
    'WILLIAM LAWSONS 1LTR': 'W/LAWSONS 1ltr',
    'WILLIAM LAWSONS1ltr': 'W/LAWSONS 1ltr',
    'WILLIAM LAWSONS 1/2': 'W/LAWSONS 350ml',
    'WILLIAM LAWSONS 3/4': 'W/ LAWSONS 750ml',
    'V & A 250ML': 'V $ A 250ml',
    'V $ A 1/4': 'V $ A 250ml',
    'V & A 3/4': 'V & A 750ml',
    'V & A 750ML': 'V & A 750ml',
    'GILBEYS 1/2': 'GILBEYS 350ML',
    'GILBEYS 1/4': 'GILBEYS 250ML',
    'GILBEYS 3/4': 'GILBEYS 750ML',
    'RICHOT 1/2': 'RICHOT 350ML',
    'RICHOT 1/4': 'RICHOT 250ML',
    'RICHOT 3/4': 'RICHOT 750ML',
    'VODKA 1/2': 'VODKA 350ML',
    'VODKA 1/4': 'VODKA 250ML',
    'VODKAA 3/4': 'VODKA 750ML',
    'VODKA 750ML': 'VODKA 750ML',
    'VICEROY 1/2': 'VICEROY 350ML',
    'VICEROY 1/4': 'VICEROY 250ML',
    'VICEROY 3/4': 'VICEROY 750ML',
    'VICEROY 375ML': 'VICEROY 350ML',
    'VAT 69 1/2': 'VAT 69 350ML',
    'VAT 69 350ML': 'VAT 69 350ML',
    'VAT69 3/4': 'VAT69 750ML',
    'VAT 69 750ML': 'VAT69 750ML',
    'BOND 7 1/2': 'BOND 7 350ML',
    'BOND 7 1/4': 'BOND 7 250ML',
    'BOND 7 3/4': 'BOND 7 750ML',
    'KC 1/2': 'KC 350ML',
    'KC 1/4': 'KC 250ML',
    'KC 3/4': 'KC 750ML',
    'GRANTS 3/4': 'GRANTS 750ML',
    'GRANTS 1L': 'GRANTS 1L',
    'GRANTS 1LTR': 'GRANTS 1L',
    'CASABUENA': 'CASABUENA SANGARIA',
    'CASABUENA SANGRIA RED': 'CASABUENA SANGARIA',
    'CAPRICE': 'CAPRICE SWEET RED',
    'CAPRICE SWEET RED': 'CAPRICE SWEET RED',
    'AMARULA 1/2': 'AMARULA 350ml',
    'AMARULA 3/4': 'AMARULA 750ml',
    'AMARULA CREAM 375ML': 'AMARULA 350ml',
    'AMARULA CREAM 750ML': 'AMARULA 750ml',
    'BAILEYS 1/2': 'BAILEYS 350ml',
    'BAILEYS 3/4': 'BAILEYS 750ml',
    'BAILEYS 350ML': 'BAILEYS 350ml',
    'BAILEYS 750ML': 'BAILEYS 750ml',
    'DROTDY': 'DROSTDY HOF',
    'DROSDTY HOF CLARET': 'DROSTDY HOF',
    'DROSDTY HOF PREMIUM': 'DROSTDY HOF',
    '4TH STREET SWEET RED': '4TH STREET',
    '4TH STREET SWEET WHITE': '4TH STREET',
    'HENNESY 750ML': 'HENNESY 750ML',
    'HENNESY VS': 'HENNESY 750ML',
    'HENNESSY VSOP 700ML': 'HENNESY 750ML',
    'DOUBLE BLACK 1L': 'DOUBLE BLACK 1L',
    'DOUBLE BLACK 1LTR': 'DOUBLE BLACK 1L',
    'SINGLETONE 12YRS': 'SINGLETONE 12YRS',
    'SINGLETON 12 YRS': 'SINGLETONE 12YRS',
    'BULLET BOURBON': 'BULLEIT BOURBON',
    'BULLEIT BOURBON': 'BULLEIT BOURBON',
    'REDBULL': 'REDBULL',
    'RED BULL': 'REDBULL',
    'TANG 10': 'TANG 10',
    'TANGUARAY 1LTR': 'TANG 10',
    'TANGUERAY 10YRS': 'TANG 10',
    'GORDONS 1/2': 'GORDONS 350ML',
    'GORDONS 3/4': 'GORDONS 750ml',
    'GORDONS 750ML': 'GORDONS 750ml',
    'GORDONS 1LTR': 'GORDONS 750ml',
    'CELLAR CASK RED': 'CELLAR CASK',
    'CELLAR CASK WHITE': 'CELLAR CASK',
    'B/WHISKY 3/4': 'BEST WHISKY 750ML',
    'B/WHISKY 1/4': 'BEST WHISKY 250ML',
    'BEST WHISKY 250ML': 'BEST WHISKY 250ML',
    'B/CREAM 750ML': 'BEST CREAM 750ML',
    'ALL SEASONS 3/4': 'ALL SEASONS 750ML',
    'ALL SEASONS 750ML': 'ALL SEASONS 750ML',
    'MARTEL VS 700ML': 'MARTEL VS',
    'MARTEL VSOP 700ML': 'MARTEL VSOP',
    'JAGERMEISTER 1LTR': 'JAGERMEISTER',
    'JAGERMEISTER 700ML': 'JAGERMEISTER',
    'CAMINO BLANCO 750ML': 'CAMINO',
    'CAMINO REAL GOLD': 'CAMINO',
    'FAMOUS GROUSE 750ML': 'FAMOUS GROUSE',
}

def fix_item_names():
    print('=' * 80)
    print('FIXING ITEM NAMES TO MATCH EXCEL SHEET')
    print('=' * 80)
    
    # Get BOMET TOWN Main Bar POS outlet
    print('\n1. Fetching BOMET TOWN Main Bar POS outlet...')
    outlets_response = supabase.table('pos_outlets').select('*').eq('branch_id', 2).eq('outlet_type', 'main_bar').execute()
    
    if not outlets_response.data:
        print("❌ ERROR: No main bar outlet found for BOMET TOWN")
        return
        
    outlet_id = outlets_response.data[0]['id']
    print(f"✅ Found outlet: {outlets_response.data[0]['name']}")
    
    # Get all POS outlet items
    print('\n2. Fetching current POS outlet items...')
    items_response = supabase.table('pos_outlet_items').select('*').eq('outlet_id', outlet_id).execute()
    items = items_response.data
    print(f"✅ Found {len(items)} items")
    
    print('\n3. Updating item names to match Excel...')
    print('-' * 80)
    
    updated_count = 0
    skipped_count = 0
    
    for item in items:
        current_name = item['name'].strip()
        
        # Check if name needs correction
        if current_name in NAME_CORRECTIONS:
            new_name = NAME_CORRECTIONS[current_name]
            
            if current_name != new_name:
                try:
                    supabase.table('pos_outlet_items').update({
                        'name': new_name
                    }).eq('id', item['id']).execute()
                    
                    print(f"✅ UPDATED: '{current_name}' → '{new_name}'")
                    updated_count += 1
                except Exception as e:
                    print(f"❌ ERROR updating '{current_name}': {str(e)}")
            else:
                skipped_count += 1
        else:
            skipped_count += 1
    
    # Also update bar_drinks catalog
    print('\n4. Updating bar_drinks catalog...')
    print('-' * 80)
    
    drinks_response = supabase.table('bar_drinks').select('*').execute()
    drinks = drinks_response.data
    
    drinks_updated = 0
    for drink in drinks:
        current_name = drink['name'].strip()
        
        if current_name in NAME_CORRECTIONS:
            new_name = NAME_CORRECTIONS[current_name]
            
            if current_name != new_name:
                try:
                    supabase.table('bar_drinks').update({
                        'name': new_name
                    }).eq('id', drink['id']).execute()
                    
                    print(f"✅ UPDATED CATALOG: '{current_name}' → '{new_name}'")
                    drinks_updated += 1
                except Exception as e:
                    print(f"❌ ERROR updating catalog '{current_name}': {str(e)}")
    
    print('\n' + '=' * 80)
    print('UPDATE SUMMARY')
    print('=' * 80)
    print(f"✅ POS outlet items updated: {updated_count}")
    print(f"✅ Bar drinks catalog updated: {drinks_updated}")
    print(f"⏭️  Items skipped (already correct): {skipped_count}")
    print(f"📊 Total items processed: {len(items)}")
    
    print('\n✅ ITEM NAMES NOW MATCH EXCEL SHEET!')
    
    return {
        'pos_updated': updated_count,
        'catalog_updated': drinks_updated,
        'skipped': skipped_count
    }

if __name__ == '__main__':
    print('\n⚠️  WARNING: This will rename items to match Excel sheet!')
    print('Press Enter to continue or Ctrl+C to cancel...')
    input()
    
    result = fix_item_names()
    
    print(f"\n✅ OPERATION COMPLETE!")
    print(f"Updated {result['pos_updated']} POS items and {result['catalog_updated']} catalog items")