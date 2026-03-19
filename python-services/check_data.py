
import os
import sys
from dotenv import load_dotenv
from supabase import create_client
import json

load_dotenv()

url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_SERVICE_KEY')
client = create_client(url, key)

def check_data():
    start_date = "2025-11-17T00:00:00"
    end_date = "2026-03-19T23:59:59"
    
    print(f"Checking data for {start_date} to {end_date}...")
    
    # 1. Payments
    pay_res = client.table('payments').select('count', count='exact').gte('created_at', start_date).lte('created_at', end_date).eq('status', 'completed').execute()
    print(f"Completed Payments: {pay_res.count}")
    
    # 2. Restaurant Orders
    rest_res = client.table('restaurant_orders').select('count', count='exact').gte('created_at', start_date).lte('created_at', end_date).in_('status', ['completed', 'paid', 'delivered']).execute()
    print(f"Restaurant Orders (Completed/Paid/Delivered): {rest_res.count}")
    
    # 3. Reservations
    room_res = client.table('reservations').select('count', count='exact').gte('created_at', start_date).lte('created_at', end_date).in_('status', ['confirmed', 'checked_in', 'checked_out']).execute()
    print(f"Reservations (Confirmed/In/Out): {room_res.count}")
    
    # 4. Catering
    cat_res = client.table('outside_catering_bookings').select('count', count='exact').gte('event_date', start_date).lte('event_date', end_date).execute()
    print(f"Catering Bookings: {cat_res.count}")

    if pay_res.count > 0:
        sample = client.table('payments').select('*').gte('created_at', start_date).lte('created_at', end_date).eq('status', 'completed').limit(1).execute()
        print("\nSample Payment:")
        print(json.dumps(sample.data[0], indent=2))

if __name__ == '__main__':
    check_data()
