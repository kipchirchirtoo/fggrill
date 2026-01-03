from supabase import create_client, Client
import os

url = "https://utsvlihpudfraxzcmtle.supabase.co"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY"

def create_bucket():
    try:
        supabase: Client = create_client(url, key)
        
        bucket_name = "menu-items"
        
        # Check if bucket exists
        buckets = supabase.storage.list_buckets()
        existing = next((b for b in buckets if b.name == bucket_name), None)
        
        if existing:
            print(f"Bucket '{bucket_name}' already exists.")
        else:
            # Create bucket
            supabase.storage.create_bucket(bucket_name, options={"public": True})
            print(f"Bucket '{bucket_name}' created successfully.")
            
        # Update public access policy if needed (usually handled by public=True in create_bucket)
        # But just in case, we might need to check policies. 
        # For now, let's assume create_bucket(public=True) is sufficient for the python client.
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    create_bucket()
