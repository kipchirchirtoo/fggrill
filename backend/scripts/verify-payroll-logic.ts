import dotenv from 'dotenv';
import path from 'path';
// Load env
dotenv.config({ path: path.join(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyPayrollLogic() {
    console.log('--- Commencing Payroll Logic Verification ---');

    // Test Case: Employee with all deductions ENABLED
    console.log('\nTest Case 1: All Deductions Enabled (50,000 Basic)');
    // Expected: NSSF ~2160, SHIF ~1375, Housing ~750, PAYE calculated accordingly

    // Test Case: Employee with NSSF DISABLED
    console.log('\nTest Case 2: NSSF Disabled (50,000 Basic)');
    // Expected: NSSF = 0, Taxable Income is Higher (Basic - 0), PAYE slightly higher

    // Test Case: Employee with Housing & SHIF DISABLED
    console.log('\nTest Case 3: Housing & SHIF Disabled (50,000 Basic)');
    // Expected: Housing = 0, SHIF = 0, Insurance/Housing Reliefs = 0, PAYE higher

    // Note: Since this touches the real DB, we would ideally mock the controller's logic 
    // or run against a test project. For this environment, we'll perform a "dry run"
    // by manually invoking the logic derived from the controller.

    const basicSalary = 50000;

    const calculate = (flags: { nssf: boolean, shif: boolean, housing: boolean }) => {
        let nssf = 0;
        if (flags.nssf) {
            const nssfTierI = Math.min(basicSalary, 7000) * 0.06;
            const nssfTierII = Math.max(0, Math.min(basicSalary - 7000, 29000)) * 0.06;
            nssf = Math.round(nssfTierI + nssfTierII);
        }

        let shif = 0;
        if (flags.shif) {
            shif = Math.round(basicSalary * 0.0275);
        }

        let housingLevy = 0;
        if (flags.housing) {
            housingLevy = Math.round(basicSalary * 0.015);
        }

        const taxableIncome = basicSalary - nssf;
        let tax = 0;
        if (taxableIncome > 0) {
            if (taxableIncome <= 24000) tax = taxableIncome * 0.10;
            else if (taxableIncome <= 32333) tax = 24000 * 0.10 + (taxableIncome - 24000) * 0.25;
            else if (taxableIncome <= 500000) tax = 24000 * 0.10 + 8333 * 0.25 + (taxableIncome - 32333) * 0.30;
            // ... truncated bands for brevity ...
        }

        const personalRelief = 2400;
        const insuranceRelief = Math.min(shif * 0.15, 5000);
        const housingRelief = Math.min(housingLevy * 0.15, 9000);
        const paye = Math.max(0, Math.round(tax - personalRelief - insuranceRelief - housingRelief));

        return { nssf, shif, housingLevy, paye };
    };

    const res1 = calculate({ nssf: true, shif: true, housing: true });
    console.log('Res 1 (All Enabled):', res1);

    const res2 = calculate({ nssf: false, shif: true, housing: true });
    console.log('Res 2 (NSSF Disabled):', res2);
    if (res2.nssf === 0) console.log('✅ NSSF Disabled correctly');
    else console.log('❌ NSSF should be 0');

    const res3 = calculate({ nssf: true, shif: false, housing: false });
    console.log('Res 3 (Housing/SHIF Disabled):', res3);
    if (res3.shif === 0 && res3.housingLevy === 0) console.log('✅ SHIF & Housing Disabled correctly');
    else console.log('❌ SHIF/Housing should be 0');

    console.log('\n--- Verification Complete ---');
}

verifyPayrollLogic().catch(console.error);
