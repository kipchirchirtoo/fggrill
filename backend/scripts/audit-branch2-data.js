#!/usr/bin/env node
/**
 * AUDIT SCRIPT: POS, Cashier, Branch Accountant — Branch 2 (Bomet Town)
 * Connects to NEW database and reports all data counts + sample records.
 */

const { Pool } = require('pg');

// NEW database from .env
const DATABASE_URL = 'postgresql://postgres.rvoaowhxyweswwuxbrzm:uj8dR3hPZmhwcEUf@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

const BRANCH_ID = 2;
const BRANCH_NAME = 'Bomet Town Branch';

async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res.rows;
  } finally {
    client.release();
  }
}

async function countRows(table, branchCol = 'branch_id', extraWhere = '') {
  const where = branchCol ? `WHERE ${branchCol} = $1 ${extraWhere}` : extraWhere ? `WHERE ${extraWhere}` : '';
  const params = branchCol ? [BRANCH_ID] : [];
  const rows = await query(`SELECT COUNT(*)::int AS cnt FROM ${table} ${where}`, params);
  return rows[0]?.cnt || 0;
}

async function sampleRows(table, limit = 5, branchCol = 'branch_id', extraWhere = '') {
  const where = branchCol ? `WHERE ${branchCol} = $1 ${extraWhere}` : extraWhere ? `WHERE ${extraWhere}` : '';
  const params = branchCol ? [BRANCH_ID] : [];
  return await query(`SELECT * FROM ${table} ${where} ORDER BY created_at DESC LIMIT ${limit}`, params);
}

async function allRows(table, branchCol = 'branch_id', extraWhere = '') {
  const where = branchCol ? `WHERE ${branchCol} = $1 ${extraWhere}` : extraWhere ? `WHERE ${extraWhere}` : '';
  const params = branchCol ? [BRANCH_ID] : [];
  return await query(`SELECT * FROM ${table} ${where} ORDER BY created_at DESC`, params);
}

