# Fix Communications Storage Policies - Dashboard UI Method

Since SQL Editor doesn't have permissions, use the Supabase Dashboard UI:

## Step 1: Go to Storage Settings
1. Open: https://supabase.com/dashboard/project/utsvlihpudfraxzcmtle/storage/buckets
2. Find the "communications" bucket
3. If it doesn't exist, click "New bucket" and create it:
   - Name: `communications`
   - Public bucket: ✅ YES (check this box)
   - File size limit: 10485760 (10MB)
   - Allowed MIME types: Leave empty or add: image/*, application/pdf, application/msword, etc.

## Step 2: Configure Bucket Policies
1. Click on the "communications" bucket
2. Click "Policies" tab at the top
3. Click "New Policy" button

### Policy 1: Allow INSERT (Upload)
- Policy name: `Allow public uploads`
- Allowed operation: `INSERT`
- Target roles: `public` (or check "For all users")
- Policy definition: `true` (or leave as default)
- Click "Save"

### Policy 2: Allow SELECT (Download/View)
- Policy name: `Allow public reads`
- Allowed operation: `SELECT`
- Target roles: `public`
- Policy definition: `true`
- Click "Save"

### Policy 3: Allow UPDATE
- Policy name: `Allow public updates`
- Allowed operation: `UPDATE`
- Target roles: `public`
- Policy definition: `true`
- Click "Save"

### Policy 4: Allow DELETE
- Policy name: `Allow public deletes`
- Allowed operation: `DELETE`
- Target roles: `public`
- Policy definition: `true`
- Click "Save"

## Alternative: Disable RLS Temporarily
If the above doesn't work, you can disable RLS for the bucket:
1. Go to Storage → communications bucket → Policies
2. Toggle "Enable RLS" to OFF
3. This will allow all operations without policy checks

## Verify
After setting up policies, try uploading a file in the app. It should work!
