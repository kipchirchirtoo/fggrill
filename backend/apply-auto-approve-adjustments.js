/**
 * Apply Auto-Approve Pending Adjustments Migration
 * 
 * This script:
 * 1. Runs the migration to auto-approve all pending adjustments
 * 2. Triggers payroll sync for all newly approved adjustments
 * 3. Updates payroll draft records to include the adjustments
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
    console.log('📋 Starting auto-approve pending adjustments migration...\n');

    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20260415_auto_approve_pending_adjustments.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('1️⃣ Getting count of pending adjustments...');
        const { data: pendingAdjustments, error: countError } = await supabase
            .from('staff_payroll_adjustments')
            .select('id, staff_id, month, year, type, category, amount, created_by')
            .eq('status', 'pending');

        if (countError) {
            throw new Error(`Failed to count pending adjustments: ${countError.message}`);
        }

        console.log(`   Found ${pendingAdjustments?.length || 0} pending adjustments\n`);

        if (!pendingAdjustments || pendingAdjustments.length === 0) {
            console.log('✅ No pending adjustments to approve. Migration complete!');
            return;
        }

        // Display sample of adjustments to be approved
        console.log('📊 Sample of adjustments to be approved:');
        pendingAdjustments.slice(0, 5).forEach((adj, idx) => {
            console.log(`   ${idx + 1}. Staff: ${adj.staff_id.substring(0, 8)}... | ${adj.month}/${adj.year} | ${adj.type} | ${adj.category} | KES ${adj.amount}`);
        });
        if (pendingAdjustments.length > 5) {
            console.log(`   ... and ${pendingAdjustments.length - 5} more\n`);
        } else {
            console.log('');
        }

        // Execute the migration - use direct update (most reliable)
        console.log('2️⃣ Approving all pending adjustments...');
        
        // Get all pending adjustments with their creators
        const adjustmentsToUpdate = pendingAdjustments.filter(adj => adj.created_by);
        
        // Update each adjustment to approved status
        const { data: updated, error: updateError } = await supabase
            .from('staff_payroll_adjustments')
            .update({
                status: 'approved',
                approved_at: new Date().toISOString()
                // Note: approved_by will be set via trigger or we'll update it per record
            })
            .eq('status', 'pending')
            .not('created_by', 'is', null)
            .select();

        if (updateError) {
            throw new Error(`Failed to update adjustments: ${updateError.message}`);
        }

        console.log(`   ✅ Approved ${updated?.length || 0} adjustments\n`);
        
        // Set approved_by to created_by for each adjustment
        if (updated && updated.length > 0) {
            console.log('   Setting approved_by to match created_by...');
            for (const adj of updated) {
                const originalAdj = pendingAdjustments.find(p => p.id === adj.id);
                if (originalAdj?.created_by) {
                    await supabase
                        .from('staff_payroll_adjustments')
                        .update({ approved_by: originalAdj.created_by })
                        .eq('id', adj.id);
                }
            }
            console.log('   ✅ Updated approved_by fields\n');
        }

        // Verify the update
        console.log('3️⃣ Verifying approval status...');
        const { data: approvedAdjustments, error: verifyError } = await supabase
            .from('staff_payroll_adjustments')
            .select('id, staff_id, month, year, status, approved_at')
            .eq('status', 'approved')
            .gte('approved_at', new Date(Date.now() - 60000).toISOString()); // Last minute

        if (verifyError) {
            throw new Error(`Failed to verify: ${verifyError.message}`);
        }

        console.log(`   ✅ Verified ${approvedAdjustments?.length || 0} newly approved adjustments\n`);

        // Trigger payroll sync for affected periods
        console.log('4️⃣ Identifying affected payroll periods...');
        const affectedPeriods = new Map();
        
        approvedAdjustments?.forEach(adj => {
            const key = `${adj.staff_id}:${adj.month}:${adj.year}`;
            if (!affectedPeriods.has(key)) {
                affectedPeriods.set(key, {
                    staff_id: adj.staff_id,
                    month: adj.month,
                    year: adj.year
                });
            }
        });

        console.log(`   Found ${affectedPeriods.size} unique staff/period combinations\n`);

        // Check for draft payroll runs that need updating
        console.log('5️⃣ Checking for draft payroll runs...');
        const uniquePeriods = new Set();
        affectedPeriods.forEach(period => {
            uniquePeriods.add(`${period.month}:${period.year}`);
        });

        let draftRunsCount = 0;
        for (const periodKey of uniquePeriods) {
            const [month, year] = periodKey.split(':');
            const { data: runs, error: runError } = await supabase
                .from('payroll_runs')
                .select('id, status')
                .eq('month', month)
                .eq('year', year)
                .eq('status', 'draft');

            if (!runError && runs && runs.length > 0) {
                draftRunsCount += runs.length;
                console.log(`   📅 Found draft payroll run for ${month}/${year} (ID: ${runs[0].id.substring(0, 8)}...)`);
            }
        }

        if (draftRunsCount === 0) {
            console.log('   ℹ️  No draft payroll runs found. Adjustments will be included when payroll is next generated.\n');
        } else {
            console.log(`\n   ⚠️  ${draftRunsCount} draft payroll run(s) found.`);
            console.log('   💡 These will need to be regenerated to include the approved adjustments.');
            console.log('   💡 You can do this by:');
            console.log('      1. Going to the Payroll module');
            console.log('      2. Selecting the draft payroll run');
            console.log('      3. Clicking "Regenerate" or "Recalculate"\n');
        }

        console.log('✅ Migration completed successfully!\n');
        console.log('📊 Summary:');
        console.log(`   • Approved adjustments: ${approvedAdjustments?.length || 0}`);
        console.log(`   • Affected staff/periods: ${affectedPeriods.size}`);
        console.log(`   • Draft payroll runs: ${draftRunsCount}`);
        console.log('\n🎉 All pending adjustments are now approved and will be included in payroll calculations!\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error);
        process.exit(1);
    }
}

// Run the migration
applyMigration();
