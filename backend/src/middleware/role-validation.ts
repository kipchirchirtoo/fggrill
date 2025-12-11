import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';

/**
 * Role validation middleware
 * This middleware checks if a user has the appropriate role to access central operations features
 */

// Validate user has central operations role
export const validateCentralOperationsRole = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const centralOperationsRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_OPERATIONS_MANAGER,
    UserRole.CENTRAL_STOREKEEPER
  ];

  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
    return;
  }

  if (!centralOperationsRoles.includes(req.user.role)) {
    res.status(403).json({
      success: false,
      message: `User role ${req.user.role} is not authorized to access Central Operations`
    });
    return;
  }

  next();
};

// Validate user has branch operations role
export const validateBranchOperationsRole = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const branchOperationsRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.BRANCH_MANAGER,
    UserRole.BRANCH_OPERATIONS_MANAGER
  ];

  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
    return;
  }

  if (!branchOperationsRoles.includes(req.user.role)) {
    res.status(403).json({
      success: false,
      message: `User role ${req.user.role} is not authorized to access Branch Operations`
    });
    return;
  }

  next();
};

// Validate user is in the warehouse team
export const validateWarehouseRole = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const warehouseRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.GENERAL_MANAGER,
    UserRole.CENTRAL_OPERATIONS_MANAGER,
    UserRole.CENTRAL_STOREKEEPER,
    UserRole.BRANCH_STOREKEEPER
  ];

  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
    return;
  }

  if (!warehouseRoles.includes(req.user.role)) {
    res.status(403).json({
      success: false,
      message: `User role ${req.user.role} is not authorized to access Warehouse features`
    });
    return;
  }

  next();
};
