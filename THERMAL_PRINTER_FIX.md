# Thermal Printer Error Fix - 2026-06-19

## Issue

The captain order printing service was returning a 500 error with an empty error message when attempting to print to the thermal printer. This was visible in the logs as:

```
AxiosError: Request failed with status code 500
"error": "",
"success": false
```

## Root Cause

1. **Missing printer configuration** - No thermal printer IP/settings in `.env` file
2. **Poor error handling** - When printer connection failed, empty error strings were returned
3. **Silent failures** - Errors were logged but not properly propagated to the caller

## Changes Made

### 1. Enhanced Error Handling (`python-services/receipts/thermal_printer.py`)

**Before:**
```python
if not self.printer:
    self.connect()  # May fail silently
p = self.printer  # Could be None
```

**After:**
```python
if not self.printer:
    connected = self.connect()
    if not connected or not self.printer:
        return {
            'success': False,
            'error': 'Thermal printer not configured or unavailable. Please configure printer in system settings.'
        }
```

### 2. Better Exception Handling

**Before:**
```python
except Exception as e:
    return {'success': False, 'error': str(e)}
```

**After:**
```python
except Exception as e:
    logger.error(f"Error printing captain order: {e}", exc_info=True)
    error_msg = str(e) if str(e) else 'Unknown printer error occurred'
    return {'success': False, 'error': error_msg}
```

### 3. Improved API Error Responses (`python-services/receipts/routes.py`)

Enhanced the `/api/receipts/printer/print` endpoint to:
- Always return meaningful error messages
- Log errors with full stack traces
- Ensure empty errors don't reach the client

### 4. Added Configuration (`python-services/.env`)

Added thermal printer configuration:
```env
# Thermal Printer Configuration
THERMAL_PRINTER_IP=192.168.1.100
THERMAL_PRINTER_PORT=9100
```

### 5. Documentation

Created `python-services/receipts/PRINTER_SETUP.md` with:
- Complete setup instructions
- Troubleshooting guide
- API documentation
- Configuration examples for network/USB/serial printers

## Impact

### Before Fix
- Captain orders failed to print with cryptic 500 errors
- No clear indication of what was wrong
- Difficult to diagnose printer issues

### After Fix
- Clear error messages when printer is not configured
- Better logging with stack traces
- Order creation still succeeds even if printing fails (by design)
- Easy to diagnose and fix printer configuration issues

## Expected Behavior

The system is **designed** to allow orders to be created even when printing fails. This is intentional to prevent printer issues from blocking restaurant operations.

### Normal Flow
1. Order created in POS
2. Captain order sent to kitchen printer
3. If print succeeds: Kitchen staff see printed order
4. If print fails: Order still saved, KDS shows order, error logged

### Error Messages Now

When printer is not configured:
```json
{
  "success": false,
  "error": "Thermal printer not configured or unavailable. Please configure printer in system settings."
}
```

When other print errors occur:
```json
{
  "success": false,
  "error": "Connection refused: [Errno 111] Connection refused to 192.168.1.100:9100"
}
```

## Next Steps

### For Development/Testing
If you don't have a physical thermal printer:
- The system uses a "Dummy" printer by default
- Orders will still be created successfully
- Print logs will show simulated output

### For Production
1. Configure actual thermal printer IP in `.env`
2. Test connection: `GET /api/receipts/printer/status`
3. Test print: `POST /api/receipts/printer/test`
4. See `python-services/receipts/PRINTER_SETUP.md` for full setup guide

## Files Changed

```
python-services/
├── .env                              # Added printer config
├── .env.example                      # Added printer config template
└── receipts/
    ├── thermal_printer.py            # Enhanced error handling
    ├── routes.py                     # Better error responses
    ├── PRINTER_SETUP.md              # New setup guide
```

## Verification

The fix can be verified by:

1. **Check logs** - Error messages are now meaningful:
   ```
   ⚠️ Captain order ORD-001 print failed: Thermal printer not configured
   ```

2. **API response** - Returns clear error instead of empty string:
   ```json
   {"success": false, "error": "Thermal printer not configured..."}
   ```

3. **Order creation** - Orders still created successfully even when printing fails

## Technical Details

### Why Printing Doesn't Block Orders

From `backend/src/controllers/outlet-pos.controller.ts`:

```typescript
// Print captain order asynchronously (don't block response)
captainOrderPrintService.printCaptainOrder({...})
  .then((result) => {
    if (result.success) {
      logger.info(`✅ Captain order printed`);
    } else {
      logger.warn(`⚠️ Print failed: ${result.error}`);
    }
  })
  .catch((printError) => {
    logger.error(`❌ Print error:`, printError);
  });

// Continue with order creation regardless of print status
res.status(201).json({ success: true, data: order });
```

This ensures:
- Orders always save to database
- Kitchen Display System (KDS) shows orders
- Print failures are logged but non-blocking
- Restaurant operations continue even with printer issues

---

**Fixed by**: Kiro AI
**Date**: 2026-06-19
**Related**: Captain order printing, thermal printer integration, error handling
