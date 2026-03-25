import requests

url = "http://localhost:5001/api/reports/auditor/export/revenue_reconciliation"
params = {
    "start_date": "2026-01-01",
    "end_date": "2026-03-24"
}

print("Testing revenue reconciliation export...")
try:
    r = requests.get(url, params=params, timeout=30)
    print(f"Status: {r.status_code}")
    print(f"Content-Type: {r.headers.get('Content-Type')}")
    print(f"Content-Length: {len(r.content)} bytes")
    if r.status_code == 200:
        print("SUCCESS - PDF generated!")
    else:
        print("Response:", r.text[:500])
except Exception as e:
    print(f"Error: {e}")
