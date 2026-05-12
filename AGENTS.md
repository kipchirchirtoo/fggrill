# AGENTS.md

## Project Overview

FamousGate Hotels Management System is a comprehensive hotel management platform with multi-branch support, built as a full-stack application with multiple client interfaces.

**Architecture:**
- **Backend API**: Node.js 16+, Express.js, TypeScript
- **Frontend Dashboard**: Next.js 14 (App Router), React 18, TypeScript
- **Python Microservices**: Flask, FastAPI
- **Desktop Application**: Tauri 2, React, SQLite (offline-first)
- **Mobile Application**: React Native, Expo SDK 54
- **Landing Page**: Next.js (standalone)
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Authentication**: JWT (custom + Supabase Auth), bcrypt
- **Payment Integrations**: Stripe, Paystack, M-Pesa (Safaricom)
- **Real-time**: Socket.IO, Supabase real-time subscriptions
- **Email/SMS**: Nodemailer, Brevo, Twilio

---

## Folder Structure

### Root Directory
```
fggrill/
├── backend/                    # Node.js/Express backend API
├── frontend/                   # Next.js frontend dashboard
├── python-services/            # Python microservices (reports, pricing, communication)
├── analytics-service/          # FastAPI analytics service
├── electron/                   # Electron desktop app (legacy)
├── famous-gates-desktop/       # Tauri 2 desktop app (current)
├── famousgate-mobile/          # React Native mobile app
├── landing-page/               # Standalone Next.js landing page
├── database/migrations/        # Database migration files
└── AGENTS.md                   # This file
```

### Backend (`/backend`)
```
backend/
├── src/
│   ├── config/                 # Configuration (supabase, database, pythonService)
│   ├── controllers/            # Route controllers (200+ files)
│   │   ├── kitchen/            # Kitchen-specific controllers
│   │   └── ...
│   ├── models/                 # TypeScript models/interfaces
│   ├── services/               # Business logic services
│   ├── middleware/             # Express middleware (auth, errorHandler, rateLimit)
│   ├── routes/                 # Route definitions (99 route modules)
│   ├── utils/                  # Utility functions (logger, audit, branchIsolation)
│   ├── jobs/                   # Background jobs
│   ├── db.ts                   # PostgreSQL connection pool
│   └── server.ts               # Express app entry point
├── src/database/migrations/    # Backend-specific migrations
├── package.json
├── tsconfig.json
└── .env.example
```

