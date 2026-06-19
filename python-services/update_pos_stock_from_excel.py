#!/usr/bin/env python3
"""
Update POS outlet stock levels to match Excel initial stock
"""
from supabase import create_client

SUPABASE_URL = "https://rvoaowhxyweswwuxbrzm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2b2Fvd2h4eXdlc3d3dXhicnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQzNjI3OCwiZXhwIjoyMDk3MDEyMjc4fQ.0VTY3prtXfuV8HDpz1xz8T30gikf-MnNeN9PwG4Z0Ns"

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Excel data: Item Name -> (unit_price, buying_price, stock)
EXCEL_DATA = {
    'SODA 500ML': (100, 50, 87),
    'WATER 1L': (100, 42, 52),
    'ALVARO CAN': (200, 122, 6),
    'DELMONTE': (350, 242, 14),
    'LEMONADE': (100, 39, 0),
    'TUSKER LARGER': (250, 169, 96),
    'TUSKER CIDER': (300, 222, 54),
    'TUSKER LITE': (250, 186, 40),
    'TUSKER MALT': (250, 186, 44),
    'GUINNESS': (300, 204, 132),
    'BALOZI': (250, 169, 46),
    'BLACK ICE': (250, 138, 67),
    'SNAPP': (250, 159, 33),
    'PILSNER': (250, 169, 57),
    'MANYATTA': (300, 223, 53),
    'DESPARADO': (350, 285, 10),
    'HUNTERS BEER': (300, 203, 2),
    'WHITE CAP': (250, 196, 100),
    'GUINNESS CAN': (300, 217, 27),
    'TUSKER LARGER CAN': (300, 199, 14),
    'WHITE CAP CAN': (270, 217, 22),
    'BLACK ICE': (250, 176, 14),
    'GUARANA': (250, 176, 125),
    'TUSKER LITE CAN': (300, 243, 20),
    'TUSKER CIDER CAN': (300, 234, 22),
    'MANYATTA CAN': (300, 240, 10),
    'SNAPP CAN': (250, 176, 14),
    'GUARANA PUNCH': (250, 176, 15),
    'RASBERRY TWIST': (250, 176, 0),
    'GORDONS CAN': (300, 176, 8),
    'FAXE CAN': (400, 285, 13),
    'BALOZI CAN': (270, 199, 10),
    'KC 250ML': (500, 256, 9),
    'KC 350ML': (700, 352, 8),
    'KC 750ML': (1300, 672, 15),
    'VODKA 250ML': (600, 436, 11),
    'VODKA 350ML': (800, 603, 7),
    'VODKA 750ML': (1700, 1298, 7),
    'RICHOT 250ML': (600, 436, 21),
    'RICHOT 350ML': (800, 603, 13),
    'RICHOT 750ML': (1700, 1298, 22),
    'GILBEYS 250ML': (600, 436, 22),
    'GILBEYS 350ML': (850, 603, 20),
    'GILBEYS 750ML': (1700, 1298, 19),
    'VICEROY 250ML': (650, 447, 18),
    'VICEROY 350ML': (900, 653, 17),
    'VICEROY 750ML': (1800, 1260, 23),
    'BEST WHISKY 750ML': (1300, 1005, 7),
    'BEST CREAM 750ML': (1500, 1089, 2),
    'ALL SEASONS 750ML': (1500, 1080, 5),
    'VAT 69 350ML': (1100, 760, 5),
    'VAT69 750ML': (1900, 1400, 7),
    'BOND 7 250ML': (600, 416, 12),
    'BOND 7 350ML': (800, 576, 10),
    'BOND 7 750ML': (1700, 1240, 6),
    'GRANTS 750ML': (2500, 1800, 5),
    'GRANTS 1L': (3000, 2200, 5),
    'RED LABEL 250ML': (1000, 560, 0),
    'RED LABEL 350ML': (1300, 853, 5),
    'RED LABEL 750ML': (2500, 1799, 10),
    'RED LABEL 1L': (3000, 2147, 10),
    'BLACK LABEL 350ML': (2100, 1720, 4),
    'BLACK LABEL 750ML': (4000, 3236, 5),
    'BLACK LABEL 1L': (5000, 3911, 6),
    'JW BLONDE 750ML': (3000, 1991, 2),
    'HUNTERS 750ML': (1300, 938, 8),
    'HUNTERS 250ML': (500, 306, 9),
    'HUNTERS 350ML': (700, 443, 10),
    'BLACK & WHITE 350ML': (800, 576, 7),
    'BLACK & WHITE 750ML': (1500, 1120, 0),
    'SAVANNA': (350, 251, 11),
    'TANG 10': (6000, 3167, 1),
    'GORDONS 350ML': (1500, 1050, 2),
    'JD 750ML': (4000, 2800, 3),
    'JD 1L': (5000, 3300, 1),
    'JD 350ML': (2400, 1650, 2),
    'JAMESON 1L': (4000, 3168, 2),
    'JAMESON 750ML': (3200, 2376, 2),
    'JAMESON 350ML': (1600, 1186, 2),
    'CAPTAIN MORGAN 250ML': (500, 336, 6),
    'CAPTAIN MORGAN 750ML': (1300, 920, 14),
    'CAPTAIN MORGAN 750ML MELON': (1500, 1106, 6),
    'FAMOUS GROUSE': (2500, 1750, 3),
    'WILLIAM LAWSONS 350ML': (1000, 869, 0),
    'WILLIAM LAWSONS 750ML': (2100, 1750, 2),
    'WILLIAM LAWSONS 1L': (3000, 2229, 2),
    'V&A 250ML': (400, 310, 6),
    'V&A 750ML': (1200, 803, 4),
    'GORDONS 750ML': (3000, 2000, 3),
    'CELLAR CASK': (1400, 1005, 6),
    'HEINEKEN': (350, 263, 15),
    '4TH STREET': (1300, 905, 5),
    'CASABUENA SANGARIA': (1100, 712, 8),
    'CAPRICE': (1100, 795, 7),
    'FOUR COUSINS': (1200, 825, 5),
    'KINGFISHER': (300, 192, 6),
    'AMARULA 350ML': (1600, 1173, 2),
    'AMARULA 750ML': (2500, 2086, 1),
    'BAILEYS 350ML': (1600, 1200, 0),
    'BAILEYS 750ML': (2800, 2160, 0),
    'ASCONI': (2000, 1630, 5),
    'DROSTDY HOF': (1300, 921, 4),
    'ROBERTSON': (2000, 1000, 2),
    'HENNESSY 750ML': (6500, 4600, 2),
    'DOUBLE BLACK 1L': (7500, 5875, 2),
    'MARTEL VS': (8500, 4764, 2),
    'MARTEL VSOP': (13000, 7865, 1),
    'SINGLETONE 12YRS': (6000, 5375, 2),
    'REDBULL': (300, 181, 16),
    'MONSTER': (350, 213, 12),
    'CAMINO': (4000, 2000, 2),
    'JAGERMEISTER': (4000, 2200, 2),
    'BULLET BOURBON': (5000, 3167, 1),
    'TRUST CLASSIC': (50, 27, 19),
    'TRUST STUDDED': (100, 40, 15),
}

