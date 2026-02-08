/**
 * Complete Financial Cleanup - Remove ALL remaining financial data
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config();
dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

async function completeFinancialCleanup() {
    console.log('\n💰 COMPLETE FINANCIAL CLEANUP - Removing ALL financial data\n');

    // Auditor and verification tables
    const auditorTables = [
        'financial_verifications',
        'daily_collections',
        'collection_gateways',
        'audit_records',
        'audit_surplus',
        'variance_records',
        'leakage_alerts',
        'logbook_verifications',
        'revenue_audits',
        'financial_audits',
        'audit_trails',
        'verification_logs',
    ];

    // Revenue and sales tracking
    const revenueTables = [
        'revenue_tracking',
        'departmental_revenue',
        'branch_revenue',
        'daily_revenue',
        'monthly_revenue',
        'revenue_summary',
        'sales_summary',
        'collection_summary',
        'payment_summary',
        'operational_revenue',
        'gross_revenue',
        'net_revenue',
    ];

    // Payment and collection tables
    const paymentTables = [
        'payment_collections',
        'daily_collections',
        'pending_collections',
        'verified_collections',
        'collection_records',
        'payment_records',
        'cash_collections',
        'card_collections',
        'mpesa_collections',
    ];

    // All tables to clean
    const allTables = [
        ...auditorTables,
        ...revenueTables,
        ...paymentTables,
    ];

    let totalCleaned = 0;

    for (const table of allTables) {
        try {
            const { data } = await supabase.from(table).select('id');
            if (data && data.length > 0) {
                for (const row of data) {
                    await supabase.from(table).delete().eq('id', row.id);
                }
                console.log(`✅ Cleaned: ${table} (${data.length} records)`);
                totalCleaned += data.length;
            }
        } catch (error) {
            // Table doesn't exist - skip
        }
    }

    console.log(`\n✅ Total records cleaned: ${totalCleaned}\n`);
    console.log('🔄 Please refresh your dashboard and check again.');
    console.log('If financial data still appears, please copy the exact page/section');
    console.log('name so I can identify the specific tables.\n');
}

completeFinancialCleanup()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(`\n❌ Error: ${error.message}`);
        process.exit(1);
    });
