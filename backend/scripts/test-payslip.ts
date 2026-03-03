import dotenv from 'dotenv';
import path from 'path';
// Load env BEFORE other imports so they can use the variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import { generatePayslipPDF, PayslipData } from '../src/utils/pdfGenerator';
import { emailService } from '../src/services/email.service';
import { logger } from '../src/utils/logger';

async function runTest() {
    console.log('Starting Branded Payslip Distribution Test...');

    const testStaff = {
        user: {
            email: 'kipchirchirtoo01@gmail.com',
            first_name: 'KIPCHIRCHIR',
            last_name: 'TOO'
        }
    };

    const monthName = new Date().toLocaleString('en-US', { month: 'long' });
    const year = new Date().getFullYear();

    const payslipData: PayslipData = {
        month: monthName,
        year: year,
        basic_salary: 50000,
        overtime_pay: 2500,
        allowances: 1500,
        gross_pay: 54000,
        paye_tax: 7200,
        nssf_deduction: 2160,
        shif_deduction: 1485,
        housing_levy_deduction: 810,
        total_deductions: 11655,
        net_salary: 42345,
        employee: {
            national_id: 'ID-88442211',
            user: {
                first_name: 'KIPCHIRCHIR',
                last_name: 'TOO'
            },
            employee_type: 'Senior Logistics Coordinator',
            bank_name: 'KCB Bank Kenya Limited',
            bank_account_number: '1234567890',
            department: 'Supply Chain & Logistics'
        },
        company: 'Kyogong',
        company_email: 'accounts@kyogong.co.ke'
    };

    try {
        console.log('Generating Branded PDF...');
        const pdfBuffer = await generatePayslipPDF(payslipData);
        console.log('PDF Generated. Sending Branded Email...');

        await emailService.sendPayslipEmail(testStaff, monthName, year, pdfBuffer);
        console.log('✅ Branded Test Email Sent Successfully to kipchirchirtoo01@gmail.com');

        process.exit(0);
    } catch (error: any) {
        console.error('❌ Test Failed:', error.message);
        process.exit(1);
    }
}

runTest();