print('=' * 80)
print('UPDATING POS OUTLET STOCK FROM EXCEL - BOMET TOWN MAIN BAR')
print('=' * 80)

# Get outlet
response = supabase.table('pos_outlets').select('id').eq('branch_id', 2).eq('outlet_type', 'main_bar').eq('is_active', True).limit(1).execute()
outlet_id = response.data[0]['id']
print(f'✅ Found outlet: {outlet_id}\n')

# Get all current items
items_response = supabase.table('pos_outlet_items').select('id, name, current_stock, selling_price, cost_price').eq('outlet_id', outlet_id).execute()

print(f'Processing {len(items_response.data)} POS outlet items...\n')
print('-' * 80)

updated = 0
matched = 0
not_found = 0

for item in items_response.data:
    item_id = item['id']
    name = item['name']
    current_stock = item['current_stock'] or 0
    
    # Try to find in Excel data
    if name in EXCEL_DATA:
        excel_price, excel_cost, excel_stock = EXCEL_DATA[name]
        
        # Update stock, price, and cost
        supabase.table('pos_outlet_items').update({
            'current_stock': excel_stock,
            'selling_price': excel_price,
            'cost_price': excel_cost
        }).eq('id', item_id).execute()
        
        print(f'✅ {name:<45} Stock: {current_stock:.0f} → {excel_stock}')
        updated += 1
        matched += 1
    else:
        # Try fuzzy matching (in case of minor differences)
        fuzzy_match = None
        for excel_name in EXCEL_DATA.keys():
            if excel_name.replace(' ', '') == name.replace(' ', ''):
                fuzzy_match = excel_name
                break
        
        if fuzzy_match:
            excel_price, excel_cost, excel_stock = EXCEL_DATA[fuzzy_match]
            supabase.table('pos_outlet_items').update({
                'current_stock': excel_stock,
                'selling_price': excel_price,
                'cost_price': excel_cost
            }).eq('id', item_id).execute()
            print(f'✅ {name:<45} Stock: {current_stock:.0f} → {excel_stock} (fuzzy match)')
            updated += 1
            matched += 1
        else:
            not_found += 1
            if not_found <= 10:  # Only show first 10
                print(f'⚠️  {name:<45} (Not in Excel - keeping current stock)')

print('-' * 80)
print(f'\n📊 SUMMARY:')
print(f'   ✅ Matched and updated: {matched} items')
print(f'   ⚠️  Not found in Excel: {not_found} items')
print(f'   🎯 Total updated: {updated} items\n')

# Verify the changes
print('=' * 80)
print('VERIFICATION - Items with Stock:')
print('=' * 80)
verified = supabase.table('pos_outlet_items').select('name, selling_price, cost_price, current_stock').eq('outlet_id', outlet_id).gt('current_stock', 0).order('name').limit(30).execute()

total_value_cost = 0
total_value_selling = 0

for item in verified.data:
    name = item['name']
    price = item['selling_price'] or 0
    cost = item['cost_price'] or 0
    stock = item['current_stock'] or 0
    value = cost * stock
    total_value_cost += value
    total_value_selling += price * stock
    print(f"{name:<45} Stock: {stock:<6.0f} Cost: KES {cost:<8.0f} Value: KES {value:,.0f}")

print('-' * 80)
print(f"Total Inventory Value (Cost): KES {total_value_cost:,.0f}")
print(f"Total Inventory Value (Selling): KES {total_value_selling:,.0f}")
print(f"Potential Profit: KES {total_value_selling - total_value_cost:,.0f} ({((total_value_selling/total_value_cost - 1) * 100):.1f}%)")
print('=' * 80)
