
import psycopg2
import os

DATABASE_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def check_journals():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        print("\n--- Journal Entries Columns ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounting_journal_entries'")
        cols = cur.fetchall()
        for col in cols:
            print(f"- {col[0]} ({col[1]})")

        print("\n--- Journal Lines Columns ---")
        cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounting_journal_lines'")
        cols = cur.fetchall()
        for col in cols:
            print(f"- {col[0]} ({col[1]})")
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_journals()
