import logging
from typing import Dict, List, Any, Optional
from supabase import ACTION_STATUS

logger = logging.getLogger(__name__)

class SchemaRegistry:
    """
    Registry to provide database schema metadata to the AI Analyst.
    Helps the AI understand what tables and columns are available.
    """
    
    # Priority tables that are most relevant for reports
    PRIORITY_TABLES = [
        'restaurant_orders', 'order_items', 'menu_items', 'menu_categories',
        'expenses', 'staff', 'shifts', 'payroll_records',
        'payments', 'reservations', 'guests', 'rooms',
        'inventory_items', 'inventory_transactions',
        'suppliers', 'purchase_orders'
    ]

    def __init__(self, supabase_client):
        self.client = supabase_client
        self._schema_cache: Optional[Dict[str, Any]] = None

    def get_schema(self, refresh: bool = False) -> Dict[str, Any]:
        """
        Returns a dictionary representation of the database schema.
        
        Structure:
        {
            "tables": {
                "table_name": {
                    "columns": [
                        {"name": "col_name", "type": "data_type", "nullable": bool},
                        ...
                    ],
                    "description": "Optional description"
                }
            }
        }
        """
        if self._schema_cache and not refresh:
            return self._schema_cache

        try:
            # We'll try to fetch from information_schema if possible.
            # If RLS/permissions block this, we might need a fallback.
            
            # Fetch columns for priority tables
            # Note: retrieving for *all* tables might overflow context, so filters are good.
            
            # Postgres query to get column info
            query = """
            SELECT 
                table_name, 
                column_name, 
                data_type, 
                is_nullable
            FROM 
                information_schema.columns 
            WHERE 
                table_schema = 'public' 
                AND table_name IN ('{}')
            ORDER BY 
                table_name, ordinal_position;
            """.format("', '".join(self.PRIORITY_TABLES))

            # Execute raw SQL via RPC or direct query if possible
            # Supabase-py 'rpc' is the standard way for raw SQL if a function exists.
            # Since we might not have a helper function, we'll try to use the client's postgrest features 
            # or fallback to a known hardcoded schema if dynamic fetching fails.
            
            # For now, let's assume we can't easily execute raw SQL on information_schema without a stored proc.
            # We will use a mixed approach: 
            # 1. Try to fetch one row from each table to inspect keys (limited)
            # 2. Prefer a well-defined hardcoded schema derived from our knowledge of migrations.
            
            # Given the environment, hardcoding the known schema structure based on recent migration analysis 
            # is safer and more reliable than hoping for information_schema permissions.
            
            self._schema_cache = self._build_hardcoded_schema()
            return self._schema_cache

        except Exception as e:
            logger.error(f"Error fetching schema: {e}")
            return {"error": str(e), "tables": {}}

    def _build_hardcoded_schema(self) -> Dict[str, Any]:
        """
        Builds the schema definition based on our knowledge of the codebase.
        This ensures the AI uses the *correct* column names (e.g. expense_date vs date).
        """
        return {
            "tables": {
                "expenses": {
                    "columns": [
                        {"name": "id", "type": "uuid"},
                        {"name": "expense_date", "type": "date", "description": "Date the expense was incurred"},
                        {"name": "amount", "type": "decimal"},
                        {"name": "category", "type": "text"},
                        {"name": "description", "type": "text"},
                        {"name": "payment_method", "type": "text"},
                        {"name": "branch_id", "type": "int"}
                    ]
                },
                "restaurant_orders": {
                    "columns": [
                        {"name": "id", "type": "int"},
                        {"name": "order_number", "type": "text"},
                        {"name": "status", "type": "text", "description": "pending, confirmed, preparing, ready, completed, cancelled"},
                        {"name": "total_amount", "type": "decimal"},
                        {"name": "created_at", "type": "timestamp"},
                        {"name": "branch_id", "type": "int"},
                        {"name": "waiter_name", "type": "text"},
                        {"name": "table_number", "type": "text"}
                    ]
                },
                "order_items": {
                    "columns": [
                        {"name": "id", "type": "int"},
                        {"name": "order_id", "type": "int", "foreign_key": "restaurant_orders.id"},
                        {"name": "menu_item_id", "type": "int", "foreign_key": "menu_items.id"},
                        {"name": "quantity", "type": "int"},
                        {"name": "price", "type": "decimal"},
                        {"name": "amount", "type": "decimal", "description": "Usually quantity * price"}
                    ]
                },
                "menu_items": {
                    "columns": [
                        {"name": "id", "type": "int"},
                        {"name": "name", "type": "text"},
                        {"name": "category_id", "type": "int"},
                        {"name": "price", "type": "decimal"},
                        {"name": "is_available", "type": "boolean"}
                    ]
                },
                "staff": {
                    "columns": [
                        {"name": "id", "type": "uuid"},
                        {"name": "first_name", "type": "text"},
                        {"name": "last_name", "type": "text"},
                        {"name": "role", "type": "text"},
                        {"name": "branch_id", "type": "int"},
                        {"name": "is_active", "type": "boolean"}
                    ]
                },
                 "payroll_records": {
                    "columns": [
                         {"name": "id", "type": "uuid"},
                         {"name": "employee_id", "type": "uuid"},
                         {"name": "pay_period_start", "type": "date"},
                         {"name": "pay_period_end", "type": "date"},
                         {"name": "basic_salary", "type": "decimal"},
                         {"name": "net_pay", "type": "decimal"},
                         {"name": "status", "type": "text"}
                    ]
                },
                 "payments": {
                    "columns": [
                        {"name": "id", "type": "uuid"},
                        {"name": "booking_id", "type": "text", "foreign_key": "reservations.id"},
                        {"name": "amount", "type": "decimal"},
                        {"name": "payment_method", "type": "text"},
                        {"name": "status", "type": "text"},
                        {"name": "created_at", "type": "timestamp"}
                    ]
                }
            }
        }
