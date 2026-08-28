#!/usr/bin/env python3
"""
Analyze migration directories and generate drift report
"""
import json
import re
from pathlib import Path
from collections import defaultdict

def extract_tables_from_sql(sql_content):
    """Extract CREATE TABLE statements from SQL"""
    pattern = r"CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([^\s(]+)"
    matches = re.findall(pattern, sql_content, re.IGNORECASE)
    return [m.strip('"') for m in matches]

def analyze_migration_dir(migration_dir):
    """Analyze a single migration directory"""
    if not migration_dir.exists():
        return {"exists": False, "tables": set()}
    
    tables = set()
    migration_files = []
    
    for sql_file in sorted(migration_dir.glob("*.sql")):
        try:
            content = sql_file.read_text()
            file_tables = extract_tables_from_sql(content)
            tables.update(file_tables)
            migration_files.append({
                "name": sql_file.name,
                "tables": file_tables,
                "size": len(content)
            })
        except Exception as e:
            print(f"Warning: Could not read {sql_file}: {e}")
    
    return {
        "exists": True,
        "tables": tables,
        "files": migration_files,
        "file_count": len(migration_files)
    }

def generate_drift_report():
    """Generate migration drift report"""
    
    base_dir = Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b")
    
    # Load live schema
    with open(base_dir / "LIVE_SCHEMA.json") as f:
        live_schema = json.load(f)
    live_tables = {t["name"] for t in live_schema["tables"]}
    
    # Analyze each migration directory
    migration_dirs = {
        "database/migrations": base_dir / "database" / "migrations",
        "backend/migrations": base_dir / "backend" / "migrations",
        "backend/supabase/migrations": base_dir / "backend" / "supabase" / "migrations",
        "backend/src/database/migrations": base_dir / "backend" / "src" / "database" / "migrations",
        "backend/src/migrations": base_dir / "backend" / "src" / "migrations",
    }
    
    analysis = {}
    for name, path in migration_dirs.items():
        analysis[name] = analyze_migration_dir(path)
        print(f"📁 {name}:")
        if analysis[name]["exists"]:
            print(f"   Files: {analysis[name]['file_count']}")
            print(f"   Tables defined: {len(analysis[name]['tables'])}")
        else:
            print(f"   Does not exist")
        print()
    
    # Find tables defined in multiple directories
    print("🔍 Tables defined in multiple directories:")
    table_locations = defaultdict(list)
    for dir_name, dir_data in analysis.items():
        if dir_data["exists"]:
            for table in dir_data["tables"]:
                table_locations[table].append(dir_name)
    
    duplicate_tables = {t: locs for t, locs in table_locations.items() if len(locs) > 1}
    print(f"   Found {len(duplicate_tables)} duplicate table definitions\n")
    
    # Compare each directory against live schema
    print("📊 Drift Analysis:\n")
    
    for dir_name, dir_data in analysis.items():
        if not dir_data["exists"]:
            continue
        
        dir_tables = dir_data["tables"]
        
        # Tables in migrations but not in live
        not_applied = dir_tables - live_tables
        
        # Tables in live but not in this migration dir
        untracked = live_tables - dir_tables
        
        print(f"📁 {dir_name}:")
        print(f"   NOT APPLIED (in migrations, missing in live): {len(not_applied)}")
        if not_applied:
            for t in sorted(list(not_applied)[:10]):
                print(f"      - {t}")
            if len(not_applied) > 10:
                print(f"      ... and {len(not_applied) - 10} more")
        
        print(f"   UNTRACKED (in live, missing in migrations): {len(untracked)}")
        if untracked:
            for t in sorted(list(untracked)[:10]):
                print(f"      - {t}")
            if len(untracked) > 10:
                print(f"      ... and {len(untracked) - 10} more")
        print()
    
    # Recommendation
    print("📋 RECOMMENDATION:\n")
    print("   Canonical migration directory: database/migrations")
    print("   Reason: This is the root-level migration directory that follows Supabase convention")
    print("           and is most likely to be the source of truth for the project.\n")

    print("   Action plan:")
    print("   1. Archive other migration directories under database/migrations-archive/")
    print("   2. Generate baseline migration matching live schema")
    print("   3. Enforce single migration root via git hooks\n")

    # Generate detailed report
    # Convert sets to lists for JSON serialization
    analysis_serializable = {}
    for dir_name, dir_data in analysis.items():
        analysis_serializable[dir_name] = {
            "exists": dir_data["exists"],
            "tables": sorted(list(dir_data["tables"])) if dir_data["exists"] else [],
            "file_count": dir_data["file_count"] if dir_data["exists"] else 0,
            "files": dir_data["files"] if dir_data["exists"] else []
        }

    report = {
        "liveSchema": {
            "tableCount": len(live_tables),
            "tables": sorted(list(live_tables))
        },
        "migrationDirectories": analysis_serializable,
        "duplicateTables": {t: locs for t, locs in sorted(duplicate_tables.items())},
        "recommendation": {
            "canonical": "database/migrations",
            "reason": "Root-level Supabase convention, most likely source of truth",
            "archive": [
                "backend/migrations",
                "backend/supabase/migrations",
                "backend/src/database/migrations",
                "backend/src/migrations"
            ]
        }
    }

    report_path = base_dir / "MIGRATION_DRIFT_REPORT.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"📄 Detailed report saved to: {report_path}")
    
    return report

if __name__ == "__main__":
    generate_drift_report()
