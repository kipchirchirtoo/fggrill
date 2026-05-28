import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import * as XLSX from 'xlsx';

/**
 * Controller for generating Kenyan statutory compliance reports
 */
export const getHRReportsIndex = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const reports = [
            {
                id: 'kra-p10',
                name: 'KRA P10 Return',
                title: 'KRA P10 Return',
                type: 'statutory',
                format: 'xlsx',
                endpoint: '/api/hr-reports/kra-p10'
            },
            {
                id: 'nssf',
                name: 'NSSF Return',
                title: 'NSSF Return',
                type: 'statutory',
                format: 'xlsx',
                endpoint: '/api/hr-reports/nssf'
            },
            {
                id: 'shif',
                name: 'SHIF Return',
                title: 'SHIF Return',
                type: 'statutory',
                format: 'xlsx',
                endpoint: '/api/hr-reports/shif'
            },
            {
                id: 'housing-levy',
                name: 'Housing Levy Return',
                title: 'Housing Levy Return',
                type: 'statutory',
                format: 'xlsx',
                endpoint: '/api/hr-reports/housing-levy'
            }
        ];

        res.json({
            success: true,
            count: reports.length,
            data: reports
        });
    } catch (error) {
        next(error);
    }
};

export const generateKRAP10 = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { month, year } = req.query;

        const { data: records, error } = await supabase
            .from('payroll_records')
            .select(`
        *,
        employee:staff_profiles!staff_id(
          *,
          user:users!user_id(*)
        )
      `)
            .eq('month', month)
            .eq('year', year);

        if (error) throw error;

        // KRA P10 Format (Simplified)
        const p10Data = records.map(r => ({
            'PIN of Employee': r.employee?.kra_pin || '',
            'Name of Employee': `${r.employee?.user?.first_name} ${r.employee?.user?.last_name}`,
            'Residential Status': r.employee?.employment_type === 'contract' ? 'Non-Resident' : 'Resident',
            'Type of Employee': 'Primary Employee',
            'Basic Salary': r.base_salary,
            'Housing Allowance': 0, // Should be split from allowances if needed
            'Transport Allowance': 0,
            'Other Allowances': r.allowances,
            'Gross Pay': r.gross_pay,
            'Defined Contribution (NSSF)': r.nssf_deduction,
            'Owner Occupied Interest': 0,
            'Retirement Contribution Relief': 0,
            'Amount of Benefit': 0,
            'Taxable Pay': r.gross_pay - r.nssf_deduction,
            'Tax Charged': r.tax_deductions,
            'Personal Relief': 2400,
            'Insurance Relief': (r.shif_deduction || 0) * 0.15, // NHIF/SHIF relief is 15%
            'PAYE Tax': r.tax_deductions - 2400 - ((r.shif_deduction || 0) * 0.15)
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(p10Data);
        XLSX.utils.book_append_sheet(wb, ws, 'P10_Return');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=KRA_P10_${year}_${month}.xlsx`);
        res.send(buffer);
    } catch (error) {
        next(error);
    }
};

export const generateNSSFReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { month, year } = req.query;
        const { data: records, error } = await supabase
            .from('payroll_records')
            .select('*, employee:staff_profiles!staff_id(*, user:users!user_id(*))')
            .eq('month', month)
            .eq('year', year);

        if (error) throw error;

        const nssfData = records.map(r => ({
            'Payroll No': r.employee?.id_number || '',
            'Surname': r.employee?.user?.last_name || '',
            'Other Names': r.employee?.user?.first_name || '',
            'ID Number': r.employee?.national_id || '',
            'NSSF Number': r.employee?.nssf_number || '',
            'Gross Pay': r.gross_pay,
            'Employee Contribution': r.nssf_deduction,
            'Employer Contribution': r.nssf_deduction, // Usually matched
            'Total': (r.nssf_deduction || 0) * 2
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(nssfData);
        XLSX.utils.book_append_sheet(wb, ws, 'NSSF_Return');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename=NSSF_Return_${year}_${month}.xlsx`);
        res.send(buffer);
    } catch (error) {
        next(error);
    }
};

export const generateSHIFReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { month, year } = req.query;
        const { data: records, error } = await supabase
            .from('payroll_records')
            .select('*, employee:staff_profiles!staff_id(*, user:users!user_id(*))')
            .eq('month', month)
            .eq('year', year);

        if (error) throw error;

        const shifData = records.map(r => ({
            'ID Number': r.employee?.national_id || '',
            'Name': `${r.employee?.user?.first_name} ${r.employee?.user?.last_name}`,
            'SHIF Number': r.employee?.shif_number || '',
            'Gross Pay': r.gross_pay,
            'Amount': r.shif_deduction
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(shifData);
        XLSX.utils.book_append_sheet(wb, ws, 'SHIF_Return');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=SHIF_Return_${year}_${month}.xlsx`);
        res.send(buffer);
    } catch (error) {
        next(error);
    }
};

export const generateHousingLevyReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const { month, year } = req.query;
        const { data: records, error } = await supabase
            .from('payroll_records')
            .select('*, employee:staff_profiles!staff_id(*, user:users!user_id(*))')
            .eq('month', month)
            .eq('year', year);

        if (error) throw error;

        const levyData = records.map(r => ({
            'ID Number': r.employee?.national_id || '',
            'Name': `${r.employee?.user?.first_name} ${r.employee?.user?.last_name}`,
            'Gross Pay': r.gross_pay,
            'Employee Levy (1.5%)': r.housing_levy_deduction,
            'Employer Levy (1.5%)': r.housing_levy_deduction, // Matched
            'Total Levy': (r.housing_levy_deduction || 0) * 2
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(levyData);
        XLSX.utils.book_append_sheet(wb, ws, 'Housing_Levy');

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Housing_Levy_${year}_${month}.xlsx`);
        res.send(buffer);
    } catch (error) {
        next(error);
    }
};
