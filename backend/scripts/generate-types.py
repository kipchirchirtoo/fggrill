#!/usr/bin/env python3
"""
Generate TypeScript types from LIVE_SCHEMA.json
"""
import json
from pathlib import Path

# Type mapping from PostgreSQL to TypeScript
TYPE_MAP = {
    'integer': 'number',
    'bigint': 'number',
    'smallint': 'number',
    'decimal': 'number',
    'numeric': 'number',
    'real': 'number',
    'double precision': 'number',
    'character varying': 'string',
    'varchar': 'string',
    'text': 'string',
    'character': 'string',
    'char': 'string',
    'boolean': 'boolean',
    'uuid': 'string',
    'timestamp with time zone': 'string',
    'timestamp without time zone': 'string',
    'date': 'string',
    'time with time zone': 'string',
    'time without time zone': 'string',
    'interval': 'string',
    'json': 'unknown',
    'jsonb': 'unknown',
    'array': 'unknown[]',
}

def map_pg_type_to_ts(pg_type: str) -> str:
    """Map PostgreSQL type to TypeScript type"""
    pg_type_lower = pg_type.lower()
    for pg, ts in TYPE_MAP.items():
        if pg_type_lower.startswith(pg):
            return ts
    return 'unknown'

def to_pascal_case(s: str) -> str:
    """Convert snake_case to PascalCase"""
    return ''.join(word.capitalize() for word in s.split('_'))

def to_camel_case(s: str) -> str:
    """Convert snake_case to camelCase"""
    parts = s.split('_')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])

def generate_types():
    """Generate TypeScript types from live schema"""
    
    # Read live schema
    schema_path = Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/LIVE_SCHEMA.json")
    with open(schema_path) as f:
        schema = json.load(f)
    
    output = []
    
    # Header
    output.append('// Auto-generated from LIVE_SCHEMA.json')
    output.append('// DO NOT EDIT MANUALY - regenerate with: python3 backend/scripts/generate-types.py')
    output.append(f'// Generated at: {schema["extractedAt"]}')
    output.append('')
    output.append('export type Json =')
    output.append('  | string')
    output.append('  | number')
    output.append('  | boolean')
    output.append('  | null')
    output.append('  | { [key: string]: Json | undefined }')
    output.append('  | Json[]')
    output.append('')
    output.append('export interface Database {')
    output.append('  public: {')
    output.append('    Tables: {')
    output.append('      Row: {}')
    output.append('      Insert: {}')
    output.append('      Update: {}')
    output.append('    }')
    output.append('    Views: {')
    output.append('      Row: {}')
    output.append('    }')
    output.append('    Functions: {}')
    output.append('    Enums: {}')
    output.append('  }')
    output.append('}')
    output.append('')
    
    # Generate table types
    print(f"Generating types for {len(schema['tables'])} tables...")
    
    for table in sorted(schema['tables'], key=lambda t: t['name']):
        table_name = table['name']
        pascal_name = to_pascal_case(table_name)
        columns = table['columns']
        
        # Row type
        row_fields = []
        for col in columns:
            col_name = col['name']
            ts_type = map_pg_type_to_ts(col['type'])
            
            # Handle nullable
            if col['nullable']:
                ts_type += ' | null'
            
            row_fields.append(f"    {col_name}: {ts_type}")
        
        # Insert type (make non-null columns required, null columns optional)
        insert_fields = []
        for col in columns:
            col_name = col['name']
            ts_type = map_pg_type_to_ts(col['type'])
            
            # Auto-generated columns are optional in Insert
            if col['name'] in ['id', 'created_at', 'updated_at'] or col['default']:
                insert_fields.append(f"    {col_name}?: {ts_type}")
            elif col['nullable']:
                insert_fields.append(f"    {col_name}?: {ts_type} | null")
            else:
                insert_fields.append(f"    {col_name}: {ts_type}")
        
        # Update type (all fields optional)
        update_fields = []
        for col in columns:
            col_name = col['name']
            ts_type = map_pg_type_to_ts(col['type'])
            update_fields.append(f"    {col_name}?: {ts_type} | null")
        
        output.append(f'export interface {pascal_name} {{')
        output.append('\n'.join(row_fields))
        output.append('}')
        output.append('')
        
        output.append(f'export interface {pascal_name}Insert {{')
        output.append('\n'.join(insert_fields))
        output.append('}')
        output.append('')
        
        output.append(f'export interface {pascal_name}Update {{')
        output.append('\n'.join(update_fields))
        output.append('}')
        output.append('')
    
    # Write output
    output_path = Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/backend/src/types/database.types.ts")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        f.write('\n'.join(output))
    
    print(f"✅ Generated types to {output_path}")
    print(f"   Total tables: {len(schema['tables'])}")
    print(f"   Total interfaces: {len(schema['tables']) * 3}")

if __name__ == "__main__":
    generate_types()
