import sys
import os
from unittest.mock import MagicMock

# Add current directory to path
sys.path.append(os.getcwd())

def test_ai_setup():
    print("Testing AI Analyst Setup...")
    
    try:
        # Test import style requested by user
        from google import genai
        print("PASS: 'from google import genai' successful")
        
        # Test imports
        from ai.ai_analyst import AIAnalyst
        from ai.schema_registry import SchemaRegistry
        print("PASS: AI modules imported")
        
        # Mock Fetcher
        mock_fetcher = MagicMock()
        mock_fetcher.client = MagicMock()
        
        # Instantiate
        analyst = AIAnalyst(mock_fetcher)
        print(f"PASS: AIAnalyst instantiated. Gemini Client present: {analyst.client is not None}")
        
        # Test Schema Registry
        registry = SchemaRegistry(mock_fetcher.client)
        schema = registry.get_schema()
        print(f"PASS: Schema Registry returned {len(schema.get('tables', {}))} priority tables")
        
        print("\nALL SYSTEM CHECKS PASSED")
        return True
        
    except ImportError as e:
        print(f"FAIL: Import Error - {e}")
    except Exception as e:
        print(f"FAIL: Error - {e}")
        import traceback
        traceback.print_exc()
    return False

if __name__ == "__main__":
    test_ai_setup()
