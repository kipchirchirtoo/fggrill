import express from 'express';
import { protect } from '../../middleware/auth';
import {
    getVehicles,
    createVehicle,
    updateVehicle,
    deleteVehicle,
    getDrivers,
    createDriver,
    updateDriver,
    deleteDriver,
    getSuppliers,
    createSupplier,
    updateSupplier,
    deleteSupplier
} from '../../controllers/storekeeping/resources.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Vehicles routes
router.route('/vehicles')
    .get(getVehicles)
    .post(createVehicle);

router.route('/vehicles/:id')
    .put(updateVehicle)
    .delete(deleteVehicle);

// Drivers routes
router.route('/drivers')
    .get(getDrivers)
    .post(createDriver);

router.route('/drivers/:id')
    .put(updateDriver)
    .delete(deleteDriver);

// Suppliers routes
router.route('/suppliers')
    .get(getSuppliers)
    .post(createSupplier);

router.route('/suppliers/:id')
    .put(updateSupplier)
    .delete(deleteSupplier);

export default router;
