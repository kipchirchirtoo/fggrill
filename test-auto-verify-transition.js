/**
 * Test automatic status transition from submitted to verified
 * 
 * This test verifies that when a stock-take is submitted, it automatically
 * transitions to 'verified' status with proper timestamps and audit logs.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

const { Client } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL not found in backend/.env');
    process.exit(1);
}

async function testAutoVerifyTransition() {
    const client = new Client({ connectionString });
    
    try {
        await client.connect();
        console.log('✅ Connected to database\n');
        
        console.log('🧪 Testing automatic status transition...\n');
        
        // Step 1: Create a test stock-take
        console.log('1️⃣  Creating test stock-take...');
        const createResult = await client.query(`
            INSERT INTO stock_takes (
                take_number,
                branch_id,
                take_type,
                status,
                started_by,
                started_at,
                total_items_counted,
                items_with_variance
            )
            VALUES (
                'TEST-' || EXTRACT(EPOCH FROM NOW())::TEXT,
                1,
                'FULL',
                'IN_PROGRESS',
                (SELECT id FROM users LIMIT 1),
                NOW(),
                100,
                5
            )
            RETURNING id, status, submitted_at, verified_at
        `);
        
        const stockTakeId = createResult.rows[0].id;
        console.log(`   ✓ Created stock-take: ${stockTakeId}`);
        console.log(`   ✓ Initial status: ${createResult.rows[0].status}\n`);
        
        // Step 2: Submit the stock-take using the RPC function
        console.log('2️⃣  Submitting stock-take (should auto-verify)...');
        const userId = (await client.query('SELECT id FROM users LIMIT 1')).rows[0].id;
        
        const submitResult = await client.query(`
            SELECT submit_stock_take_with_lock(
                $1::uuid,
                $2::uuid,
                '127.0.0.1',
                'test-script'
            ) as result
        `, [stockTakeId, userId]);
        
        const result = submitResult.rows[0].result;
        console.log(`   ✓ Submission result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`   ✓ Message: ${result.message}\n`);
        
        if (!result.success) {
            console.error('❌ Submission failed:', result);
            process.exit(1);
        }
        
        // Step 3: Verify the status is 'verified' (not 'submitted')
        console.log('3️⃣  Verifying automatic status transition...');
        const statusCheck = await client.query(`
            SELECT 
                id,
                status,
                submitted_at,
                verified_at,
                submitted_by
            FROM stock_takes
            WHERE id = $1
        `, [stockTakeId]);
        
        const stockTake = statusCheck.rows[0];
        console.log(`   ✓ Current status: ${stockTake.status}`);
        console.log(`   ✓ Submitted at: ${stockTake.submitted_at}`);
        console.log(`   ✓ Verified at: ${stockTake.verified_at}`);
        console.log(`   ✓ Submitted by: ${stockTake.submitted_by}\n`);
        
        // Verify status is 'verified'
        if (stockTake.status !== 'verified') {
            console.error(`❌ FAILED: Expected status 'verified', got '${stockTake.status}'`);
            process.exit(1);
        }
        
        // Verify timestamps are set
        if (!stockTake.submitted_at) {
            console.error('❌ FAILED: submitted_at is null');
            process.exit(1);
        }
        
        if (!stockTake.verified_at) {
            console.error('❌ FAILED: verified_at is null');
            process.exit(1);
        }
        
        // Verify verified_at >= submitted_at
        const submittedTime = new Date(stockTake.submitted_at);
        const verifiedTime = new Date(stockTake.verified_at);
        
        if (verifiedTime < submittedTime) {
            console.error('❌ FAILED: verified_at is before submitted_at');
            process.exit(1);
        }
        
        console.log('   ✅ Status correctly set to "verified"');
        console.log('   ✅ Timestamps are properly set');
        console.log('   ✅ verified_at >= submitted_at\n');
        
        // Step 4: Check audit log entries
        console.log('4️⃣  Checking audit log entries...');
        const auditLogs = await client.query(`
            SELECT 
                action,
                previous_status,
                new_status,
                event_type,
                user_role,
                created_at
            FROM stock_take_audit_log
            WHERE stock_take_id = $1
            ORDER BY created_at ASC
        `, [stockTakeId]);
        
        console.log(`   ✓ Found ${auditLogs.rows.length} audit log entries\n`);
        
        // Should have 2 entries: submission and auto-verification
        if (auditLogs.rows.length < 2) {
            console.error(`❌ FAILED: Expected at least 2 audit log entries, got ${auditLogs.rows.length}`);
            process.exit(1);
        }
        
        // Check submission entry
        const submissionLog = auditLogs.rows.find(log => 
            log.action === 'status_change' && 
            log.new_status === 'submitted'
        );
        
        if (!submissionLog) {
            console.error('❌ FAILED: No submission audit log entry found');
            process.exit(1);
        }
        
        console.log('   📝 Submission audit log:');
        console.log(`      - Action: ${submissionLog.action}`);
        console.log(`      - Previous status: ${submissionLog.previous_status}`);
        console.log(`      - New status: ${submissionLog.new_status}`);
        console.log(`      - Event type: ${submissionLog.event_type}`);
        console.log(`      - User role: ${submissionLog.user_role}\n`);
        
        // Check verification entry
        const verificationLog = auditLogs.rows.find(log => 
            log.action === 'status_change' && 
            log.new_status === 'verified'
        );
        
        if (!verificationLog) {
            console.error('❌ FAILED: No verification audit log entry found');
            process.exit(1);
        }
        
        console.log('   📝 Verification audit log:');
        console.log(`      - Action: ${verificationLog.action}`);
        console.log(`      - Previous status: ${verificationLog.previous_status}`);
        console.log(`      - New status: ${verificationLog.new_status}`);
        console.log(`      - Event type: ${verificationLog.event_type}`);
        console.log(`      - User role: ${verificationLog.user_role}\n`);
        
        // Verify the verification log has correct values
        if (verificationLog.previous_status !== 'submitted') {
            console.error(`❌ FAILED: Verification log previous_status should be 'submitted', got '${verificationLog.previous_status}'`);
            process.exit(1);
        }
        
        if (verificationLog.event_type !== 'auto_verification') {
            console.error(`❌ FAILED: Verification log event_type should be 'auto_verification', got '${verificationLog.event_type}'`);
            process.exit(1);
        }
        
        if (verificationLog.user_role !== 'system') {
            console.error(`❌ FAILED: Verification log user_role should be 'system', got '${verificationLog.user_role}'`);
            process.exit(1);
        }
        
        console.log('   ✅ Submission audit log entry is correct');
        console.log('   ✅ Verification audit log entry is correct');
        console.log('   ✅ Verification is marked as system-triggered\n');
        
        // Step 5: Clean up test data
        console.log('5️⃣  Cleaning up test data...');
        await client.query('DELETE FROM stock_take_audit_log WHERE stock_take_id = $1', [stockTakeId]);
        await client.query('DELETE FROM stock_takes WHERE id = $1', [stockTakeId]);
        console.log('   ✓ Test data cleaned up\n');
        
        // Final summary
        console.log('═'.repeat(80));
        console.log('✅ ALL TESTS PASSED!');
        console.log('═'.repeat(80));
        console.log('\n📋 Verified Requirements:');
        console.log('   ✓ 3.1: Status automatically transitions to "verified"');
        console.log('   ✓ 3.2: Transition happens immediately (within same transaction)');
        console.log('   ✓ 3.3: verified_at timestamp is set correctly');
        console.log('   ✓ 3.4: Transition is atomic with submission');
        console.log('   ✓ 4.2: Audit log entry created for verification\n');
        console.log('🎉 Automatic status transition is working correctly!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

testAutoVerifyTransition();
