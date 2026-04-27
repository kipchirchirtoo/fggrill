import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { AppError } from './errorHandler';

/**
 * Middleware factory to validate request body against a Zod schema
 * @param schema - Zod schema to validate against
 */
export const validateBody = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            // Parse and validate the request body
            const validated = schema.parse(req.body);
            
            // Replace request body with validated data (strips unknown fields)
            req.body = validated;
            
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                // Format Zod errors into readable messages
                const errors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }));
                
                next(new AppError(`Validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`, 400));
            } else {
                next(error);
            }
        }
    };
};

/**
 * Middleware factory to validate request query parameters
 * @param schema - Zod schema to validate against
 */
export const validateQuery = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const validated = schema.parse(req.query);
            req.query = validated as any;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }));
                
                next(new AppError(`Query validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`, 400));
            } else {
                next(error);
            }
        }
    };
};

/**
 * Middleware factory to validate request params
 * @param schema - Zod schema to validate against
 */
export const validateParams = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            const validated = schema.parse(req.params);
            req.params = validated as any;
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const errors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message
                }));
                
                next(new AppError(`Params validation failed: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`, 400));
            } else {
                next(error);
            }
        }
    };
};

// Common validation schemas
export const commonSchemas = {
    uuid: z.string().uuid('Invalid UUID format'),
    positiveNumber: z.number().positive('Must be a positive number'),
    email: z.string().email('Invalid email format'),
    phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    pagination: z.object({
        page: z.coerce.number().int().positive().optional().default(1),
        limit: z.coerce.number().int().positive().max(100).optional().default(20)
    })
};
