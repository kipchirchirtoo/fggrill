# ID Card Generation - Testing Guide

## Prerequisites

1. **Python Service Running** on port 5001
2. **Backend Service Running** on port 5000
3. **Frontend Running** on port 3000
4. **Database** accessible with staff data

## Quick Test Steps

### 1. Start Python Service
```bash
cd python-services
python app.py
```

Expected output:
```
 * Running on http://127.0.0.1:5001
 * Running on http://localhost:5001
```

### 2. Test Python Endpoint Directly

**Using curl (Windows PowerShell)**:
```powershell
$body = @{
    data = @{
        name = "John Doe"
        role = "MANAGER"
        id_no = "EMP001"
        national_id = "12345678"
        email = "john@example.com"
        phone = "0700000000"
        join_date = "01/01/2024"
        expire_date = "31/12/2026"
        photo_url = $null
    } | ConvertTo-Json
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:5001/api/id-cards/generate" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -OutFile "test_id_card.pdf"
```

**Using curl (bash)**:
```bash
curl -X POST http://localhost:5001/api/id-cards/generate \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "role": "MANAGER",
    "id_no": "EMP001",
    "national_id": "12345678",
    "email": "john@example.com",
    "phone": "0700000000",
    "join_date": "01/01/2024",
    "expire_date": "31/12/2026",
    "photo_url": null
  }' \
  --output test_id_card.pdf
```

Expected: `test_id_card.pdf` file created

### 3. Test Frontend Integration

1. Navigate to: `http://localhost:3000/dashboard/admin/id-cards`
2. You should see a list of employees
3. Click **Preview** on any employee
   - Modal should open
   - PDF preview should load
4. Click **Generate** on any employee
   - PDF should download
5. Click **Batch Print**
   - ZIP file with multiple PDFs should download

## Troubleshooting

### Error: "JSONDecodeError: Expecting value"

**Cause**: Frontend is sending empty body or wrong Content-Type

**Check**:
1. Open browser DevTools → Network tab
2. Find the request to `/api/id-cards/generate`
3. Check Request Headers:
   - Should be `Content-Type: multipart/form-data; boundary=...`
   - Should NOT be `application/json`
4. Check Request Payload:
   - Should show FormData with 'data' field
   - 'data' field should contain JSON string

**Fix Applied**: ✅ Already fixed in `core.ts`

### Error: "Staff member has no associated user account"

**Cause**: Staff record in database has `user_id = null`

**Solution**: This is a data integrity issue. Staff member needs a user account created.

**Workaround**: 
1. Create user account for staff member
2. Update `staff_profiles.user_id` to link to new user

### Error: "Invalid staff ID format"

**Cause**: Staff ID is not a valid UUID

**Check**: 
```sql
SELECT id, user_id, first_name, last_name 
FROM staff_profiles 
WHERE id = 'YOUR_STAFF_ID';
```

### Python Service Not Starting

**Check**:
1. Python version: `python --version` (should be 3.8+)
2. Dependencies installed: `pip install -r requirements.txt`
3. Port 5001 not in use: `netstat -ano | findstr :5001`

### Frontend Not Connecting to Python Service

**Check**:
1. `frontend/.env` has correct URL:
   ```
   NEXT_PUBLIC_PYTHON_API_URL=http://localhost:5001
   ```
2. CORS is enabled in Python service (already configured)
3. Both services are running

## Expected Logs

### Python Service (Success)
```
INFO - [ID Card] Received Form Data request
INFO - [ID Card] Generating card for: John Doe
INFO - [ID Card] Data keys: ['name', 'role', 'id_no', 'national_id', 'email', 'phone', 'join_date', 'expire_date', 'photo_url']
INFO - [ID Card] Calling generator.generate()
INFO - [ID Card] PDF generated successfully, size: 45678 bytes
```

### Python Service (Error - Empty Data)
```
ERROR - [ID Card] No data received in request
```

### Python Service (Error - JSON Decode)
```
ERROR - [ID Card] Data is empty after parsing
```

### Browser Console (Success)
```
POST http://localhost:5001/api/id-cards/generate 200 OK
```

### Browser Console (Error)
```
POST http://localhost:5001/api/id-cards/generate 500 Internal Server Error
```

## Manual Test Checklist

- [ ] Python service starts without errors
- [ ] Direct curl test generates PDF
- [ ] Frontend loads employee list
- [ ] Preview button opens modal
- [ ] Preview shows PDF in iframe
- [ ] Generate button downloads PDF
- [ ] Batch print creates ZIP file
- [ ] Photo upload works (for staff with user_id)
- [ ] Error message shown for staff without user_id
- [ ] Edit employee details works
- [ ] Changes persist after refresh

## Performance Benchmarks

- **Single ID Card**: < 2 seconds
- **Batch 10 Cards**: < 15 seconds
- **Batch 50 Cards**: < 60 seconds

## Known Limitations

1. **Photo Download**: If photo URL is external, requires internet connection
2. **Large Batches**: Browser may timeout for >100 cards (use server-side batch generation)
3. **PDF Size**: Each card is ~40-50KB, ZIP compression reduces by ~30%

## Next Steps After Testing

1. ✅ Verify all tests pass
2. ✅ Check Python service logs for errors
3. ✅ Monitor browser console for warnings
4. ✅ Test with real staff data
5. ✅ Test photo upload functionality
6. ✅ Test batch generation with 5-10 employees
7. ✅ Verify PDF quality and formatting
8. ✅ Test on different browsers (Chrome, Firefox, Edge)

---

**Last Updated**: 2026-04-11
**Status**: Ready for Testing
