#!/usr/bin/env python3
"""
Extract live Supabase schema to establish baseline truth.
"""
import json
import os
import sys
from datetime import timezone
from datetime import datetime
from urllib.parse import urlparse

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Installing psycopg2...")
    os.system(f"{sys.executable} -m pip install psycopg2-binary --quiet")
    import psycopg2
    from psycopg2.extras import RealDictCursor

# Database connection
DATABASE_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def extract_schema():
    print("🔍 Connecting to Supabase database...")
    
    output = {
        "extractedAt": datetime.now(timezone.utc).isoformat() + "Z",
        "tables": [],
        "indexes": [],
        "policies": [],
        "functions": [],
        "triggers": [],
        "rowCounts": {}
    }
    
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    print("✅ Connected to database\n")
    
    # 1. Get all tables
    print("📋 Fetching tables...")
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    """)
    tables = [row['table_name'] for row in cursor.fetchall()]
    print(f"  Found {len(tables)} tables\n")
    
    # 2. Get table schemas and row counts
    print("📊 Fetching table schemas and row counts...")
    for table_name in tables:
        try:
            # Get row count
            cursor.execute(f'SELECT COUNT(*) as cnt FROM "{table_name}"')
            row_count = cursor.fetchone()['cnt']
            output["rowCounts"][table_name] = row_count

            # Get columns
            cursor.execute("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
            """, (table_name,))
            columns = cursor.fetchall()

            # Get primary key
            cursor.execute("""
                SELECT a.attname
                FROM pg_index i
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
                WHERE i.indrelid = %s::regclass AND i.indisprimary
            """, (table_name,))
            pks = [row['attname'] for row in cursor.fetchall()]

            # Get foreign keys
            cursor.execute("""
                SELECT
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_schema = 'public'
                    AND tc.table_name = %s
            """, (table_name,))
            fks = cursor.fetchall()

            output["tables"].append({
                "name": table_name,
                "rowCount": row_count,
                "columns": [
                    {
                        "name": col['column_name'],
                        "type": col['data_type'],
                        "nullable": col['is_nullable'] == 'YES',
                        "default": col['column_default']
                    }
                    for col in columns
                ],
                "primaryKey": pks,
                "foreignKeys": [
                    {
                        "column": fk['column_name'],
                        "references": f"{fk['foreign_table_name']}.{fk['foreign_column_name']}"
                    }
                    for fk in fks
                ]
            })

            print(f"  ✅ {table_name}: {row_count} rows, {len(columns)} columns, {len(pks)} PK, {len(fks)} FK")
        except Exception as e:
            print(f"  ❌ {table_name}: {str(e)}")
    
    # 3. Get indexes
    print("\n📋 Fetching indexes...")
    cursor.execute("""
        SELECT
            schemaname,
            tablename,
            indexname,
            indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
    """)
    idx_rows = cursor.fetchall()
    output["indexes"] = [
        {
            "table": idx['tablename'],
            "name": idx['indexname'],
            "definition": idx['indexdef']
        }
        for idx in idx_rows
    ]
    print(f"  Found {len(idx_rows)} indexes")
    
    # 4. Get RLS policies
    print("\n📋 Fetching RLS policies...")
    cursor.execute("""
        SELECT
            schemaname,
            tablename,
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
    """)
    pol_rows = cursor.fetchall()
    output["policies"] = [
        {
            "table": pol['tablename'],
            "name": pol['policyname'],
            "permissive": pol['permissive'],
            "roles": pol['roles'],
            "command": pol['cmd'],
            "using": pol['qual'],
            "withCheck": pol['with_check']
        }
        for pol in pol_rows
    ]
    print(f"  Found {len(pol_rows)} policies")
    
    # 5. Get functions
    print("\n📋 Fetching functions...")
    cursor.execute("""
        SELECT
            n.nspname as schema,
            p.proname as name,
            pg_get_function_arguments(p.oid) as arguments,
            pg_get_functiondef(p.oid) as definition
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY p.proname
    """)
    func_rows = cursor.fetchall()
    output["functions"] = [
        {
            "schema": func['schema'],
            "name": func['name'],
            "arguments": func['arguments'],
            "definition": func['definition']
        }
        for func in func_rows
    ]
    print(f"  Found {len(func_rows)} functions")
    
    # 6. Get triggers
    print("\n📋 Fetching triggers...")
    cursor.execute("""
        SELECT
            trigger_schema,
            event_object_table,
            trigger_name,
            action_timing,
            event_manipulation,
            action_statement
        FROM information_schema.triggers
        WHERE trigger_schema = 'public'
        ORDER BY event_object_table, trigger_name
    """)
    trig_rows = cursor.fetchall()
    output["triggers"] = [
        {
            "table": trig['event_object_table'],
            "name": trig['trigger_name'],
            "timing": trig['action_timing'],
            "event": trig['event_manipulation'],
            "statement": trig['action_statement']
        }
        for trig in trig_rows
    ]
    print(f"  Found {len(trig_rows)} triggers")
    
    cursor.close()
    conn.close()
    
    # Write output
    output_path = "LIVE_SCHEMA.json"
    print(f"\n📄 Writing schema to {output_path}...")
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2, default=str)
    
    print("\n✅ Schema extraction complete!")
    print(f"Total tables: {len(output['tables'])}")
    print(f"Total indexes: {len(output['indexes'])}")
    print(f"Total policies: {len(output['policies'])}")
    print(f"Total functions: {len(output['functions'])}")
    print(f"Total triggers: {len(output['triggers'])}")
    
    # Summary
    tables_with_data = sorted(output['tables'], key=lambda t: t['rowCount'], reverse=True)[:20]
    print("\n📈 Top 20 tables by row count:")
    for i, t in enumerate(tables_with_data, 1):
        print(f"  {i}. {t['name']}: {t['rowCount']:,} rows")
    
    return output

if __name__ == "__main__":
    try:
        extract_schema()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
