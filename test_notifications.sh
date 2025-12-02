#!/bin/bash

# Test script to create sample notifications for Famous Gate Hotel

echo "🔔 Creating Test Notifications for Multi-Branch Multi-Role System..."
echo ""

API_URL="http://localhost:5000/api/notifications"

# Get auth token (you'll need to provide a valid token)
# For testing in dev mode, the backend might allow dev-user
TOKEN="${1:-dev-token}"

echo "📍 Using API: $API_URL"
echo "🔑 Token: ${TOKEN:0:20}..."
echo ""

# Test 1: Create notification for specific user
echo "1️⃣ Creating notification for specific user..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "user_id": null,
    "role": "branch_manager",
    "branch_id": 1,
    "title": "Low Stock Alert",
    "message": "Coffee beans running low at Famous Gate Bomet. Current stock: 5kg. Minimum required: 20kg.",
    "type": "warning",
    "category": "inventory",
    "priority": "high",
    "metadata": {
      "branch_name": "Famous Gate Bomet",
      "role": "branch_manager",
      "item": "Coffee Beans",
      "current_stock": "5kg",
      "min_stock": "20kg"
    }
  }' | jq '.'

echo ""
echo "2️⃣ Creating notification for all super admins..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "role": "super_admin",
    "title": "System Update",
    "message": "New iOS-styled UI has been deployed across all dashboards. All staff should see consistent design.",
    "type": "success",
    "category": "system",
    "priority": "medium",
    "metadata": {
      "role": "super_admin",
      "update_type": "UI_REFRESH"
    }
  }' | jq '.'

echo ""
echo "3️⃣ Creating notification for housekeeping staff..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "role": "housekeeping",
    "branch_id": 2,
    "title": "Urgent Room Cleaning",
    "message": "Room 205 checkout completed. VIP guest checking in at 2PM. Priority cleaning required.",
    "type": "warning",
    "category": "housekeeping",
    "priority": "urgent",
    "action_url": "/dashboard/housekeeping",
    "metadata": {
      "branch_name": "Famous Gate Kericho",
      "role": "housekeeping",
      "room_number": "205",
      "deadline": "2:00 PM"
    }
  }' | jq '.'

echo ""
echo "4️⃣ Creating notification for branch storekeepers..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "role": "branch_storekeeper",
    "title": "Incoming Delivery",
    "message": "Central warehouse dispatch #D-12345 arriving today. Contains 25 items. Please prepare receiving area.",
    "type": "info",
    "category": "stock",
    "priority": "medium",
    "metadata": {
      "role": "branch_storekeeper",
      "dispatch_id": "D-12345",
      "item_count": 25
    }
  }' | jq '.'

echo ""
echo "5️⃣ Creating notification for accountants..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "role": "accountant",
    "title": "Payment Pending",
    "message": "Supplier invoice #INV-2024-145 for KES 250,000 is due in 3 days. Please process payment.",
    "type": "warning",
    "category": "finance",
    "priority": "high",
    "action_url": "/dashboard/finance/invoices",
    "metadata": {
      "role": "accountant",
      "invoice_number": "INV-2024-145",
      "amount": "KES 250,000",
      "due_days": 3
    }
  }' | jq '.'

echo ""
echo "6️⃣ Creating notification for reception staff..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "role": "receptionist",
    "branch_id": 1,
    "title": "VIP Arrival Expected",
    "message": "Government delegation of 8 guests arriving at 6PM. Premium suites prepared. Special catering arranged.",
    "type": "info",
    "category": "booking",
    "priority": "high",
    "metadata": {
      "branch_name": "Famous Gate Bomet",
      "role": "receptionist",
      "guest_type": "VIP",
      "party_size": 8,
      "arrival_time": "6:00 PM"
    }
  }' | jq '.'

echo ""
echo "✅ Test notifications created!"
echo ""
echo "📱 Now open the notification bell in your dashboard to see them!"
echo "🔍 Check browser console for debug logs showing:"
echo "   - User role and branch"
echo "   - API response data"
echo "   - Number of notifications loaded"
