"""
Test script for security report generation
"""
import requests
import json
from datetime import datetime

# Test data
test_data = {
    "date_range": "Last 24 Hours",
    "summary": {
        "total_logins": 150,
        "failed_logins": 12,
        "suspicious_count": 5,
        "critical_events": 2,
        "failure_rate": 8.0,
        "avg_threat_score": 15.5
    },
    "threat_analysis": {
        "total": 150,
        "suspicious": 5,
        "vpn_detected": 3,
        "proxy_detected": 2,
        "high_threat": 2
    },
    "geographic_distribution": [
        {"country": "Kenya", "count": 120, "suspicious": 2},
        {"country": "United States", "count": 15, "suspicious": 1},
        {"country": "United Kingdom", "count": 10, "suspicious": 1},
        {"country": "Nigeria", "count": 3, "suspicious": 1},
        {"country": "Unknown", "count": 2, "suspicious": 0}
    ],
    "logs": [
        {
            "timestamp": datetime.now().isoformat(),
            "user": {
                "email": "admin@famousgatehotels.com",
                "name": "Admin User"
            },
            "authentication": {
                "status": "success",
                "ipAddress": "192.168.1.1"
            },
            "location": {
                "city": "Nairobi",
                "country": "Kenya",
                "coordinates": {
                    "latitude": -1.286389,
                    "longitude": 36.817223
                }
            },
            "device": {
                "type": "Desktop",
                "browser": "Chrome",
                "os": "Windows 10",
                "userAgent": "Mozilla/5.0..."
            },
            "security": {
                "threatScore": 10,
                "threatLevel": "Low",
                "isVPN": False,
                "isProxy": False,
                "isSuspicious": False,
                "threatReason": None
            }
        }
    ]
}

def test_security_report():
    """Test security report generation"""
    url = "http://localhost:5001/api/reports/generate/security-report"
    
    print("Testing security report generation...")
    print(f"URL: {url}")
    
    try:
        response = requests.post(url, json=test_data, timeout=30)
        
        if response.status_code == 200:
            print("✓ Success! PDF generated")
            print(f"Content-Type: {response.headers.get('content-type')}")
            print(f"Content-Length: {len(response.content)} bytes")
            
            # Save the PDF
            filename = f"test_security_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            with open(filename, 'wb') as f:
                f.write(response.content)
            print(f"✓ PDF saved as: {filename}")
        else:
            print(f"✗ Error: {response.status_code}")
            print(f"Response: {response.text}")
    
    except requests.exceptions.ConnectionError:
        print("✗ Connection Error: Is the analytics service running on port 5001?")
        print("  Run: python app.py")
    except Exception as e:
        print(f"✗ Error: {str(e)}")

if __name__ == "__main__":
    test_security_report()
