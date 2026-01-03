#!/usr/bin/env python3
"""
Test script to debug report generation with branch filtering
"""

import os
import sys
import requests
import json
from datetime import datetime

# Test the Python service directly
def test_report_generation():
    url = "http://localhost:5001/api/reports/generate/branded-pdf"
    
    # Test data matching what branch manager should send
    test_data = {
        "reportType": "daily_sales",
        "filters": {
            "start_date": datetime.now().strftime('%Y-%m-%d'),
            "end_date": datetime.now().strftime('%Y-%m-%d'),
            "branch_id": 2,
            "branch_name": "Kericho Branch"
        },
        "useRealData": True
    }
    
    print(f"Testing report generation with data: {json.dumps(test_data, indent=2)}")
    
    try:
        response = requests.post(url, json=test_data, timeout=30)
        print(f"Response status: {response.status_code}")
        
        if response.status_code == 200:
            print("✅ Report generated successfully!")
            # Save the PDF for inspection
            with open(f"/tmp/test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf", "wb") as f:
                f.write(response.content)
            print("PDF saved to /tmp/")
        else:
            print(f"❌ Error: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection error: {e}")
        print("Make sure Python service is running on port 5001")

if __name__ == "__main__":
    test_report_generation()
