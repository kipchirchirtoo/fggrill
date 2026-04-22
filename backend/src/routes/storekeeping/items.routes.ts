import express from 'express';
import { protect, authorize, UserRole } from '../../middleware/auth';
import {
    getItems,
    getItem,
    createItem,
    updateItem,
    deleteItem,
    suggestItemAttributes,
    generateBarcodeEndpoint
} from '../../controllers/storekeeping/items.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

const centralRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.AUDITOR];
const managerRoles = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.AUDITOR];

router.route('/')
    .get(getItems)
    .post(authorize(managerRoles), createItem);

router.post('/suggest', authorize(managerRoles), suggestItemAttributes);
router.post('/generate-barcode', authorize(managerRoles), generateBarcodeEndpoint);

router.route('/:id')
    .get(getItem)
    .put(authorize(managerRoles), updateItem)
    .delete(authorize(managerRoles), deleteItem);

export default router;
