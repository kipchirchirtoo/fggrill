"""
Thermal Printer Service
Handles direct printing to thermal receipt printers (ESC/POS compatible)
Supports USB, Network, and Serial connections
"""

import os
import io
import socket
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone

# Africa/Nairobi is a fixed UTC+3 offset with no DST. The printer service
# can run on a host in any timezone, so every printed timestamp must be
# computed in Kenyan time explicitly rather than via the host clock.
KENYA_TZ = timezone(timedelta(hours=3))


def _now_kenya() -> datetime:
    return datetime.now(KENYA_TZ)


def _parse_to_kenya(value: Optional[Any]) -> datetime:
    """Parses a caller-supplied timestamp (ISO string or datetime) into
    Kenyan local time. Falls back to the current Kenyan time when the value
    is missing or unparseable, so a receipt always prints a sane time."""
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str) and value.strip():
        try:
            dt = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
        except ValueError:
            return _now_kenya()
    else:
        return _now_kenya()

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KENYA_TZ)

# Try to import escpos library for thermal printing
try:
    from escpos.printer import Usb, Network, Serial, Dummy
    ESCPOS_AVAILABLE = True
except ImportError:
    ESCPOS_AVAILABLE = False
    logging.warning("python-escpos not installed. Install with: pip install python-escpos")
    
    # Define a dummy class to prevent NameError if the library is missing
    class Dummy:
        def __init__(self, *args, **kwargs):
            self.output = b""
        def text(self, txt):
            if isinstance(txt, str):
                self.output += txt.encode('utf-8')
            else:
                self.output += txt
        def set(self, *args, **kwargs): pass
        def cut(self): self.text("\n[CUT]\n")
        def close(self): pass
        def image(self, *args, **kwargs): pass
        def barcode(self, *args, **kwargs): pass
        def qr(self, *args, **kwargs): pass

logger = logging.getLogger(__name__)


