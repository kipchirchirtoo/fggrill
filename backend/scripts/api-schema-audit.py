#!/usr/bin/env python3
"""
API↔Schema Audit - Cross-reference Supabase queries against live schema
Implements the api_schema_auditor.toml specification
"""
import json
import re
from pathlib import Path
from collections import defaultdict

# Load live schema
def load_live_schema():
    with open(Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/LIVE_SCHEMA.json")) as f:
        return json.load(f)

def extract_supabase_queries(content):
    """Extract Supabase query patterns from TypeScript code"""
    queries = []
    
    # Pattern to match .from('table_name') chains
    # This catches: .from('table'), .from("table"), .from(`table`)
    from_pattern = r'\.from\([\'"`]([^\'"`]+)[\'"`]\)'
    
    # Pattern for method chains: .select(), .insert(), .update(), .upsert(), .delete()
    method_pattern = r'\.(select|insert|update|upsert|delete)\s*\('
    
    # Pattern for field references in select
    select_fields_pattern = r'\.select\([\'"`]?([^\'"`)]*)[\'"`]?\)'
    
    # Find all .from() calls
    for match in re.finditer(from_pattern, content):
        table_name = match.group(1)
        start_pos = match.start()
        
        # Find the query context (surrounding ~200 chars)
        context_start = max(0, start_pos - 100)
        context_end = min(len(content), start_pos + 500)
        context = content[context_start:context_end]
        
        # Determine operation type
        operation = "UNKNOWN"
        if '.insert(' in context:
            operation = "INSERT"
        elif '.update(' in context:
            operation = "UPDATE"
        elif '.upsert(' in context:
            operation = "UPSERT"
        elif '.delete(' in context:
            operation = "DELETE"
        elif '.select(' in context:
            operation = "SELECT"
        
        # Extract fields from select
        fields = []
        if operation == "SELECT":
            select_match = re.search(r'\.select\([\'"`]?([^\'"`)]*)[\'"`]?\)', context)
            if select_match:
                field_str = select_match.group(1)
                fields = [f.strip() for f in field_str.split(',') if f.strip()]
        
        queries.append({
            "table": table_name,
            "operation": operation,
            "fields": fields,
            "context": context.strip()
        })
    
    return queries

def audit_file(file_path, live_schema):
    """Audit a single TypeScript file"""
    issues = []
    
    try:
        content = file_path.read_text()
        queries = extract_supabase_queries(content)
        
        # Build table schema lookup
        tables_by_name = {t["name"]: t for t in live_schema["tables"]}
        columns_by_table = {t["name"]: {c["name"]: c for c in t["columns"]} for t in live_schema["tables"]}
        
        for query in queries:
            table_name = query["table"]
            operation = query["operation"]
            fields = query["fields"]
            
            # Check if table exists
            if table_name not in tables_by_name:
                issues.append({
                    "file": str(file_path.relative_to(Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/backend/src"))),
                    "severity": "CRITICAL",
                    "type": "MISSING_TABLE",
                    "table": table_name,
                    "message": f"Table '{table_name}' does not exist in live schema",
                    "context": query["context"][:200]
                })
                continue
            
            # Check if table has data (warn about empty tables)
            table_data = tables_by_name[table_name]
            if table_data["rowCount"] == 0:
                issues.append({
                    "file": str(file_path.relative_to(Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/backend/src"))),
                    "severity": "LOW",
                    "type": "EMPTY_TABLE",
                    "table": table_name,
                    "message": f"Table '{table_name}' is empty (0 rows) - may be deprecated",
                    "context": query["context"][:200]
                })
            
            # Check fields in SELECT
            if operation == "SELECT" and fields:
                table_columns = columns_by_table.get(table_name, {})
                for field in fields:
                    # Skip special Supabase fields
                    if field in ['*', 'count', 'exact']:
                        continue
                    # Skip Supabase join syntax (table:related_table!join_type(columns))
                    if ':' in field or '!' in field or field.startswith('('):
                        continue
                    # Handle nested references like "table.field"
                    if '.' in field:
                        field = field.split('.')[0]

                    if field and field not in table_columns:
                        issues.append({
                            "file": str(file_path.relative_to(Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/backend/src"))),
                            "severity": "HIGH",
                            "type": "MISSING_COLUMN",
                            "table": table_name,
                            "field": field,
                            "message": f"Column '{field}' does not exist in table '{table_name}'",
                            "context": query["context"][:200]
                        })
        
    except Exception as e:
        issues.append({
            "file": str(file_path.relative_to(Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/backend/src"))),
            "severity": "INFO",
            "type": "AUDIT_ERROR",
            "message": f"Could not audit file: {str(e)}",
            "context": ""
        })
    
    return issues

def run_audit():
    """Run full API↔Schema audit"""
    print("🔍 Starting API↔Schema Audit...\n")
    
    live_schema = load_live_schema()
    print(f"Loaded live schema: {len(live_schema['tables'])} tables\n")
    
    base_dir = Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/backend/src")
    
    all_issues = []
    
    # Scan controllers
    controllers_dir = base_dir / "controllers"
    if controllers_dir.exists():
        print("📁 Scanning controllers...")
        for ts_file in controllers_dir.glob("**/*.ts"):
            if '.backup' in ts_file.name:
                continue
            issues = audit_file(ts_file, live_schema)
            all_issues.extend(issues)
            print(f"   {ts_file.relative_to(base_dir)}: {len(issues)} issues")
    
    # Scan routes
    routes_dir = base_dir / "routes"
    if routes_dir.exists():
        print("\n📁 Scanning routes...")
        for ts_file in routes_dir.glob("*.ts"):
            if '.backup' in ts_file.name:
                continue
            issues = audit_file(ts_file, live_schema)
            all_issues.extend(issues)
            print(f"   {ts_file.relative_to(base_dir)}: {len(issues)} issues")
    
    # Scan services
    services_dir = base_dir / "services"
    if services_dir.exists():
        print("\n📁 Scanning services...")
        for ts_file in services_dir.glob("**/*.ts"):
            if '.backup' in ts_file.name:
                continue
            issues = audit_file(ts_file, live_schema)
            all_issues.extend(issues)
            print(f"   {ts_file.relative_to(base_dir)}: {len(issues)} issues")
    
    # Group issues by severity
    issues_by_severity = defaultdict(list)
    for issue in all_issues:
        issues_by_severity[issue["severity"]].append(issue)
    
    # Print summary
    print("\n" + "=" * 60)
    print("AUDIT SUMMARY")
    print("=" * 60)
    print(f"CRITICAL: {len(issues_by_severity['CRITICAL'])}")
    print(f"HIGH: {len(issues_by_severity['HIGH'])}")
    print(f"MEDIUM: {len(issues_by_severity['MEDIUM'])}")
    print(f"LOW: {len(issues_by_severity['LOW'])}")
    print(f"INFO: {len(issues_by_severity['INFO'])}")
    print(f"TOTAL: {len(all_issues)}")
    
    # Print top issues by type
    print("\n" + "=" * 60)
    print("TOP ISSUES BY TYPE")
    print("=" * 60)
    
    issues_by_type = defaultdict(list)
    for issue in all_issues:
        issues_by_type[issue["type"]].append(issue)
    
    for issue_type, type_issues in sorted(issues_by_type.items(), key=lambda x: len(x[1]), reverse=True):
        print(f"{issue_type}: {len(type_issues)}")
    
    # Save detailed report
    report = {
        "summary": {
            "total": len(all_issues),
            "bySeverity": {k: len(v) for k, v in issues_by_severity.items()},
            "byType": {k: len(v) for k, v in issues_by_type.items()}
        },
        "issues": all_issues
    }
    
    report_path = Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/API_SCHEMA_AUDIT_REPORT.json")
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\n📄 Detailed report saved to: {report_path}")
    
    # Print CRITICAL and HIGH issues
    if issues_by_severity['CRITICAL']:
        print("\n" + "=" * 60)
        print("CRITICAL ISSUES")
        print("=" * 60)
        for issue in issues_by_severity['CRITICAL'][:20]:
            print(f"\nFile: {issue['file']}")
            print(f"Type: {issue['type']}")
            print(f"Message: {issue['message']}")
            print(f"Context: {issue['context'][:150]}...")
    
    if issues_by_severity['HIGH']:
        print("\n" + "=" * 60)
        print("HIGH PRIORITY ISSUES (first 20)")
        print("=" * 60)
        for issue in issues_by_severity['HIGH'][:20]:
            print(f"\nFile: {issue['file']}")
            print(f"Type: {issue['type']}")
            print(f"Message: {issue['message']}")
            print(f"Context: {issue['context'][:150]}...")
    
    return report

if __name__ == "__main__":
    run_audit()
