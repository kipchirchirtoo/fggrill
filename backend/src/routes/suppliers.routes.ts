import express from 'express';
import { protect, authorize } from '../middleware/auth.middleware';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierProducts,
  addSupplierProduct,
  updateSupplierProduct,
  deleteSupplierProduct,
  getSupplierPerformance
} from '../controllers/suppliers.controller';

const router = express.Router();

// All routes require authentication
router.use(protect);

// Supplier routes
router.get('/', authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin'), getSuppliers);
router.get('/:id', authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin'), getSupplierById);
router.post('/', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), createSupplier);
router.put('/:id', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), updateSupplier);
router.delete('/:id', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), deleteSupplier);

// Supplier products routes
router.get('/:supplierId/products', authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin'), getSupplierProducts);
router.post('/:supplierId/products', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), addSupplierProduct);
router.put('/products/:productId', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), updateSupplierProduct);
router.delete('/products/:productId', authorize('branch_storekeeper', 'central_storekeeper', 'super_admin'), deleteSupplierProduct);

// Supplier performance
router.get('/:supplierId/performance', authorize('branch_storekeeper', 'central_storekeeper', 'branch_manager', 'super_admin'), getSupplierPerformance);

export default router;
