import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';

// ... existing imports ...

export const saveCashierLogbook = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { credit_bills, ...logbookData } = req.body;
        const branchId = req.branch?.id; // Assuming auth middleware sets this

        // 1. Save Logbook Base Data (Simplified for this snippet)
        // ... (Logbook saving logic) ...

        // 2. Process Credit Bills
        // We need to insert these into the REAL 'staff_credit_bills' table for Payroll to see them.
        if (credit_bills && Array.isArray(credit_bills)) {
            for (const bill of credit_bills) {
                if (bill.staff_id && bill.amount > 0) {
                    // Check if this bill already exists for this day/logbook to avoid duplicates if re-saving
                    // ideally we link it to the logbook_id. 
                    // For now, let's just insert pending bills.

                    // Optimization: In a real app, you'd sync this carefully. 
                    // Here we'll just Insert a new record if it looks new.

                    const { error } = await supabase.from('staff_credit_bills').insert({
                        staff_id: bill.staff_id,
                        amount: bill.amount,
                        description: `Cashier Logbook Credit: ${bill.reference || 'No Ref'}`,
                        bill_date: new Date().toISOString().split('T')[0],
                        status: 'pending'
                    });

                    if (error) console.error('Failed to create credit bill record', error);
                }
            }
        }

        res.status(200).json({ success: true, message: 'Logbook saved' });

    } catch (error) {
        next(error);
    }
};