### Frontend (`/frontend`)
```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages (600+ dashboard pages)
│   │   ├── dashboard/          # Role-based dashboards
│   │   ├── (auth)/             # Auth pages
│   │   └── ...
│   ├── components/             # React components
│   │   ├── ui/                 # UI components (40+ Shadcn-style)
│   │   └── ...
│   ├── lib/                    # Utilities and API
│   │   ├── api/                # Modular API clients (10+ modules)
│   │   ├── api.ts              # API re-exports
│   │   ├── api/core.ts         # Unified fetch engine
│   │   ├── config.ts           # Configuration
│   │   ├── supabase-client.ts  # Supabase client
│   │   └── auth-context.tsx    # Auth context
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # Frontend services
│   └── types/                  # TypeScript types
├── public/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

### Python Services (`/python-services`)
```
python-services/
├── app.py                      # Flask application entry point
├── pricing_engine/
│   └── service.py              # Dynamic pricing service
├── communication_hub/
│   └── service.py              # Email/SMS service
├── reports/                    # Report generators
├── requirements.txt
└── .env
```

### Desktop App (`/famous-gates-desktop`)
```
famous-gates-desktop/
├── apps/desktop/
│   ├── src/
│   │   ├── main.tsx            # React entry
│   │   ├── routes/             # Route registry + guards
│   │   ├── features/           # Domain pages
│   │   ├── components/         # Shared UI components
│   │   ├── services/           # API clients, SQLite, sync
│   │   ├── bridge/             # Tauri invoke() wrappers
│   │   └── src-tauri/          # Tauri backend (Rust)
│   │       ├── src/
│   │       │   ├── commands/   # Tauri commands
│   │       │   ├── services/   # Rust services
│   │       │   └── models/     # Domain structs
│   │       └── migrations/     # SQLite schema
├── packages/
│   ├── shared/src/types/       # Shared DTOs
│   └── contracts/              # API + sync + auth contracts
├── package.json
├── vite.config.ts
└── tauri.conf.json
```

### Mobile App (`/famousgate-mobile`)
```
famousgate-mobile/
├── src/
│   ├── api/                    # API clients
│   ├── components/             # React Native components
│   ├── navigation/             # React Navigation
│   ├── screens/                # Screen components by role
│   ├── services/               # Business logic services
│   ├── stores/                 # Zustand state stores
│   ├── theme/                  # Theme configuration
│   ├── types/                  # TypeScript types
│   ├── utils/                  # Utility functions
│   └── App.tsx                 # App entry point
├── package.json
├── app.json
└── app.config.ts
```

### Database Migrations (`/database/migrations`)
```
database/migrations/
├── 00_drop_existing.sql
├── 01_create_users_table.sql
├── 02_create_room_tables.sql
├── 03_create_booking_tables.sql
├── 04_create_booking_procedures.sql
├── 05_create_guest_tables.sql
├── 06_create_staff_tables.sql
├── 07_create_housekeeping_tables.sql
├── 08_create_restaurant_tables.sql
├── 09_create_finance_tables.sql
├── 10_create_maintenance_tables.sql
├── 15_bar_stock_requests.sql
├── 20231126_simple_stock.sql
├── 20231127_enhanced_inventory.sql
├── 20231128_sku_order_sequences.sql
├── 20231129_multi_branch_inventory.sql
├── 20231130_demo_users.sql
├── 20231201_simple_stock_management.sql
├── 20231202_dispatch_enhancements.sql
├── 20231203_kitchen_usage_tracking.sql
├── 20241212_wastage_recording.sql
├── 20251128_bar_functions.sql
├── 20251128_bar_module.sql
├── 20251128_bar_seed_data.sql
├── 20251128_bar_waste_log.sql
├── 20251128_bartender_users.sql
├── 20251214_employee_guest_portals.sql
├── 20251217_fix_null_branch_orders.sql
├── 20251218_add_guest_fields.sql
├── 20260114_ULTIMATE_USER_FIX.sql
├── 20260114_add_kitchen_operations_role.sql
├── 20260114_fix_user_creation_trigger.sql
├── 20260114_kitchen_management.sql
├── 20260114_menu_overhaul.sql
├── 20260126_add_profile_photo.sql
├── 20260126_kitchen_management_clean.sql
├── 20260128_add_rfid_tag.sql
├── 20260128_staff_terminal_fields.sql
├── 20260203_food_controls_enhancement.sql
├── 20260206_create_credit_bills.sql
├── 20260206_simplified_payroll_schema.sql
├── 20260207_add_auditor_fields_to_payroll.sql
├── 20260207_add_reconciliation_columns.sql
├── 20260207_branch_accounting_setup.sql
├── 20260207_finance_daily_logs.sql
├── 20260207_fix_bank_branch_id.sql
├── 20260207_fix_credit_bills_auditor_fields.sql
├── 20260324_fix_credit_bills_schema.sql
├── 20260425_food_control_system.sql
├── COMBINED_MIGRATION.sql
└── RUN_ALL_STOREKEEPING.sql
```

---

## Development Rules

### Code Quality
- **Preserve existing architecture** - This is a production system with complex integrations
- **Do not introduce unnecessary dependencies** - Keep bundle sizes minimal
- **Prefer refactoring over rewriting** - Maintain backward compatibility
- **Keep functions small and composable** - Follow single responsibility principle
- **Follow TypeScript strict typing** - Enable strict mode in tsconfig.json
- **Use environment variables** - Never hardcode credentials (except in .env.example)
- **Follow existing patterns** - Look at similar controllers/services before creating new ones

### Naming Conventions
- **Components**: PascalCase (e.g., `BookingForm.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useBookings.ts`)
- **Utilities**: camelCase (e.g., `formatCurrency.ts`)
- **Backend routes**: kebab-case (e.g., `bookings.routes.ts`)
- **Backend controllers**: PascalCase with `.controller.ts` suffix (e.g., `BookingController.ts`)
- **Backend services**: PascalCase with `.service.ts` suffix (e.g., `BookingService.ts`)
- **Backend models**: PascalCase (e.g., `Booking.ts`, `User.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_URL`)
- **Database tables**: snake_case (e.g., `staff_profiles`)
- **Python modules**: snake_case (e.g., `pricing_engine/service.py`)

### Backend Development
- Use Express.js with TypeScript
- Controllers handle HTTP requests/responses
- Services contain business logic
- Models define TypeScript interfaces
- Use Supabase client for database operations via `supabase` from `../config/supabase`
- Use PostgreSQL connection pool via `db` from `../db` for complex queries
- Apply `applyBranchFilter()` for multi-branch data isolation
- Use `isGlobalRole()` to check if user has cross-branch access
- Log errors with `logger` from `../utils/logger`
- Use `AppError` class for operational errors
- Always handle Supabase errors in try-catch blocks
- Use `authorize()` middleware for role-based access control

### Frontend Development
- Use Next.js 14 App Router
- Use React 18 with functional components and hooks
- Use Tailwind CSS for styling
- Use modular API clients from `lib/api/`
- Use `fetchAPI()` from `lib/api/core.ts` for API calls
- Use `auth-context.tsx` for authentication state
- Use Supabase client from `lib/supabase-client.ts` for direct DB access
- Use Shadcn UI components from `components/ui/`
- Use Zustand for global state management
- Use React Hook Form for forms
- Use Sonner for toast notifications
- Follow role-based routing patterns in `dashboard/page.tsx`

### Database Changes
- Create new migration files in `/database/migrations/`
- Use UUID primary keys: `id UUID DEFAULT gen_random_uuid() PRIMARY KEY`
- Add `created_at TIMESTAMPTZ DEFAULT NOW()` to all tables
- Add `updated_at TIMESTAMPTZ` with trigger for auto-update
- Add `branch_id INTEGER REFERENCES branches(id)` for multi-branch tables
- Enable Row Level Security (RLS) on all tables
- Add RLS policies for role-based access
- Use CHECK constraints for enums
- Add indexes on frequently queried columns
- Add foreign key constraints with CASCADE where appropriate

### Authentication & Authorization
- Use JWT tokens from Authorization header or query parameter
- Support both custom JWT and Supabase Auth
- Use `authorize()` middleware for route protection
- Use `isGlobalRole()` to check for cross-branch access
- Apply `applyBranchFilter()` to queries for branch isolation
- Log all auth attempts with `logAuthAttempt()` from `utils/audit.ts`
- Use bcrypt for password hashing
- Never expose service role keys to frontend

### Payment Integration
- Use Stripe for international card payments
- Use Paystack for local card payments and bank transfers
- Use M-Pesa for mobile payments (Kenya)
- Always handle payment webhooks securely
- Verify payment status before updating orders/bookings
- Use `payment.service.ts` for Stripe operations
- Use `mpesa.service.ts` for M-Pesa operations
- Use `paystack.service.ts` for Paystack operations

### Testing Requirements

Before considering a task complete, always verify:

### Backend
```bash
cd backend
npm install
npm run lint
npm run build
```

### Frontend
```bash
cd frontend
npm install
npm run lint
npm run build
```

### Python Services
```bash
cd python-services
pip install -r requirements.txt
python app.py  # Verify it starts without errors
```

### Desktop App
```bash
cd famous-gates-desktop
npm install
npm run build
```

### Mobile App
```bash
cd famousgate-mobile
npm install
npm run lint
npm run type-check
```

---

## Key Services & Patterns

### Branch Isolation
- Use `applyBranchFilter(query, req)` to automatically filter by branch_id
- Global roles: `super_admin`, `director`, `general_manager`, `hr_manager`, `central_storekeeper`, `auditor`
- Branch-specific roles: `branch_manager`, `receptionist`, `cashier`, etc.

### Error Handling
- Use `AppError` class for operational errors
- Use global `errorHandler` middleware for consistent error responses
- Log errors with `logger.error()`
- Return structured error responses: `{ success: false, message: string, error?: any }`

### Notification System
- Use `notificationService` for real-time notifications
- Socket.IO for live updates
- Supabase real-time subscriptions for frontend
- Email notifications via `email.service.ts`
- SMS notifications via Twilio

### Audit Logging
- Use `logAuthAttempt()` for authentication events
- Use `logSecurityEvent()` for security anomalies
- All auth attempts include IP geolocation and device fingerprinting

---

## Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=5000

# Supabase
SUPABASE_PROJECT_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# JWT
JWT_SECRET=your-jwt-secret

# Python Services
PYTHON_SERVICE_URL=http://localhost:5001
PRICING_SERVICE_URL=http://localhost:5002
COMMUNICATION_SERVICE_URL=http://localhost:5003
REPORTS_SERVICE_URL=http://localhost:5004

# Payment
STRIPE_SECRET_KEY=your-stripe-key
PAYSTACK_SECRET_KEY=your-paystack-key
MPESA_CONSUMER_KEY=your-mpesa-key
MPESA_CONSUMER_SECRET=your-mpesa-secret
MPESA_ENVIRONMENT=sandbox
MPESA_SHORTCODE=your-shortcode
MPESA_PASSKEY=your-passkey

# Email
BREVO_API_KEY=your-brevo-key
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password

# SMS
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=your-twilio-phone
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_PYTHON_API_URL=http://localhost:5001
NEXT_PUBLIC_REPORTS_SERVICE_URL=http://localhost:5004
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Common Commands

### Backend
```bash
cd backend
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm start            # Start production server
```

### Frontend
```bash
cd frontend
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npm start            # Start production server
```

### Python Services
```bash
cd python-services
gunicorn app:app     # Start with Gunicorn
```

### Desktop App
```bash
cd famous-gates-desktop
npm run dev          # Start Tauri dev
npm run build        # Build for production
```

---

## Important Notes

1. **Multi-branch architecture**: Always consider branch isolation when adding new features
2. **50+ user roles**: Check existing roles in `UserRole` enum before adding new ones
3. **Database migrations**: Always create new migration files, never modify existing ones
4. **Security**: Never expose service role keys to frontend or client-side code
5. **Payment handling**: Always verify payment status before updating database
6. **Audit logging**: Important for compliance - log all sensitive operations
7. **Offline support**: Desktop app works offline with SQLite sync via PowerSync
8. **Real-time**: Use Socket.IO for live updates, Supabase real-time for subscriptions
9. **Email templates**: Use existing templates in `utils/emailTemplates.ts`
10. **Barcode generation**: Use `barcodeGenerator.service.ts` for booking barcodes

---

## Troubleshooting

### Database Connection Issues
- Check Supabase credentials in .env
- Verify PostgreSQL connection pool settings in `db.ts`
- Check RLS policies if data not showing

### Authentication Issues
- Verify JWT_SECRET matches between backend and frontend
- Check Supabase Auth configuration
- Review auth logs in `auth_logs` table

### Payment Integration Issues
- Verify API keys in .env
- Check payment provider webhook URLs
- Review payment verification logic in controllers

### Build Issues
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript strict mode violations
- Review ESLint errors
