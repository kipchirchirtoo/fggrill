import os
import requests
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

class DataFetcher:
    def __init__(self):
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:3001/api')
        self.api_key = os.getenv('API_KEY', '')
    
    def fetch_report_data(self, report_type, filters):
        """Fetch data for report from backend API"""
        try:
            if report_type == 'financial_summary':
                return self._fetch_financial_data(filters)
            elif report_type == 'payroll_summary':
                return self._fetch_payroll_data(filters)
            elif report_type == 'inventory_status':
                return self._fetch_inventory_data(filters)
            elif report_type == 'booking_summary':
                return self._fetch_booking_data(filters)
            elif report_type == 'employee_attendance':
                return self._fetch_attendance_data(filters)
            elif report_type == 'revenue_analysis':
                return self._fetch_revenue_analysis(filters)
            elif report_type == 'stock_movement':
                return self._fetch_stock_movement(filters)
            elif report_type == 'occupancy_rate':
                return self._fetch_occupancy_data(filters)
            else:
                return {'error': f'Unknown report type: {report_type}'}
        except Exception as e:
            logger.error(f"Error fetching data for {report_type}: {str(e)}")
            return {'error': str(e)}
    
    def _fetch_financial_data(self, filters):
        """Fetch financial summary data"""
        try:
            params = self._build_params(filters)
            response = requests.get(
                f"{self.backend_url}/finance/summary",
                params=params,
                headers=self._get_headers()
            )
            
            if response.status_code == 200:
                return response.json().get('data', {})
            else:
                logger.error(f"Failed to fetch financial data: {response.text}")
                return self._mock_financial_data()
        except Exception as e:
            logger.error(f"Error fetching financial data: {str(e)}")
            return self._mock_financial_data()
    
    def _fetch_payroll_data(self, filters):
        """Fetch payroll data"""
        try:
            params = self._build_params(filters)
            response = requests.get(
                f"{self.backend_url}/payroll/summary",
                params=params,
                headers=self._get_headers()
            )
            
            if response.status_code == 200:
                return response.json().get('data', {})
            else:
                return self._mock_payroll_data()
        except:
            return self._mock_payroll_data()
    
    def _fetch_inventory_data(self, filters):
        """Fetch inventory data"""
        try:
            params = self._build_params(filters)
            response = requests.get(
                f"{self.backend_url}/store/inventory/status",
                params=params,
                headers=self._get_headers()
            )
            
            if response.status_code == 200:
                return response.json().get('data', {})
            else:
                return self._mock_inventory_data()
        except:
            return self._mock_inventory_data()
    
    def _fetch_booking_data(self, filters):
        """Fetch booking data"""
        try:
            params = self._build_params(filters)
            response = requests.get(
                f"{self.backend_url}/bookings",
                params=params,
                headers=self._get_headers()
            )
            
            if response.status_code == 200:
                return response.json().get('data', {})
            else:
                return self._mock_booking_data()
        except:
            return self._mock_booking_data()
    
    def _fetch_attendance_data(self, filters):
        """Fetch attendance data"""
        try:
            params = self._build_params(filters)
            response = requests.get(
                f"{self.backend_url}/staff/attendance",
                params=params,
                headers=self._get_headers()
            )
            
            if response.status_code == 200:
                return response.json().get('data', {})
            else:
                return self._mock_attendance_data()
        except:
            return self._mock_attendance_data()
    
    def _fetch_revenue_analysis(self, filters):
        """Fetch revenue analysis data"""
        try:
            params = self._build_params(filters)
            response = requests.get(
                f"{self.backend_url}/finance/revenue-analysis",
                params=params,
                headers=self._get_headers()
            )
            
            if response.status_code == 200:
                return response.json().get('data', {})
            else:
                return self._mock_revenue_analysis()
        except:
            return self._mock_revenue_analysis()
    
    def _fetch_stock_movement(self, filters):
        """Fetch stock movement data"""
        try:
            params = self._build_params(filters)
            response = requests.get(
                f"{self.backend_url}/store/movements",
                params=params,
                headers=self._get_headers()
            )
            
            if response.status_code == 200:
                return response.json().get('data', {})
            else:
                return self._mock_stock_movement()
        except:
            return self._mock_stock_movement()
    
    def _fetch_occupancy_data(self, filters):
        """Fetch occupancy data"""
        try:
            params = self._build_params(filters)
            response = requests.get(
                f"{self.backend_url}/bookings/occupancy",
                params=params,
                headers=self._get_headers()
            )
            
            if response.status_code == 200:
                return response.json().get('data', {})
            else:
                return self._mock_occupancy_data()
        except:
            return self._mock_occupancy_data()
    
    def _build_params(self, filters):
        """Build query parameters from filters"""
        params = {}
        if 'startDate' in filters:
            params['start_date'] = filters['startDate']
        if 'endDate' in filters:
            params['end_date'] = filters['endDate']
        if 'branch' in filters:
            params['branch'] = filters['branch']
        if 'department' in filters:
            params['department'] = filters['department']
        return params
    
    def _get_headers(self):
        """Get request headers"""
        headers = {'Content-Type': 'application/json'}
        if self.api_key:
            headers['Authorization'] = f'Bearer {self.api_key}'
        return headers
    
    # Mock data methods (fallback when API is unavailable)
    def _mock_financial_data(self):
        return {
            'totalRevenue': 5000000,
            'totalExpenses': 3200000,
            'netProfit': 1800000,
            'operatingMargin': 36.0,
            'revenueBreakdown': {
                'room_bookings': 2500000,
                'restaurant': 1500000,
                'bar': 800000,
                'other_services': 200000
            }
        }
    
    def _mock_payroll_data(self):
        return {
            'employees': [
                {
                    'employeeId': 'EMP001',
                    'name': 'John Doe',
                    'position': 'Manager',
                    'grossPay': 80000,
                    'deductions': 12000,
                    'netPay': 68000
                },
                {
                    'employeeId': 'EMP002',
                    'name': 'Jane Smith',
                    'position': 'Receptionist',
                    'grossPay': 45000,
                    'deductions': 6750,
                    'netPay': 38250
                }
            ]
        }
    
    def _mock_inventory_data(self):
        return {
            'items': [
                {
                    'itemCode': 'ITM001',
                    'itemName': 'Bed Sheets',
                    'category': 'Linen',
                    'currentStock': 50,
                    'minStock': 20,
                    'unit': 'pcs'
                },
                {
                    'itemCode': 'ITM002',
                    'itemName': 'Toiletries Set',
                    'category': 'Amenities',
                    'currentStock': 15,
                    'minStock': 30,
                    'unit': 'sets'
                }
            ]
        }
    
    def _mock_booking_data(self):
        return {
            'bookings': [
                {
                    'bookingId': 'BK001',
                    'guestName': 'Alice Johnson',
                    'roomNumber': '101',
                    'checkIn': '2024-01-15',
                    'checkOut': '2024-01-18',
                    'nights': 3,
                    'totalAmount': 15000,
                    'status': 'Confirmed'
                }
            ]
        }
    
    def _mock_attendance_data(self):
        return {
            'attendance': [
                {
                    'employeeId': 'EMP001',
                    'name': 'John Doe',
                    'department': 'Management',
                    'date': '2024-01-15',
                    'checkIn': '08:00',
                    'checkOut': '17:00',
                    'hours': '9.0'
                }
            ]
        }
    
    def _mock_revenue_analysis(self):
        return {
            'dailyRevenue': [
                {
                    'date': '2024-01-15',
                    'rooms': 50000,
                    'restaurant': 30000,
                    'bar': 15000,
                    'other': 5000,
                    'total': 100000
                }
            ]
        }
    
    def _mock_stock_movement(self):
        return {
            'movements': [
                {
                    'date': '2024-01-15',
                    'itemCode': 'ITM001',
                    'itemName': 'Bed Sheets',
                    'type': 'Transfer',
                    'quantity': 10,
                    'from': 'Central Store',
                    'to': 'Branch 1',
                    'reference': 'TRF001'
                }
            ]
        }
    
    def _mock_occupancy_data(self):
        return {
            'dailyOccupancy': [
                {
                    'date': '2024-01-15',
                    'totalRooms': 50,
                    'occupied': 35,
                    'vacant': 15,
                    'occupancyRate': 70.0,
                    'revenue': 175000
                }
            ]
        }
