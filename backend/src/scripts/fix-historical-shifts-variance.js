#!/usr/bin/env node
/**
 * fix-historical-shifts-variance.js
 * 
 * Fixes cashier_shift_logs records since July 10, 2026:
 * 1. Sets cash_deposited to 0 (to delete the double entry).
 * 2. Recalculates expected_closing_float = opening_float + total_cash_sales + paid_bills_value
 *    (Note: total_cash_sales is already stored as net of expenses in the DB cashier_shift_logs, so we don't subtract expense_total again).
 * 3. Updates variance = actual_cash_counted - expected_closing_float
 * 4. Updates shift_actual_collections cash row: system_amount
 *
 * Usage:
 *   DRY_RUN=true node fix-historical-shifts-variance.js    (preview changes, no writes)
 *   node fix-historical-shifts-variance.js                 (apply changes to DB)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { Pool } = require('pg');

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const url = process.env.DATABASE_URL.replace(':6543/', ':5432/');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

function num(v) { return parseFloat(v || 0); }

async function main() {
  const client = await pool.connect();
  try {
    console.log(`\n=== Shift Historical Variance & Cash Deposited Fix Script ===`);
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes written)' : '✅ LIVE (writing to DB)'}`);
    console.log(`Date: ${new Date().toISOString()}\n`);

    // Fetch all closed shifts since July 10
    const { rows: shifts } = await client.query(`
      SELECT 
        id, shift_number, status, cashier_name,
        opening_float, total_cash_sales, total_mpesa_sales, total_card_sales,
        cash_deposited, expense_total, paid_bills_value,
        closing_float, expected_closing_float, variance,
        actual_cash_counted, actual_mpesa_logged, actual_card_logged
      FROM cashier_shift_logs
      WHERE created_at >= '2026-07-10'
        AND status IN ('closed', 'hard_closed', 'reconciled', 'verified')
      ORDER BY created_at ASC
    `);

    console.log(`Found ${shifts.length} closed shifts to evaluate.\n`);

    let fixCount = 0;
    const fixes = [];

    for (const shift of shifts) {
      const openingFloat  = num(shift.opening_float);
      const cashSales     = num(shift.total_cash_sales); // Net cash sales stored in DB
      const paidBills     = num(shift.paid_bills_value);
      const expenseTotal  = num(shift.expense_total);
      const actualCash    = num(shift.actual_cash_counted || shift.closing_float);

      // Correct expected formula without cash_deposited/cashDrops deduction
      const correctExpected = openingFloat + cashSales + paidBills;
      const correctVariance = actualCash - correctExpected;

      const dbExpected = num(shift.expected_closing_float);
      const dbVariance = num(shift.variance);
      const dbDeposited = num(shift.cash_deposited);

      // Check if correction needed
      const needsExpectedFix = Math.abs(correctExpected - dbExpected) > 0.01;
      const needsDepositedFix = dbDeposited !== 0;
      const needsFix = needsExpectedFix || needsDepositedFix;

      if (needsFix) {
        fixCount++;
        fixes.push({
          id: shift.id,
          shift_number: shift.shift_number,
          cashier_name: shift.cashier_name,
          dbExpected, dbVariance, dbDeposited,
          correctExpected, correctVariance,
          expenseTotal,
        });

        console.log(`[NEEDS FIX] ${shift.shift_number} — ${shift.cashier_name}`);
        console.log(`  Opening Float:     KES ${openingFloat.toLocaleString('en-KE', {minimumFractionDigits: 2})}`);
        console.log(`  Net Cash Sales:    KES ${cashSales.toLocaleString('en-KE', {minimumFractionDigits: 2})}`);
        console.log(`  Paid Bills:        KES ${paidBills.toLocaleString('en-KE', {minimumFractionDigits: 2})}`);
        console.log(`  Expenses:          KES ${expenseTotal.toLocaleString('en-KE', {minimumFractionDigits: 2})}`);
        console.log(`  DB expected_cash:  KES ${dbExpected.toLocaleString('en-KE', {minimumFractionDigits: 2})} -> New: KES ${correctExpected.toLocaleString('en-KE', {minimumFractionDigits: 2})}`);
        console.log(`  DB variance:       KES ${dbVariance.toLocaleString('en-KE', {minimumFractionDigits: 2})} -> New: KES ${correctVariance.toLocaleString('en-KE', {minimumFractionDigits: 2})}`);
        console.log(`  DB cash_deposited: KES ${dbDeposited.toLocaleString('en-KE', {minimumFractionDigits: 2})} -> New: KES 0.00`);
        console.log('');
      } else {
        console.log(`[  OK  ] ${shift.shift_number} — ${shift.cashier_name} (expected=${dbExpected.toFixed(2)}, variance=${dbVariance.toFixed(2)}, deposited=${dbDeposited.toFixed(2)})`);
      }
    }

    console.log(`\n--- Summary ---`);
    console.log(`Total shifts evaluated: ${shifts.length}`);
    console.log(`Shifts needing fix:     ${fixCount}`);

    if (fixCount === 0) {
      console.log('\n✅ All shifts are already correct. Nothing to update.');
      return;
    }

    if (DRY_RUN) {
      console.log('\n🔍 DRY RUN complete. Run without DRY_RUN=true to apply fixes.');
      return;
    }

    // Apply fixes
    console.log('\nApplying fixes...');
    await client.query('BEGIN');
    try {
      for (const fix of fixes) {
        // Update cashier_shift_logs
        await client.query(`
          UPDATE cashier_shift_logs
          SET 
            expected_closing_float = $1,
            variance = $2,
            cash_deposited = 0,
            updated_at = NOW()
          WHERE id = $3
        `, [fix.correctExpected, fix.correctVariance, fix.id]);

        // Update shift_actual_collections cash row
        await client.query(`
          UPDATE shift_actual_collections
          SET
            system_amount = $1
          WHERE shift_id = $2
            AND payment_method = 'cash'
        `, [fix.correctExpected, fix.id]);

        console.log(`  ✅ Fixed ${fix.shift_number} (${fix.cashier_name}): expected ${fix.dbExpected.toFixed(2)} → ${fix.correctExpected.toFixed(2)}, variance ${fix.dbVariance.toFixed(2)} → ${fix.correctVariance.toFixed(2)}, cash_deposited ${fix.dbDeposited.toFixed(2)} → 0.00`);
      }

      await client.query('COMMIT');
      console.log(`\n✅ Successfully applied ${fixCount} fix(es) to the database.`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Error applying fixes, rolled back:', err.message);
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
