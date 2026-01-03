import requests
import json
import os

url = "http://localhost:5001/api/reports/generate/branded-pdf"

def test_report(report_type, data, filename):
    payload = {
        "reportType": report_type,
        "filters": {
            "period": "week",
            "start_date": "2026-01-02",
            "end_date": "2026-01-02"
        },
        "useRealData": False,
        "data": data
    }
    
    print(f"Testing {report_type}...")
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        with open(filename, "wb") as f:
            f.write(response.content)
        print(f"PDF generated successfully: {filename}")
    else:
        print(f"Error: {response.text}")

# Test Branch Performance
performance_data = {
    "total_revenue": 100000,
    "total_orders": 500,
    "avg_satisfaction": 4.5,
    "best_performer": "Main Branch",
    "worst_performer": "Small Branch",
    "branches": [
        {
            "branch_name": "Main Branch",
            "revenue": 60000,
            "revenue_change": 10.5,
            "orders": 300,
            "avg_order_value": 200,
            "customer_satisfaction": 4.8,
            "staff_efficiency": 95,
            "target_achievement": 110
        },
        {
            "branch_name": "Small Branch",
            "revenue": 40000,
            "revenue_change": None, # Test None value
            "orders": 200,
            "avg_order_value": 200,
            "customer_satisfaction": None, # Test None value
            "staff_efficiency": 85,
            "target_achievement": 90
        }
    ]
}
test_report("branch_performance", performance_data, "test_performance.pdf")

# Test Branch Comparison
comparison_data = {
    "title": "Weekly Revenue Comparison",
    "period": "week",
    "metric": "revenue",
    "branches": [
        {"name": "Main Branch", "revenue": 60000},
        {"name": "Small Branch", "revenue": 40000},
        {"name": "New Branch", "revenue": 20000}
    ]
}
test_report("branch_comparison", comparison_data, "test_comparison.pdf")
