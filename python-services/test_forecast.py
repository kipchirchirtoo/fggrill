import requests
import json

def test_forecast():
    url = "http://localhost:5001/api/forecasting/generate"
    payload = {
        "branch_id": 1,
        "forecast_type": "revenue",
        "metric_name": "Daily Revenue",
        "periods": 7
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_forecast()
