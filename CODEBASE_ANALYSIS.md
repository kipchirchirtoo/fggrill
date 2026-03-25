# Famous Gates Hotels — Full Codebase Analysis
> Generated: March 24, 2026 | System: Hirall Systems Hospitality Management Platform

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [Frontend Pages & Routes](#frontend-pages--routes)
4. [Backend API Endpoints](#backend-api-endpoints)
5. [URL Type Classification](#url-type-classification)

---

## Architecture Overview

| Layer | Technology | Port | Description |
|---|---|---|---|
| Frontend (Dashboard) | Next.js 14 App Router + TypeScript | 3001 | Main ERP dashboard |
| Frontend (Landing) | Next.js Pages Router + TypeScript | 3000 | Public hotel website |
| Backend API | Express.js + TypeScript + Node.js | 5000 | REST API server |
| Database | Supabase (PostgreSQL) | — | Cloud DB + Auth |
| Python Services | Flask microservices | 8000 | Analytics, PDF, Reports |
| Desktop POS | Electron + C# WinForms | — | Offline-capable terminal |
| Auth | Supabase Auth + JWT fallback | — | Bearer token |

**Multi-tenant pattern:** Branch-based isolation via `X-Branch-ID` header and `activeBranchId` in localStorage.
**Branches:** Famous Gates (HQ), Kyogong (Spa / Executive Bar / Sports Bar / Reception)

---

## Project Structure

```
famous-gates-hotels/                        ← Monorepo root
│
├── frontend/                               ← Next.js 14 App Router (Dashboard ERP)
│   ├── src/
│   │   ├── app/                            ← App Router pages
│   │   │   ├── (public)/                   ← Public route group
│   │   │   │   ├── page.tsx                ← / (home redirect)
│   │   │   │   └── booking/
│   │   │   │       ├── page.tsx            ← /booking
│   │   │   │       └── confirmation/
│   │   │   │           └── page.tsx        ← /booking/confirmation
│   │   │   ├── dashboard/                  ← Protected dashboard
│   │   │   │   ├── page.tsx                ← /dashboard
│   │   │   │   ├── admin/                  ← Super Admin module
│   │   │   │   ├── auditor/                ← Auditor module
│   │   │   │   ├── bar/                    ← Bar operations
│   │   │   │   ├── branch-accounting/      ← Branch accountant
│   │   │   │   ├── branch-manager/         ← Branch manager
│   │   │   │   ├── branch-operations/      ← Branch ops
│   │   │   │   ├── branch-store/           ← Branch storekeeper
│   │   │   │   ├── cashier/                ← Cashier shifts
│   │   │   │   ├── central-store/          ← Central warehouse
│   │   │   │   ├── employee/               ← Employee portal
│   │   │   │   ├── facilities/             ← Facilities mgmt
│   │   │   │   ├── gm/                     ← General Manager
│   │   │   │   ├── housekeeping/           ← Housekeeping
│   │   │   │   ├── hr/                     ← HR & Payroll
│   │   │   │   ├── inventory/              ← Inventory
│   │   │   │   ├── kitchen/                ← Kitchen display
│   │   │   │   ├── kitchen-operations/     ← Kitchen mgmt
│   │   │   │   ├── kyogong/                ← Kyogong branch
│   │   │   │   ├── maintenance/            ← Maintenance
│   │   │   │   ├── manager/                ← Manager
│   │   │   │   ├── pos-kitchen/            ← Unified POS
│   │   │   │   ├── procurement/            ← Procurement
│   │   │   │   ├── profile/                ← User profile
│   │   │   │   ├── reception/              ← Reception desk
│   │   │   │   ├── reports/                ← Analytics
│   │   │   │   ├── settings/               ← System settings
│   │   │   │   └── storekeeping/           ← Store management
│   │   │   ├── docs/                       ← System documentation
│   │   │   ├── guest-portal/               ← Guest self-service
│   │   │   ├── ios-design-demo/            ← Mobile UI demo
│   │   │   ├── login/                      ← Auth page
│   │   │   ├── portal/                     ← Employee/Guest portals
│   │   │   ├── terminal/                   ← POS terminal web
│   │   │   ├── unauthorized/               ← 403 page
│   │   │   ├── verify/                     ← ID verification
│   │   │   ├── layout.tsx                  ← Root layout
│   │   │   └── error.tsx / not-found.tsx
│   │   ├── components/                     ← Shared UI components
│   │   ├── lib/                            ← Utilities
│   │   │   ├── api.ts                      ← Unified API client (5599 lines)
│   │   │   ├── auth-context.tsx            ← Auth provider
│   │   │   ├── config.ts                   ← Env config
│   │   │   └── user-roles.ts               ← 40+ role definitions
│   │   └── types/                          ← TypeScript types
│   ├── public/                             ← Static assets
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── package.json
│
├── backend/                                ← Express.js API Server
│   ├── src/
│   │   ├── server.ts                       ← Entry point (port 5000)
│   │   ├── routes/                         ← 70+ route files
│   │   │   ├── index.ts                    ← Route registry
│   │   │   ├── auth.routes.ts
│   │   │   ├── user.routes.ts
│   │   │   ├── booking.routes.ts
│   │   │   ├── room.routes.ts
│   │   │   ├── restaurant.routes.ts
│   │   │   ├── restaurant.table.routes.ts
│   │   │   ├── restaurant.reservation.routes.ts
│   │   │   ├── payment.routes.ts           ← Webhooks + payment flows
│   │   │   ├── payments.routes.ts          ← Payment verification
│   │   │   ├── payroll-simple.routes.ts    ← Payroll + credit bills
│   │   │   ├── payroll-enhanced.routes.ts
│   │   │   ├── payroll-adjustments.routes.ts
│   │   │   ├── statutory-deductions.routes.ts
│   │   │   ├── accounting.routes.ts
│   │   │   ├── banking.routes.ts
│   │   │   ├── procurement.routes.ts
│   │   │   ├── kyogong.routes.ts           ← Kyogong branch
│   │   │   ├── storekeeping.routes.ts
│   │   │   ├── stock-take.routes.ts
│   │   │   ├── kitchen.routes.ts
│   │   │   ├── kitchen-ledger.routes.ts
│   │   │   ├── bar.routes.ts
│   │   │   ├── bar-stock-requests.routes.ts
│   │   │   ├── staff.routes.ts
│   │   │   ├── attendance.routes.ts
│   │   │   ├── hr-reports.routes.ts
│   │   │   ├── performance.routes.ts
│   │   │   ├── housekeeping.routes.ts
│   │   │   ├── maintenance.routes.ts
│   │   │   ├── maintenance.enhanced.routes.ts
│   │   │   ├── inventory.routes.ts
│   │   │   ├── suppliers.routes.ts
│   │   │   ├── report.routes.ts
│   │   │   ├── auditor.routes.ts
│   │   │   ├── auditor-reports.routes.ts
│   │   │   ├── auditor-void-bills.routes.ts
│   │   │   ├── audit.routes.ts
│   │   │   ├── credit.routes.ts
│   │   │   ├── receipts.routes.ts
│   │   │   ├── folio.routes.ts
│   │   │   ├── guest.routes.ts
│   │   │   ├── guest-portal.routes.ts
│   │   │   ├── employee-portal.routes.ts
│   │   │   ├── cashier.routes.ts
│   │   │   ├── shifts.routes.ts
│   │   │   ├── petty-cash.routes.ts
│   │   │   ├── wastage.routes.ts
│   │   │   ├── conference.routes.ts
│   │   │   ├── catering.routes.ts
│   │   │   ├── catering-bookings.routes.ts
│   │   │   ├── additional-services.routes.ts
│   │   │   ├── finance.routes.ts
│   │   │   ├── branch-operations.routes.ts
│   │   │   ├── fleet.routes.ts
│   │   │   ├── facilities.routes.ts
│   │   │   ├── system.routes.ts
│   │   │   ├── admin.routes.ts
│   │   │   ├── ratePlan.routes.ts
│   │   │   ├── pricing.routes.ts
│   │   │   ├── channelManager.routes.ts
│   │   │   ├── communication.routes.ts
│   │   │   ├── document.routes.ts
│   │   │   ├── notification.routes.ts
│   │   │   ├── email.routes.ts
│   │   │   ├── landing-email.routes.ts
│   │   │   ├── barcode.routes.ts
│   │   │   ├── ml-forecasting.routes.ts
│   │   │   ├── automation.routes.ts
│   │   │   ├── vendor-performance.routes.ts
│   │   │   ├── verify.routes.ts            ← Public, no auth
│   │   │   └── storekeeping/               ← Enhanced storekeeping sub-routes
│   │   ├── controllers/                    ← Business logic
│   │   ├── middleware/
│   │   │   ├── auth.ts                     ← protect + authorize
│   │   │   └── auth.middleware.ts
│   │   ├── models/
│   │   │   └── User.ts                     ← UserRole enum (40+ roles)
│   │   ├── config/
│   │   │   ├── supabase.ts                 ← Supabase client
│   │   │   └── database.ts                 ← PostgreSQL config
│   │   ├── services/                       ← Shared services
│   │   └── utils/
│   │       └── logger.ts
│   ├── supabase/
│   │   └── migrations/                     ← SQL migration files
│   ├── migrations/                         ← Additional migrations
│   ├── tsconfig.json
│   └── package.json
│
├── landing-page/                           ← Next.js Pages Router (Public website)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.tsx                   ← /
│   │   │   ├── hotels.tsx                  ← /hotels
│   │   │   ├── about.tsx                   ← /about
│   │   │   ├── dining.tsx                  ← /dining
│   │   │   ├── events.tsx                  ← /events
│   │   │   └── discover/
│   │   │       └── top-10-luxury-hotels-in-kenya.tsx  ← slug page
│   │   ├── components/
│   │   │   ├── layout/                     ← Header, Footer, Navigation
│   │   │   ├── hotel/                      ← HotelCard, HotelList
│   │   │   └── gallery/                    ← ImageGallery components
│   │   ├── services/
│   │   │   ├── api-client.ts               ← Axios client with retry
│   │   │   ├── booking.service.ts
│   │   │   ├── hotels.service.ts
│   │   │   ├── email.service.ts
│   │   │   └── search.service.ts
│   │   ├── hooks/
│   │   │   ├── useBooking.ts
│   │   │   ├── useHotels.ts
│   │   │   └── useSearch.ts
│   │   ├── config/
│   │   │   └── environment.ts              ← API base URL config
│   │   └── templates/emails/               ← Email templates
│   └── package.json
│
├── analytics-service/                      ← Python Flask (Analytics)
│   ├── app.py
│   ├── maa_analytics.py
│   ├── config/
│   │   └── database.py
│   ├── services/
│   │   ├── sales_analytics.py
│   │   ├── demand_forecast.py
│   │   ├── inventory_optimizer.py
│   │   ├── menu_optimization.py
│   │   └── customer_segmentation.py
│   └── reports/
│       ├── excel_exporter.py
│       └── pdf_generator.py
│
├── python-services/                        ← Python microservices collection
│   ├── app.py                              ← Main gateway
│   ├── gateway.py                          ← Service router
│   ├── accounting/                         ← Accounting docs & reports
│   ├── ai/                                 ← AI/ML features
│   ├── analytics/                          ← Analytics reports
│   ├── attendance/                         ← Shift calculations
│   ├── barcode_generator/                  ← QR/barcode generation
│   ├── communication_hub/                  ← SMS/email coordination
│   ├── email_automation/                   ← Scheduled emails
│   ├── finance/                            ← Anomaly detection, reconciliation
│   ├── id_cards/                           ← Staff ID card generation
│   ├── payroll/                            ← Payroll PDF generation
│   ├── pdf_generator/                      ← Invoice/receipt PDFs
│   ├── portals/                            ← Employee & guest portals
│   ├── pricing_engine/                     ← Dynamic pricing
│   ├── receipts/                           ← Receipt generation
│   ├── reports/                            ← Comprehensive reporting
│   ├── room_service/                       ← Room management
│   ├── search/                             ← Full-text search
│   ├── template_generator/                 ← Document templates
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── requirements.txt
│
├── electron/                               ← Desktop POS Terminal (Electron)
│   ├── main.js                             ← Electron main process
│   ├── preload.js                          ← IPC bridge
│   ├── database.js                         ← Local SQLite (offline)
│   ├── powersync.js                        ← Offline sync queue
│   └── offline.html                        ← Offline fallback UI
│
├── dist/                                   ← C# WinForms POS (compiled)
│   └── FgGrillPos.exe                      ← Desktop POS executable
│
├── dist-electron/                          ← Electron builds
│   ├── FG Grill Terminal Setup 1.0.2.exe
│   └── latest.yml
│
├── database/
│   └── migrations/                         ← Raw SQL migrations
│
├── docs/
│   ├── ROLE_BASED_ACCESS_CONTROL.md
│   ├── ROLE_ACCESS_UPDATES.md
│   └── restaurant_inventory_system.md
│
├── scripts/                                ← Utility scripts
│   ├── import-users-now.js
│   ├── offline-sync-agent.py
│   └── verify_pricing_logic.js
│
├── logs/                                   ← Server logs
│   ├── combined.log
│   ├── error.log
│   └── exceptions.log
│
├── .env                                    ← Root environment variables
├── package.json                            ← Root (Electron builder config)
├── docker-compose.offline.yml
├── render.yaml                             ← Render.com deployment config
└── README.md
```

---
