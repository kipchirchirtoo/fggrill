# Fix Email Issue - Quick Steps

## Run This ONE Command

```bash
cd backend && node diagnose-email-issue.js
```

This will tell you exactly what's wrong.

## Most Likely Issues

### 1. Backend Not Running
```bash
cd backend
npm run dev
```

### 2. Python Service Not Running
```bash
cd python-services
python barcode_app.py
```

### 3. Both Not Running
**Terminal 1**:
```bash
cd python-services
python barcode_app.py
```

**Terminal 2**:
```bash
cd backend
npm run dev
```

**Terminal 3** (after both are running):
```bash
cd backend
node diagnose-email-issue.js
```

## What the Diagnosis Will Show

✅ = Working
❌ = Not working (with fix instructions)

It checks:
1. Environment variables
2. Python service
3. Backend service
4. Email sending

## After Running Diagnosis

Follow the instructions it gives you. It will tell you exactly what to fix.

## Email Will Be Sent To

allansamuel571@gmail.com

Check inbox in 1-2 minutes after successful send.
