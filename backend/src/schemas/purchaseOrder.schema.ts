import { z } from 'zod';

/**
 * Purchase Order validation schemas
 */

export const SourceModuleEnum = z.enum([
    'central_store',
    'branch_store',
    'branch_accounting',
    'inventory',
    'restaurant'
]);

export const POStatusEnum = z.enum([
    'draft',
    'pending',
    'approved',
    'sent',
    'received',
    'cancelled',
    'closed'
]);

export const PaymentTermsEnum = z.enum([
    'cash',
    'credit_7_days',
    'credit_15_days',
    'credit_30_days',
    'credit_45_days',
    'credit_60_days',
    'credit_90_days',
    'advance_payment'
]);

// PO Item schema
export const POItemSchema = z.object({
    item_id: z.string().min(1, 'Item ID is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unit_price: z.number().nonnegative('Unit price cannot be negative'),
    tax_amount: z.number().nonnegative('Tax amount cannot be negative').optional().default(0),
    total_price: z.number().nonnegative('Total price cannot be negative').optional()
});

// Create PO schema
export const CreatePOSchema = z.object({
    supplier_id: z.string().uuid('Invalid supplier ID'),
    po_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
    items: z.array(POItemSchema).min(1, 'At least one item is required'),
    payment_terms: PaymentTermsEnum.optional().default('credit_30_days'),
    delivery_terms: z.string().optional(),
    special_instructions: z.string().optional(),
    source_module: SourceModuleEnum.optional(), // Will be set by middleware
    branch_id: z.number().int().positive().optional(), // Will be set by middleware
    auto_approve: z.boolean().optional().default(false)
}).refine(
    (data) => {
        // If expected_delivery_date is provided, it must be >= po_date
        if (data.expected_delivery_date && data.po_date) {
            return new Date(data.expected_delivery_date) >= new Date(data.po_date);
        }
        return true;
    },
    {
        message: 'Expected delivery date cannot be before PO date',
        path: ['expected_delivery_date']
    }
);

// Update PO schema
export const UpdatePOSchema = z.object({
    supplier_id: z.string().uuid().optional(),
    expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    payment_terms: PaymentTermsEnum.optional(),
    delivery_terms: z.string().optional(),
    special_instructions: z.string().optional(),
    status: POStatusEnum.optional()
});

// Query PO schema
export const QueryPOSchema = z.object({
    supplier_id: z.string().uuid().optional(),
    status: POStatusEnum.optional(),
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    source_module: SourceModuleEnum.optional(),
    branch_id: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20)
});

// PO ID param schema
export const POIdSchema = z.object({
    id: z.string().uuid('Invalid PO ID')
});

// Export types
export type CreatePOInput = z.infer<typeof CreatePOSchema>;
export type UpdatePOInput = z.infer<typeof UpdatePOSchema>;
export type QueryPOInput = z.infer<typeof QueryPOSchema>;
export type POItem = z.infer<typeof POItemSchema>;
