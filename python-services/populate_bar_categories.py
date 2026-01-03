import psycopg2
import os

DATABASE_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

categories = [
    {"name": "Beers", "description": "Local and international beers", "sort_order": 1},
    {"name": "Wines", "description": "Red, white, and sparkling wines", "sort_order": 2},
    {"name": "Cocktails", "description": "Signature and classic cocktails", "sort_order": 3},
    {"name": "Spirits", "description": "Whisky, Vodka, Gin, Rum, Tequila", "sort_order": 4},
    {"name": "Soft Drinks", "description": "Sodas, juices, and water", "sort_order": 5},
    {"name": "Hot Beverages", "description": "Coffee, tea, and hot chocolate", "sort_order": 6}
]

def populate():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        print("Connected to database")
        
        for cat in categories:
            # Check if exists
            cur.execute("SELECT id FROM bar_drink_categories WHERE name = %s", (cat['name'],))
            if cur.fetchone():
                print(f"Category {cat['name']} already exists")
                continue
                
            cur.execute(
                "INSERT INTO bar_drink_categories (name, description, sort_order, is_active) VALUES (%s, %s, %s, true) RETURNING id",
                (cat['name'], cat['description'], cat['sort_order'])
            )
            new_id = cur.fetchone()[0]
            print(f"Created category {cat['name']} with ID {new_id}")
            
        conn.commit()
        cur.close()
        conn.close()
        print("Done")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    populate()
