# Thermal Printer Setup Guide

## Overview

The FamousGate system supports automatic captain order printing to kitchen thermal printers for restaurant POS orders. This guide explains how to configure and troubleshoot thermal printer integration.

## Supported Printers

- **ESC/POS compatible thermal printers** (most common)
- **Connection types**: Network (TCP/IP), USB, Serial

### Common Compatible Brands
- Epson TM series
- Star Micronics TSP series
- Bixolon SRP series
- Generic ESC/POS thermal printers

## Configuration

### 1. Install Python Dependencies

```bash
cd python-services
pip install python-escpos pillow pyusb pyserial
```

### 2. Configure Environment Variables

Edit `python-services/.env` and add:

```env
# Thermal Printer Configuration
THERMAL_PRINTER_CONNECTION_TYPE=network
THERMAL_PRINTER_IP=192.168.1.100
THERMAL_PRINTER_PORT=9100
```

**Connection Type Options:**
- `network` - TCP/IP network printer (recommended)
- `usb` - USB connected printer
- `serial` - Serial port printer

### 3. Network Printer Setup (Recommended)

For network printers:

```env
THERMAL_PRINTER_CONNECTION_TYPE=network
THERMAL_PRINTER_IP=192.168.1.100
THERMAL_PRINTER_PORT=9100
```

**Finding your printer's IP:**
1. Print a self-test page (usually hold feed button on boot)
2. Check your router's DHCP client list
3. Use the printer discovery endpoint: `GET /api/receipts/printer/discover`

### 4. USB Printer Setup

For USB printers:

```env
THERMAL_PRINTER_CONNECTION_TYPE=usb
THERMAL_PRINTER_USB_VENDOR=0x04b8  # Epson vendor ID
THERMAL_PRINTER_USB_PRODUCT=0x0202 # Product ID
```

**Finding USB vendor/product IDs:**

Linux:
```bash
lsusb
```

Windows:
```powershell
Get-PnpDevice | Where-Object {$_.FriendlyName -like "*printer*"}
```

### 5. Serial Printer Setup

For serial printers:

```env
THERMAL_PRINTER_CONNECTION_TYPE=serial
THERMAL_PRINTER_SERIAL_PORT=/dev/ttyUSB0  # Linux
# or COM1                                   # Windows
THERMAL_PRINTER_SERIAL_BAUDRATE=9600
```

## Testing

### Test Print via API

```bash
curl -X POST http://localhost:5001/api/receipts/printer/test \
  -H "Content-Type: application/json"
```

### Check Printer Status

```bash
curl http://localhost:5001/api/receipts/printer/status
```

### Discover Network Printers

```bash
curl "http://localhost:5001/api/receipts/printer/discover?ip_range=192.168.1&port=9100"
```

## How It Works

### Automatic Captain Order Printing

When a restaurant POS order is created:

1. **Order Created** - Backend receives new restaurant order
2. **Captain Order Generated** - Order data formatted for kitchen display
3. **Print Request** - Async call to Python thermal printer service
4. **Kitchen Receipt** - Captain order prints on kitchen thermal printer
5. **Order Continues** - Order creation completes regardless of print status

**Important**: Print failures do NOT block order creation. Orders are always saved even if printing fails.

### Captain Order Format

The kitchen receipt includes:
- Large "CAPTAIN ORDER" header
- Order lookup code (if available)
- Order number
- Table/Room number
- Order type (dine-in, takeout, delivery)
- Customer name
- Waiter name
- **Items list** (LARGE and CLEAR for kitchen staff)
- Special instructions/notes
- Total items count
- Timestamp

## Troubleshooting

### Error: "Thermal printer not configured or unavailable"

**Cause**: Printer is not connected or configuration is incorrect.

**Solutions**:
1. Check printer is powered on and connected to network/USB
2. Verify IP address and port in `.env` file
3. Test network connectivity: `ping 192.168.1.100`
4. Check firewall rules allow port 9100
5. Run printer discovery: `GET /api/receipts/printer/discover`

### Error: "python-escpos not installed"

**Solution**:
```bash
cd python-services
pip install python-escpos pillow
```

### USB Permission Denied (Linux)

**Solution**:
```bash
sudo usermod -a -G lp $USER
sudo chmod 666 /dev/usb/lp0
```

Or add udev rule:
```bash
echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="04b8", MODE="0666"' | sudo tee /etc/udev/rules.d/99-printer.rules
sudo udevadm control --reload-rules
```

### Printer Prints Garbage Characters

**Cause**: Printer may not be ESC/POS compatible or wrong encoding.

**Solutions**:
1. Verify printer is ESC/POS compatible
2. Check printer documentation for compatibility mode
3. Try different encoding in printer settings

### Network Printer Not Responding

**Solutions**:
1. Verify printer IP hasn't changed (set static IP on printer)
2. Check printer is on same network/VLAN as server
3. Test direct connection: `telnet 192.168.1.100 9100`
4. Restart printer and try again

## Advanced Configuration

### Custom Printer Settings

Edit `python-services/receipts/thermal_printer.py` to customize:
- Company header information
- Receipt format and layout
- Font sizes and styles
- Logo images
- Barcode/QR code generation

### Multiple Printers

To support multiple kitchen printers (e.g., hot kitchen vs cold prep):

1. Extend configuration to support multiple printer instances
2. Route orders based on outlet type or menu item category
3. Configure separate print queues per station

## Production Recommendations

1. **Use static IP** for network printers (not DHCP)
2. **Backup printer** - Configure fallback printer in case primary fails
3. **Monitor printer status** - Set up alerts for printer offline/paper out
4. **Regular maintenance** - Clean print head, replace paper regularly
5. **Power backup** - Use UPS for printers to prevent mid-print failures

## API Endpoints

### Print Receipt
```http
POST /api/receipts/printer/print
Content-Type: application/json

{
  "receipt_type": "CAPTAIN ORDER",
  "order_number": "ORD-001",
  "short_code": "A1B2",
  "customer_name": "Walk-in",
  "table_number": "5",
  "items": [
    {
      "name": "Grilled Chicken",
      "quantity": 2,
      "unit_price": 500,
      "notes": "Extra spicy"
    }
  ],
  "waiter_name": "John Doe",
  "is_captain_order": true
}
```

### Configure Printer
```http
POST /api/receipts/printer/configure
Content-Type: application/json

{
  "connection_type": "network",
  "printer_ip": "192.168.1.100",
  "printer_port": 9100
}
```

### Get Printer Status
```http
GET /api/receipts/printer/status
```

### Discover Printers
```http
GET /api/receipts/printer/discover?ip_range=192.168.1&port=9100
```

### Test Print
```http
POST /api/receipts/printer/test
```

## Support

For issues or questions:
- Check logs: `python-services/logs/` or console output
- Backend logs: Look for "Captain order" messages
- Email: admin@hirall.com
- Phone: +254 710 944 249
