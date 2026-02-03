import sys
import os

# Mock the environment and modules
os.environ['SUPABASE_URL'] = 'http://mock'
os.environ['SUPABASE_KEY'] = 'mock'

# Mock md5_fix
sys.modules['md5_fix'] = type('md5_fix', (), {})

# Mock other blueprints and modules that app.py imports
mock_modules = [
    'report_scheduler', 'receipts.routes', 'finance.routes', 
    'accounting.routes', 'restaurant_inventory.routes', 'budget_analytics',
    'portals.employee_service', 'portals.guest_service',
    'email_automation.routes', 'template_generator.routes',
    'barcode_generator.routes', 'analytics.routes', 'pricing_engine.routes',
    'communication_hub.routes', 'room_service.routes', 'attendance.routes',
    'id_cards.routes', 'finance.anomaly_detector'
]
for mod in mock_modules:
    sys.modules[mod] = type(mod, (), {'receipts_bp': None, 'finance_bp': None, 'accounting_bp': None, 
                                     'audit_bp': None, 'restaurant_inventory_bp': None,
                                     'BudgetAnalytics': type('BA', (), {}),
                                     'employee_portal_bp': None, 'guest_portal_bp': None,
                                     'email_automation_bp': None, 'start_email_scheduler': lambda: None,
                                     'template_generator_bp': None, 'barcode_generator_bp': None,
                                     'analytics_bp': None, 'pricing_bp': None, 'communication_bp': None,
                                     'room_bp': None, 'attendance_bp': None, 'id_cards_bp': None,
                                     'ReportScheduler': type('RS', (), {}),
                                     'SchedulerDaemon': type('SD', (), {}),
                                     'PaymentAnomalyDetector': type('PAD', (), {'detect_anomaly': lambda x: {}})})

# Now we can try to import app
try:
    from app import app
    from reports.database_fetcher import DatabaseFetcher
    from reports.branded_pdf_generator import BrandedPDFGenerator
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

# Mock database_fetcher to return None for one of the methods and see what happens
fetcher = DatabaseFetcher()
generator = BrandedPDFGenerator()

# Test cases
test_reports = [
    ('daily_sales', {'total_revenue': 100}),
    ('occupancy', {'occupancy_rate': 75}),
    ('branch_performance', None), # This might be the one!
    ('branch_performance', {}),
]

print("Testing generators with various data inputs...")
for report_type, data in test_reports:
    print(f"\nTesting {report_type} with data: {data}")
    try:
        # We don't want to actually create a PDF, just see if it fails before that
        # But generate_report calls the specific generator
        # Mocking _create_pdf to avoid file operations
        generator._create_pdf = lambda x, filename=None: "mock_pdf_path"
        
        result = generator.generate_report(report_type, data)
        print(f"Success! Result: {result}")
    except Exception as e:
        print(f"FAILED: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
