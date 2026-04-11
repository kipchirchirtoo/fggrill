# Staff Photo Flow - Complete Test Guide

## Quick Test Checklist

### 1. Apply Database Migration ✅

**Run in Supabase SQL Editor**:
```sql
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- Verify column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'staff_profiles' 
AND column_name = 'profile_photo';
```

### 2. Restart Backend ✅

```bash
cd backend
npm run dev
```

### 3. Test Photo Upload ✅

1. Navigate to: `http://localhost:3000/dashboard/admin/id-cards`
2. Find staff: `943a2d6b-bac6-426d-9865-aed2b8cb8ab5`
3. Click upload button (camera icon)
4. Select photo file
5. Click "Save Photo"
6. **Expected**: Success message
7. **Expected**: Photo appears in staff card

### 4. Verify Database ✅

```sql
SELECT id, first_name, last_name, profile_photo 
FROM staff_profiles 
WHERE id = '943a2d6b-bac6-426d-9865-aed2b8cb8ab5';

-- Expected result:
-- profile_photo: staff-photos/943a2d6b-...-1712345678.jpg
```

### 5. Test ID Card Generation ✅

**Preview**:
1. Click "Preview" button on staff card
2. **Expected**: Modal opens with PDF preview
3. **Expected**: Photo appears in ID card

**Download**:
1. Click "Generate" button
2. **Expected**: PDF downloads
3. Open PDF
4. **Expected**: Photo appears in ID card

**Batch Print**:
1. Click "Batch Print" button
2. **Expected**: ZIP file downloads
3. Extract ZIP
4. Open PDFs
5. **Expected**: Photos appear in all ID cards

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PHOTO UPLOAD                                             │
├─────────────────────────────────────────────────────────────┤
│ Frontend: Upload photo file                                 │
│     ↓                                                        │
│ POST /api/staff/{id}/photo                                  │
│     ↓                                                        │
│ Backend: Upload to Supabase Storage                         │
│     → staff-photos/{staffId}-{timestamp}.jpg                │
│     ↓                                                        │
│ Backend: Update staff_profiles.profile_photo                │
│     → profile_photo = "staff-photos/..."                    │
│     ↓                                                        │
│ Response: { profile_photo: "...", profile_photo_url: "..." }│
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 2. FETCH STAFF LIST                                         │
├─────────────────────────────────────────────────────────────┤
│ Frontend: GET /api/staff                                    │
│     ↓                                                        │
│ Backend: Query staff_profiles with profile_photo           │
│     ↓                                                        │
│ Backend: Return staff with profile_photo field             │
│     → profile_photo: "staff-photos/..."                     │
│     ↓                                                        │
│ Frontend: Construct full URL                                │
│     → {SUPABASE_URL}/storage/v1/object/public/profile/      │
│       staff-photos/{staffId}-{timestamp}.jpg                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 3. DISPLAY PHOTO IN UI                                      │
├─────────────────────────────────────────────────────────────┤
│ Frontend: Render staff card                                 │
│     ↓                                                        │
│ <img src={`${SUPABASE_URL}/storage/.../profile_photo`} />  │
│     ↓                                                        │
│ Browser: Fetch image from Supabase Storage                 │
│     ↓                                                        │
│ Display: Photo appears in staff card                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 4. GENERATE ID CARD                                         │
├─────────────────────────────────────────────────────────────┤
│ Frontend: Click "Generate" or "Preview"                    │
│     ↓                                                        │
│ Frontend: Prepare data with photo_url                       │
│     → photo_url: {SUPABASE_URL}/storage/.../profile_photo  │
│     ↓                                                        │
│ POST /api/id-cards/generate (Python service)               │
│     ↓                                                        │
│ Python: Download photo from photo_url                       │
│     ↓                                                        │
│ Python: Generate PDF with photo                             │
│     ↓                                                        │
│ Response: PDF blob                                          │
│     ↓                                                        │
│ Frontend: Download or display PDF                           │
└─────────────────────────────────────────────────────────────┘
```

## Photo URL Construction

### Backend Returns
```json
{
  "profile_photo": "staff-photos/943a2d6b-bac6-426d-9865-aed2b8cb8ab5-1712345678.jpg"
}
```

### Frontend Constructs Full URL
```javascript
const photoUrl = emp.profile_photo
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile/${emp.profile_photo}`
  : null;

// Result:
// https://your-project.supabase.co/storage/v1/object/public/profile/staff-photos/943a2d6b-...-1712345678.jpg
```

