const { Client } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

// Force the database URL used by the imported controller and db pool to be the DEV/DEMO one
const connectionString = process.env.DATABASE_URL_DEV_DEMO;
if (!connectionString) {
  console.error('❌ SAFETY ERROR: DATABASE_URL_DEV_DEMO is not set in backend/.env!');
  process.exit(1);
}
process.env.DATABASE_URL = connectionString;

const client = new Client({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});
client.on('error', (err) => { console.error('Main client error:', err.message); });

// Helper to create mock Express response object
function mockResponse() {
  const res = {};
  res.statusCode = 200;
  res.headers = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  res.send = (data) => {
    res.body = data;
    return res;
  };
  res.setHeader = (name, value) => {
    res.headers[name] = value;
  };
  return res;
}

// Helper to call controller handlers and wait for response or error
function callHandler(handler, req) {
  return new Promise((resolve, reject) => {
    const res = mockResponse();
    res.json = (data) => {
      res.body = data;
      resolve(res);
      return res;
    };
    res.send = (data) => {
      res.body = data;
      resolve(res);
      return res;
    };
    const next = (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    };
    try {
      const p = handler(req, res, next);
      if (p && typeof p.catch === 'function') {
        p.catch(next);
      }
    } catch (err) {
      next(err);
    }
  });
}

