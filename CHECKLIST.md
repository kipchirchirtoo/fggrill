# ✅ Security Center Setup Checklist

## Pre-Setup (Already Done ✓)
- [x] Code implementation complete
- [x] axios installed
- [x] pg installed
- [x] Migration file created
- [x] Documentation created

## Setup Steps (Do Now)

### 1. Apply Database Migration
- [ ] Open https://app.supabase.com
- [ ] Login to account
- [ ] Select Famous Gates Hotels project
- [ ] Click "SQL Editor" in sidebar
- [ ] Click "New Query"
- [ ] Open file: `database/migrations/013_add_geolocation_security_fields.sql`
- [ ] Copy ALL content (Ctrl+A, Ctrl+C)
- [ ] Paste into SQL Editor (Ctrl+V)
- [ ] Click "Run" (or Ctrl+Enter)
- [ ] Wait for "Success. No rows returned" message

### 2. Verify Migration
- [ ] Open terminal
- [ ] Run: `cd backend`
- [ ] Run: `node check-migration-status.js`
- [ ] Confirm: "✅ Migration appears to be COMPLETE"

### 3. Restart Backend
- [ ] Stop current backend (Ctrl+C if running)
- [ ] Run: `npm run dev`
- [ ] Wait for "Server running" message

### 4. Test the System
- [ ] Open browser: http://localhost:3001
- [ ] Login to your account
- [ ] Navigate to: http://localhost:3001/dashboard/super/admin/security
- [ ] Verify dashboard loads
- [ ] Check statistics cards show data
- [ ] Click through all 4 tabs (Access, Threats, Geo, Sessions)

### 5. Verify Data Collection
- [ ] Go to Supabase Dashboard
- [ ] Click "Table Editor"
- [ ] Select "auth_logs" table
- [ ] Find your latest login row
- [ ] Verify these fields are populated:
  - [ ] `ip_address` (not ::1)
  - [ ] `geo_country` (e.g., "Kenya")
  - [ ] `geo_city` (e.g., "Nairobi")
  - [ ] `threat_score` (0-100)
  - [ ] `device_info` (browser/OS)

## Post-Setup (Optional)

### 6. Configure Whitelisting (Recommended)
- [ ] Identify your office/branch IP addresses
- [ ] Add them to IP whitelist via dashboard
- [ ] Test that whitelisted IPs work correctly

### 7. Test Security Features
- [ ] Try 5 failed login attempts
- [ ] Check if brute force alert appears
- [ ] Verify threat detection is working
- [ ] Check geolocation data accuracy

### 8. Review Documentation
- [ ] Read: `docs/SECURITY_CENTER_GUIDE.md`
- [ ] Understand threat levels
- [ ] Learn about security alerts
- [ ] Review best practices

## Troubleshooting

If any step fails:
- [ ] Check error message
- [ ] Review `APPLY_MIGRATION_NOW.md`
- [ ] Run `node check-migration-status.js`
- [ ] Check backend logs: `backend/logs/error.log`

## Success Criteria

✅ All checkboxes above are checked  
✅ Security dashboard loads without errors  
✅ Real IP addresses are captured (not localhost)  
✅ Geolocation data is populated  
✅ Threat detection is working  
✅ All 4 tabs display data correctly  

## Completion

When all checkboxes are checked, you have successfully:
- ✅ Implemented enterprise-grade security monitoring
- ✅ Enabled real IP tracking and geolocation
- ✅ Activated automatic threat detection
- ✅ Set up comprehensive security dashboard

**Congratulations! Your security center is now operational!** 🎉🔒

---

## Quick Reference

**Security Dashboard URL**: http://localhost:3001/dashboard/super/admin/security

**Check Migration Status**: `node check-migration-status.js`

**Restart Backend**: `npm run dev`

**Documentation**: See `docs/SECURITY_CENTER_GUIDE.md`

---

**Current Status**: Ready to apply migration (Step 1)

**Next Action**: Open Supabase SQL Editor and apply migration