### Python Service Receives
```python
data = {
  "photo_url": "https://your-project.supabase.co/storage/v1/object/public/profile/staff-photos/..."
}

# Python downloads the image
response = requests.get(data['photo_url'])
```

## Troubleshooting

### Photo Not Appearing in UI

**Check 1**: Verify column exists
```sql
SELECT profile_photo FROM staff_profiles LIMIT 1;
```

**Check 2**: Verify photo path is stored
```sql
SELECT id, profile_photo 
FROM staff_profiles 
WHERE profile_photo IS NOT NULL;
```

**Check 3**: Verify Supabase URL in frontend
```bash
# Check frontend/.env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
```

**Check 4**: Check browser console for 404 errors

### Photo Not Appearing in ID Card

**Check 1**: Verify Python service is running
```bash
cd python-services
python app.py
# Should show: Running on http://localhost:5001
```

**Check 2**: Check Python logs
```
[ID Card] Downloading photo from: https://...
[ID Card] Photo downloaded successfully
```

**Check 3**: Test photo URL directly
- Copy photo URL from browser console
- Paste in new browser tab
- Should display the image

### Upload Fails

**Check 1**: Verify backend is running
```bash
cd backend
npm run dev
```

**Check 2**: Check backend logs
```
Uploading staff photo: { staffId: '...', filename: 'photo.jpg' }
Photo uploaded to storage: staff-photos/...
Staff photo updated successfully
```

**Check 3**: Verify Supabase Storage bucket
- Open Supabase Dashboard
- Storage → profile bucket
- Check if `staff-photos/` folder exists
- Check if photos are being uploaded

## Expected Logs

### Backend (Photo Upload)
```
[DEBUG] Uploading staff photo: {
  staffId: '943a2d6b-bac6-426d-9865-aed2b8cb8ab5',
  filename: 'apple.png'
}
[INFO] Photo uploaded to storage: staff-photos/943a2d6b-...-1712345678.png
[INFO] Staff photo updated successfully for staff 943a2d6b-...
```

### Python Service (ID Card Generation)
```
[ID Card] Received Form Data request
[ID Card] Generating card for: John Doe
[ID Card] Data keys: ['name', 'role', 'id_no', 'national_id', 'email', 'phone', 'join_date', 'expire_date', 'photo_url']
[ID Card] Downloading photo from: https://your-project.supabase.co/storage/...
[ID Card] Photo downloaded successfully
[ID Card] Calling generator.generate()
[ID Card] PDF generated successfully, size: 45678 bytes
```

### Browser Console (Success)
```
POST http://localhost:5000/api/staff/943a2d6b-.../photo 200 OK
Photo uploaded successfully!
```

## Performance Benchmarks

- **Photo Upload**: < 2 seconds
- **Photo Display**: Instant (cached)
- **ID Card with Photo**: < 3 seconds
- **Batch 10 Cards**: < 20 seconds

## Success Criteria

✅ Photo uploads without errors
✅ Photo appears in staff card immediately
✅ Photo appears in ID card preview
✅ Photo appears in downloaded ID card PDF
✅ Photo appears in batch-generated ID cards
✅ No console errors
✅ No backend errors
✅ No Python service errors

---

**Status**: Ready for Testing
**Date**: 2026-04-11
**Complexity**: Simple & Efficient ✅
