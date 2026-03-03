"""
Notification Automation Service for Kyogong
Monitors system events and generates automated notifications
"""

import os
import sys
import time
import schedule
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_PROJECT_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase: Client = create_client(supabase_url, supabase_key)

# Backend API URL
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5000/api')

class NotificationAutomation:
    """Handles automated notification generation based on system events"""
    
    def __init__(self):
        self.notification_categories = {
            'booking': 'Booking & Reservations',
            'housekeeping': 'Housekeeping',
            'inventory': 'Inventory & Stock',
            'maintenance': 'Maintenance',
            'finance': 'Finance & Payments',
            'staff': 'Staff Management',
            'system': 'System Alerts',
            'guest': 'Guest Services'
        }
    
    def create_notification(
        self,
        title: str,
        message: str,
        category: str,
        notification_type: str = 'info',
        priority: str = 'medium',
        user_id: Optional[int] = None,
        role: Optional[str] = None,
        branch_id: Optional[int] = None,
        action_url: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> bool:
        """Create a notification via the backend API"""
        try:
            notification_data = {
                'title': title,
                'message': message,
                'type': notification_type,
                'category': category,
                'priority': priority,
                'user_id': user_id,
                'role': role,
                'branch_id': branch_id,
                'action_url': action_url,
                'metadata': metadata
            }
            
            # Remove None values
            notification_data = {k: v for k, v in notification_data.items() if v is not None}
            
            response = supabase.table('notifications').insert(notification_data).execute()
            
            if response.data:
                print(f"✓ Created notification: {title}")
                return True
            else:
                print(f"✗ Failed to create notification: {title}")
                return False
                
        except Exception as e:
            print(f"Error creating notification: {e}")
            return False
    
    def check_upcoming_checkouts(self):
        """Notify reception about checkouts today and tomorrow"""
        try:
            today = datetime.now().date()
            tomorrow = today + timedelta(days=1)
            
            # Get checkouts for today
            today_checkouts = supabase.table('bookings')\
                .select('*, rooms(room_number, type), guests(first_name, last_name)')\
                .eq('status', 'checked_in')\
                .gte('check_out_date', today.isoformat())\
                .lt('check_out_date', tomorrow.isoformat())\
                .execute()
            
            if today_checkouts.data and len(today_checkouts.data) > 0:
                count = len(today_checkouts.data)
                self.create_notification(
                    title=f"{count} Checkout{'s' if count > 1 else ''} Today",
                    message=f"You have {count} guest{'s' if count > 1 else ''} checking out today. Please prepare checkout procedures.",
                    category='booking',
                    notification_type='info',
                    priority='high',
                    role='receptionist',
                    action_url='/dashboard/reception/checkouts',
                    metadata={'checkout_date': today.isoformat(), 'count': count}
                )
            
            # Get checkouts for tomorrow
            day_after = tomorrow + timedelta(days=1)
            tomorrow_checkouts = supabase.table('bookings')\
                .select('*, rooms(room_number), guests(first_name, last_name)')\
                .eq('status', 'checked_in')\
                .gte('check_out_date', tomorrow.isoformat())\
                .lt('check_out_date', day_after.isoformat())\
                .execute()
            
            if tomorrow_checkouts.data and len(tomorrow_checkouts.data) > 0:
                count = len(tomorrow_checkouts.data)
                self.create_notification(
                    title=f"{count} Checkout{'s' if count > 1 else ''} Tomorrow",
                    message=f"Reminder: {count} guest{'s' if count > 1 else ''} checking out tomorrow. Plan room assignments accordingly.",
                    category='booking',
                    notification_type='info',
                    priority='medium',
                    role='receptionist',
                    action_url='/dashboard/reception/checkouts',
                    metadata={'checkout_date': tomorrow.isoformat(), 'count': count}
                )
                
        except Exception as e:
            print(f"Error checking upcoming checkouts: {e}")
    
    def check_low_stock_items(self):
        """Notify storekeepers about low stock items"""
        try:
            # Check inventory items with low stock
            low_stock = supabase.table('inventory_items')\
                .select('*, category:categories(name)')\
                .lte('quantity', supabase.table('inventory_items').select('reorder_level'))\
                .eq('status', 'active')\
                .execute()
            
            if low_stock.data and len(low_stock.data) > 0:
                count = len(low_stock.data)
                items_list = ', '.join([item['name'] for item in low_stock.data[:5]])
                more_text = f" and {count - 5} more" if count > 5 else ""
                
                # Notify central storekeeper
                self.create_notification(
                    title=f"{count} Low Stock Alert{'s' if count > 1 else ''}",
                    message=f"The following items are running low: {items_list}{more_text}. Please initiate reordering.",
                    category='inventory',
                    notification_type='warning',
                    priority='high',
                    role='central_storekeeper',
                    action_url='/dashboard/central-store/inventory',
                    metadata={'count': count, 'items': [item['item_code'] for item in low_stock.data]}
                )
                
            # Check branch stock levels
            branches = supabase.table('branches').select('id, name, code').neq('is_central_warehouse', True).execute()
            
            for branch in branches.data:
                branch_low_stock = supabase.table('branch_stock')\
                    .select('*, inventory_item:inventory_items(name, reorder_level)')\
                    .eq('branch_id', branch['id'])\
                    .filter('quantity', 'lte', 'inventory_item.reorder_level')\
                    .execute()
                
                if branch_low_stock.data and len(branch_low_stock.data) > 0:
                    count = len(branch_low_stock.data)
                    self.create_notification(
                        title=f"{count} Low Stock Item{'s' if count > 1 else ''} in {branch['name']}",
                        message=f"Branch {branch['code']} has {count} item{'s' if count > 1 else ''} running low. Consider requesting stock from central warehouse.",
                        category='inventory',
                        notification_type='warning',
                        priority='medium',
                        role='branch_storekeeper',
                        branch_id=branch['id'],
                        action_url='/dashboard/branch-store/stock',
                        metadata={'branch_code': branch['code'], 'count': count}
                    )
                    
        except Exception as e:
            print(f"Error checking low stock items: {e}")
    
    def check_pending_stock_requests(self):
        """Notify about pending stock transfer requests"""
        try:
            # Get pending requests older than 24 hours
            yesterday = (datetime.now() - timedelta(days=1)).isoformat()
            
            pending_requests = supabase.table('stock_requests')\
                .select('*, branch:branches(name, code)')\
                .eq('status', 'pending')\
                .lt('created_at', yesterday)\
                .execute()
            
            if pending_requests.data and len(pending_requests.data) > 0:
                count = len(pending_requests.data)
                self.create_notification(
                    title=f"{count} Pending Stock Request{'s' if count > 1 else ''}",
                    message=f"You have {count} stock request{'s' if count > 1 else ''} pending for over 24 hours. Please review and process.",
                    category='inventory',
                    notification_type='warning',
                    priority='high',
                    role='central_storekeeper',
                    action_url='/dashboard/central-store/requests',
                    metadata={'count': count}
                )
                
        except Exception as e:
            print(f"Error checking pending stock requests: {e}")
    
    def check_overdue_maintenance(self):
        """Notify about overdue maintenance tasks"""
        try:
            today = datetime.now().date().isoformat()
            
            overdue_tasks = supabase.table('maintenance_tasks')\
                .select('*, asset:assets(name, location)')\
                .in_('status', ['pending', 'in_progress'])\
                .lt('due_date', today)\
                .execute()
            
            if overdue_tasks.data and len(overdue_tasks.data) > 0:
                count = len(overdue_tasks.data)
                self.create_notification(
                    title=f"{count} Overdue Maintenance Task{'s' if count > 1 else ''}",
                    message=f"You have {count} maintenance task{'s' if count > 1 else ''} that are overdue. Please prioritize completion.",
                    category='maintenance',
                    notification_type='error',
                    priority='urgent',
                    role='maintenance',
                    action_url='/dashboard/maintenance/tasks',
                    metadata={'count': count}
                )
                
        except Exception as e:
            print(f"Error checking overdue maintenance: {e}")
    
    def check_dirty_rooms_status(self):
        """Notify housekeeping about rooms needing attention"""
        try:
            # Get dirty rooms count per branch
            branches = supabase.table('branches').select('id, name, code').execute()
            
            for branch in branches.data:
                dirty_rooms = supabase.table('rooms')\
                    .select('room_number, status')\
                    .eq('branch_id', branch['id'])\
                    .eq('status', 'dirty')\
                    .execute()
                
                if dirty_rooms.data and len(dirty_rooms.data) > 3:  # Only alert if more than 3 dirty rooms
                    count = len(dirty_rooms.data)
                    self.create_notification(
                        title=f"{count} Rooms Need Cleaning",
                        message=f"There are {count} dirty rooms in {branch['name']} that need immediate attention.",
                        category='housekeeping',
                        notification_type='warning',
                        priority='high',
                        role='housekeeping',
                        branch_id=branch['id'],
                        action_url='/dashboard/housekeeping/rooms',
                        metadata={'branch_code': branch['code'], 'count': count}
                    )
                    
        except Exception as e:
            print(f"Error checking dirty rooms: {e}")
    
    def check_pending_payments(self):
        """Notify finance about pending payments"""
        try:
            # Get bookings with pending payments
            pending_payments = supabase.table('bookings')\
                .select('*, guests(first_name, last_name), rooms(room_number)')\
                .eq('payment_status', 'pending')\
                .in_('status', ['confirmed', 'checked_in'])\
                .execute()
            
            if pending_payments.data and len(pending_payments.data) > 0:
                count = len(pending_payments.data)
                total_amount = sum([booking.get('total_price', 0) for booking in pending_payments.data])
                
                self.create_notification(
                    title=f"{count} Pending Payment{'s' if count > 1 else ''}",
                    message=f"{count} booking{'s' if count > 1 else ''} with pending payments totaling KES {total_amount:,.2f}. Follow up required.",
                    category='finance',
                    notification_type='warning',
                    priority='high',
                    role='accountant',
                    action_url='/dashboard/finance/payments',
                    metadata={'count': count, 'total_amount': total_amount}
                )
                
        except Exception as e:
            print(f"Error checking pending payments: {e}")
    
    def check_expiring_supplies(self):
        """Notify about supplies expiring soon"""
        try:
            next_week = (datetime.now() + timedelta(days=7)).date().isoformat()
            
            expiring_items = supabase.table('inventory_items')\
                .select('name, expiry_date, quantity')\
                .not_('expiry_date', 'is', None)\
                .lte('expiry_date', next_week)\
                .eq('status', 'active')\
                .execute()
            
            if expiring_items.data and len(expiring_items.data) > 0:
                count = len(expiring_items.data)
                items_list = ', '.join([item['name'] for item in expiring_items.data[:3]])
                more_text = f" and {count - 3} more" if count > 3 else ""
                
                self.create_notification(
                    title=f"{count} Item{'s' if count > 1 else ''} Expiring Soon",
                    message=f"The following items are expiring within 7 days: {items_list}{more_text}. Please use or dispose appropriately.",
                    category='inventory',
                    notification_type='warning',
                    priority='high',
                    role='central_storekeeper',
                    action_url='/dashboard/central-store/inventory',
                    metadata={'count': count}
                )
                
        except Exception as e:
            print(f"Error checking expiring supplies: {e}")
    
    def check_staff_attendance(self):
        """Notify managers about staff attendance issues"""
        try:
            today = datetime.now().date().isoformat()
            
            # Check for absent staff (implementation depends on your attendance tracking)
            # This is a placeholder - adjust based on your actual attendance system
            
            branches = supabase.table('branches').select('id, name').execute()
            
            for branch in branches.data:
                # Check if critical roles are covered
                critical_roles = ['receptionist', 'housekeeping', 'restaurant']
                
                for role in critical_roles:
                    staff_count = supabase.table('users')\
                        .select('id', count='exact')\
                        .eq('branch_id', branch['id'])\
                        .eq('role', role)\
                        .eq('status', 'active')\
                        .execute()
                    
                    if staff_count.count == 0:
                        self.create_notification(
                            title=f"No Active {role.title()} Staff",
                            message=f"Branch {branch['name']} has no active {role} staff scheduled. Please ensure coverage.",
                            category='staff',
                            notification_type='error',
                            priority='urgent',
                            role='branch_manager',
                            branch_id=branch['id'],
                            action_url='/dashboard/branch-manager/staff'
                        )
                        
        except Exception as e:
            print(f"Error checking staff attendance: {e}")
    
    def send_daily_summary(self):
        """Send daily summary to managers"""
        try:
            today = datetime.now().date().isoformat()
            
            # Gather statistics
            bookings_today = supabase.table('bookings')\
                .select('id', count='exact')\
                .eq('check_in_date', today)\
                .execute()
            
            occupancy = supabase.table('rooms')\
                .select('status', count='exact')\
                .eq('status', 'occupied')\
                .execute()
            
            total_rooms = supabase.table('rooms')\
                .select('id', count='exact')\
                .execute()
            
            occupancy_rate = (occupancy.count / total_rooms.count * 100) if total_rooms.count > 0 else 0
            
            self.create_notification(
                title="Daily Operations Summary",
                message=f"Check-ins today: {bookings_today.count}. Current occupancy: {occupancy_rate:.1f}%. Review full dashboard for details.",
                category='system',
                notification_type='info',
                priority='low',
                role='branch_manager',
                action_url='/dashboard/branch-manager',
                metadata={
                    'checkins_today': bookings_today.count,
                    'occupancy_rate': occupancy_rate,
                    'date': today
                }
            )
            
        except Exception as e:
            print(f"Error sending daily summary: {e}")
    
    def run_all_checks(self):
        """Run all notification checks"""
        print(f"\n{'='*60}")
        print(f"Running Notification Automation - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"{'='*60}\n")
        
        self.check_upcoming_checkouts()
        self.check_low_stock_items()
        self.check_pending_stock_requests()
        self.check_overdue_maintenance()
        self.check_dirty_rooms_status()
        self.check_pending_payments()
        self.check_expiring_supplies()
        self.check_staff_attendance()
        
        print(f"\n{'='*60}")
        print(f"Notification checks completed")
        print(f"{'='*60}\n")

def main():
    """Main function to run the notification automation service"""
    print("Starting Kyogong Notification Automation Service")
    print(f"Environment: {os.getenv('NODE_ENV', 'development')}")
    print(f"Backend URL: {BACKEND_URL}")
    print("="*60)
    
    automation = NotificationAutomation()
    
    # Schedule tasks
    schedule.every().day.at("08:00").do(automation.check_upcoming_checkouts)
    schedule.every().day.at("09:00").do(automation.send_daily_summary)
    schedule.every(4).hours.do(automation.check_low_stock_items)
    schedule.every(6).hours.do(automation.check_pending_stock_requests)
    schedule.every(2).hours.do(automation.check_dirty_rooms_status)
    schedule.every(3).hours.do(automation.check_overdue_maintenance)
    schedule.every().day.at("14:00").do(automation.check_pending_payments)
    schedule.every().day.at("10:00").do(automation.check_expiring_supplies)
    schedule.every().day.at("07:00").do(automation.check_staff_attendance)
    
    # Run initial check
    automation.run_all_checks()
    
    # Keep the service running
    print("\nNotification Automation Service is running...")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    except KeyboardInterrupt:
        print("\nShutting down Notification Automation Service...")
        sys.exit(0)

if __name__ == "__main__":
    main()
