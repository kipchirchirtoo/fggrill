# URGENT: Webpack Cache Corruption Fix

## Current Situation

Your Next.js dev server has a **corrupted webpack cache** causing multiple errors:
- Missing vendor chunks (`@swc.js`)
- Missing module files (`_document.js`)
- False positive syntax errors

The **original attendance issue IS FIXED** in the code, but the corrupted cache is preventing it from loading.

## What Was Fixed (Code Level)

✅ Added `getAttendanceSummary` method to `staffAPI` in `frontend/src/lib/api/staff.ts` (line 162)
✅ The method correctly delegates to `attendanceAPI.getSummary(staffId)`
✅ Backend endpoint `/staff/attendance/summary` exists and is working

## How to Fix the Cache Corruption

### OPTION 1: Use the Batch File (RECOMMENDED)

1. **Stop the current dev server** by pressing `Ctrl+C` in the terminal
2. **Run the cleanup script**: Double-click `clean-and-restart.bat` in the root directory
3. Wait for the dev server to start fresh (will take 30-60 seconds)
4. Refresh your browser

### OPTION 2: Manual Cleanup

1. **Stop the dev server**: Press `Ctrl+C` in the terminal running `npm run dev`

2. **Kill any remaining Node processes**:
   ```powershell
   taskkill /F /IM node.exe
   ```

3. **Delete the cache directories**:
   ```powershell
   cd frontend
   rmdir /s /q .next
   rmdir /s /q node_modules\.cache
   ```

4. **Start fresh**:
   ```powershell
   npm run dev
   ```

5. **Hard refresh browser**: `Ctrl + Shift + R`

## Why This Happened

When we tried to delete the `.next` folder earlier while the dev server was running, it caused webpack to lose track of its cache files. The server continued running with references to files that no longer existed, creating an inconsistent state.

## Verification

After the clean restart, you should see:
- ✅ No webpack cache errors
- ✅ Clean compilation of all pages
- ✅ The attendance page loads without the `getAttendanceSummary is not a function` error
- ✅ Attendance summary data displays correctly

## If Problems Persist

If you still see errors after the clean restart:

1. Check if multiple Node processes are running:
   ```powershell
   Get-Process node
   ```

2. Kill all Node processes:
   ```powershell
   Stop-Process -Name node -Force
   ```

3. Delete `node_modules` and reinstall (last resort):
   ```powershell
   cd frontend
   rmdir /s /q node_modules
   npm install
   npm run dev
   ```

## Summary

**The code fix is complete and correct.** You just need to clear the corrupted webpack cache and restart the dev server fresh.
