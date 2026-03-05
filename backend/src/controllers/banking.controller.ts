
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * @desc    Get all bank accounts
 * @route   GET /api/banking/accounts
 * @access  Private (Accountant)
 */
export const getBankAccounts = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branch_id = req.query.branch_id || req.user?.branch_id;
        const { is_active } = req.query;

        let query = supabase.from('bank_accounts').select('*');

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (is_active !== undefined) {
            query = query.eq('is_active', is_active === 'true');
        }

        const { data: accounts, error } = await query.order('bank_name');

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: accounts || []
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Create bank account
 * @route   POST /api/banking/accounts
 * @access  Private (Accountant)
 */
export const createBankAccount = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            bank_name,
            account_number,
            account_name,
            account_type,
            currency,
            opening_balance,
            notes
        } = req.body;

        const branch_id = req.body.branch_id || req.user?.branch_id;

        if (!bank_name || !account_number || !account_name) {
            throw new AppError('Bank name, account number, and account name are required', 400);
        }

        const { data: account, error } = await supabase
            .from('bank_accounts')
            .insert({
                branch_id,
                bank_name,
                account_number,
                account_name,
                account_type,
                currency: currency || 'KES',
                opening_balance: opening_balance || 0,
                current_balance: opening_balance || 0,
                notes
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Bank account created successfully',
            data: account
        });

        logger.info(`Bank account created: ${bank_name} - ${account_number}`);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Record banking transaction
 * @route   POST /api/banking/transactions
 * @access  Private (Accountant)
 */
export const recordBankingTransaction = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            transaction_date,
            transaction_type,
            bank_name,
            account_number,
            amount,
            currency,
            reference_number,
            source,
            destination,
            payment_method,
            receipt_number,
            slip_attachment_url,
            purpose_category,
            purpose_description,
            notes
        } = req.body;

        const branch_id = req.body.branch_id || req.user?.branch_id;
        const recorded_by = req.user?.id;

        if (!transaction_date || !transaction_type || !bank_name || !account_number || !amount || !reference_number || !purpose_description) {
            throw new AppError('Required fields: transaction_date, transaction_type, bank_name, account_number, amount, reference_number, purpose_description', 400);
        }

        const { data: transaction, error } = await supabase
            .from('banking_transactions')
            .insert({
                branch_id,
                transaction_date,
                transaction_type,
                bank_name,
                account_number,
                amount,
                currency: currency || 'KES',
                reference_number,
                source,
                destination,
                payment_method,
                receipt_number,
                slip_attachment_url,
                purpose_category,
                purpose_description,
                notes,
                recorded_by,
                status: 'PENDING'
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Banking transaction recorded successfully',
            data: transaction
        });

        logger.info(`Banking transaction recorded: ${transaction_type} - ${reference_number}`);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get banking transactions
 * @route   GET /api/banking/transactions
 * @access  Private (Accountant)
 */
