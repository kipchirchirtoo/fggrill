# Debug: Photo Not Showing in ID Card

## Issue
Photo circle appears empty (gold border only) in generated ID card PDF.

## Possible Causes

### 1. Photo Not Uploaded to Supabase Storage
### 2. Photo URL Incorrect
### 3. Storage Bucket RLS Blocking Access
### 4. Python Service Can't Download Photo

## Step-by-Step Debugging

### Step 1: Verify Photo Exists in Database

```sql
SELECT id, first_name, last_name, profile_photo 
FROM staff_profiles 
WHERE id = '943a2d6b-bac6-426d-9865-aed2b8cb8ab5';
```

**Expected**: `profile_photo` should have a value like `staff-photos/943a2d6b-...-1234567890.jpg`

**If NULL**: Photo was never uploaded. Go to Step 2.

### Step 2: Upload Photo

1. Navigate to `/dashboard/admin/id-cards`
2. Find the staff member
3. Click upload button (camera icon)
4. Select photo file
5. Click "Save Photo"
6. Check backend logs for:
   ```
   [INFO] Photo uploaded to storage: staff-photos/...
   [INFO] Staff photo updated successfully
   ```

### Step 3: Verify Photo in Supabase Storage

1. Open Supabase Dashboard
2. Go to Storage → `profile` bucket
3. Navigate to `staff-photos/` folder
4. Check if photo file exists
5. Click on photo to view it

**If photo doesn't exist**: Upload failed. Check backend logs.

### Step 4: Test Photo URL Accessibility

**Get the photo URL from database**:
```sql
SELECT 
  CONCAT(
    'https://utsvlihpudfraxzcmtle.supabase.co/storage/v1/object/public/profile/',
    profile_photo
  ) as photo_url
FROM staff_profiles 
WHERE id = '943a2d6b-bac6-426d-9865-aed2b8cb8ab5';
```

**Test URL in browser**:
1. Copy the photo_url
2. Paste in new browser tab
3. Photo should display

**If 404 Not Found**: Photo doesn't exist in storage.
**If 403 Forbidden**: RLS policy blocking access.
**If photo displays**: URL is correct, issue is in Python service.

### Step 5: Test with Python Script

```bash
cd python-services
python test_photo_url.py "YOUR_PHOTO_URL_HERE"
```

**Expected output**:
```
✅ SUCCESS - Photo is accessible!
Content-Length: 45678 bytes
```

**If fails**: Check error message for details.

### Step 6: Check Storage Bucket RLS Policies

**In Supabase Dashboard**:
1. Go to Storage → `profile` bucket
2. Click "Policies" tab
3. Check if there's a policy allowing public read access

**Required Policy**:
```sql
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile');
```

**Or make bucket public**:
1. Storage → `profile` bucket
2. Settings → Make bucket public

### Step 7: Check Python Service Logs

**Restart Python service with logging**:
```bash
cd python-services
python app.py
```

**Generate ID card and check logs**:
```
[ID Card] Generating card for: John Doe
[ID Card] Data keys: ['name', 'role', 'id_no', 'photo_url', ...]
[ID Card] Downloading photo from: https://...
[ID Card] Photo download response: HTTP 200
[ID Card] Photo downloaded successfully to: /tmp/...
[ID Card] Photo file size: 45678 bytes
[Generator] photo_path: /tmp/tmpXXXXXX.jpg
[Generator] Loading from file: /tmp/tmpXXXXXX.jpg
```

**If you see**:
- `HTTP 404`: Photo doesn't exist
- `HTTP 403`: RLS blocking access
- `No photo_path provided`: Photo URL not sent from frontend
- `Photo path does not exist`: Download failed

### Step 8: Check Frontend Data

**Open browser console**:
```javascript
// Check what data is being sent
console.log('Employee data:', emp);
console.log('Photo URL:', emp.profile_photo);
```

**Expected**:
```javascript
{
  profile_photo: "staff-photos/943a2d6b-...-1234567890.jpg",
  // ... other fields
}
```

**Photo URL should be constructed as**:
```
https://utsvlihpudfraxzcmtle.supabase.co/storage/v1/object/public/profile/staff-photos/943a2d6b-...-1234567890.jpg
```

## Common Issues & Solutions

### Issue 1: Photo URL is NULL

**Cause**: Photo not uploaded or database not updated

**Solution**:
1. Upload photo again
2. Check backend logs for errors
3. Verify database column exists:
   ```sql
   ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS profile_photo TEXT;
   ```

### Issue 2: HTTP 403 Forbidden

**Cause**: Storage bucket RLS policy blocking access

**Solution**:
```sql
-- Make profile bucket publicly readable
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile');
```

**Or in Supabase Dashboard**:
- Storage → profile → Settings → Make public

### Issue 3: HTTP 404 Not Found

**Cause**: Photo doesn't exist in storage

**Solution**:
1. Re-upload photo
2. Check if upload succeeded
3. Verify file exists in Supabase Storage

### Issue 4: Photo Downloads But Doesn't Appear

**Cause**: Image format not supported by ReportLab

**Solution**:
- Ensure photo is JPG or PNG
- Check Python logs for image loading errors
- Try re-uploading photo in different format

### Issue 5: Python Can't Download Photo

**Cause**: Network/firewall blocking requests

**Solution**:
1. Test URL in browser
2. Check Python service has internet access
3. Try with User-Agent header (already implemented)

## Quick Fix Checklist

- [ ] Database column `profile_photo` exists
- [ ] Photo uploaded successfully
- [ ] Photo exists in Supabase Storage
- [ ] Photo URL accessible in browser
- [ ] Storage bucket is public or has read policy
- [ ] Python service logs show successful download
- [ ] Photo file size > 0 bytes
- [ ] No errors in Python logs
- [ ] Frontend sends correct photo_url

## Test Commands

### Test Database
```sql
SELECT id, first_name, last_name, profile_photo 
FROM staff_profiles 
WHERE profile_photo IS NOT NULL 
LIMIT 5;
```

### Test Storage Access
```bash
curl -I "https://utsvlihpudfraxzcmtle.supabase.co/storage/v1/object/public/profile/staff-photos/test.jpg"
```

### Test Python Download
```bash
python test_photo_url.py "YOUR_PHOTO_URL"
```

## Expected Working Flow

```
1. Upload Photo
   ↓
2. Store in: staff-photos/{staffId}-{timestamp}.jpg
   ↓
3. Update DB: profile_photo = "staff-photos/..."
   ↓
4. Frontend constructs URL: {SUPABASE_URL}/storage/.../profile_photo
   ↓
5. Send to Python: { photo_url: "https://..." }
   ↓
6. Python downloads photo to /tmp/
   ↓
7. Python generates PDF with photo
   ↓
8. Photo appears in ID card ✅
```

## Still Not Working?

1. **Check Python service is running**: `http://localhost:5001/health`
2. **Restart Python service**: `python app.py`
3. **Clear browser cache**: Hard refresh (Ctrl+Shift+R)
4. **Check all logs**: Backend, Python, Browser console
5. **Try with different staff member**: Rule out data-specific issues
6. **Test with placeholder image**: Verify PDF generation works

---

**Need Help?**
- Check Python service logs
- Check backend logs
- Check browser console
- Share error messages for debugging
