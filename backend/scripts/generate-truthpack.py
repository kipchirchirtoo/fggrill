#!/usr/bin/env python3
"""
Generate truthpack files (schemas.json, routes.json) from live schema and codebase
"""
import json
import re
from pathlib import Path
from collections import defaultdict

def generate_schemas_json():
    """Generate schemas.json from LIVE_SCHEMA.json"""
    
    schema_path = Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/LIVE_SCHEMA.json")
    with open(schema_path) as f:
        live_schema = json.load(f)
    
    # Build schemas.json structure
    schemas = {
        "tables": {},
        "extractedAt": live_schema["extractedAt"]
    }
    
    for table in live_schema["tables"]:
        table_name = table["name"]
        schemas["tables"][table_name] = {
            "columns": {},
            "primaryKey": table["primaryKey"],
            "foreignKeys": table["foreignKeys"],
            "rowCount": table["rowCount"]
        }
        
        for col in table["columns"]:
            schemas["tables"][table_name]["columns"][col["name"]] = {
                "type": col["type"],
                "nullable": col["nullable"],
                "default": col["default"]
            }
    
    # Write schemas.json
    truthpack_dir = Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/.vibecheck/truthpack")
    truthpack_dir.mkdir(parents=True, exist_ok=True)
    
    schemas_path = truthpack_dir / "schemas.json"
    with open(schemas_path, 'w') as f:
        json.dump(schemas, f, indent=2)
    
    print(f"✅ Generated schemas.json ({len(schemas['tables'])} tables)")
    return schemas

def extract_routes_from_backend():
    """Extract API routes from backend routes and controllers"""
    
    base_dir = Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/backend/src")
    
    routes = {
        "api": {},
        "extractedAt": live_schema["extractedAt"]
    }
    
    # Scan routes directory
    routes_dir = base_dir / "routes"
    if routes_dir.exists():
        for route_file in routes_dir.glob("*.ts"):
            content = route_file.read_text()
            
            # Extract route patterns like router.get('/path', handler)
            pattern = r"(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)['\"]"
            matches = re.findall(pattern, content)
            
            for method, path in matches:
                if path not in routes["api"]:
                    routes["api"][path] = []
                routes["api"][path].append({
                    "method": method.upper(),
                    "file": str(route_file.relative_to(base_dir))
                })
    
    # Scan controllers for route definitions
    controllers_dir = base_dir / "controllers"
    if controllers_dir.exists():
        for controller_file in controllers_dir.glob("**/*.ts"):
            content = controller_file.read_text()
            
            # Look for @Route decorators or router definitions
            pattern = r"router\.(get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)['\"]"
            matches = re.findall(pattern, content)
            
            for method, path in matches:
                if path not in routes["api"]:
                    routes["api"][path] = []
                routes["api"][path].append({
                    "method": method.upper(),
                    "file": str(controller_file.relative_to(base_dir))
                })
    
    return routes

def generate_routes_json():
    """Generate routes.json by scanning the codebase"""
    
    base_dir = Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/backend/src")
    
    routes = {
        "api": {},
        "extractedAt": json.loads(Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/LIVE_SCHEMA.json").read_text())["extractedAt"]
    }
    
    # Scan routes directory
    routes_dir = base_dir / "routes"
    if routes_dir.exists():
        for route_file in routes_dir.glob("*.ts"):
            try:
                content = route_file.read_text()
                
                # Extract route patterns
                pattern = r"(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)['\"]"
                matches = re.findall(pattern, content)
                
                for method, path in matches:
                    if path not in routes["api"]:
                        routes["api"][path] = []
                    routes["api"][path].append({
                        "method": method.upper(),
                        "file": str(route_file.relative_to(base_dir))
                    })
            except Exception as e:
                print(f"Warning: Could not read {route_file}: {e}")
    
    # Scan controllers directory
    controllers_dir = base_dir / "controllers"
    if controllers_dir.exists():
        for controller_file in controllers_dir.glob("**/*.ts"):
            try:
                content = controller_file.read_text()
                
                pattern = r"router\.(get|post|put|patch|delete)\s*\(\s*['\"]([^'\"]+)['\"]"
                matches = re.findall(pattern, content)
                
                for method, path in matches:
                    if path not in routes["api"]:
                        routes["api"][path] = []
                    routes["api"][path].append({
                        "method": method.upper(),
                        "file": str(controller_file.relative_to(base_dir))
                    })
            except Exception as e:
                print(f"Warning: Could not read {controller_file}: {e}")
    
    # Write routes.json
    truthpack_dir = Path("/home/john/.windsurf/worktrees/fggrill-1/fggrill-1-3b591a4b/.vibecheck/truthpack")
    truthpack_dir.mkdir(parents=True, exist_ok=True)
    
    routes_path = truthpack_dir / "routes.json"
    with open(routes_path, 'w') as f:
        json.dump(routes, f, indent=2)
    
    print(f"✅ Generated routes.json ({len(routes['api'])} unique paths)")
    return routes

if __name__ == "__main__":
    print("🔍 Generating truthpack files...\n")
    
    # Generate schemas.json
    schemas = generate_schemas_json()
    
    # Generate routes.json
    routes = generate_routes_json()
    
    print("\n✅ Truthpack generation complete!")
    print(f"   .vibecheck/truthpack/schemas.json: {len(schemas['tables'])} tables")
    print(f"   .vibecheck/truthpack/routes.json: {len(routes['api'])} API paths")
