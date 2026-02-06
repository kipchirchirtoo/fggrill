-- Create a function to run dynamic SQL queries (Read-Only)
-- This is required for the AI Analyst to execute generated queries.

CREATE OR REPLACE FUNCTION run_dynamic_query(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    -- Basic safety check to prevent write operations
    -- (The application layer should also check this, but double security is good)
    IF lower(query) ~ '\s*(insert|update|delete|drop|alter|truncate|grant|revoke|create)\s+' THEN
        RAISE EXCEPTION 'Write operations are not allowed in dynamic queries.';
    END IF;

    -- Execute the query and return results as JSON
    EXECUTE 'SELECT json_agg(t) FROM (' || query || ') t' INTO result;
    
    -- Return empty array if null
    IF result IS NULL THEN
        result := '[]'::json;
    END IF;
    
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    -- Return the error as a JSON object
    RETURN json_build_object('error', SQLERRM);
END;
$$;
