#!/usr/bin/env node
/**
 * fix-historical-shifts.js
 * 
 * Fixes cashier_shift_logs records since July 10, 2026:
 * 1. Updates expected_closing_float to include expense_total subtraction
 *    Formula: opening_float + total_cash_sales + paid_bills_value - cash_deposited - expense_total
 * 2. Updates the variance = actual_cash_counted - expected_closing_float
 * 3. Updates shift_actual_collections cash row: system_amount and variance
 *
 * M-Pesa figures are already correct in the DB and are left untouched.
 *
 * Usage:
 *   DRY_RUN=true node fix-historical-shifts.js    (preview changes, no writes)
 *   node fix-historical-shifts.js                 (apply changes to DB)
 */

require('dotenv').config({ path: '/home/john/fggrill-1/backend/.env' });
const { Pool } = require('pg');

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');
const url = process.env.DATABASE_URL.replace(':6543/', ':5432/');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

function num(v) { return parseFloat(v || 0); }

async function main() {
  const client = await pool.connect();
  try {
    console.log(`\n=== Shift Historical Fix Script ===`);
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
        AND status IN ('closed', 'hard_closed')
      ORDER BY created_at ASC
    `);

    console.log(`Found ${shifts.length} closed shifts to evaluate.\n`);

    let fixCount = 0;
    const fixes = [];

    for (const shift of shifts) {
      const openingFloat  = num(shift.opening_float);
      const cashSales     = num(shift.total_cash_sales);
      const paidBills     = num(shift.paid_bills_value);
      const cashDeposited = num(shift.cash_deposited);
      const expenseTotal  = num(shift.expense_total);
      const actualCash    = num(shift.actual_cash_counted || shift.closing_float);

      // Correct expected formula
      const correctExpected = openingFloat + cashSales + paidBills - cashDeposited - expenseTotal;
      const correctVariance = actualCash - correctExpected;

      const dbExpected = num(shift.expected_closing_float);
      const dbVariance = num(shift.variance);

      // Check if correction needed (using small epsilon for float comparison)
      const needsFix = Math.abs(correctExpected - dbExpected) > 0.01;

      if (needsFix) {
        fixCount++;
        fixes.push({
          id: shift.id,
          shift_number: shift.shift_number,
          cashier_name: shift.cashier_name,
          dbExpected, dbVariance,
          correctExpected, correctVariance,
          expenseTotal,
        });

        console.log(`[NEEDS FIX] ${shift.shift_number} — ${shift.cashier_name}`);
        console.log(`  Expenses:          KES ${expenseTotal.toLocaleString('en-KE', {minimumFractionDigits: 2})}`);
        console.log(`  DB expected_cash:  KES ${dbExpected.toLocaleString('en-KE', {minimumFractionDigits: 2})}`);
        console.log(`  New expected_cash: KES ${correctExpected.toLocaleString('en-KE', {minimumFractionDigits: 2})}`);
        console.log(`  DB variance:       KES ${dbVariance.toLocaleString('en-KE', {minimumFractionDigits: 2})}`);
        console.log(`  New variance:      KES ${correctVariance.toLocaleString('en-KE', {minimumFractionDigits: 2})}`);
        console.log('');
      } else {
        console.log(`[  OK  ] ${shift.shift_number} — ${shift.cashier_name} (expected=${dbExpected.toFixed(2)}, variance=${dbVariance.toFixed(2)})`);
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
            updated_at = NOW()
          WHERE id = $3
        `, [fix.correctExpected, fix.correctVariance, fix.id]);

        // Update shift_actual_collections cash row
        // NOTE: variance is a STORED GENERATED column (actual_amount - system_amount),
        // so we only update system_amount and Postgres recalculates variance automatically.
        await client.query(`
          UPDATE shift_actual_collections
          SET
            system_amount = $1
          WHERE shift_id = $2
            AND payment_method = 'cash'
        `, [fix.correctExpected, fix.id]);

        console.log(`  ✅ Fixed ${fix.shift_number} (${fix.cashier_name}): expected ${fix.dbExpected.toFixed(2)} → ${fix.correctExpected.toFixed(2)}, variance ${fix.dbVariance.toFixed(2)} → ${fix.correctVariance.toFixed(2)}`);
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
