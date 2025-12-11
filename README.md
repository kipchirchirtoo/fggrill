# Famous Gate Hotel Management System

A comprehensive, full-stack hotel management system built with modern technologies for efficient hotel operations, revenue management, and guest experience.

## 🏨 Features

### Core Operations
- **Reception & Front Desk**
  - Real-time room availability dashboard
  - Quick check-in/check-out workflows
  - Guest registration with document upload
  - Reservation management

- **Room Management**
  - Room status tracking (available, occupied, maintenance, cleaning)
  - Room type configuration
  - Housekeeping task assignment
  - Maintenance request tracking

- **Guest Management**
  - Guest profiles with preferences
  - Stay history tracking
  - Loyalty program (Bronze/Silver/Gold/Platinum tiers)
  - VIP guest identification
  - Document storage (ID, passport)

### Financial Management
- **Folio Management**
  - Guest billing and charges
  - Payment processing (Card, M-Pesa, Cash)
  - Invoice generation
  - Transaction history

- **Revenue Management**
  - Rate plan configuration
  - Dynamic pricing engine (AI-powered)
  - Revenue analytics dashboard
  - ADR, RevPAR, Occupancy metrics

### Integrations
- **Payment Gateway**
  - M-Pesa STK Push integration
  - Card payment processing
  - Payment status tracking

- **Communication Hub**
  - Email notifications (booking confirmation, reminders, invoices)
  - SMS messaging
  - Bulk SMS campaigns

- **Channel Manager** (Preparation)
  - OTA connection framework (Booking.com, Expedia, Airbnb, Agoda)
  - Availability push
  - Booking pull

### Reporting & Analytics
- **Advanced Analytics Dashboard**
  - Occupancy forecasting
  - Revenue projections
  - Channel performance
  - Room type analysis
  - AI-powered insights

- **Reports**
  - Daily/Weekly/Monthly revenue reports
  - Occupancy reports
  - Guest statistics
  - Financial summaries

## 🛠 Tech Stack

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **Supabase** (PostgreSQL) for database
- **JWT** authentication
- **Multer** for file uploads

### Frontend
- **Next.js 14** (App Router)
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Recharts** for data visualization
- **Lucide React** for icons
- **Sonner** for toast notifications

### Microservices (Python)
- **FastAPI** for API framework
- **Pricing Engine** - Dynamic pricing calculations
- **Communication Hub** - Email/SMS services

## 📁 Project Structure

```
fggrill/
├── backend/                    # Node.js Express API
│   ├── src/
│   │   ├── config/            # Database & app configuration
│   │   ├── controllers/       # Route handlers
│   │   ├── middleware/        # Auth, error handling
│   │   ├── models/            # Data models
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   └── utils/             # Helpers & utilities
│   └── uploads/               # File uploads directory
│
├── frontend/                   # Next.js React application
│   ├── src/
│   │   ├── app/               # App router pages
│   │   │   └── dashboard/     # Dashboard pages
│   │   ├── components/        # React components
│   │   │   ├── modals/        # Modal components
│   │   │   ├── ui/            # UI components
│   │   │   └── layout/        # Layout components
│   │   └── lib/               # Utilities & API client
│   └── public/                # Static assets
│
├── python-services/            # Python microservices
│   ├── pricing_engine/        # Dynamic pricing service
│   └── communication_hub/     # Email/SMS service
│
└── scripts/                    # Startup & utility scripts
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- npm or yarn
- Supabase account

### Environment Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd fggrill
```

2. **Backend Setup**
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your configuration
npm run dev
```

3. **Frontend Setup**
```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your configuration
npm run dev
```

4. **Python Services Setup**
```bash
# Pricing Engine
./start_pricing_engine.sh

# Communication Hub
./start_communication_hub.sh
```

### Environment Variables

**Backend (.env)**
```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
JWT_SECRET=your_jwt_secret
PRICING_SERVICE_URL=http://localhost:8001
COMMUNICATION_SERVICE_URL=http://localhost:8002
```

**Frontend (.env.local)**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_PYTHON_SERVICE_URL=http://localhost:8001
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

### Bookings
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create booking
- `POST /api/bookings/:id/check-in` - Check in guest
- `POST /api/bookings/:id/check-out` - Check out guest

### Guests
- `GET /api/guests` - List guests
- `GET /api/guests/:id` - Get guest details
- `GET /api/guests/:id/loyalty` - Get loyalty status
- `GET /api/guests/:id/history` - Get stay history

### Payments
- `POST /api/payments/folio/intent` - Create payment intent
- `POST /api/payments/folio/confirm/:id` - Confirm payment
- `POST /api/payments/booking/initiate` - Initiate booking payment

### Communications
- `POST /api/communications/booking-confirmation` - Send confirmation
- `POST /api/communications/check-in-reminder` - Send reminder
- `POST /api/communications/invoice` - Send invoice

### Reports
- `GET /api/reports/revenue` - Revenue report
- `GET /api/reports/occupancy` - Occupancy report
- `GET /api/reports/dashboard` - Dashboard metrics

## 👥 User Roles

| Role | Access Level |
|------|--------------|
| `super_admin` | Full system access |
| `general_manager` | All operations, reports |
| `branch_manager` | Branch-specific operations |
| `receptionist` | Front desk operations |
| `housekeeping` | Housekeeping tasks |
| `accountant` | Financial operations |
| `auditor` | Read-only financial access |

## 🔒 Security Features

- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Rate limiting
- Input validation
- SQL injection prevention (parameterized queries)

## 📱 Key Pages

| Path | Description |
|------|-------------|
| `/dashboard` | Main dashboard |
| `/dashboard/reception/reservations` | Reservations management |
| `/dashboard/reception/guests/[id]` | Guest profile |
| `/dashboard/admin/rates` | Rate plan management |
| `/dashboard/admin/channels` | Channel manager |
| `/dashboard/admin/settings` | System settings |
| `/dashboard/reports/revenue` | Revenue analytics |
| `/dashboard/reports/analytics` | Advanced analytics |

## 🧪 Development

### Running Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test
```

### Building for Production
```bash
# Backend
cd backend && npm run build

# Frontend
cd frontend && npm run build
```

## 📄 License

This project is proprietary software for Famous Gate Hotel.

## 🤝 Support

For support, contact the development team or create an issue in the repository.

---

Built with ❤️ for Famous Gate Hotel
