import express from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import bookingRoutes from './booking.routes';
import roomRoutes from './room.routes';
import inventoryRoutes from './inventory.routes';
import housekeepingRoutes from './housekeeping.routes';
import maintenanceRoutes from './maintenance.routes';
import reportRoutes from './report.routes';
import storekeepingRoutes from './storekeeping.routes';
import financeRoutes from './finance.routes';
import systemRoutes from './system.routes';
import fleetRoutes from './fleet.routes';
import barRoutes from './bar.routes';
import restaurantRoutes from './restaurant.routes';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime()
  });
});

// API routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/bookings', bookingRoutes);
router.use('/rooms', roomRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/housekeeping', housekeepingRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/reports', reportRoutes);
router.use('/store', storekeepingRoutes);
router.use('/finance', financeRoutes);
router.use('/system', systemRoutes);
router.use('/fleet', fleetRoutes);
router.use('/bar', barRoutes);
router.use('/restaurant', restaurantRoutes);

export default router;
