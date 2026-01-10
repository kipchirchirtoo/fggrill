import psycopg2
import json
from collections import defaultdict

# Database connection
DB_URL = "postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres"

def get_all_tables(cursor):
    """Get all tables in the database"""
    cursor.execute("""
        SELECT table_schema, table_name 
        FROM information_schema.tables 
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name;
    """)
    return cursor.fetchall()

def get_table_columns(cursor, schema, table):
    """Get all columns for a specific table"""
    cursor.execute("""
        SELECT 
            column_name,
            data_type,
            udt_name,
            is_nullable,
            column_default,
            character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position;
    """, (schema, table))
    return cursor.fetchall()

def get_foreign_keys(cursor, schema, table):
    """Get foreign key constraints for a table"""
    cursor.execute("""
        SELECT
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = %s
            AND tc.table_name = %s;
    """, (schema, table))
    return cursor.fetchall()

def get_enum_values(cursor, enum_name):
    """Get all values for an enum type"""
    cursor.execute("""
        SELECT enumlabel 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
        WHERE pg_type.typname = %s
        ORDER BY enumsortorder;
    """, (enum_name,))
    return [row[0] for row in cursor.fetchall()]

def get_all_enums(cursor):
    """Get all enum types"""
    cursor.execute("""
        SELECT DISTINCT typname 
        FROM pg_type 
        WHERE typtype = 'e'
        ORDER BY typname;
    """)
    return [row[0] for row in cursor.fetchall()]

def analyze_schema():
    """Main function to analyze the entire database schema"""
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    
    schema_info = {
        'enums': {},
        'tables': {}
    }
    
    print("=" * 80)
    print("DATABASE SCHEMA ANALYSIS")
    print("=" * 80)
    
    # Get all enums
    print("\n### ENUM TYPES ###\n")
    enums = get_all_enums(cursor)
    for enum_name in enums:
        values = get_enum_values(cursor, enum_name)
        schema_info['enums'][enum_name] = values
        print(f"{enum_name}:")
        for val in values:
            print(f"  - {val}")
        print()
    
    # Get all tables
    tables = get_all_tables(cursor)
    
    for schema, table in tables:
        full_table_name = f"{schema}.{table}"
        print(f"\n{'=' * 80}")
        print(f"TABLE: {full_table_name}")
        print('=' * 80)
        
        schema_info['tables'][full_table_name] = {
            'columns': [],
            'foreign_keys': []
        }
        
        # Get columns
        columns = get_table_columns(cursor, schema, table)
        print("\nCOLUMNS:")
        for col in columns:
            col_name, data_type, udt_name, is_nullable, col_default, max_length = col
            
            col_info = {
                'name': col_name,
                'type': data_type,
                'udt_name': udt_name,
                'nullable': is_nullable == 'YES',
                'default': col_default,
                'max_length': max_length
            }
            schema_info['tables'][full_table_name]['columns'].append(col_info)
            
            type_display = data_type
            if data_type == 'USER-DEFINED':
                type_display = f"ENUM({udt_name})"
            elif max_length:
                type_display = f"{data_type}({max_length})"
            
            nullable = "NULL" if is_nullable == 'YES' else "NOT NULL"
            default_display = f" DEFAULT {col_default}" if col_default else ""
            
            print(f"  {col_name:30} {type_display:25} {nullable:10}{default_display}")
        
        # Get foreign keys
        fks = get_foreign_keys(cursor, schema, table)
        if fks:
            print("\nFOREIGN KEYS:")
            for fk in fks:
                col_name, fk_schema, fk_table, fk_col, constraint_name = fk
                fk_info = {
                    'column': col_name,
                    'references': f"{fk_schema}.{fk_table}.{fk_col}",
                    'constraint': constraint_name
                }
                schema_info['tables'][full_table_name]['foreign_keys'].append(fk_info)
                print(f"  {col_name} -> {fk_schema}.{fk_table}({fk_col})")
    
    # Save to JSON file
    with open('schema_analysis.json', 'w') as f:
        json.dump(schema_info, f, indent=2)
    
    print("\n" + "=" * 80)
    print("Schema analysis saved to schema_analysis.json")
    print("=" * 80)
    
    cursor.close()
    conn.close()
    
    return schema_info

if __name__ == "__main__":
    analyze_schema()