async function runTests() {
  let userId = null;
  let originalBranchId = null;
  let cashierShiftId = null;
  let shiftId = null;

  try {
    await client.connect();
    console.log('Connected to database for API/Service-level verification...');

    // Resolve target user
    const userRes = await client.query("SELECT id, branch_id FROM users LIMIT 1");
    if (userRes.rows.length === 0) {
      console.log('❌ ABORT: No users found in DB to run tests.');
      return;
    }
    userId = userRes.rows[0].id;
    originalBranchId = userRes.rows[0].branch_id;

    // Use Branch ID 2 Bomet Town
    const branchId = 2; 
    console.log(`Using Seeded Branch ID: ${branchId}, User ID: ${userId} (original branch: ${originalBranchId})`);

    // Temporarily update user branch to 2 to pass branch scope checks
    await client.query("UPDATE users SET branch_id = 2 WHERE id = $1", [userId]);

    // Pre-test cleanup of any previous test runs
    await client.query("DELETE FROM pastry_production_log WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
    await client.query("DELETE FROM kitchen_shift_approvals WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
    await client.query("DELETE FROM kitchen_shift_production WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
    await client.query("DELETE FROM kitchen_shift_production WHERE conversion_notes = 'TEST_RUN'");
    await client.query("DELETE FROM kitchen_shift_additions WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
    await client.query("DELETE FROM kitchen_shift_items WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
    await client.query("DELETE FROM pos_outlet_items WHERE source_item_id IN (SELECT id::text FROM inventory_items WHERE sku LIKE 'TEST_%')");
    await client.query("DELETE FROM kitchen_production_recipes WHERE raw_item_sku IN (SELECT sku FROM inventory_items WHERE sku LIKE 'TEST_%')");
    await client.query("DELETE FROM branch_stock WHERE item_sku LIKE 'TEST_%'");
    await client.query("DELETE FROM inventory_balances WHERE item_id IN (SELECT id FROM inventory_items WHERE sku LIKE 'TEST_%')");
    await client.query("DELETE FROM stock_count_items WHERE stock_count_id IN (SELECT id FROM stock_counts WHERE branch_id IN (2, 5))");
    await client.query("DELETE FROM stock_counts WHERE branch_id IN (2, 5)");
    await client.query("DELETE FROM inventory_items WHERE sku LIKE 'TEST_%'");
    await client.query("DELETE FROM kitchen_shift_pos_consumption WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
    await client.query("DELETE FROM kitchen_shifts WHERE branch_id IN (2, 5)");
    await client.query("DELETE FROM cashier_shift_logs WHERE notes = 'TEST_SHIFT'");
    await client.query("DELETE FROM branch_shift_config WHERE branch_id IN (1, 2, 3, 4, 5, 9, 10) AND effective_from_business_date = '2026-07-08'");

    // Seed Bomet & Mogogosiek configs temporarily for DEV/DEMO DB testing
    await client.query(`
      INSERT INTO branch_shift_config (branch_id, shift_mode, effective_from_business_date)
      VALUES 
        (2, 'TWO_SHIFT', '2026-07-08'),
        (5, 'SINGLE_SHIFT', '2026-07-08')
    `);

    // 1. Setup scenario records
    const rawItemSku = 'TEST_RAW_01';
    const outputItemSku = 'TEST_OUT_01';
    
    const insertRawRes = await client.query(`
      INSERT INTO inventory_items (item_name, sku, unit, branch_id, category)
      VALUES ('TEST Raw Ingredient', $1, 'kg', $2, 'kitchen') RETURNING id
    `, [rawItemSku, branchId]);
    const rawItemId = insertRawRes.rows[0].id;

    const insertOutRes = await client.query(`
      INSERT INTO inventory_items (item_name, sku, unit, branch_id, category)
      VALUES ('TEST Produced Item', $1, 'portion', $2, 'kitchen') RETURNING id
    `, [outputItemSku, branchId]);
    const outputItemId = insertOutRes.rows[0].id;

    const outletRes = await client.query("SELECT id FROM pos_outlets WHERE branch_id = $1 LIMIT 1", [branchId]);
    const outletId = outletRes.rows.length > 0 ? outletRes.rows[0].id : null;
    let posOutletItemId = null;
    if (outletId) {
      const poiRes = await client.query(`
        INSERT INTO pos_outlet_items (outlet_id, source_table, source_item_id, name, branch_id, current_stock)
        VALUES ($1, 'inventory_items', $2, 'TEST Produced Item', $3, 10) RETURNING id
      `, [outletId, outputItemId, branchId]);
      posOutletItemId = poiRes.rows[0].id;
    }

    // NOTE: WE DO NOT INSERT A RECIPE standard. kitchen_production_recipes will have 0 rows for this item.

    await client.query(`
      INSERT INTO branch_stock (branch_id, item_sku, quantity)
      VALUES ($1, $2, 100)
    `, [branchId, rawItemSku]);

    // Insert cashier shift log
    const cashierShiftRes = await client.query(`
      INSERT INTO cashier_shift_logs (branch_id, status, shift_start, cashier_id, notes)
      VALUES ($1, 'open', NOW(), $2, 'TEST_SHIFT') RETURNING id
    `, [branchId, userId]);
    cashierShiftId = cashierShiftRes.rows[0].id;

    // Insert posted morning stocktakes for BOTH branch 2 and branch 5 with items to pass checks
    const testDate = '2026-07-08'; // Pilot date
    const scRes = await client.query(`
      INSERT INTO stock_counts (branch_id, count_date, store_type, location, status, created_by)
      VALUES 
        (2, $1, 'kitchen', 'kitchen_morning', 'posted', $2),
        (5, $1, 'kitchen', 'kitchen_morning', 'posted', $2)
      RETURNING id
    `, [testDate, userId]);

    for (const row of scRes.rows) {
      await client.query(`
        INSERT INTO stock_count_items (stock_count_id, item_sku, counted_quantity, unit_cost)
        VALUES ($1, $2, 10, 150)
      `, [row.id, rawItemSku]);
    }

    console.log('✅ Setup scenario records successfully.');

    // Now import controller module
    const {
      openKitchenShift,
      addShiftStock,
      logProductionEvent,
      recordSpoilage,
      closeKitchenShift,
      submitForApproval
    } = require('../dist/controllers/kitchen-shift.controller');

    // --- TEST 0: Gating of configs across all 7 pilot branches ---
    console.log('\n--- Test 0: Verify Branch Configurations for Date 2026-07-08 ---');
    
    const branchesToTest = [
      { id: 2, name: 'Bomet Town', expectedAllowed: true },
      { id: 5, name: 'Mogogoshiek', expectedAllowed: true },
      { id: 1, name: 'Kyogong', expectedAllowed: false },
      { id: 3, name: 'Kaplong', expectedAllowed: false },
      { id: 4, name: 'Sotik', expectedAllowed: false },
      { id: 9, name: 'Grill', expectedAllowed: false },
      { id: 10, name: 'Guesthouse', expectedAllowed: false }
    ];

    for (const b of branchesToTest) {
      const req = {
        body: {
          branch_id: b.id,
          shift_type: 'shift_a',
          shift_date: testDate,
          sub_shift_type: 'A',
          department: 'KITCHEN',
          opening_items: [{ sku: rawItemSku, quantity: 10 }]
        },
        user: { id: userId, branch_id: b.id, role: 'branch_manager' }
      };

      let errorThrown = null;
      let res = null;
      try {
        res = await callHandler(openKitchenShift, req);
      } catch (err) {
        errorThrown = err;
      }

      if (b.expectedAllowed) {
        if (errorThrown) {
          console.log(`❌ FAIL: Configured Branch ${b.id} (${b.name}) was blocked! Error: ${errorThrown.message}`);
        } else {
          console.log(`✅ PASS: Configured Branch ${b.id} (${b.name}) is ALLOWED.`);
          if (b.id === 2) {
            shiftId = res.body.data.id;
          } else {
            // Mogogosiek (Branch 5): immediately delete opened shift so we don't clash later
            await client.query("DELETE FROM kitchen_shift_items WHERE shift_id = $1", [res.body.data.id]);
            await client.query("DELETE FROM kitchen_shifts WHERE id = $1", [res.body.data.id]);
          }
        }
      } else {
        if (errorThrown && errorThrown.message.includes('KITCHEN_SESSIONS_NOT_CONFIGURED')) {
          console.log(`... Branch ${b.id} (${b.name}) is BLOCKED (KITCHEN_SESSIONS_NOT_CONFIGURED).`);
        } else {
          console.log(`❌ FAIL: Unseeded Branch ${b.id} (${b.name}) was NOT correctly blocked!`);
        }
      }
    }

    console.log(`✅ Opened working shift for subsequent tests: ${shiftId}`);
    await client.query("UPDATE kitchen_shifts SET closing_notes = 'TEST_SHIFT' WHERE id = $1", [shiftId]);

    // --- TEST 0.5: Cross-Branch Scope Gating Blocks ---
    console.log('\n--- Test 0.5: Verify Cross-Branch Scope Gating Blocks ---');
    {
      const crossBranchUser = { id: userId, branch_id: 5, role: 'branch_storekeeper' }; // User is branch 5, shift is branch 2
      
      const testCases = [
        { name: 'openKitchenShift', handler: openKitchenShift, req: { body: { branch_id: branchId, shift_type: 'shift_a', shift_date: testDate }, user: crossBranchUser } },
        { name: 'addShiftStock', handler: addShiftStock, req: { params: { shift_id: shiftId }, body: { items: [] }, user: crossBranchUser } },
        { name: 'logProductionEvent', handler: logProductionEvent, req: { body: { kitchen_shift_id: shiftId, output_item_id: outputItemId, production_recipe_id: '00000000-0000-0000-0000-000000000000', consumed_inputs: [{ raw_item_id: rawItemId, quantity_used: 1, unit: 'kg' }], actual_produced_qty: 1, output_unit: 'portion', idempotency_key: 'x', produced_by: [userId] }, user: crossBranchUser } },
        { name: 'recordSpoilage', handler: recordSpoilage, req: { params: { shift_id: shiftId }, body: { items: [] }, user: crossBranchUser } },
        { name: 'closeKitchenShift', handler: closeKitchenShift, req: { params: { shift_id: shiftId }, body: { physical_counts: [] }, user: crossBranchUser } },
        { name: 'submitForApproval', handler: submitForApproval, req: { params: { shift_id: shiftId }, user: crossBranchUser } }
      ];

      for (const tc of testCases) {
        let errThrown = null;
        try {
          await callHandler(tc.handler, tc.req);
        } catch (e) {
          errThrown = e;
        }
        if (errThrown && errThrown.message.includes('BRANCH_SCOPE_VIOLATION')) {
          console.log(`✅ PASS: ${tc.name} blocked with BRANCH_SCOPE_VIOLATION.`);
        } else {
          console.log(`❌ FAIL: ${tc.name} was not blocked correctly! Msg: ${errThrown ? errThrown.message : 'None'}`);
        }
      }
    }

    // --- TEST 0.6: Verify Route Gating Blocks Unapproved Roles from Write Routes ---
    console.log('\n--- Test 0.6: Verify Route Gating Blocks Unapproved Roles from Write Routes ---');
    {
      const { authorize } = require('../dist/middleware/auth');
      const { SHIFT_WRITE_ROLES } = require('../dist/routes/kitchen-shift.routes');
      const middleware = authorize(SHIFT_WRITE_ROLES);

      const rolesToTest = [
        { role: 'super_admin', expectedAllowed: false },
        { role: 'branch_manager', expectedAllowed: false },
        { role: 'branch_accountant', expectedAllowed: false },
        { role: 'head_chef', expectedAllowed: false },
        { role: 'sous_chef', expectedAllowed: false },
        { role: 'line_cook', expectedAllowed: false },
        { role: 'kitchen', expectedAllowed: false },
        { role: 'kitchen_operations', expectedAllowed: true },
        { role: 'branch_storekeeper', expectedAllowed: true },
        { role: 'storekeeper', expectedAllowed: true },
        { role: 'central_storekeeper', expectedAllowed: false }
      ];

      const writeEndpoints = [
        '/kitchen/shifts',               // Open Shift
        '/kitchen/shifts/production/log', // Log Production
        '/kitchen/shifts/shift-123/stock', // Add Stock
        '/kitchen/shifts/shift-123/spoilage', // Record Spoilage
        '/kitchen/shifts/shift-123/close', // Close/Handover Shift
        '/kitchen/shifts/shift-123/submit' // Submit for Review
      ];

      for (const r of rolesToTest) {
        for (const ep of writeEndpoints) {
          const req = {
            user: { id: userId, role: r.role },
            originalUrl: ep
          };
          const res = mockResponse();
          let nextCalled = false;
          const next = () => { nextCalled = true; };

          middleware(req, res, next);

          if (r.expectedAllowed) {
            if (!nextCalled) {
              console.log(`❌ FAIL: Allowed role "${r.role}" was blocked on endpoint ${ep}! Code: ${res.statusCode}`);
              throw new Error(`Gating validation failure: allowed role blocked on ${ep}`);
            }
          } else {
            if (res.statusCode === 403 && !nextCalled) {
              console.log(`✅ BLOCKED: Role "${r.role}" on Endpoint "${ep}" -> Status: ${res.statusCode}, Response: ${JSON.stringify(res.body)}`);
            } else {
              console.log(`❌ FAIL: Unapproved role "${r.role}" was NOT correctly blocked on ${ep}! Next called: ${nextCalled}, Status: ${res.statusCode}`);
              throw new Error(`Gating validation failure: unapproved role bypassed check on ${ep}`);
            }
          }
        }
        if (r.expectedAllowed) {
          console.log(`✅ PASS: Allowed role "${r.role}" successfully passed all write route guards.`);
        }
      }
    }

    // --- TEST 0.7: Verify super_admin and branch_manager role authorization checks ---
    console.log('\n--- Test 0.7: Verify super_admin and branch_manager are blocked from SHIFT_WRITE_ROLES ---');
    {
      const { UserRole } = require('../dist/models/User');
      const { SHIFT_WRITE_ROLES } = require('../dist/routes/kitchen-shift.routes');
      
      const superAdminAllowed = SHIFT_WRITE_ROLES.includes(UserRole.SUPER_ADMIN);
      const branchManagerAllowed = SHIFT_WRITE_ROLES.includes(UserRole.BRANCH_MANAGER);
      const storekeeperAllowed = SHIFT_WRITE_ROLES.includes(UserRole.KITCHEN_OPERATIONS);
      
      console.log(`  - super_admin in SHIFT_WRITE_ROLES: ${superAdminAllowed}`);
      console.log(`  - branch_manager in SHIFT_WRITE_ROLES: ${branchManagerAllowed}`);
      console.log(`  - kitchen_operations in SHIFT_WRITE_ROLES: ${storekeeperAllowed}`);
      
      if (!superAdminAllowed && !branchManagerAllowed && storekeeperAllowed) {
        console.log('✅ PASS: super_admin and branch_manager are correctly blocked from write routes, while kitchen_operations remains allowed.');
      } else {
        console.log('❌ FAIL: super_admin or branch_manager still allowed in SHIFT_WRITE_ROLES!');
        throw new Error('Gating validation failure: admin/manager retain write route access!');
      }
    }

    // --- TEST 2: Add Shift Stock ---
    console.log('\n--- Test 2: Add Shift Stock (Stock Issue) Service-level Call ---');
    {
      const req = {
        params: { shift_id: shiftId },
        body: {
          items: [
            {
              sku: rawItemSku,
              quantity: 5,
              unit: 'kg',
              name: 'TEST Raw Ingredient',
              responsible_staff_ids: [userId]
            }
          ]
        },
        user: { id: userId, branch_id: branchId, role: 'branch_manager' }
      };

      await callHandler(addShiftStock, req);
      const ledgerRes = await client.query("SELECT additions FROM kitchen_shift_items WHERE shift_id = $1 AND item_sku = $2", [shiftId, rawItemSku]);
      const branchStockRes = await client.query("SELECT quantity FROM branch_stock WHERE branch_id = $1 AND item_sku = $2", [branchId, rawItemSku]);
      
      console.log(`  - Ledger Additions: ${ledgerRes.rows[0].additions}`);
      console.log(`  - Branch Stock:      ${branchStockRes.rows[0].quantity}`);

      if (parseFloat(ledgerRes.rows[0].additions) === 5.0 && parseFloat(branchStockRes.rows[0].quantity) === 95.0) {
        console.log('✅ PASS: addShiftStock controller deducted branch stock once and updated additions.');
      } else {
        console.log('❌ FAIL: addShiftStock assertions failed.');
      }
    }

    // --- TEST 3: Log Production with missing recipe standard ---
    console.log('\n--- Test 3: Log Production Event (Missing Recipe Block check) ---');
    const idempotencyKey = 'api-test-idemp-' + Date.now();
    {
      const req = {
        body: {
          kitchen_shift_id: shiftId,
          output_item_id: outputItemId,
          production_recipe_id: '00000000-0000-0000-0000-000000000000', // Non-existent recipe ID
          consumed_inputs: [
            {
              raw_item_id: rawItemId,
              quantity_used: 2.0,
              unit: 'kg'
            }
          ],
          actual_produced_qty: 4,
          output_unit: 'portion',
          produced_by: [userId],
          idempotency_key: idempotencyKey,
          reason_note: 'TEST_RUN'
        },
        user: {
          id: userId,
          branch_id: branchId,
          role: 'branch_manager',
          outlet_id: outletId
        }
      };

      let errorThrown = null;
      try {
        await callHandler(logProductionEvent, req);
      } catch (err) {
        errorThrown = err;
      }

      console.log('  - Error status code:', errorThrown ? errorThrown.statusCode : 'None');
      console.log('  - Error message:    ', errorThrown ? errorThrown.message : 'None');

      // Assertions
      const posRes = await client.query("SELECT current_stock FROM pos_outlet_items WHERE id = $1", [posOutletItemId]);
      const prodRes = await client.query("SELECT count(*) FROM kitchen_shift_production WHERE idempotency_key = $1", [idempotencyKey]);
      
      console.log(`  - POS Outlet Stock:  ${posRes.rows[0].current_stock} (expected: 10)`);
      console.log(`  - Production Log rows count: ${prodRes.rows[0].count} (expected: 0)`);

      const noStockCredited = parseFloat(posRes.rows[0].current_stock) === 10.0;
      const noRowInserted = parseInt(prodRes.rows[0].count, 10) === 0;

      if (errorThrown && errorThrown.message.includes('MISSING_RECIPE_STANDARD') && noStockCredited && noRowInserted) {
        console.log('✅ PASS: Missing recipe standard correctly blocks production logging, no stock credited, no rows inserted.');
      } else {
        console.log('❌ FAIL: Production logging gating checks failed or permitted write when recipe was missing.');
      }
    }

    // --- TEST 4: Idempotency Retry Returns Original Record ---
    console.log('\n--- Test 4: Idempotency Retry Service-level Call ---');
    {
      const mockIdempKey = 'mock-idemp-' + Date.now();
      // Manually insert mock completed production log into database with correct columns
      await client.query(`
        INSERT INTO kitchen_shift_production (
          shift_id, branch_id, recipe_id, 
          raw_item_sku, raw_item_name, raw_quantity_used, raw_unit, 
          produced_item_name, produced_item_sku, produced_quantity, produced_unit, 
          produced_by, idempotency_key, conversion_notes
        )
        VALUES ($1, $2, '00000000-0000-0000-0000-000000000000', 'TEST_RAW_01', 'TEST Raw Ingredient', 2.0, 'kg', 'TEST Produced Item', 'TEST_OUT_01', 4.0, 'portion', $3, $4, 'TEST_RUN')
      `, [shiftId, branchId, userId, mockIdempKey]);

      const req = {
        body: {
          kitchen_shift_id: shiftId,
          output_item_id: outputItemId,
          production_recipe_id: '00000000-0000-0000-0000-000000000000',
          consumed_inputs: [
            {
              raw_item_id: rawItemId,
              quantity_used: 2.0,
              unit: 'kg'
            }
          ],
          actual_produced_qty: 4,
          output_unit: 'portion',
          produced_by: [userId],
          idempotency_key: mockIdempKey,
          reason_note: 'TEST_RUN'
        },
        user: {
          id: userId,
          branch_id: branchId,
          role: 'branch_manager',
          outlet_id: outletId
        }
      };

      const res = await callHandler(logProductionEvent, req);

      console.log(`  - Response status code: ${res.statusCode}`);
      console.log(`  - Returned original record ID: ${res.body.data.idempotency_key === mockIdempKey ? 'Matched' : 'Mismatch'}`);

      if (res.statusCode === 200 && res.body.data.idempotency_key === mockIdempKey) {
        console.log('✅ PASS: Idempotent request returned original record instead of inserting duplicate.');
      } else {
        console.log('❌ FAIL: Idempotent request failed.');
      }
    }

    // --- TEST 5: Multi-Input Blocked ---
    console.log('\n--- Test 5: Multi-Input Recipe Blocked Service-level Call ---');
    {
      const req = {
        body: {
          kitchen_shift_id: shiftId,
          output_item_id: outputItemId,
          production_recipe_id: '00000000-0000-0000-0000-000000000000',
          consumed_inputs: [
            { raw_item_id: rawItemId, quantity_used: 2.0, unit: 'kg' },
            { raw_item_id: rawItemId, quantity_used: 1.0, unit: 'kg' }
          ],
          actual_produced_qty: 8,
          output_unit: 'portion',
          produced_by: [userId],
          idempotency_key: 'idemp-multi-' + Date.now(),
          reason_note: 'TEST_RUN'
        },
        user: {
          id: userId,
          branch_id: branchId,
          role: 'branch_manager',
          outlet_id: outletId
        }
      };

      let errorThrown = null;
      try {
        await callHandler(logProductionEvent, req);
      } catch (e) {
        errorThrown = e;
      }

      console.log(`  - Caught expected error: ${errorThrown ? errorThrown.message : 'None'}`);

      if (errorThrown && errorThrown.message.includes('MULTI_INPUT_RECIPE_BLOCKED')) {
        console.log('✅ PASS: Multi-input production request correctly rejected with MULTI_INPUT_RECIPE_BLOCKED.');
      } else {
        console.log('❌ FAIL: Allowed multi-input production request or did not throw correct block error.');
      }
    }

  } catch (error) {
    console.error('❌ Service/Controller test script run failed:', error);
  } finally {
    // Restore original user branch_id
    if (userId && originalBranchId !== null) {
      console.log(`Restoring User ID ${userId} to original branch_id ${originalBranchId}...`);
      await client.query("UPDATE users SET branch_id = $1 WHERE id = $2", [originalBranchId, userId]);
      const verifyRes = await client.query("SELECT branch_id FROM users WHERE id = $1", [userId]);
      const finalBranchId = verifyRes.rows[0].branch_id;
      
      console.log('\n--- Production Test User Restoration Verification ---');
      console.log(`User ID: ${userId}`);
      console.log(`branch_id after cleanup: ${finalBranchId}`);
      console.log(`expected original branch_id: ${originalBranchId}`);
      if (Number(finalBranchId) === Number(originalBranchId)) {
        console.log('✅ restored');
      } else {
        console.log('❌ RESTORATION FAILED!');
        throw new Error('User branch restoration verification failed!');
      }
      console.log('-----------------------------------------------------\n');
    }

    // Cleanup test records
    console.log('\n--- Cleaning up API Test Scenario Data ---');
    try {
      await client.query("DELETE FROM pastry_production_log WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
      await client.query("DELETE FROM kitchen_shift_approvals WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
      await client.query("DELETE FROM kitchen_shift_production WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
      await client.query("DELETE FROM kitchen_shift_production WHERE conversion_notes = 'TEST_RUN'");
      await client.query("DELETE FROM kitchen_shift_additions WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
      await client.query("DELETE FROM kitchen_shift_items WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
      await client.query("DELETE FROM pos_outlet_items WHERE source_item_id IN (SELECT id::text FROM inventory_items WHERE sku LIKE 'TEST_%')");
      await client.query("DELETE FROM kitchen_production_recipes WHERE raw_item_sku IN (SELECT sku FROM inventory_items WHERE sku LIKE 'TEST_%')");
      await client.query("DELETE FROM branch_stock WHERE item_sku LIKE 'TEST_%'");
      await client.query("DELETE FROM inventory_balances WHERE item_id IN (SELECT id FROM inventory_items WHERE sku LIKE 'TEST_%')");
      if (userId) {
        await client.query("DELETE FROM stock_count_items WHERE stock_count_id IN (SELECT id FROM stock_counts WHERE created_by = $1)", [userId]);
        await client.query("DELETE FROM stock_counts WHERE created_by = $1", [userId]);
      }
      await client.query("DELETE FROM stock_count_items WHERE stock_count_id IN (SELECT id FROM stock_counts WHERE branch_id IN (2, 5))");
      await client.query("DELETE FROM stock_counts WHERE branch_id IN (2, 5)");
      await client.query("DELETE FROM kitchen_shift_pos_consumption WHERE shift_id IN (SELECT id FROM kitchen_shifts WHERE branch_id IN (2, 5))");
      await client.query("DELETE FROM kitchen_shifts WHERE branch_id IN (2, 5)");
      if (cashierShiftId) {
        await client.query("DELETE FROM cashier_shift_logs WHERE id = $1", [cashierShiftId]);
      }
      await client.query("DELETE FROM branch_shift_config WHERE branch_id IN (1, 2, 3, 4, 5, 9, 10) AND effective_from_business_date = '2026-07-08'");
      console.log('✅ Test scenario data successfully cleaned up.');
    } catch (cleanupErr) {
      console.error('❌ Error during cleanup query execution:', cleanupErr.message);
    }

    await client.end();
  }
}

runTests();
