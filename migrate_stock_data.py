import psycopg2
import json
import re

DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

# Data mapping
STOCK_DATA = {
    "CEREALS": {"cat": "food", "items": ["Kamande", "Makoroni", "Ndengu", "Rice", "Yellow beans", "Wheatabix", "Cornflakes"]},
    "SPICES": {"cat": "food", "items": ["Garam masala", "Black pepper", "Beef Masala", "Chicken Masala", "White pepper", "Ginger powder", "Garlic powder", "Paprika", "Egg yellow", "Pilau masala", "Pilau masala whole", "Turmeric", "Oregano", "Cardamoms", "Mayonnaise", "Curry powder", "Vanilla essence", "Fish masala", "Coconut milk", "Coconut cream", "Baking powder", "Mushroom can", "Dark soy sauce", "Light soy sauce", "Ketchup", "Chilli sauce", "Tomato sauce", "Tomato paste", "Tea masala", "Bi Carbonate", "Vinegar", "Cinnamon", "Royco cubes", "Yeast"]},
    "SPREADS": {"cat": "food", "items": ["Blueband", "Zesta (jam)", "Honey Carton"]},
    "VEGETABLES": {"cat": "food", "items": ["Beetroots", "Onions", "Tomatoes", "Cabbage", "Nduma", "Sweet potatoes", "Potatoes", "Carrots", "Lemon", "Ginger", "Hoho", "Spaghetti", "Indomie", "Butternut", "Garlic", "Watermelon", "Pawpaw"]},
    "OIL": {"cat": "food", "items": ["Cooking oil"]},
    "NON CONSUMABLES": {"cat": "amenities", "items": ["Air freshener", "Baycon", "Bella Tissues", "Kitchen rolls", "Cosy/Hannan tissue", "Jumbo Tissue", "Serviettes", "Hand towels", "Film", "Foil", "Thermal rolls"]},
    "SOAP": {"cat": "cleaning_supplies", "items": ["Toilet soap", "Bar soap", "Shower gel", "Hand wash", "Kitchen cleaner", "Glass cleaner"]},
    "DETERGENTS": {"cat": "cleaning_supplies", "items": ["Harpic", "Vim", "Toilet balls", "Jik", "Omo"]},
    "BEVERAGES": {"cat": "beverage", "items": ["Tea leaves", "Sugar", "Dormants"]},
    "SATCHETS": {"cat": "food", "items": ["Salt", "Nescafe", "Milo", "Sugar", "Tea bag", "Chilli sauce", "Tomato sauce"]},
    "FLOUR": {"cat": "food", "items": ["Exe All purpose", "Self raising", "Jogoo wimbi", "Familia wimbi", "Pure wimbi", "Ugali (Ajab)", "U-Mix", "Gram flour", "Attamack", "Corn flour"]},
    "PERISHABLE GOODS": {"cat": "food", "items": ["Milk packet", "Eggs", "Kuku kienyeji", "Broiler", "Sausage", "Chicken bites", "Smokie", "Beef", "Minced meat", "Bacon", "Mutton", "Fish", "Fillets", "Porkchops", "Mixed vegetables", "Mozzarella cheese"]},
    "FRUITS": {"cat": "food", "items": ["Bananas", "Mangoes", "Pineapples"]},
    "SOFT DRINKS / BEVERAGES": {"cat": "beverage", "items": ["Desperado", "Lemonade", "Faxe", "Delmonte (1L)", "Red Bull", "Monster", "Hunters Dry", "Hunters Gold", "Savan Cider", "Heineken"]},
    "GIN": {"cat": "beverage", "items": ["Gilbeys Gin 250ml", "Gilbeys Gin 350ml", "Gilbeys Gin 750ml", "Gordons 350ml", "Gordons Dry Gin", "Tangurey 10yrs"]},
    "BRANDY": {"cat": "beverage", "items": ["Viceroy 250ml", "Viceroy 350ml", "Viceroy 750ml", "Viceroy 10yrs 1L", "Richot 250ml", "Richot 350ml", "Richot 750ml"]},
    "VODKA": {"cat": "beverage", "items": ["Vodka 250ml", "Vodka 350ml", "Vodka 750ml"]},
    "SPIRITS": {"cat": "beverage", "items": ["KC 250ml", "KC 350ml", "KC 750ml", "KC Pineapple", "Ken Extra 250ml", "Ken Extra 750ml"]},
    "WHISKY": {"cat": "beverage", "items": ["Jameson 350ml", "Jameson 750ml", "Jameson 1L", "Vat 69 350ml", "Vat 69 750ml", "J.W Red 250", "J.W Red 375ml", "J.W Red 750ml", "J.W Blonde 750ml", "J.W Black 250", "J.W Black 375ml", "J.W Black 750ml", "Double Black 1L", "Bond 7 250ml", "Bond 7 350ml", "Bond 7 750ml", "Famous Grse 750ml", "Jack Daniels 350ml", "Jack Daniels 750ml", "Jack Daniels 1L", "W.Lossons 1/2", "W.Lossons 3/4", "W.Lossons 1L", "All Seasons 750ml", "Grants 350ml", "Grants 750ml", "Grants 1L", "Southern", "Black & White 350ml", "Black & White 750ml", "Hunters 250ml", "Hunters 350ml", "Hunters 750ml", "Best Whisky 250ml", "Best Cream 750ml", "Best Whisky 750ml", "Glenfiddich 12yrs", "Glenfiddich 15yrs", "Glenfiddich 18yrs"]},
    "COGNAC": {"cat": "beverage", "items": ["Singleton 12yrs", "Singleton 15yrs", "Singleton 8yrs", "Martel 750ml", "Martel VSOP", "Hennessy VSOP", "Hennessy 750ml"]},
    "LIQUOR": {"cat": "beverage", "items": ["Amarula 350", "Amarula 750", "Baileys 350", "Baileys 750", "V&A 350", "V&A 750"]},
    "OTHERS": {"cat": "beverage", "items": ["Jagermeister 750ml", "Jagermeister 1Ltr", "Camino", "Malibu", "Kingfisher", "4th Street"]},
    "WINE": {"cat": "beverage", "items": ["4th Street (Wine)"]}
}

