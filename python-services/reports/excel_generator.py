import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime
import tempfile

class ExcelReportGenerator:
    def __init__(self):
        self.header_fill = PatternFill(start_color="34495e", end_color="34495e", fill_type="solid")
        self.header_font = Font(bold=True, color="FFFFFF", size=12)
        self.border = Border(
            left=Side(style='thin'),
            right=Side(style='thin'),
            top=Side(style='thin'),
            bottom=Side(style='thin')
        )
    
    def generate_report(self, report_type, data, filters):
        """Generate Excel report based on type"""
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = report_type.replace('_', ' ').title()[:31]  # Excel sheet name max 31 chars
        
        # Add header
        self._add_header(ws, report_type, filters)
        
        # Map report types to generators
        generators = {
            'financial_summary': self._create_financial_summary,
            'payroll_summary': self._create_payroll_summary,
            'inventory_status': self._create_inventory_status,
            'booking_summary': self._create_booking_summary,
            'employee_attendance': self._create_attendance_report,
            'revenue_analysis': self._create_revenue_analysis,
            'stock_movement': self._create_stock_movement,
            'occupancy_rate': self._create_occupancy_rate,
            'occupancy': self._create_occupancy_report,
            'daily_sales': self._create_daily_sales_report,
            'housekeeping': self._create_housekeeping_report,
            'maintenance': self._create_maintenance_report,
            'restaurant_sales': self._create_restaurant_sales_report,
            'bar_sales': self._create_bar_sales_report,
            'arrivals_departures': self._create_arrivals_departures_report,
            'room_supplies': self._create_room_supplies_report,
            'manager_duty': self._create_manager_duty_report,
            'reservation': self._create_reservation_report,
            'expense': self._create_expense_report,
        }
        
        generator = generators.get(report_type, self._create_generic_report)
        generator(ws, data)
        
        # Auto-adjust column widths
        self._adjust_column_widths(ws)
        
        # Save to temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
        wb.save(temp_file.name)
        temp_file.close()
        
        return temp_file.name
    
    def _add_header(self, ws, report_type, filters):
        """Add report header"""
        ws['A1'] = 'Famous Gate Hotel'
        ws['A1'].font = Font(bold=True, size=16)
        
        ws['A2'] = report_type.replace('_', ' ').title()
        ws['A2'].font = Font(bold=True, size=14)
        
        ws['A3'] = f"Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}"
        
        if filters:
            filter_text = self._format_filters(filters)
            ws['A4'] = f"Filters: {filter_text}"
        
        # Add spacing
        ws.append([])
    
    def _format_filters(self, filters):
        """Format filters for display"""
        filter_parts = []
        if 'startDate' in filters:
            filter_parts.append(f"From {filters['startDate']}")
        if 'endDate' in filters:
            filter_parts.append(f"To {filters['endDate']}")
        if 'branch' in filters:
            filter_parts.append(f"Branch: {filters['branch']}")
        return ", ".join(filter_parts) if filter_parts else "None"
    
    def _create_financial_summary(self, ws, data):
        """Create financial summary in Excel"""
        # Find starting row
        start_row = 6
        
        # Add section header
        ws.cell(row=start_row, column=1, value="Financial Overview")
        ws.cell(row=start_row, column=1).font = Font(bold=True, size=12)
        
        # Add headers
        headers = ['Metric', 'Amount (KES)']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=start_row + 1, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.alignment = Alignment(horizontal='center')
            cell.border = self.border
        
        # Add data
        metrics = [
            ('Total Revenue', data.get('totalRevenue', 0)),
            ('Total Expenses', data.get('totalExpenses', 0)),
            ('Net Profit', data.get('netProfit', 0)),
            ('Operating Margin (%)', data.get('operatingMargin', 0))
        ]
        
        row = start_row + 2
        for metric, value in metrics:
            ws.cell(row=row, column=1, value=metric).border = self.border
            if 'Margin' in metric:
                ws.cell(row=row, column=2, value=f"{value:.2f}%").border = self.border
            else:
                ws.cell(row=row, column=2, value=value).border = self.border
                ws.cell(row=row, column=2).number_format = '#,##0.00'
            row += 1
        
        # Add revenue breakdown
        if 'revenueBreakdown' in data:
            row += 2
            ws.cell(row=row, column=1, value="Revenue Breakdown")
            ws.cell(row=row, column=1).font = Font(bold=True, size=12)
            
            row += 1
            for col, header in enumerate(['Source', 'Amount'], 1):
                cell = ws.cell(row=row, column=col, value=header)
                cell.fill = self.header_fill
                cell.font = self.header_font
                cell.border = self.border
            
            row += 1
            for source, amount in data['revenueBreakdown'].items():
                ws.cell(row=row, column=1, value=source.replace('_', ' ').title()).border = self.border
                ws.cell(row=row, column=2, value=amount).border = self.border
                ws.cell(row=row, column=2).number_format = '#,##0.00'
                row += 1
    
    def _create_payroll_summary(self, ws, data):
        """Create payroll summary in Excel"""
        start_row = 6
        
        ws.cell(row=start_row, column=1, value="Payroll Summary")
        ws.cell(row=start_row, column=1).font = Font(bold=True, size=12)
        
        headers = ['Employee ID', 'Name', 'Position', 'Gross Pay', 'Deductions', 'Net Pay']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=start_row + 1, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.alignment = Alignment(horizontal='center')
            cell.border = self.border
        
        employees = data.get('employees', [])
        row = start_row + 2
        
        for emp in employees:
            ws.cell(row=row, column=1, value=emp.get('employeeId', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=emp.get('name', 'N/A')).border = self.border
            ws.cell(row=row, column=3, value=emp.get('position', 'N/A')).border = self.border
            ws.cell(row=row, column=4, value=emp.get('grossPay', 0)).border = self.border
            ws.cell(row=row, column=4).number_format = '#,##0.00'
            ws.cell(row=row, column=5, value=emp.get('deductions', 0)).border = self.border
            ws.cell(row=row, column=5).number_format = '#,##0.00'
            ws.cell(row=row, column=6, value=emp.get('netPay', 0)).border = self.border
            ws.cell(row=row, column=6).number_format = '#,##0.00'
            row += 1
        
        # Add totals
        total_gross = sum(emp.get('grossPay', 0) for emp in employees)
        total_deductions = sum(emp.get('deductions', 0) for emp in employees)
        total_net = sum(emp.get('netPay', 0) for emp in employees)
        
        ws.cell(row=row, column=1, value="TOTAL").font = Font(bold=True)
        ws.cell(row=row, column=3, value="").border = self.border
        ws.cell(row=row, column=4, value=total_gross).border = self.border
        ws.cell(row=row, column=4).number_format = '#,##0.00'
        ws.cell(row=row, column=4).font = Font(bold=True)
        ws.cell(row=row, column=5, value=total_deductions).border = self.border
        ws.cell(row=row, column=5).number_format = '#,##0.00'
        ws.cell(row=row, column=5).font = Font(bold=True)
        ws.cell(row=row, column=6, value=total_net).border = self.border
        ws.cell(row=row, column=6).number_format = '#,##0.00'
        ws.cell(row=row, column=6).font = Font(bold=True)
    
    def _create_inventory_status(self, ws, data):
        """Create inventory status in Excel"""
        start_row = 6
        
        ws.cell(row=start_row, column=1, value="Inventory Status")
        ws.cell(row=start_row, column=1).font = Font(bold=True, size=12)
        
        headers = ['Item Code', 'Item Name', 'Category', 'Current Stock', 'Min Stock', 'Unit', 'Status']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=start_row + 1, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.alignment = Alignment(horizontal='center')
            cell.border = self.border
        
        items = data.get('items', [])
        row = start_row + 2
        
        for item in items:
            current_stock = item.get('currentStock', 0)
            min_stock = item.get('minStock', 0)
            status = 'Low Stock' if current_stock < min_stock else 'OK'
            
            ws.cell(row=row, column=1, value=item.get('itemCode', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=item.get('itemName', 'N/A')).border = self.border
            ws.cell(row=row, column=3, value=item.get('category', 'N/A')).border = self.border
            ws.cell(row=row, column=4, value=current_stock).border = self.border
            ws.cell(row=row, column=5, value=min_stock).border = self.border
            ws.cell(row=row, column=6, value=item.get('unit', 'pcs')).border = self.border
            
            status_cell = ws.cell(row=row, column=7, value=status)
            status_cell.border = self.border
            if status == 'Low Stock':
                status_cell.fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
            
            row += 1
    
    def _create_booking_summary(self, ws, data):
        """Create booking summary in Excel"""
        start_row = 6
        
        ws.cell(row=start_row, column=1, value="Booking Summary")
        ws.cell(row=start_row, column=1).font = Font(bold=True, size=12)
        
        headers = ['Booking ID', 'Guest Name', 'Room', 'Check-In', 'Check-Out', 'Nights', 'Amount', 'Status']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=start_row + 1, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.alignment = Alignment(horizontal='center')
            cell.border = self.border
        
        bookings = data.get('bookings', [])
        row = start_row + 2
        
        for booking in bookings:
            ws.cell(row=row, column=1, value=booking.get('bookingId', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=booking.get('guestName', 'N/A')).border = self.border
            ws.cell(row=row, column=3, value=booking.get('roomNumber', 'N/A')).border = self.border
            ws.cell(row=row, column=4, value=booking.get('checkIn', 'N/A')).border = self.border
            ws.cell(row=row, column=5, value=booking.get('checkOut', 'N/A')).border = self.border
            ws.cell(row=row, column=6, value=booking.get('nights', 0)).border = self.border
            ws.cell(row=row, column=7, value=booking.get('totalAmount', 0)).border = self.border
            ws.cell(row=row, column=7).number_format = '#,##0.00'
            ws.cell(row=row, column=8, value=booking.get('status', 'N/A')).border = self.border
            row += 1
    
    def _create_attendance_report(self, ws, data):
        """Create attendance report in Excel"""
        start_row = 6
        
        ws.cell(row=start_row, column=1, value="Employee Attendance")
        ws.cell(row=start_row, column=1).font = Font(bold=True, size=12)
        
        headers = ['Employee ID', 'Name', 'Department', 'Date', 'Check-In', 'Check-Out', 'Hours']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=start_row + 1, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.alignment = Alignment(horizontal='center')
            cell.border = self.border
        
        attendance = data.get('attendance', [])
        row = start_row + 2
        
        for record in attendance:
            ws.cell(row=row, column=1, value=record.get('employeeId', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=record.get('name', 'N/A')).border = self.border
            ws.cell(row=row, column=3, value=record.get('department', 'N/A')).border = self.border
            ws.cell(row=row, column=4, value=record.get('date', 'N/A')).border = self.border
            ws.cell(row=row, column=5, value=record.get('checkIn', 'N/A')).border = self.border
            ws.cell(row=row, column=6, value=record.get('checkOut', 'N/A')).border = self.border
            ws.cell(row=row, column=7, value=record.get('hours', 'N/A')).border = self.border
            row += 1
    
    def _create_revenue_analysis(self, ws, data):
        """Create revenue analysis report"""
        start_row = 6
        
        ws.cell(row=start_row, column=1, value="Revenue Analysis")
        ws.cell(row=start_row, column=1).font = Font(bold=True, size=12)
        
        headers = ['Date', 'Rooms', 'Restaurant', 'Bar', 'Other', 'Total']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=start_row + 1, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.alignment = Alignment(horizontal='center')
            cell.border = self.border
        
        revenue_data = data.get('dailyRevenue', [])
        row = start_row + 2
        
        for day in revenue_data:
            ws.cell(row=row, column=1, value=day.get('date', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=day.get('rooms', 0)).border = self.border
            ws.cell(row=row, column=2).number_format = '#,##0.00'
            ws.cell(row=row, column=3, value=day.get('restaurant', 0)).border = self.border
            ws.cell(row=row, column=3).number_format = '#,##0.00'
            ws.cell(row=row, column=4, value=day.get('bar', 0)).border = self.border
            ws.cell(row=row, column=4).number_format = '#,##0.00'
            ws.cell(row=row, column=5, value=day.get('other', 0)).border = self.border
            ws.cell(row=row, column=5).number_format = '#,##0.00'
            ws.cell(row=row, column=6, value=day.get('total', 0)).border = self.border
            ws.cell(row=row, column=6).number_format = '#,##0.00'
            row += 1
    
    def _create_stock_movement(self, ws, data):
        """Create stock movement report"""
        start_row = 6
        
        ws.cell(row=start_row, column=1, value="Stock Movement")
        ws.cell(row=start_row, column=1).font = Font(bold=True, size=12)
        
        headers = ['Date', 'Item Code', 'Item Name', 'Type', 'Quantity', 'From', 'To', 'Reference']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=start_row + 1, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.alignment = Alignment(horizontal='center')
            cell.border = self.border
        
        movements = data.get('movements', [])
        row = start_row + 2
        
        for movement in movements:
            ws.cell(row=row, column=1, value=movement.get('date', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=movement.get('itemCode', 'N/A')).border = self.border
            ws.cell(row=row, column=3, value=movement.get('itemName', 'N/A')).border = self.border
            ws.cell(row=row, column=4, value=movement.get('type', 'N/A')).border = self.border
            ws.cell(row=row, column=5, value=movement.get('quantity', 0)).border = self.border
            ws.cell(row=row, column=6, value=movement.get('from', 'N/A')).border = self.border
            ws.cell(row=row, column=7, value=movement.get('to', 'N/A')).border = self.border
            ws.cell(row=row, column=8, value=movement.get('reference', 'N/A')).border = self.border
            row += 1
    
    def _create_occupancy_rate(self, ws, data):
        """Create occupancy rate report"""
        start_row = 6
        
        ws.cell(row=start_row, column=1, value="Room Occupancy Rate")
        ws.cell(row=start_row, column=1).font = Font(bold=True, size=12)
        
        headers = ['Date', 'Total Rooms', 'Occupied', 'Vacant', 'Occupancy %', 'Revenue']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=start_row + 1, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.alignment = Alignment(horizontal='center')
            cell.border = self.border
        
        occupancy_data = data.get('dailyOccupancy', [])
        row = start_row + 2
        
        for day in occupancy_data:
            ws.cell(row=row, column=1, value=day.get('date', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=day.get('totalRooms', 0)).border = self.border
            ws.cell(row=row, column=3, value=day.get('occupied', 0)).border = self.border
            ws.cell(row=row, column=4, value=day.get('vacant', 0)).border = self.border
            ws.cell(row=row, column=5, value=f"{day.get('occupancyRate', 0):.2f}%").border = self.border
            ws.cell(row=row, column=6, value=day.get('revenue', 0)).border = self.border
            ws.cell(row=row, column=6).number_format = '#,##0.00'
            row += 1
    
    def _create_generic_report(self, ws, data):
        """Create generic report for unknown types"""
        ws['A6'] = "Report Data"
        ws['A6'].font = Font(bold=True, size=12)
        row = 7
        for key, value in data.items():
            if not isinstance(value, (list, dict)):
                ws.cell(row=row, column=1, value=str(key)).border = self.border
                ws.cell(row=row, column=2, value=str(value)).border = self.border
                row += 1

    def _create_occupancy_report(self, ws, data):
        """Create occupancy report"""
        start_row = 6
        ws.cell(row=start_row, column=1, value="Occupancy Summary").font = Font(bold=True, size=12)
        
        # Summary metrics
        metrics = [
            ('Occupancy Rate', f"{data.get('occupancy_rate', 0):.1f}%"),
            ('Total Rooms', data.get('total_rooms', 0)),
            ('Occupied Rooms', data.get('occupied_rooms', 0)),
            ('Available Rooms', data.get('available_rooms', 0)),
            ('ADR', f"KES {data.get('adr', 0):,.2f}"),
            ('RevPAR', f"KES {data.get('revpar', 0):,.2f}"),
        ]
        
        row = start_row + 1
        for metric, value in metrics:
            ws.cell(row=row, column=1, value=metric).border = self.border
            ws.cell(row=row, column=2, value=value).border = self.border
            row += 1
        
        # Room types
        row += 1
        ws.cell(row=row, column=1, value="By Room Type").font = Font(bold=True, size=12)
        row += 1
        
        headers = ['Room Type', 'Total', 'Occupied', 'Occupancy %', 'Revenue']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.border = self.border
        
        row += 1
        for rt in data.get('room_types', []):
            ws.cell(row=row, column=1, value=rt.get('type', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=rt.get('total', 0)).border = self.border
            ws.cell(row=row, column=3, value=rt.get('occupied', 0)).border = self.border
            ws.cell(row=row, column=4, value=f"{rt.get('occupancy_pct', 0):.1f}%").border = self.border
            ws.cell(row=row, column=5, value=rt.get('revenue', 0)).border = self.border
            ws.cell(row=row, column=5).number_format = '#,##0.00'
            row += 1

    def _create_daily_sales_report(self, ws, data):
        """Create daily sales report"""
        start_row = 6
        ws.cell(row=start_row, column=1, value="Sales Summary").font = Font(bold=True, size=12)
        
        metrics = [
            ('Total Revenue', f"KES {data.get('total_revenue', 0):,.2f}"),
            ('Total Transactions', data.get('total_transactions', 0)),
            ('Average Transaction', f"KES {data.get('avg_transaction', 0):,.2f}"),
            ('Cash Sales', f"KES {data.get('cash_sales', 0):,.2f}"),
            ('Card Sales', f"KES {data.get('card_sales', 0):,.2f}"),
            ('M-Pesa Sales', f"KES {data.get('mpesa_sales', 0):,.2f}"),
        ]
        
        row = start_row + 1
        for metric, value in metrics:
            ws.cell(row=row, column=1, value=metric).border = self.border
            ws.cell(row=row, column=2, value=value).border = self.border
            row += 1
        
        # Categories
        row += 1
        ws.cell(row=row, column=1, value="Sales by Category").font = Font(bold=True, size=12)
        row += 1
        
        headers = ['Category', 'Quantity', 'Total Sales']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.border = self.border
        
        row += 1
        for cat in data.get('categories', []):
            ws.cell(row=row, column=1, value=cat.get('name', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=cat.get('quantity', 0)).border = self.border
            ws.cell(row=row, column=3, value=cat.get('total', 0)).border = self.border
            ws.cell(row=row, column=3).number_format = '#,##0.00'
            row += 1

    def _create_housekeeping_report(self, ws, data):
        """Create housekeeping report"""
        start_row = 6
        ws.cell(row=start_row, column=1, value="Housekeeping Summary").font = Font(bold=True, size=12)
        
        metrics = [
            ('Rooms Cleaned', data.get('rooms_cleaned', 0)),
            ('Average Time (mins)', f"{data.get('avg_time', 0):.1f}"),
            ('Inspection Pass Rate', f"{data.get('pass_rate', 0):.1f}%"),
            ('Complaints', data.get('complaints', 0)),
        ]
        
        row = start_row + 1
        for metric, value in metrics:
            ws.cell(row=row, column=1, value=metric).border = self.border
            ws.cell(row=row, column=2, value=value).border = self.border
            row += 1
        
        # Staff performance
        row += 1
        ws.cell(row=row, column=1, value="Staff Performance").font = Font(bold=True, size=12)
        row += 1
        
        headers = ['Staff Name', 'Rooms Cleaned', 'Avg Time', 'Pass Rate', 'Rating']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.border = self.border
        
        row += 1
        for staff in data.get('staff', []):
            ws.cell(row=row, column=1, value=staff.get('name', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=staff.get('rooms', 0)).border = self.border
            ws.cell(row=row, column=3, value=f"{staff.get('avg_time', 0):.1f}").border = self.border
            ws.cell(row=row, column=4, value=f"{staff.get('pass_rate', 0):.1f}%").border = self.border
            ws.cell(row=row, column=5, value=f"{staff.get('rating', 0):.1f}/5").border = self.border
            row += 1

    def _create_maintenance_report(self, ws, data):
        """Create maintenance report"""
        start_row = 6
        ws.cell(row=start_row, column=1, value="Maintenance Summary").font = Font(bold=True, size=12)
        
        metrics = [
            ('Total Requests', data.get('total_requests', 0)),
            ('Completed', data.get('completed', 0)),
            ('Pending', data.get('pending', 0)),
            ('In Progress', data.get('in_progress', 0)),
            ('Avg Resolution (hrs)', f"{data.get('avg_resolution', 0):.1f}"),
        ]
        
        row = start_row + 1
        for metric, value in metrics:
            ws.cell(row=row, column=1, value=metric).border = self.border
            ws.cell(row=row, column=2, value=value).border = self.border
            row += 1
        
        # Work orders
        row += 1
        ws.cell(row=row, column=1, value="Work Orders").font = Font(bold=True, size=12)
        row += 1
        
        headers = ['ID', 'Location', 'Issue', 'Priority', 'Status', 'Assigned To']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.border = self.border
        
        row += 1
        for wo in data.get('work_orders', []):
            ws.cell(row=row, column=1, value=wo.get('id', 'N/A')[:8]).border = self.border
            ws.cell(row=row, column=2, value=wo.get('location', 'N/A')).border = self.border
            ws.cell(row=row, column=3, value=wo.get('issue', 'N/A')[:30]).border = self.border
            ws.cell(row=row, column=4, value=wo.get('priority', 'Normal')).border = self.border
            ws.cell(row=row, column=5, value=wo.get('status', 'Pending')).border = self.border
            ws.cell(row=row, column=6, value=wo.get('assigned_to', 'Unassigned')).border = self.border
            row += 1

    def _create_restaurant_sales_report(self, ws, data):
        """Create restaurant sales report"""
        start_row = 6
        ws.cell(row=start_row, column=1, value="Restaurant Sales Summary").font = Font(bold=True, size=12)
        
        metrics = [
            ('Total Revenue', f"KES {data.get('total_revenue', 0):,.2f}"),
            ('Total Orders', data.get('total_orders', 0)),
            ('Average Order', f"KES {data.get('avg_order', 0):,.2f}"),
            ('Dine-In', data.get('dine_in', 0)),
            ('Room Service', data.get('room_service', 0)),
            ('Takeaway', data.get('takeaway', 0)),
        ]
        
        row = start_row + 1
        for metric, value in metrics:
            ws.cell(row=row, column=1, value=metric).border = self.border
            ws.cell(row=row, column=2, value=value).border = self.border
            row += 1
        
        # Top items
        row += 1
        ws.cell(row=row, column=1, value="Top Selling Items").font = Font(bold=True, size=12)
        row += 1
        
        headers = ['Item Name', 'Category', 'Quantity', 'Revenue']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.border = self.border
        
        row += 1
        for item in data.get('top_items', []):
            ws.cell(row=row, column=1, value=item.get('name', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=item.get('category', 'N/A')).border = self.border
            ws.cell(row=row, column=3, value=item.get('quantity', 0)).border = self.border
            ws.cell(row=row, column=4, value=item.get('revenue', 0)).border = self.border
            ws.cell(row=row, column=4).number_format = '#,##0.00'
            row += 1

    def _create_bar_sales_report(self, ws, data):
        """Create bar sales report"""
        start_row = 6
        ws.cell(row=start_row, column=1, value="Bar Sales Summary").font = Font(bold=True, size=12)
        
        metrics = [
            ('Total Revenue', f"KES {data.get('total_revenue', 0):,.2f}"),
            ('Total Orders', data.get('total_orders', 0)),
            ('Average Order', f"KES {data.get('avg_order', 0):,.2f}"),
        ]
        
        row = start_row + 1
        for metric, value in metrics:
            ws.cell(row=row, column=1, value=metric).border = self.border
            ws.cell(row=row, column=2, value=value).border = self.border
            row += 1
        
        # Top items
        row += 1
        ws.cell(row=row, column=1, value="Top Selling Drinks").font = Font(bold=True, size=12)
        row += 1
        
        headers = ['Item Name', 'Quantity', 'Revenue']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.border = self.border
        
        row += 1
        for item in data.get('top_items', []):
            ws.cell(row=row, column=1, value=item.get('name', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=item.get('quantity', 0)).border = self.border
            ws.cell(row=row, column=3, value=item.get('revenue', 0)).border = self.border
            ws.cell(row=row, column=3).number_format = '#,##0.00'
            row += 1

    def _create_arrivals_departures_report(self, ws, data):
        """Create arrivals and departures report"""
        start_row = 6
        
        # Arrivals
        ws.cell(row=start_row, column=1, value="Expected Arrivals").font = Font(bold=True, size=12)
        row = start_row + 1
        
        headers = ['Guest Name', 'Room', 'Expected Time', 'Status']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.border = self.border
        
        row += 1
        arrivals = data.get('arrivals', [])
        if not arrivals:
            ws.cell(row=row, column=1, value="No arrivals scheduled").border = self.border
            row += 1
        else:
            for arr in arrivals:
                ws.cell(row=row, column=1, value=arr.get('guest_name', 'N/A')).border = self.border
                ws.cell(row=row, column=2, value=arr.get('room', 'TBA')).border = self.border
                ws.cell(row=row, column=3, value=arr.get('time', 'N/A')).border = self.border
                ws.cell(row=row, column=4, value=arr.get('status', 'Expected')).border = self.border
                row += 1
        
        # Departures
        row += 1
        ws.cell(row=row, column=1, value="Expected Departures").font = Font(bold=True, size=12)
        row += 1
        
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.border = self.border
        
        row += 1
        departures = data.get('departures', [])
        if not departures:
            ws.cell(row=row, column=1, value="No departures scheduled").border = self.border
        else:
            for dep in departures:
                ws.cell(row=row, column=1, value=dep.get('guest_name', 'N/A')).border = self.border
                ws.cell(row=row, column=2, value=dep.get('room', 'N/A')).border = self.border
                ws.cell(row=row, column=3, value=dep.get('time', 'N/A')).border = self.border
                ws.cell(row=row, column=4, value=dep.get('status', 'Expected')).border = self.border
                row += 1

    def _create_room_supplies_report(self, ws, data):
        """Create room supplies report"""
        start_row = 6
        ws.cell(row=start_row, column=1, value="Room Supplies Inventory").font = Font(bold=True, size=12)
        row = start_row + 1
        
        headers = ['Item Name', 'Category', 'Current Stock', 'Unit', 'Reorder Level', 'Status']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.border = self.border
        
        row += 1
        for item in data.get('supplies', []):
            qty = item.get('quantity', 0)
            reorder = item.get('reorder_level', 0)
            status = 'LOW' if qty < reorder else 'OK'
            
            ws.cell(row=row, column=1, value=item.get('name', 'N/A')).border = self.border
            ws.cell(row=row, column=2, value=item.get('category', 'N/A')).border = self.border
            ws.cell(row=row, column=3, value=qty).border = self.border
            ws.cell(row=row, column=4, value=item.get('unit', 'pcs')).border = self.border
            ws.cell(row=row, column=5, value=reorder).border = self.border
            status_cell = ws.cell(row=row, column=6, value=status)
            status_cell.border = self.border
            if status == 'LOW':
                status_cell.fill = PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid")
            row += 1

    def _create_manager_duty_report(self, ws, data):
        """Create manager on duty report"""
        start_row = 6
        ws.cell(row=start_row, column=1, value="Manager on Duty Report").font = Font(bold=True, size=12)
        
        info = [
            ('Manager', data.get('manager_name', 'N/A')),
            ('Date', data.get('date', 'N/A')),
            ('Shift', data.get('shift', 'Day')),
            ('Time', data.get('time', 'N/A')),
        ]
        
        row = start_row + 1
        for label, value in info:
            ws.cell(row=row, column=1, value=label).border = self.border
            ws.cell(row=row, column=2, value=value).border = self.border
            row += 1
        
        row += 1
        ws.cell(row=row, column=1, value="Operations Summary").font = Font(bold=True, size=12)
        row += 1
        
        ops = [
            ('Expected Arrivals', data.get('arrivals', 0)),
            ('Expected Departures', data.get('departures', 0)),
            ('Current Occupancy', f"{data.get('occupancy', 0)}%"),
            ('Out of Order Rooms', data.get('ooo_rooms', 0)),
        ]
        
        for label, value in ops:
            ws.cell(row=row, column=1, value=label).border = self.border
            ws.cell(row=row, column=2, value=value).border = self.border
            row += 1

    def _create_reservation_report(self, ws, data):
        """Create reservation confirmation report"""
        start_row = 6
        ws.cell(row=start_row, column=1, value="Reservation Confirmation").font = Font(bold=True, size=12)
        
        guest_info = [
            ('Guest Name', data.get('guest_name', 'N/A')),
            ('Email', data.get('email', 'N/A')),
            ('Phone', data.get('phone', 'N/A')),
            ('ID Number', data.get('id_number', 'N/A')),
        ]
        
        row = start_row + 1
        for label, value in guest_info:
            ws.cell(row=row, column=1, value=label).border = self.border
            ws.cell(row=row, column=2, value=value).border = self.border
            row += 1
        
        row += 1
        ws.cell(row=row, column=1, value="Booking Details").font = Font(bold=True, size=12)
        row += 1
        
        booking_info = [
            ('Confirmation #', data.get('confirmation_number', 'N/A')),
            ('Room Type', data.get('room_type', 'N/A')),
            ('Room Number', data.get('room_number', 'TBA')),
            ('Check-In', data.get('check_in', 'N/A')),
            ('Check-Out', data.get('check_out', 'N/A')),
            ('Guests', data.get('guests', 1)),
        ]
        
        for label, value in booking_info:
            ws.cell(row=row, column=1, value=label).border = self.border
            ws.cell(row=row, column=2, value=value).border = self.border
            row += 1
        
        row += 1
        ws.cell(row=row, column=1, value="Payment Summary").font = Font(bold=True, size=12)
        row += 1
        
        payment_info = [
            ('Room Rate (per night)', f"KES {data.get('room_rate', 0):,.2f}"),
            ('Number of Nights', data.get('nights', 1)),
            ('Subtotal', f"KES {data.get('subtotal', 0):,.2f}"),
            ('Taxes & Fees', f"KES {data.get('taxes', 0):,.2f}"),
            ('TOTAL', f"KES {data.get('total', 0):,.2f}"),
            ('Payment Status', data.get('payment_status', 'Pending')),
        ]
        
        for label, value in payment_info:
            ws.cell(row=row, column=1, value=label).border = self.border
            cell = ws.cell(row=row, column=2, value=value)
            cell.border = self.border
            if label == 'TOTAL':
                cell.font = Font(bold=True)
            row += 1

    def _create_expense_report(self, ws, data):
        """Create expense report"""
        start_row = 6
        ws.cell(row=start_row, column=1, value="Expense Summary").font = Font(bold=True, size=12)
        
        ws.cell(row=start_row + 1, column=1, value="Total Expenses").border = self.border
        ws.cell(row=start_row + 1, column=2, value=f"KES {data.get('total_expenses', 0):,.2f}").border = self.border
        
        row = start_row + 3
        ws.cell(row=row, column=1, value="Expenses by Category").font = Font(bold=True, size=12)
        row += 1
        
        headers = ['Category', 'Amount', '% of Total']
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=row, column=col, value=header)
            cell.fill = self.header_fill
            cell.font = self.header_font
            cell.border = self.border
        
        row += 1
        for cat in data.get('by_category', []):
            ws.cell(row=row, column=1, value=cat.get('category', 'Other')).border = self.border
            ws.cell(row=row, column=2, value=cat.get('amount', 0)).border = self.border
            ws.cell(row=row, column=2).number_format = '#,##0.00'
            ws.cell(row=row, column=3, value=f"{cat.get('pct', 0):.1f}%").border = self.border
            row += 1

    def _adjust_column_widths(self, ws):
        """Auto-adjust column widths"""
        for column in ws.columns:
            max_length = 0
            column_letter = get_column_letter(column[0].column)
            
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(cell.value)
                except:
                    pass
            
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
