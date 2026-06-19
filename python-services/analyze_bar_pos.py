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

def analyze_bar_pos():
    print('=' * 80)
    print('BAR POS OUTLET ANALYSIS - FAMOUSGATE HOTEL SYSTEM')
    print('=' * 80)

    try:
        # 1. Get all POS outlets (focus on bar outlets)
        print('\n1. POS OUTLETS CONFIGURATION')
        print('-' * 50)
        outlets_response = supabase.table('pos_outlets').select('*').order('branch_id, outlet_type').execute()
        outlets = outlets_response.data
        
        for outlet in outlets:
            print(f"Branch {outlet['branch_id']}: {outlet['name']} ({outlet['outlet_type']}) - Pin: {outlet.get('pin_prefix', 'N/A')}")

        # Filter main bar outlets
        main_bar_outlets = [o for o in outlets if o['outlet_type'] == 'main_bar']
        print(f"\nMain Bar Outlets Found: {len(main_bar_outlets)}")
        
        # 2. Get POS outlet items for main bar
        print('\n2. MAIN BAR POS OUTLET ITEMS')
        print('-' * 50)
        
        for outlet in main_bar_outlets:
            print(f"\nOutlet: {outlet['name']} (Branch {outlet['branch_id']})")
            
            items_response = supabase.table('pos_outlet_items').select('*').eq('outlet_id', outlet['id']).order('name').execute()
            items = items_response.data
            
            if items and len(items) > 0:
                print(f"Items: {len(items)}")
                for item in items:
                    cost = item.get('cost_price', 'N/A')
                    selling = item.get('selling_price', 'N/A')
                    stock = item.get('current_stock', 'N/A')
                    print(f"  - {item['name']}: Cost: {cost}, Selling: {selling}, Stock: {stock}")
            else:
                print('  No items found in this outlet')

        # 3. Get bar drinks catalog
        print('\n3. BAR DRINKS CATALOG')
        print('-' * 50)
        drinks_response = supabase.table('bar_drinks').select('*, category:bar_drink_categories(name)').order('name').execute()
        bar_drinks = drinks_response.data
        
        if bar_drinks and len(bar_drinks) > 0:
            print(f"Total Bar Drinks: {len(bar_drinks)}")
            for drink in bar_drinks:
                category_name = drink.get('category', {}).get('name', 'No category') if drink.get('category') else 'No category'
                cost = drink.get('cost_price', 'N/A')
                price = drink.get('price', 'N/A')
                print(f"  - {drink['name']} ({category_name}): Cost: {cost}, Price: {price}")
        else:
            print('No bar drinks found')

        # 4. Get bar stock/inventory
        print('\n4. BAR STOCK INVENTORY')
        print('-' * 50)
        try:
            stock_response = supabase.table('bar_stock').select('*, drink:bar_drinks(name, price, cost_price)').order('branch_id').execute()
            bar_stock = stock_response.data
            
            if bar_stock and len(bar_stock) > 0:
                print(f"Total Stock Items: {len(bar_stock)}")
                for stock in bar_stock:
                    drink_name = stock.get('drink', {}).get('name', 'Unknown') if stock.get('drink') else 'Unknown'
                    branch_id = stock.get('branch_id', 'N/A')
                    quantity = stock.get('quantity', 'N/A')
                    min_stock = stock.get('min_stock', 'N/A')
                    cost_per_unit = stock.get('cost_per_unit', 'N/A')
                    print(f"  - Branch {branch_id}: {drink_name} - Qty: {quantity}, Min: {min_stock}, Cost/Unit: {cost_per_unit}")
            else:
                print('No bar stock found')
        except Exception as e:
            print(f'Error accessing bar_stock: {str(e)}')

        # 5. Get bar drink categories
        print('\n5. BAR DRINK CATEGORIES')
        print('-' * 50)
        categories_response = supabase.table('bar_drink_categories').select('*').order('sort_order').execute()
        categories = categories_response.data
        
        if categories and len(categories) > 0:
            for cat in categories:
                print(f"  - {cat['name']} (Order: {cat.get('sort_order', 'N/A')})")
        else:
            print('No categories found')

        # 6. Check branches for context
        print('\n6. BRANCHES INFORMATION')
        print('-' * 50)
        try:
            branches_response = supabase.table('branches').select('id, name').execute()
            branches = branches_response.data
            
            if branches:
                for branch in branches:
                    print(f"  - Branch {branch['id']}: {branch['name']}")
        except Exception as e:
            print(f'Error accessing branches: {str(e)}')

        # 7. Excel data structure analysis
        print('\n7. EXCEL DATA STRUCTURE ANALYSIS')
        print('-' * 50)
        
        excel_items = [
            {'name': 'SODA 500ML', 'unit_price': 100, 'buying_price': 50, 'stock': 87},
            {'name': 'WATER 1L', 'unit_price': 100, 'buying_price': 42, 'stock': 52},
            {'name': 'ALVARO CAN', 'unit_price': 200, 'buying_price': 122, 'stock': 6},
            {'name': 'TUSKER LARGER', 'unit_price': 250, 'buying_price': 169, 'stock': 96},
            {'name': 'GUINESS', 'unit_price': 300, 'buying_price': 204, 'stock': 132}
        ]
        
        print('Excel contains BOMET TOWN bar items with:')
        print('- Item names (e.g., SODA 500ML, TUSKER LARGER, GUINESS)')
        print('- Unit price (selling price)')
        print('- Buying price (cost price)') 
        print('- Current stock levels')
        print('\nThis data needs to be matched with:')
        print('- pos_outlet_items for main bar outlets')
        print('- bar_drinks catalog')
        print('- bar_stock inventory levels')

        # 8. Data matching analysis
        print('\n8. DATA MATCHING OPPORTUNITIES')
        print('-' * 50)
        
        # Sample Excel data for matching
        excel_data = {
            'SODA 500ML': {'unit_price': 100, 'buying_price': 50, 'stock': 87},
            'WATER 1L': {'unit_price': 100, 'buying_price': 42, 'stock': 52},
            'TUSKER LARGER': {'unit_price': 250, 'buying_price': 169, 'stock': 96},
            'GUINESS': {'unit_price': 300, 'buying_price': 204, 'stock': 132},
            'TUSKER CIDER': {'unit_price': 300, 'buying_price': 222, 'stock': 54},
            'HEINEKEN': {'unit_price': 350, 'buying_price': 263, 'stock': 15},
        }
        
        print('Checking for matches between Excel and database items:')
        
        # Check against bar_drinks
        if bar_drinks:
            for drink in bar_drinks:
                drink_name = drink['name'].upper()
                for excel_name, excel_data in excel_data.items():
                    if excel_name in drink_name or any(word in drink_name for word in excel_name.split()):
                        print(f"  POSSIBLE MATCH: {drink['name']} <-> {excel_name}")
                        print(f"    DB: Cost={drink.get('cost_price', 'N/A')}, Price={drink.get('price', 'N/A')}")
                        print(f"    Excel: Cost={excel_data['buying_price']}, Price={excel_data['unit_price']}, Stock={excel_data['stock']}")
        
        # Check against pos_outlet_items
        all_pos_items = []
        for outlet in main_bar_outlets:
            items_response = supabase.table('pos_outlet_items').select('*').eq('outlet_id', outlet['id']).execute()
            all_pos_items.extend(items_response.data)
        
        if all_pos_items:
            print(f"\nChecking {len(all_pos_items)} POS outlet items against Excel data:")
            for item in all_pos_items:
                item_name = item['name'].upper()
                for excel_name, excel_data in excel_data.items():
                    if excel_name in item_name or any(word in item_name for word in excel_name.split()):
                        print(f"  POSSIBLE MATCH: {item['name']} <-> {excel_name}")
                        print(f"    DB: Cost={item.get('cost_price', 'N/A')}, Selling={item.get('selling_price', 'N/A')}, Stock={item.get('current_stock', 'N/A')}")
                        print(f"    Excel: Cost={excel_data['buying_price']}, Price={excel_data['unit_price']}, Stock={excel_data['stock']}")

    except Exception as error:
        print(f'Error analyzing bar POS: {str(error)}')
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    analyze_bar_pos()