def generate_sku(category, sub, item):
    cat_code = category[:3].upper()
    sub_code = sub[:3].upper().replace(" ", "")
    # Clean item name for SKU
    item_clean = re.sub(r'[^A-Z0-0]', '', item.upper())
    item_code = item_clean[:6]
    return f"FGH-{cat_code}-{sub_code}-{item_code}"

def migrate():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    
    try:
        total_count = sum(len(d['items']) for d in STOCK_DATA.values())
        print(f"Starting migration of {total_count} items...")
        
        count = 0
        skus_seen = set()
        
        for sub_cat, data in STOCK_DATA.items():
            sys_cat = data['cat']
            items = data['items']
            
            for item_name in items:
                sku = generate_sku(sys_cat, sub_cat, item_name)
                # Handle collisions
                orig_sku = sku
                suffix = 1
                while sku in skus_seen:
                    sku = f"{orig_sku}{suffix}"
                    suffix += 1
                skus_seen.add(sku)
                
                # Insert into simple_items
                cur.execute("""
                    INSERT INTO public.simple_items (
                        sku, item_name, description, category, quantity, 
                        is_active, is_master_item, unit_of_measure, 
                        retail_price, cost_price
                    )
                    VALUES (%s, %s, %s, %s, 0, true, true, 'units', 0.00, 0.00)
                    ON CONFLICT (sku) DO NOTHING
                """, (sku, item_name, item_name, sys_cat))
                
                # Insert into store_items
                cur.execute("""
                    INSERT INTO public.store_items (
                        item_code, sku, name, description, category, 
                        sub_category, current_stock, unit, is_active
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, 0, 'units', true)
                    ON CONFLICT (item_code) DO NOTHING
                """, (sku, sku, item_name, item_name, sys_cat, sub_cat))
                
                # Initialize branch stock for branch 1 and 9
                for b_id in [1, 9]:
                    cur.execute("""
                        INSERT INTO public.branch_stock (branch_id, item_sku, quantity)
                        VALUES (%s, %s, 0)
                        ON CONFLICT (branch_id, item_sku) DO NOTHING
                    """, (b_id, sku))
                
                count += 1
                if count % 10 == 0:
                    print(f"Processed {count}/{total_count} items...")
        
        print(f"Successfully migrated {count} items.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate()
