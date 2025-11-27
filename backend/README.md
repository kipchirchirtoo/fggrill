# Famous Gate Hotel Management System - Backend

Backend API for the Famous Gate Hotel Management System built with Node.js, Express, TypeScript, and MongoDB.

## Features

- User Authentication & Authorization
- Booking Management
- Room Management
- Inventory Management
- Housekeeping Management
- Maintenance Management
- Real-time Updates with Socket.IO
- Email & SMS Notifications
- Payment Processing with Stripe
- File Upload Support
- Comprehensive API Documentation
- Test Coverage

## Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- Redis (optional, for caching)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Create required directories:
```bash
mkdir -p logs uploads/images uploads/documents uploads/videos
```

## Development

Start the development server:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Production

Build the project:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server
- `npm run build` - Build the project
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run seed` - Seed the database
- `npm run clean` - Clean build output
- `npm run deploy` - Deploy to production

## API Documentation

API documentation is available at `/api/docs` when running the server.

## Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Route controllers
├── middleware/     # Custom middleware
├── models/         # Database models
├── routes/         # Route definitions
├── services/       # Business logic
├── utils/         # Utility functions
├── test/          # Test files
└── server.ts      # Server entry point
```

## Features

### Authentication
- JWT-based authentication
- Role-based access control
- Password reset functionality
- Session management

### Booking System
- Real-time availability
- Multi-channel booking support
- Dynamic pricing
- Payment processing
- Booking modifications
- Automated notifications

### Room Management
- Room status tracking
- Room type configuration
- Pricing management
- Maintenance scheduling

### Inventory Management
- Stock tracking
- Low stock alerts
- Purchase order management
- Supplier management
- Stock movement history

### Housekeeping
- Task assignment
- Room status updates
- Cleaning schedules
- Supply tracking
- Quality checks

### Maintenance
- Work order management
- Preventive maintenance
- Asset tracking
- Task scheduling
- Issue reporting

### Reporting
- Financial reports
- Occupancy reports
- Inventory reports
- Staff performance
- Custom report builder

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
