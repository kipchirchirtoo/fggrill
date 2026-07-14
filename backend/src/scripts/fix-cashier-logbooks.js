#!/usr/bin/env node
/**
 * fix-cashier-logbooks.js
 * 
 * Fixes cashier_logbooks.sales_breakdown JSONB for shifts since July 10:
 * 
 * 1. Sets cash_drops to correct value (from cashier_shift_logs.cash_deposited)
 * 2. Adds expense_total to sales_breakdown (from cashier_shift_logs.expense_total)
 * 3. Recalculates expected_closing_float in sales_breakdown:
 *    = opening_float + total_cash_sales + paid_bills_value - cash_deposited - expense_total
 *
 * The backend controller reads breakdown.cash_drops first (before shift.cash_deposited),
 * so this JSONB fix is what actually drives what the UI shows.
 *
 * Usage:
 *   DRY_RUN=true node fix-cashier-logbooks.js    (preview, no writes)
 *   node fix-cashier-logbooks.js                  (apply to DB)
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
    console.log(`\n=== Cashier Logbooks Fix Script ===`);
    console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes written)' : '✅ LIVE (writing to DB)'}`);
    console.log(`Date: ${new Date().toISOString()}\n`);

    // Fetch all logbooks since July 10 with their linked shift data
    const { rows } = await client.query(`
      SELECT 
        cl.id as logbook_id,
        cl.opening_float as logbook_opening_float,
        cl.closing_float as logbook_closing_float,
        cl.sales_breakdown,
        csl.id as shift_id,
        csl.shift_number,
        csl.cashier_name,
        csl.status as shift_status,
        csl.opening_float as shift_opening_float,
        csl.total_cash_sales,
        csl.total_mpesa_sales,
        csl.total_card_sales,
        csl.cash_deposited,
        csl.expense_total,
        csl.paid_bills_value,
        csl.expected_closing_float as shift_expected,
        csl.variance as shift_variance
      FROM cashier_logbooks cl
      JOIN cashier_shift_logs csl ON csl.id = cl.cashier_shift_id
      WHERE cl.created_at >= '2026-07-10'
        AND csl.status IN ('closed', 'hard_closed')
      ORDER BY cl.created_at ASC
    `);

    console.log(`Found ${rows.length} closed logbook-shift pairs to evaluate.\n`);

    let fixCount = 0;
    const fixes = [];

    for (const r of rows) {
      const bd = r.sales_breakdown || {};

      // Source of truth is the cashier_shift_logs columns (already fixed/correct)
      const openingFloat  = num(r.logbook_opening_float || r.shift_opening_float);
      const cashSales     = num(bd.total_cash || r.total_cash_sales);
      const paidBills     = num(bd.paid_bills_value || r.paid_bills_value);
      const cashDeposited = num(r.cash_deposited);   // correct value in shift log
      const expenseTotal  = num(r.expense_total);    // correct value in shift log

      const correctCashDrops = cashDeposited;        // cash_drops = actual cash deposited only
      const correctExpected  = openingFloat + cashSales + paidBills - cashDeposited - expenseTotal;

      // What does the breakdown currently say?
      const bdCashDrops = num(bd.cash_drops);
      const bdExpenseTotal = num(bd.expense_total);
      const bdExpected = num(bd.expected_closing_float);

      const needsFix = Math.abs(bdCashDrops - correctCashDrops) > 0.01 ||
                       Math.abs(bdExpenseTotal - expenseTotal) > 0.01 ||
                       Math.abs(bdExpected - correctExpected) > 0.01;

      if (needsFix) {
        fixCount++;
        fixes.push({
          logbook_id: r.logbook_id,
          shift_number: r.shift_number,
          cashier_name: r.cashier_name,
          bdCashDrops, correctCashDrops,
          bdExpenseTotal, expenseTotal,
          bdExpected, correctExpected,
        });

        console.log(`[NEEDS FIX] ${r.shift_number} — ${r.cashier_name}`);
        if (Math.abs(bdCashDrops - correctCashDrops) > 0.01) {
          console.log(`  breakdown.cash_drops:      ${bdCashDrops.toFixed(2)} → ${correctCashDrops.toFixed(2)}`);
        }
        if (Math.abs(bdExpenseTotal - expenseTotal) > 0.01) {
          console.log(`  breakdown.expense_total:   ${bdExpenseTotal.toFixed(2)} → ${expenseTotal.toFixed(2)}`);
        }
        if (Math.abs(bdExpected - correctExpected) > 0.01) {
          console.log(`  breakdown.expected_closing: ${bdExpected.toFixed(2)} → ${correctExpected.toFixed(2)}`);
        }
        console.log('');
      } else {
        console.log(`[  OK  ] ${r.shift_number} — ${r.cashier_name} (cash_drops=${bdCashDrops}, expense=${bdExpenseTotal}, expected=${bdExpected.toFixed(2)})`);
      }
    }

    console.log(`\n--- Summary ---`);
    console.log(`Total logbooks evaluated: ${rows.length}`);
    console.log(`Logbooks needing fix:     ${fixCount}`);

    if (fixCount === 0) {
      console.log('\n✅ All logbooks are already correct. Nothing to update.');
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
        await client.query(`
          UPDATE cashier_logbooks
          SET 
            sales_breakdown = sales_breakdown 
              || jsonb_build_object(
                'cash_drops', $1::numeric,
                'expense_total', $2::numeric,
                'expected_closing_float', $3::numeric
              ),
            updated_at = NOW()
          WHERE id = $4
        `, [fix.correctCashDrops, fix.expenseTotal, fix.correctExpected, fix.logbook_id]);

        console.log(`  ✅ Fixed ${fix.shift_number} (${fix.cashier_name}): cash_drops ${fix.bdCashDrops.toFixed(0)}→${fix.correctCashDrops.toFixed(0)}, expense_total ${fix.bdExpenseTotal.toFixed(0)}→${fix.expenseTotal.toFixed(0)}, expected ${fix.bdExpected.toFixed(0)}→${fix.correctExpected.toFixed(0)}`);
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
