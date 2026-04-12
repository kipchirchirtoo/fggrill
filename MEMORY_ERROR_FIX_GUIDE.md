# 🔧 Memory Allocation Error - Complete Fix Guide

## 🚨 Error Description

```
RangeError: Array buffer allocation failed
at new ArrayBuffer (<anonymous>)
at Gunzip.ZlibBase (node:zlib:264:28)
```

This error occurs when Node.js runs out of memory during Next.js compilation. It's common in large projects with many pages and components.

---

## ✅ Solution 1: Use the Fix Script (Recommended)

### Quick Fix
```bash
FIX_MEMORY_ERROR.bat
```

This script will:
1. ✅ Stop any running Node.js processes
2. ✅ Clear Next.js cache (.next folder)
3. ✅ Start dev server with 8GB memory limit

---

## ✅ Solution 2: Manual Fix

### Step 1: Stop Current Server
Press `Ctrl + C` in the terminal running the dev server

### Step 2: Clear Cache
```bash
cd frontend
rmdir /s /q .next
rmdir /s /q node_modules\.cache
```

### Step 3: Set Memory Limit
```bash
set NODE_OPTIONS=--max-old-space-size=8192
```

### Step 4: Restart Dev Server
```bash
npm run dev
```

---

## ✅ Solution 3: Permanent Fix (Already Applied)

The `package.json` has been updated to include memory limits in all scripts:

```json
{
  "scripts": {
    "dev": "cross-env NODE_OPTIONS=--max-old-space-size=8192 next dev -p 3001",
    "build": "cross-env NODE_OPTIONS=--max-old-space-size=8192 next build",
    "build:electron": "cross-env NODE_OPTIONS=--max-old-space-size=8192 BUILD_FOR_ELECTRON=true next build"
  }
}
```

Now you can simply run:
```bash
cd frontend
npm run dev
```

---

## 🔍 Understanding the Fix

### What is `--max-old-space-size`?
- Controls the maximum memory Node.js can use
- Default: ~1.5GB (too small for large Next.js projects)
- Our fix: 8GB (8192 MB)

### Why 8GB?
- Large Next.js projects need more memory for:
  - Webpack compilation
  - TypeScript type checking
  - Hot module replacement (HMR)
  - Multiple page routes
  - Large component trees

### Memory Allocation Breakdown
```
Default Node.js:  1.5 GB  ❌ Too small
Our Setting:      8.0 GB  ✅ Sufficient
System RAM:       16+ GB  ✅ Recommended
```

---

## 🎯 Alternative Solutions

### Option A: Reduce Bundle Size

If you still face issues, consider:

1. **Code Splitting**
   ```typescript
   // Use dynamic imports
   const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
     loading: () => <p>Loading...</p>
   });
   ```

2. **Remove Unused Dependencies**
   ```bash
   npm uninstall <unused-package>
   ```

3. **Optimize Images**
   - Use Next.js Image component
   - Compress images before importing

### Option B: Increase System Virtual Memory

**Windows:**
1. Right-click "This PC" → Properties
2. Advanced system settings → Performance Settings
3. Advanced → Virtual Memory → Change
4. Set custom size: Initial 16GB, Maximum 32GB

### Option C: Upgrade Node.js

Ensure you're using Node.js 18+ for better memory management:
```bash
node --version
```

If below v18, download from: https://nodejs.org/

---

## 🧪 Verify the Fix

### Test 1: Check Memory Limit
```bash
node -e "console.log(v8.getHeapStatistics().heap_size_limit / (1024 * 1024) + ' MB')"
```

Should show: `8192 MB` or higher

### Test 2: Start Dev Server
```bash
cd frontend
npm run dev
```

Should compile without errors

### Test 3: Navigate to Leave Page
```
http://localhost:3001/dashboard/branch-manager/leave
```

Should load successfully

---

## 📊 Memory Usage Monitoring

### Check Current Memory Usage
```bash
# Windows Task Manager
Ctrl + Shift + Esc → Performance → Memory
```

### Node.js Memory Stats
```javascript
// Add to any page for debugging
console.log('Memory Usage:', process.memoryUsage());
```

---

## 🚨 If Error Persists

### 1. Restart Computer
Sometimes Windows needs a full restart to free up memory

### 2. Close Other Applications
- Close Chrome/Edge tabs
- Close Visual Studio Code
- Close other Node.js processes

### 3. Check Available RAM
```bash
wmic OS get FreePhysicalMemory
```

If less than 4GB free, close applications or upgrade RAM

### 4. Use Production Build
Development mode uses more memory. Try production:
```bash
npm run build
npm start
```

---

## 🔄 Clean Start Procedure

If all else fails, do a complete clean restart:

```bash
# 1. Stop all Node processes
taskkill /F /IM node.exe

# 2. Delete all caches
cd frontend
rmdir /s /q .next
rmdir /s /q node_modules\.cache
rmdir /s /q node_modules

# 3. Reinstall dependencies
npm install

# 4. Start with memory limit
set NODE_OPTIONS=--max-old-space-size=8192
npm run dev
```

---

## 📝 Files Modified

1. ✅ `frontend/package.json` - Added memory limits to scripts
2. ✅ `FIX_MEMORY_ERROR.bat` - Quick fix script
3. ✅ `MEMORY_ERROR_FIX_GUIDE.md` - This guide

---

## ✅ Summary

**Problem**: Node.js ran out of memory during Next.js compilation

**Solution**: Increased Node.js memory limit from 1.5GB to 8GB

**Status**: ✅ Fixed - `package.json` updated with permanent solution

**Next Steps**:
1. Run `FIX_MEMORY_ERROR.bat` OR
2. Simply run `npm run dev` (memory limit now included)

---

## 💡 Pro Tips

1. **Always use the updated scripts** - They include memory limits
2. **Clear cache regularly** - Delete `.next` folder when switching branches
3. **Monitor memory usage** - Keep Task Manager open during development
4. **Upgrade RAM if possible** - 16GB+ recommended for large projects
5. **Use production mode for testing** - It uses less memory

---

**Status**: ✅ Fixed and Ready
**Memory Limit**: 8GB (8192 MB)
**Next Action**: Run `FIX_MEMORY_ERROR.bat` or `npm run dev`
