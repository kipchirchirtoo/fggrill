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
from datetime import datetime

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
        self.company_name = "Kyogong"
        self.company_address = "Kericho, Kenya"
        self.company_phone = "+254 700 000 000"
        
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
    
    def print_receipt(self, receipt_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Print a receipt matching the Fish & Chips style from the images
        VAT is already included in prices - just show breakdown
        """
        try:
            if not self.printer:
                self.connect()
            
            p = self.printer
            
            # === HEADER ===
            p.set(align='center', font='a', bold=True, double_height=True)
            p.text(f"{self.company_name}\n")
            
            p.set(align='center', font='a', bold=False, double_height=False)
            p.text(f"{self.company_address}\n")
            p.text(f"{self.company_phone}\n")
            p.text("\n")
            
            # === ORDER INFO ===
            receipt_no = receipt_data.get('receipt_number', f"ORD-{datetime.now().strftime('%H%M%S')}")
            date_str = receipt_data.get('date', datetime.now().strftime('%m/%d/%Y'))
            time_str = receipt_data.get('time', datetime.now().strftime('%I:%M %p'))
            
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
            payment_code = receipt_data.get('payment_code', datetime.now().strftime('%Y%m%d%H%M%S'))
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
            logger.error(f"Error printing receipt: {e}")
            return {
                'success': False,
                'error': str(e)
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