export const getBankingTransactions = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branch_id = req.query.branch_id || req.user?.branch_id;
        const { transaction_type, status, start_date, end_date, bank_name } = req.query;

        let query = supabase
            .from('banking_transactions')
            .select(`
                *,
                recorded_by_user:users!recorded_by(id, full_name),
                approved_by_user:users!approved_by(id, full_name),
                reconciled_by_user:users!reconciled_by(id, full_name)
            `)
            .order('transaction_date', { ascending: false });

        if (branch_id) {
            query = query.eq('branch_id', branch_id);
        }

        if (transaction_type) {
            query = query.eq('transaction_type', transaction_type);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (start_date) {
            query = query.gte('transaction_date', start_date);
        }

        if (end_date) {
            query = query.lte('transaction_date', end_date);
        }

        if (bank_name) {
            query = query.eq('bank_name', bank_name);
        }

        const { data: transactions, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: transactions || []
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Approve or reject banking transaction
 * @route   PUT /api/banking/transactions/:id/approve
 * @access  Private (Senior Accountant/Manager/Auditor)
 */
export const approveBankingTransaction = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { notes, action } = req.body;
        const approved_by = req.user?.id;

        // Determine status based on action
        const status = action === 'reject' ? 'REJECTED' : 'APPROVED';

        const { data: transaction, error } = await supabase
            .from('banking_transactions')
            .update({
                status,
                approved_by,
                approved_at: new Date().toISOString(),
                notes: notes || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('status', 'PENDING')
            .select()
            .single();

        if (error) throw error;

        if (!transaction) {
            throw new AppError('Transaction not found or already processed', 404);
        }

        res.status(200).json({
            success: true,
            message: `Transaction ${action === 'reject' ? 'rejected' : 'approved'} successfully`,
            data: transaction
        });

        logger.info(`Banking transaction ${action === 'reject' ? 'rejected' : 'approved'}: ${id}`);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get banking summary/dashboard
 * @route   GET /api/banking/summary
 * @access  Private (Accountant)
 */
export const getBankingSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const branch_id = req.query.branch_id || req.user?.branch_id;
        const { start_date, end_date } = req.query;

        // Get total balances
        let accountsQuery = supabase
            .from('bank_accounts')
            .select('*')
            .eq('is_active', true);

        if (branch_id) {
            accountsQuery = accountsQuery.eq('branch_id', branch_id);
        }

        const { data: accounts } = await accountsQuery;

        const total_balance = accounts?.reduce((sum, acc) => sum + parseFloat(acc.current_balance || 0), 0) || 0;

        // Get transactions summary
        let transQuery = supabase
            .from('banking_transactions')
            .select('transaction_type, amount, status');

        if (branch_id) {
            transQuery = transQuery.eq('branch_id', branch_id);
        }

        if (start_date) {
            transQuery = transQuery.gte('transaction_date', start_date);
        }

        if (end_date) {
            transQuery = transQuery.lte('transaction_date', end_date);
        }

        const { data: transactions } = await transQuery;

        const summary = {
            total_accounts: accounts?.length || 0,
            total_balance,
            deposits: 0,
            withdrawals: 0,
            pending_transactions: 0,
            approved_transactions: 0
        };

        transactions?.forEach((txn: any) => {
            if (txn.transaction_type === 'DEPOSIT' && txn.status === 'APPROVED') {
                summary.deposits += parseFloat(txn.amount);
            } else if (txn.transaction_type === 'WITHDRAWAL' && txn.status === 'APPROVED') {
                summary.withdrawals += parseFloat(txn.amount);
            }

            if (txn.status === 'PENDING') {
                summary.pending_transactions++;
            } else if (txn.status === 'APPROVED') {
                summary.approved_transactions++;
            }
        });

        res.status(200).json({
            success: true,
            data: {
                summary,
                accounts: accounts || []
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Record bank reconciliation
 * @route   POST /api/banking/reconciliations
 * @access  Private (Accountant)
 */
export const recordBankReconciliation = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            bank_account_id,
            reconciliation_date,
            statement_balance,
            book_balance,
            variance_reason,
            notes
        } = req.body;

        const reconciled_by = req.user?.id;

        if (!bank_account_id || !reconciliation_date || statement_balance === undefined || book_balance === undefined) {
            throw new AppError('Required fields: bank_account_id, reconciliation_date, statement_balance, book_balance', 400);
        }

        const variance = statement_balance - book_balance;

        const { data: reconciliation, error } = await supabase
            .from('banking_reconciliations')
            .insert({
                bank_account_id,
                reconciliation_date,
                statement_balance,
                book_balance,
                variance,
                variance_reason,
                notes,
                reconciled_by,
                status: 'PENDING'
            })
            .select()
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Bank reconciliation recorded successfully',
            data: reconciliation
        });

        logger.info(`Bank reconciliation recorded for account ${bank_account_id}`);
    } catch (error) {
        next(error);
    }
};

/**
 * @desc    Get bank reconciliations
 * @route   GET /api/banking/reconciliations
 * @access  Private (Accountant)
 */
export const getBankReconciliations = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { bank_account_id, status, start_date, end_date } = req.query;

        let query = supabase
            .from('banking_reconciliations')
            .select(`
                *,
                bank_account:bank_accounts(*),
                reconciled_by_user:users!reconciled_by(id, full_name),
                approved_by_user:users!approved_by(id, full_name)
            `)
            .order('reconciliation_date', { ascending: false });

        if (bank_account_id) {
            query = query.eq('bank_account_id', bank_account_id);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (start_date) {
            query = query.gte('reconciliation_date', start_date);
        }

        if (end_date) {
            query = query.lte('reconciliation_date', end_date);
        }

        const { data: reconciliations, error } = await query;

        if (error) throw error;

        res.status(200).json({
            success: true,
            data: reconciliations || []
        });
    } catch (error) {
        next(error);
    }
};
