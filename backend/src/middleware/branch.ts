import { Request, Response, NextFunction } from 'express';

// Validate branch ID in headers or query params
export const validateBranch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get branch ID from header or query params
    const branchId = req.headers['x-branch-id'] || req.query.branchId || req.query.branch_id;
    
    if (!branchId) {
      return res.status(400).json({
        success: false,
        message: 'Branch ID is required'
      });
    }
    
    // Store branch ID in request for later use
    req.headers['x-branch-id'] = branchId.toString();
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error validating branch',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
