# Famous Gates Hotels — Desktop App

Hybrid desktop application built with **Tauri 2**, **React + Vite**, and **TypeScript**.

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| UI | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v3 |
| Routing | React Router DOM v6 |
| Local DB | SQLite via `tauri-plugin-sql` |
| Cloud DB | Supabase |
| Node API | `https://api.hirall.com` |
| Python API | `https://services.hirall.com` |
| State | Zustand + React Query |

## Project Structure

```
famous-gates-desktop/
├── apps/desktop/
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx              # React entry
│   │   ├── routes/               # Route registry + guards
│   │   ├── features/             # Domain pages (bookings, rooms, etc.)
│   │   ├── components/           # Shared UI components
│   │   ├── services/             # API clients, SQLite, sync
│   │   ├── bridge/               # Tauri invoke() wrappers
│   │   ├── hooks/                # Data + sync hooks
│   │   ├── state/                # App state provider
│   │   ├── constants/            # Roles, modules
│   │   └── assets/styles/        # Global CSS + Tailwind
│   └── src-tauri/
│       ├── Cargo.toml
│       ├── tauri.conf.json
│       ├── build.rs
│       ├── capabilities/         # Per-window permissions
│       ├── migrations/           # SQLite schema
│       └── src/
│           ├── main.rs
│           ├── lib.rs
│           ├── commands/         # Tauri commands
│           ├── services/         # Rust services
│           ├── models/           # Domain structs
│           ├── state/            # Shared Rust state
│           └── events/           # Frontend event dispatch
├── packages/
│   ├── shared/src/types/         # Shared DTOs
│   └── contracts/                # API + sync + auth contracts
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
└── .env.example
```

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 18+
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)

### Setup

```bash
# 1. Copy env file
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, etc.

# 2. Install dependencies
npm install

# 3. Run in development
npm run dev
# This starts Vite on :1420 and opens the Tauri window

# 4. Build for production
npm run build
```

### Windows build

```bash
npm run build
# Output: apps/desktop/src-tauri/target/release/bundle/
```

## Architecture

### Offline-first flow

**Read:** UI → local SQLite (instant) → background refresh from API → UI updates

**Write:** UI → local SQLite (immediate) → outbox queue → Rust sync worker → Node/Supabase → mark clean

### Two windows

- `main` — full dashboard, role-based navigation
- `pos` — POS terminal, PIN login, fast checkout

### Role-based access

40+ roles defined in `src/constants/roles.ts`. Route guards enforce access per role.
All UUID, slug, and confirmation-number routes are preserved from the web app.
