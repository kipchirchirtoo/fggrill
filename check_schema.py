import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

# Query to get table schema information
tables_to_check = ['accounting_vendors', 'accounting_ap_bills', 'suppliers', 'accounting_customers', 'accounting_ar_invoices']

print("=" * 80)
print("DATABASE SCHEMA ANALYSIS")
print("=" * 80)

for table_name in tables_to_check:
    print(f"\n{'=' * 80}")
    print(f"TABLE: {table_name}")
    print("=" * 80)
    
    # Get table structure using information_schema
    query = f"""
    SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
    FROM information_schema.columns 
    WHERE table_name = '{table_name}'
    ORDER BY ordinal_position;
    """
    
    try:
        result = supabase.rpc('exec_sql', {'query': query}).execute()
        if result.data:
            print(f"\nColumns:")
            for col in result.data:
                nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
                print(f"  - {col['column_name']}: {col['data_type']} {nullable}{default}")
        else:
            # Try direct query
            result = supabase.from_(table_name).select("*").limit(0).execute()
            print(f"  Table exists but couldn't fetch schema via information_schema")
    except Exception as e:
        print(f"  ERROR: {str(e)}")
    
    # Get foreign key constraints
    fk_query = f"""
    SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = '{table_name}';
    """
    
    try:
        result = supabase.rpc('exec_sql', {'query': fk_query}).execute()
        if result.data:
            print(f"\nForeign Keys:")
            for fk in result.data:
                print(f"  - {fk['column_name']} -> {fk['foreign_table_name']}.{fk['foreign_column_name']}")
    except Exception as e:
        print(f"  Could not fetch foreign keys: {str(e)}")

# Check if there are any suppliers in the database
print(f"\n{'=' * 80}")
print("DATA CHECK: Suppliers")
print("=" * 80)
try:
    result = supabase.from_('suppliers').select("id, name").limit(5).execute()
    if result.data:
        print(f"Found {len(result.data)} suppliers (showing first 5):")
        for supplier in result.data:
            print(f"  - {supplier['id']}: {supplier['name']}")
    else:
        print("  No suppliers found in database!")
except Exception as e:
    print(f"  ERROR: {str(e)}")

# Check accounting_vendors
print(f"\n{'=' * 80}")
print("DATA CHECK: Accounting Vendors")
print("=" * 80)
try:
    result = supabase.from_('accounting_vendors').select("id, vendor_code, vendor_name").limit(5).execute()
    if result.data:
        print(f"Found {len(result.data)} accounting vendors (showing first 5):")
        for vendor in result.data:
            print(f"  - {vendor['id']}: {vendor['vendor_name']} (code: {vendor.get('vendor_code', 'N/A')})")
    else:
        print("  No accounting vendors found in database!")
except Exception as e:
    print(f"  ERROR: {str(e)}")

print(f"\n{'=' * 80}")
print("ANALYSIS COMPLETE")
print("=" * 80)