async function run() {
  console.log('='.repeat(80));
  console.log('BRANCH 2 DATA AUDIT — POS, CASHIER, BRANCH ACCOUNTANT MODULES');
  console.log('Database: NEW (rvoaowhxyweswwuxbrzm)');
  console.log('Branch ID:', BRANCH_ID);
  console.log('='.repeat(80));

  // Verify branch exists
  const branchCheck = await query('SELECT id, name, location FROM branches WHERE id = $1', [BRANCH_ID]);
  if (!branchCheck.length) {
    console.log('\n❌ BRANCH 2 NOT FOUND IN DATABASE!');
    await pool.end();
    return;
  }
  console.log(`\n✓ Branch found: ${branchCheck[0].name} (${branchCheck[0].location})`);

  // =============================
  // MODULE 1: POS
  // =============================
  console.log('\n' + '='.repeat(80));
  console.log('MODULE 1: POS (Point of Sale)');
  console.log('='.repeat(80));

  const posTables = [
    { table: 'pos_outlets', label: 'POS Outlets', col: 'branch_id' },
    { table: 'pos_outlet_items', label: 'POS Outlet Items', col: 'branch_id' },
    { table: 'pos_outlet_shifts', label: 'POS Outlet Shifts', col: 'branch_id' },
    { table: 'pos_shift_orders', label: 'POS Shift Orders', col: 'branch_id' },
    { table: 'pos_shift_order_items', label: 'POS Shift Order Items', col: 'branch_id' },
    { table: 'pos_shift_payments', label: 'POS Shift Payments', col: 'branch_id' },
    { table: 'pos_shift_stock_counts', label: 'POS Shift Stock Counts', col: 'branch_id' },
    { table: 'pos_void_requests', label: 'POS Void Requests', col: 'branch_id' },
    { table: 'pos_inventory_mappings', label: 'POS Inventory Mappings', col: 'branch_id' },
  ];

  for (const t of posTables) {
    try {
      const cnt = await countRows(t.table, t.col);
      console.log(`\n📊 ${t.label}: ${cnt} row(s)`);
      if (cnt > 0) {
        const sample = await sampleRows(t.table, 3, t.col);
        console.log('   Sample records (most recent):');
        sample.forEach((row, i) => {
          const keys = Object.keys(row).slice(0, 8);
          console.log(`   [${i + 1}] ${keys.map(k => `${k}=${JSON.stringify(row[k])?.substring(0, 60)}`).join(', ')}`);
        });
      }
    } catch (e) {
      console.log(`\n⚠️ ${t.label}: TABLE NOT FOUND or ERROR — ${e.message}`);
    }
  }

  // =============================
  // MODULE 2: CASHIER
  // =============================
  console.log('\n' + '='.repeat(80));
  console.log('MODULE 2: CASHIER');
  console.log('='.repeat(80));

  const cashierTables = [
    { table: 'pos_outlet_shifts', label: 'Cashier Shifts (open/closed)', col: 'branch_id' },
    { table: 'pos_shift_payments', label: 'Cashier Payments', col: 'branch_id' },
    { table: 'pos_shift_orders', label: 'Cashier Orders', col: 'branch_id' },
  ];

  for (const t of cashierTables) {
    try {
      const cnt = await countRows(t.table, t.col);
      console.log(`\n📊 ${t.label}: ${cnt} row(s)`);
      if (cnt > 0) {
        const sample = await sampleRows(t.table, 3, t.col);
        console.log('   Sample records:');
        sample.forEach((row, i) => {
          const keys = Object.keys(row).slice(0, 8);
          console.log(`   [${i + 1}] ${keys.map(k => `${k}=${JSON.stringify(row[k])?.substring(0, 60)}`).join(', ')}`);
        });
      }
    } catch (e) {
      console.log(`\n⚠️ ${t.label}: ERROR — ${e.message}`);
    }
  }

  // =============================
  // MODULE 3: BRANCH ACCOUNTANT
  // =============================
  console.log('\n' + '='.repeat(80));
  console.log('MODULE 3: BRANCH ACCOUNTANT');
  console.log('='.repeat(80));

  const acctTables = [
    { table: 'daily_financial_records', label: 'Daily Financial Records', col: 'branch_id' },
    { table: 'monthly_financial_adjustments', label: 'Monthly Financial Adjustments', col: 'branch_id' },
    { table: 'branch_payment_receipts', label: 'Branch Payment Receipts', col: 'branch_id' },
    { table: 'void_requests', label: 'Void Requests', col: null, extra: `EXISTS (SELECT 1 FROM restaurant_orders ro WHERE ro.id = void_requests.order_id AND ro.branch_id = ${BRANCH_ID})` },
    { table: 'department_accounts', label: 'Department Accounts', col: 'branch_id' },
    { table: 'report_jobs', label: 'Report Jobs', col: 'branch_id' },
    { table: 'inventory_governance_reviews', label: 'Inventory Governance Reviews', col: 'branch_id' },
    { table: 'superadmin_audit_log', label: 'Superadmin Audit Log', col: 'branch_id' },
  ];

  for (const t of acctTables) {
    try {
      const cnt = await countRows(t.table, t.col, t.extra || '');
      console.log(`\n📊 ${t.label}: ${cnt} row(s)`);
      if (cnt > 0) {
        const sample = await sampleRows(t.table, 3, t.col, t.extra || '');
        console.log('   Sample records:');
        sample.forEach((row, i) => {
          const keys = Object.keys(row).slice(0, 8);
          console.log(`   [${i + 1}] ${keys.map(k => `${k}=${JSON.stringify(row[k])?.substring(0, 60)}`).join(', ')}`);
        });
      }
    } catch (e) {
      console.log(`\n⚠️ ${t.label}: TABLE NOT FOUND or ERROR — ${e.message}`);
    }
  }

  // =============================
  // TEST/DEV DATA DETECTION
  // =============================
  console.log('\n' + '='.repeat(80));
  console.log('TEST / DEV DATA DETECTION');
  console.log('='.repeat(80));

  // Look for test indicators in users
  console.log('\n👤 USERS linked to Branch 2:');
  const users = await query(`
    SELECT id, email, role, first_name, last_name, created_at, is_active
    FROM users WHERE branch_id = $1
    ORDER BY created_at DESC
  `, [BRANCH_ID]);
  console.log(`   Total users: ${users.length}`);
  users.forEach(u => {
    const isTest = /test|demo|sample|fake|admin@test|cashier@test/.test(u.email || '');
    console.log(`   ${isTest ? '⚠️ TEST' : '✓'} ${u.email} | role=${u.role} | ${u.first_name} ${u.last_name} | active=${u.is_active}`);
  });

  // Look for test data patterns in POS orders
  console.log('\n🛒 POS Orders — Test Data Patterns:');
  let posOrders = [];
  try {
    posOrders = await query(`
      SELECT order_number, customer_name, total_amount, payment_status, status, created_at
      FROM pos_shift_orders WHERE branch_id = $1
      ORDER BY created_at DESC
    `, [BRANCH_ID]);
  } catch (e) {
    console.log(`   Note: ${e.message}`);
  }
  console.log(`   Total POS orders: ${posOrders.length}`);

  let testOrders = 0;
  posOrders.forEach(o => {
    const isTest = /test|demo|sample|fake|debug/.test(`${o.customer_name} ${o.order_number}`);
    if (isTest) testOrders++;
  });
  console.log(`   Orders with test indicators: ${testOrders}`);

  // Look for test data in daily financial records
  console.log('\n📒 Daily Financial Records — Test Data Patterns:');
  let dfr = [];
  try {
    dfr = await query(`
      SELECT id, record_date, status, total_revenue, total_expenses, created_at
      FROM daily_financial_records WHERE branch_id = $1
      ORDER BY created_at DESC
    `, [BRANCH_ID]);
  } catch (e) {
    console.log(`   Note: ${e.message}`);
  }
  console.log(`   Total records: ${dfr.length}`);
  dfr.forEach(r => {
    const isTest = /test|demo|sample|fake/.test(`${r.status}`);
    console.log(`   ${isTest ? '⚠️ TEST' : '✓'} Date=${r.record_date} | Status=${r.status} | Revenue=${r.total_revenue} | Expenses=${r.total_expenses}`);
  });

  // Void requests for branch 2
  console.log('\n🚫 Void Requests for Branch 2:');
  try {
    const voidReqs = await query(`
      SELECT vr.id, vr.status, vr.reason, vr.created_at, ro.order_number, ro.total_amount
      FROM void_requests vr
      JOIN restaurant_orders ro ON ro.id = vr.order_id
      WHERE ro.branch_id = $1
      ORDER BY vr.created_at DESC
    `, [BRANCH_ID]);
    console.log(`   Total void requests: ${voidReqs.length}`);
    voidReqs.forEach(v => {
      console.log(`   ${v.status} | Order=${v.order_number} | Amount=${v.total_amount} | Reason=${v.reason?.substring(0, 50)}`);
    });
  } catch (e) {
    console.log(`   Error: ${e.message}`);
  }

  // =============================
  // SUMMARY
  // =============================
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Branch: ${BRANCH_NAME} (ID: ${BRANCH_ID})`);
  console.log(`Database: NEW (rvoaowhxyweswwuxbrzm)`);
  console.log(`Total Users: ${users.length}`);
  console.log(`Total POS Orders: ${posOrders.length}`);
  console.log(`Total Daily Financial Records: ${dfr.length}`);
  console.log('\n⚠️  Review the output above for test/demo data before going live.');
  console.log('   Look for: emails with "test", "demo", order notes with "test", etc.');

  await pool.end();
}

run().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
