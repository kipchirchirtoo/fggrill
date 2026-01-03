import requests
import json

def test_receipt_barcode():
    url = "http://localhost:5001/api/receipts/generate"
    data = {
        "receipt_number": "ORD2601019999",
        "date": "2026-01-01",
        "table_number": "T10",
        "customer_name": "Test Guest",
        "cashier_name": "Cashier 1",
        "items": [
            {"name": "Burger", "quantity": 1, "price": 1000, "total": 1000},
            {"name": "Coke", "quantity": 1, "price": 500, "total": 500}
        ],
        "total_amount": 1500,
        "payment_method": "cash",
        "amount_paid": 1500,
        "change_amount": 0
    }
    
    response = requests.post(url, json=data)
    if response.status_code == 200:
        with open("test_receipt.pdf", "wb") as f:
            f.write(response.content)
        print("✅ Receipt generated: test_receipt.pdf")
    else:
        print(f"❌ Failed to generate receipt: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    test_receipt_barcode()
