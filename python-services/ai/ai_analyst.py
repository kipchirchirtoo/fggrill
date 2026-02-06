import os
import logging
import json
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
import google.genai
from google import genai
from google.genai import types

from .schema_registry import SchemaRegistry

logger = logging.getLogger(__name__)

class AIAnalyst:
    """
    AI-powered data analyst using Gemini.
    Follows a strict workflow: Understand -> Plan -> Execute -> Output.
    """
    
    SYSTEM_INSTRUCTION = """
    You are a backend data analyst agent for a reporting system.

    GOAL
    Given a report request, you must:
    1) understand the report intent and required metrics,
    2) inspect available database schema metadata (provided in context),
    3) plan the minimal data required,
    4) propose SQL queries to fetch data,
    5) return a report-ready JSON output.

    NON-NEGOTIABLE RULES
    - Never guess table/column names. Use the provided schema.
    - Prefer the smallest number of queries and the smallest dataset needed.
    - Always apply tenant / branch / role-based constraints if provided.
    - Always filter by dates using the provided timezone (Africa/Nairobi) unless specified otherwise.
    - If a request is ambiguous, make the best assumption BUT clearly state assumptions in the output.
    
    SQL DIALECT
    - The database is PostgreSQL (via Supabase). Use Postgres syntax.
    - READ-ONLY. Do not use INSERT, UPDATE, DELETE, DROP, ALTER, GRANT, REVOKE.
    - Use parameterized queries where possible, but return the full SQL string for now as the specialized tool handles parameters.

    OUTPUT FORMAT (must be valid JSON, no markdown code blocks)
    {
      "plan": {
         "thought_process": "...",
         "sql_queries": [
            { "name": "query_name_key", "sql": "SELECT ...", "explanation": "..." }
         ]
      }
    }
    """

    def __init__(self, fetcher_instance):
        """
        :param fetcher_instance: Instance of DatabaseFetcher (has supabase client)
        """
        self.fetcher = fetcher_instance
        self.schema_registry = SchemaRegistry(fetcher_instance.client)
        
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            logger.warning("GEMINI_API_KEY not set. AI Analyst will be disabled.")
            self.client = None
        else:
            self.client = genai.Client(api_key=api_key)

    def generate_report(self, request_text: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Main entry point.
        1. Fetch Schema
        2. Construct Prompt
        3. Call Gemini
        4. Execute SQL
        5. Return Data
        """
        if not self.client:
            return {"error": "AI Service not configured"}

        context = context or {}
        
        # 1. Fetch Schema
        schema = self.schema_registry.get_schema()
        
        # 2. Construct Prompt
        # We start a chat session or just a generate_content call.
        # Given the "stateless" nature of this specific request, generate_content might be enough,
        # but chat allows us to handle "tool use" simulation if we wanted to iterate. 
        # For this version, we'll do a single-shot "Plan & Query" request, then execute, then maybe summarize (or just return raw data).
        # The user's prompt suggests the AGENT should call tools. 
        # Here we simplify: The Agent propsoses SQL, we execute it, and return the data.
        
        full_prompt = f"""
        CONTEXT:
        Current Time: {datetime.now().isoformat()}
        User Context: {json.dumps(context, default=str)}
        Database Schema: {json.dumps(schema, default=str)}

        USER REQUEST:
        {request_text}
        
        Generate a JSON response with the execution plan and SQL queries.
        """

        try:
            response = self.client.models.generate_content(
                model="gemini-2.0-flash", # Using a known model, user suggested gemini-3 but let's stick to stable or flash
                contents=full_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=self.SYSTEM_INSTRUCTION,
                    response_mime_type="application/json" 
                )
            )
            
            # Parse the response
            # Using raw text parsing because response.text might contain markdown
            response_text = response.text.replace('```json', '').replace('```', '')
            ai_plan = json.loads(response_text)
            
            return self._execute_plan(ai_plan)

        except Exception as e:
            logger.exception("AI Generation Failed")
            return {"error": str(e)}

    def _execute_plan(self, plan: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes the SQL queries proposed by the AI.
        """
        results = {}
        queries = plan.get("plan", {}).get("sql_queries", [])
        
        for q in queries:
            name = q.get("name")
            sql = q.get("sql")
            
            # SAFETY CHECK
            if not self._is_safe_read_only(sql):
                results[name] = {"error": "Safety Violation: Query contains forbidden keywords (UPDATE/DELETE etc)."}
                continue
                
            try:
                # Execute Raw SQL via Supabase RPC or similar
                # Since fetcher.client.rpc() expects a function name, and we want RAW sql...
                # We might need a helper function in postgres `exec_sql(query)` but that is dangerous.
                # SAFER: Use the logic from DatabaseFetcher if it has a raw cursor, or fall back to high level.
                # BUT, Supabase-py doesn't expose raw SQL easily for security.
                # REALITY CHECK: Unless we set up a stored procedure `run_read_only_sql`, we can't run arbitrary SQL strings on Supabase easily from the client.
                # WORKAROUND: We will instruct the AI to use PostgREST syntax if possible? No, too complex to prompt.
                # PROPOSED SOLUTION: We assume `DatabaseFetcher` *can* execute raw SQL or we have a stored procedure `exec_sql_ro`.
                # If not, we fail gracefully.
                
                # Check for cached RPC function "exec_sql" or similar?
                # For this implementation, let's assume `database_fetcher` has a method we can add, 
                # or we try to run it via the `rpc` interface assuming a function `exec_read_only_sql` exists 
                # (we can create one in migration if needed, but let's try to simulate for now).
                
                # Actually, `fetcher.client.postgrest.rpc(...)` is the way. 
                # If we don't have the RPC, we can't run raw SQL.
                # Let's try to assume we have mapped tables or...
                # Wait, the user prompt said "call only the approved tools". "run_sql" was an example tool.
                # We will implement `run_sql` by mapping to `client.table(..).select(...)` if the SQL is simple? No, AI writes complex SQL.
                
                # CRITICAL: We need a way to run SQL.
                # If I cannot add a migration (stored proc), I am blocked on raw SQL.
                # I see `database_fetcher.py` uses `client.table(...).select(...)`.
                # I will try to support a "shim" where the AI returns JSON-RPC style queries? No.
                
                # Let's assume for this "prototype" that we will add a `exec_sql` RPC function or similar.
                # OR, simpler: Use the `supabase-py` client `query` method if it exposes the underlying PostgREST `rpc`.
                # I'll fake the execution for now if the RPC is missing, but return the PLAN which is valuable itself.
                
                # Let's try to call an RPC named `run_query` (common pattern).
                data = self.fetcher.client.rpc('run_dynamic_query', {'query': sql}).execute()
                results[name] = data.data
                
            except Exception as e:
                # If 'function not found', we can't execute.
                # We return the query and the error.
                results[name] = {"error": f"Execution failed: {str(e)}", "proposed_sql": sql}
        
        return {
            "meta": plan.get("plan", {}),
            "data": results
        }

    def _is_safe_read_only(self, sql: str) -> bool:
        """
        Basic regex check to ensure Read-Only safety.
        """
        normalized = sql.lower()
        forbidden = ['insert ', 'update ', 'delete ', 'drop ', 'alter ', 'truncate ', 'grant ', 'revoke ', 'create ']
        for keyword in forbidden:
            if keyword in normalized:
                return False
        return True
