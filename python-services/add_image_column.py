import psycopg2
import os

DATABASE_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def add_column():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        cur.execute("ALTER TABLE bar_drinks ADD COLUMN IF NOT EXISTS image_url text;")
        
        conn.commit()
        cur.close()
        conn.close()
        print("Added image_url column to bar_drinks")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    add_column()
