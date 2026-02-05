import os
import time
import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import create_client, Client
import logging

# Configuration from Environment Variables
LOCAL_DB_URL = os.environ.get('LOCAL_DATABASE_URL', 'postgresql://postgres:fggrill_secret@localhost:5432/postgres')
SUPABASE_URL = os.environ.get('SUPABASE_PROJECT_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
SYNC_INTERVAL = int(os.environ.get('SYNC_INTERVAL', 30))  # Seconds

# Tables to Sync
SYNC_TABLES = [
    'pos_transactions',
    'cashier_logs',
    'staff_attendance',
    'kitchen_orders'
]

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_supabase_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

def sync_table(table_name, local_conn, supabase_client):
    try:
        with local_conn.cursor(cursor_factory=RealDictCursor) as cur:
            # 1. Get records that haven't been synced yet
            # Assumes a 'synced_at' column exists or tracking is done via a sync_meta table
            # For "no code change", we use a local metadata table to track progress
            cur.execute(f"CREATE TABLE IF NOT EXISTS _sync_tracking (table_name TEXT PRIMARY KEY, last_id UUID, last_sync_at TIMESTAMP WITH TIME ZONE)")
            
            cur.execute("SELECT last_id FROM _sync_tracking WHERE table_name = %s", (table_name,))
            row = cur.fetchone()
            last_id = row['last_id'] if row else None
            
            if last_id:
                query = f"SELECT * FROM {table_name} WHERE id > %s ORDER BY created_at ASC"
                cur.execute(query, (last_id,))
            else:
                query = f"SELECT * FROM {table_name} ORDER BY created_at ASC"
                cur.execute(query)
            
            records = cur.fetchall()
            
            if not records:
                return

            logger.info(f"Syncing {len(records)} records for table: {table_name}")
            
            # 2. Push to Supabase
            for record in records:
                filtered_record = {k: v for k, v in record.items() if not k.startswith('_')}
                supabase_client.table(table_name).upsert(filtered_record).execute()
                last_id = record['id']
            
            # 3. Update tracking
            cur.execute(
                "INSERT INTO _sync_tracking (table_name, last_id, last_sync_at) VALUES (%s, %s, NOW()) "
                "ON CONFLICT (table_name) DO UPDATE SET last_id = EXCLUDED.last_id, last_sync_at = EXCLUDED.last_sync_at",
                (table_name, last_id)
            )
            local_conn.commit()
            logger.info(f"Successfully synced {table_name}")

    except Exception as e:
        logger.error(f"Error syncing table {table_name}: {e}")
        local_conn.rollback()

def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("SUPABASE_PROJECT_URL or SUPABASE_SERVICE_ROLE_KEY not set!")
        return

    supabase_client = get_supabase_client()
    
    while True:
        try:
            logger.info("Starting sync cycle...")
            with psycopg2.connect(LOCAL_DB_URL) as conn:
                for table in SYNC_TABLES:
                    sync_table(table, conn, supabase_client)
            logger.info(f"Sync cycle complete. Waiting {SYNC_INTERVAL}s")
        except Exception as e:
            logger.error(f"Connection error: {e}")
        
        time.sleep(SYNC_INTERVAL)

if __name__ == "__main__":
    main()