class ThermalPrinter:
    """
    Thermal Receipt Printer Handler
    Supports ESC/POS compatible printers via USB, Network, or Serial
    """
    
    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.printer = None
        self.connection_type = self.config.get('connection_type', 'network')
        
        # Default printer settings
        self.settings = {
            'network_ip': self.config.get('printer_ip', os.getenv('THERMAL_PRINTER_IP', '192.168.1.100')),
            'network_port': int(self.config.get('printer_port', os.getenv('THERMAL_PRINTER_PORT', 9100))),
            'usb_vendor': self.config.get('usb_vendor', 0x04b8),  # Common Epson vendor ID
            'usb_product': self.config.get('usb_product', 0x0202),
            'serial_port': self.config.get('serial_port', '/dev/ttyUSB0'),
            'serial_baudrate': self.config.get('serial_baudrate', 9600),
        }
        
        # Company info
        self.company_name = "FamousGate Hotels"
        self.company_address = "Bomet, Kenya"
        self.company_phone = "+254 706 782 828"
        
    def connect(self) -> bool:
        """Establish connection to the printer"""
        if not ESCPOS_AVAILABLE:
            logger.warning("ESC/POS library not available, using dummy printer")
            self.printer = Dummy()
            return True
            
        try:
            if self.connection_type == 'network':
                self.printer = Network(
                    self.settings['network_ip'],
                    port=self.settings['network_port']
                )
            elif self.connection_type == 'usb':
                self.printer = Usb(
                    self.settings['usb_vendor'],
                    self.settings['usb_product']
                )
            elif self.connection_type == 'serial':
                self.printer = Serial(
                    self.settings['serial_port'],
                    baudrate=self.settings['serial_baudrate']
                )
            else:
                self.printer = Dummy()
                
            logger.info(f"Connected to thermal printer via {self.connection_type}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to printer: {e}")
            self.printer = Dummy()
            return False
    
    def disconnect(self):
        """Close printer connection"""
        if self.printer:
            try:
                self.printer.close()
            except:
                pass
            self.printer = None
    
    def print_captain_order(self, receipt_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Print captain order for kitchen display (restaurant orders only)
        Simplified format focused on order fulfillment, not payment
        """
        try:
            if not self.printer:
                connected = self.connect()
                if not connected or not self.printer:
                    return {
                        'success': False,
                        'error': 'Thermal printer not configured or unavailable. Please configure printer in system settings.'
                    }
            
            p = self.printer
            is_recall = receipt_data.get('is_recall', False)
            outlet_type = str(receipt_data.get('outlet_type') or '').strip().lower()

            # Main Bar / Executive Bar tickets must say so instead of the
            # generic "CAPTAIN ORDER" / "KITCHEN COPY" — they're handed to
            # that outlet's own cashier/bar, not the kitchen.
            if outlet_type == 'main_bar':
                base_label = 'MAIN BAR ORDER'
                copy_label = 'BAR COPY'
            elif outlet_type == 'executive_bar':
                base_label = 'EXECUTIVE BAR ORDER'
                copy_label = 'BAR COPY'
            else:
                base_label = 'CAPTAIN ORDER'
                copy_label = 'KITCHEN COPY'

            # === HEADER ===
            p.set(align='center', font='a', bold=True, double_height=True)
            p.text(f"RECALLED {base_label}\n" if is_recall else f"{base_label}\n")
            p.text(f"{copy_label}\n")

            p.set(align='center', font='a', bold=False, double_height=False)
            p.text(f"{self.company_name}\n")
            p.text("\n")
            
            # === ORDER INFO ===
            order_no = receipt_data.get('order_number', f"ORD-{_now_kenya().strftime('%H%M%S')}")
            lookup_code = (
                receipt_data.get('short_code')
                or receipt_data.get('shortCode')
                or receipt_data.get('lookup_code')
                or receipt_data.get('lookupCode')
                or ''
            )
            lookup_code = str(lookup_code).strip().upper()
            
            if lookup_code:
                p.set(align='center', font='a', bold=True, double_height=True)
                p.text(f"{lookup_code}\n")
                p.set(align='center', font='a', bold=False, double_height=False)
                p.text("ORDER CODE\n\n")
            
            p.set(align='left', font='a', bold=True)
            p.text(f"ORDER: {order_no}\n")
            p.set(align='left', font='a', bold=False)
            
            # Location info (Table/Room)
            table_no = receipt_data.get('table_number', '')
            room_no = receipt_data.get('room_number', '')
            if table_no:
                p.set(align='left', font='a', bold=True)
                p.text(f"TABLE: {table_no}\n")
            if room_no:
                p.set(align='left', font='a', bold=True)
                p.text(f"ROOM: {room_no}\n")
            
            # Order type
            order_type = receipt_data.get('order_type', 'dine_in').replace('_', ' ').upper()
            p.set(align='left', font='a', bold=False)
            p.text(f"TYPE: {order_type}\n")
            
            # Customer name
            customer = receipt_data.get('customer_name', 'Walk-in')
            p.text(f"GUEST: {customer}\n")
            
            # Waiter name
            waiter = receipt_data.get('waiter_name', 'Staff')
            p.text(f"WAITER: {waiter}\n")
            
            # Time — caller usually sends an ISO timestamp in 'date'; convert
            # it to Kenyan local time rather than trusting the host clock.
            kenya_dt = _parse_to_kenya(receipt_data.get('time') or receipt_data.get('date'))
            time_str = kenya_dt.strftime('%I:%M %p')
            date_str = kenya_dt.strftime('%m/%d/%Y')
            p.text(f"TIME: {time_str} - {date_str}\n")
            
            p.text("\n")
            p.text("=" * 32 + "\n")
            p.text("\n")
            
            # === ITEMS (LARGE AND CLEAR FOR KITCHEN) ===
            p.set(align='left', font='a', bold=True)
            p.text("RECALLED ITEMS TO PREPARE:\n" if is_recall else "ITEMS TO PREPARE:\n")
            p.text("-" * 32 + "\n")
            
            items = receipt_data.get('items', [])
            
            for item in items:
                qty = item.get('quantity', 1)
                name = item.get('name', item.get('item_name', 'Item'))
                notes = item.get('notes', item.get('special_instructions', ''))
                already_served = item.get('already_served', False)

                # Already-made items (from before a recall) are underlined so
                # kitchen staff know to skip them; new/recalled items print
                # bold (but normal width — double-width wastes a lot of
                # paper by wrapping any item name longer than ~16 chars
                # onto extra lines) so it still stands out clearly.
                if already_served:
                    p.set(align='left', font='a', bold=False, underline=True, double_width=False)
                    p.text(f"{qty}x {name.upper()} (ALREADY MADE)\n")
                else:
                    p.set(align='left', font='a', bold=True, double_width=False)
                    p.text(f"{qty}x {name.upper()}\n")

                # Special instructions (if any)
                if notes:
                    p.set(align='left', font='a', bold=False, underline=False, double_width=False)
                    p.text(f"   NOTE: {notes}\n")

                p.set(align='left', font='a', bold=False, underline=False, double_width=False)
            
            p.text("=" * 32 + "\n")
            p.text("\n")
            
            # === SUMMARY ===
            p.set(align='left', font='a', bold=True)
            p.text(f"TOTAL ITEMS: {len(items)}\n")
            total_qty = sum(item.get('quantity', 1) for item in items)
            p.text(f"TOTAL QUANTITY: {total_qty}\n")
            
            p.text("\n")
            
            # === FOOTER ===
            p.set(align='center', font='a', bold=False)
            p.text("-" * 32 + "\n")
            p.text(f"{copy_label} - DO NOT GIVE TO CUSTOMER\n")
            p.text("\n")

            # Cut paper
            p.cut()
            
            # Get raw output if using Dummy printer
            output = None
            if isinstance(self.printer, Dummy):
                output = self.printer.output
            
            return {
                'success': True,
                'message': 'Captain order printed to kitchen',
                'receipt_number': order_no,
                'raw_output': output.decode('utf-8', errors='ignore') if output else None
            }
            
        except Exception as e:
            logger.error(f"Error printing captain order: {e}", exc_info=True)
            error_msg = str(e) if str(e) else 'Unknown printer error occurred'
            return {
                'success': False,
                'error': error_msg
            }
    
    def print_receipt(self, receipt_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Print a receipt matching the Fish & Chips style from the images
        VAT is already included in prices - just show breakdown
        """
        # Check if this is a captain order
        is_captain_order = receipt_data.get('is_captain_order', False)
        receipt_type = receipt_data.get('receipt_type', '').upper()
        
        if is_captain_order or 'CAPTAIN' in receipt_type:
            return self.print_captain_order(receipt_data)
        
        try:
            if not self.printer:
                connected = self.connect()
                if not connected or not self.printer:
                    return {
                        'success': False,
                        'error': 'Thermal printer not configured or unavailable. Please configure printer in system settings.'
                    }
            
            p = self.printer
            
            # === HEADER ===
            p.set(align='center', font='a', bold=True, double_height=True)
            p.text(f"{self.company_name}\n")
            
            p.set(align='center', font='a', bold=False, double_height=False)
            p.text(f"{self.company_address}\n")
            p.text(f"{self.company_phone}\n")
            p.text("\n")
            
            # === ORDER INFO ===
            receipt_no = receipt_data.get('receipt_number', f"ORD-{_now_kenya().strftime('%H%M%S')}")
            public_code = (
                receipt_data.get('verification_code')
                or receipt_data.get('verificationCode')
                or receipt_data.get('short_code')
                or receipt_data.get('shortCode')
                or receipt_data.get('public_code')
                or receipt_data.get('publicCode')
                or receipt_data.get('lookup_code')
                or receipt_data.get('lookupCode')
                or ''
            )
            public_code = str(public_code).strip().upper()
            # The caller usually sends an ISO timestamp in 'date'; parse it
            # to Kenyan local time rather than printing the raw ISO string
            # or trusting the host clock's own timezone.
            kenya_dt = _parse_to_kenya(receipt_data.get('date'))
            date_str = kenya_dt.strftime('%m/%d/%Y')
            time_str = kenya_dt.strftime('%I:%M %p')

            if public_code:
                p.set(align='center', font='a', bold=True, double_height=True)
                p.text(f"{public_code}\n")
                p.set(align='center', font='a', bold=True, double_height=False)
                p.text("BILL VERIFICATION CODE\n\n")
            
            p.set(align='left', font='a')
            p.text(f"ORDER # {receipt_no.split('-')[-1] if '-' in str(receipt_no) else receipt_no}\n")
            p.text(f"HOST = {receipt_data.get('cashier_name', 'STAFF')}\n")
            
            p.set(align='right')
            p.text(f"{date_str}\n")
            p.text(f"{time_str}\n")
            p.text("\n")
            
            # === ITEMS ===
            p.set(align='left', font='a')
            items = receipt_data.get('items', [])
            
            for item in items:
                qty = item.get('quantity', 1)
                name = item.get('name', item.get('item_name', 'Item'))
                # Price already includes VAT
                price = item.get('unit_price', 0) * qty
                
                # Truncate long names
                if len(name) > 20:
                    name = name[:17] + "..."
                
                p.text(f"{qty} {name.upper()}\n")
                p.set(align='right')
                p.text(f"$ {price:,.2f}\n")
                p.set(align='left')
            
            # Check for special items (like WISH 0000 in the image)
            if receipt_data.get('wish_number'):
                p.text(f"  WISH {receipt_data['wish_number']}\n")
            
            p.text("\n")
            p.text("-" * 32 + "\n")
            
            # === TOTALS ===
            # Calculate from items - prices already include VAT
            subtotal = sum(item.get('unit_price', 0) * item.get('quantity', 1) for item in items)
            
            # VAT is INCLUDED in prices (16%), so we calculate the breakdown
            # If price is X (VAT inclusive), then:
            # X = base_price + (base_price * 0.16)
            # X = base_price * 1.16
            # base_price = X / 1.16
            # VAT = X - base_price = X - (X/1.16) = X * (0.16/1.16)
            
            vat_rate = 0.16
            vat_amount = round(subtotal * (vat_rate / (1 + vat_rate)), 2)
            base_amount = subtotal - vat_amount
            total = subtotal  # Total is same as subtotal since VAT is included
            
            p.set(align='left')
            p.text(f"SUBTOTAL")
            p.set(align='right')
            p.text(f"$ {base_amount:,.2f}\n")
            
            p.set(align='left')
            p.text(f"TAX")
            p.set(align='right')
            p.text(f"$ {vat_amount:,.2f}\n")
            
            p.set(align='left', bold=True)
            p.text(f"TOTAL:")
            p.set(align='right', bold=True)
            p.text(f"$ {total:,.2f}\n")
            
            p.text("\n")
            
            # === PAYMENT INFO ===
            p.set(align='left', bold=False)
            payment_method = receipt_data.get('payment_method', 'CASH').upper()
            
            p.text(f"TRANSACTION TYPE:      {payment_method.upper()}\n")
            p.text(f"AUTHORIZATION:         APPROVED\n")
            
            # Generate payment code
            payment_code = receipt_data.get('payment_code', _now_kenya().strftime('%Y%m%d%H%M%S'))
            p.text(f"PAYMENT CODE:          {payment_code}\n")
            
            if payment_method in ['CARD', 'MPESA']:
                card_method = "SWIPED/CHIP" if payment_method == 'CARD' else "MOBILE"
                p.text(f"CARD READER:           {card_method}\n")
            
            p.text("\n")
            p.text("-" * 32 + "\n")
            
            # === TIP LINE ===
            p.text("TIP: _______________\n")
            p.text("\n")
            p.text("=TOTAL: _______________\n")
            p.text("\n")
            
            # === SIGNATURE LINE ===
            p.text("_" * 32 + "\n")
            p.text("\n")
            
            # === FOOTER ===
            p.set(align='center')
            p.text("CUSTOMER COPY\n")
            p.text("\n")
            p.text("THANKS FOR VISITING\n")
            p.text(f"{self.company_name}\n")
            
            p.text("\n")
            p.text("-" * 32 + "\n")
            p.set(align='center', font='a', bold=True)
            p.text("System managed and made by Hirall\n")
            p.set(align='center', font='a', bold=False)
            p.text("+254 710 944 249 | admin@hirall.com\n")
            p.text("-" * 32 + "\n")
            
            # Cut paper
            p.cut()
            
            # Get raw output if using Dummy printer
            output = None
            if isinstance(self.printer, Dummy):
                output = self.printer.output
            
            return {
                'success': True,
                'message': 'Receipt printed successfully',
                'receipt_number': receipt_no,
                'raw_output': output.decode('utf-8', errors='ignore') if output else None
            }
            
        except Exception as e:
            logger.error(f"Error printing receipt: {e}", exc_info=True)
            error_msg = str(e) if str(e) else 'Unknown printer error occurred'
            return {
                'success': False,
                'error': error_msg
            }
    
    def print_raw_text(self, text: str) -> bool:
        """Print raw text to the printer"""
        try:
            if not self.printer:
                self.connect()
            
            self.printer.text(text)
            self.printer.cut()
            return True
        except Exception as e:
            logger.error(f"Error printing raw text: {e}")
            return False
    
    def test_print(self) -> Dict[str, Any]:
        """Print a test receipt"""
        test_data = {
            'receipt_number': 'TEST-001',
            'cashier_name': 'TEST',
            'items': [
                {'name': 'Test Item 1', 'quantity': 1, 'unit_price': 100},
                {'name': 'Test Item 2', 'quantity': 2, 'unit_price': 50},
            ],
            'payment_method': 'cash'
        }
        return self.print_receipt(test_data)


class NetworkPrinterDiscovery:
    """Discover thermal printers on the network"""
    
    @staticmethod
    def scan_network(ip_range: str = "192.168.1", port: int = 9100) -> List[str]:
        """Scan network for printers on common thermal printer port"""
        found_printers = []
        
        for i in range(1, 255):
            ip = f"{ip_range}.{i}"
            try:
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(0.1)
                result = sock.connect_ex((ip, port))
                if result == 0:
                    found_printers.append(ip)
                sock.close()
            except:
                pass
        
        return found_printers


# Singleton instance for the thermal printer
_thermal_printer_instance = None

def get_thermal_printer(config: Dict[str, Any] = None) -> ThermalPrinter:
    """Get or create thermal printer instance"""
    global _thermal_printer_instance
    if _thermal_printer_instance is None:
        _thermal_printer_instance = ThermalPrinter(config)
    return _thermal_printer_instance


# Windows-specific printing using win32print
try:
    import win32print
    import win32ui
    from PIL import Image, ImageDraw, ImageFont
    WIN32PRINT_AVAILABLE = True
except ImportError:
    WIN32PRINT_AVAILABLE = False
    logger.warning("win32print not installed. Install with: pip install pywin32 pillow")


def print_captain_order_windows(receipt_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fallback: Print captain order using Windows win32print API
    Used when ESC/POS fails or on Windows systems
    """
    if not WIN32PRINT_AVAILABLE:
        return {'success': False, 'error': 'win32print not available'}
    
    try:
        # Get default printer
        printer_name = win32print.GetDefaultPrinter()
        
        # Create a device context
        hDC = win32ui.CreateDC()
        hDC.CreatePrinterDC(printer_name)
        hDC.StartDoc('Captain Order')
        hDC.StartPage()
        
        # Thermal printer width (80mm = ~300px at 96 DPI)
        width = 300
        y = 10
        
        # Header
        hDC.SetMapMode(1)  # MM_TEXT
        hDC.TextOut(width//2 - 60, y, "CAPTAIN ORDER")
        y += 30
        hDC.TextOut(width//2 - 60, y, "KITCHEN COPY")
        y += 40
        
        # Order info
        order_no = receipt_data.get('order_number', 'N/A')
        short_code = receipt_data.get('short_code', '')
        
        if short_code:
            hDC.TextOut(10, y, f"CODE: {short_code}")
            y += 25
        
        hDC.TextOut(10, y, f"ORDER: {order_no}")
        y += 25
        
        # Table/Room
        table_no = receipt_data.get('table_number')
        if table_no:
            hDC.TextOut(10, y, f"TABLE: {table_no}")
            y += 25
            
        room_no = receipt_data.get('room_number')
        if room_no:
            hDC.TextOut(10, y, f"ROOM: {room_no}")
            y += 25
        
        # Customer & Waiter
        customer = receipt_data.get('customer_name', 'Walk-in')
        waiter = receipt_data.get('waiter_name', 'Staff')
        hDC.TextOut(10, y, f"GUEST: {customer}")
        y += 25
        hDC.TextOut(10, y, f"WAITER: {waiter}")
        y += 35
        
        # Items
        hDC.TextOut(10, y, "ITEMS TO PREPARE:")
        y += 25
        hDC.TextOut(10, y, "-" * 40)
        y += 25
        
        items = receipt_data.get('items', [])
        for item in items:
            qty = item.get('quantity', 1)
            name = item.get('name', 'Item')
            notes = item.get('notes', '')
            
            hDC.TextOut(10, y, f"{qty}x {name.upper()}")
            y += 25
            
            if notes:
                hDC.TextOut(20, y, f"NOTE: {notes}")
                y += 20
            
            y += 10
        
        # Footer
        y += 20
        hDC.TextOut(10, y, "-" * 40)
        y += 25
        hDC.TextOut(width//2 - 80, y, "KITCHEN PREPARATION ORDER")
        y += 20
        hDC.TextOut(width//2 - 80, y, "DO NOT GIVE TO CUSTOMER")
        
        # End page and document
        hDC.EndPage()
        hDC.EndDoc()
        hDC.DeleteDC()
        
        return {
            'success': True,
            'message': 'Captain order printed via Windows API',
            'receipt_number': order_no
        }
        
    except Exception as e:
        logger.error(f"Error printing with win32print: {e}")
        return {
            'success': False,
            'error': str(e)
        }
