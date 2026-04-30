#!/usr/bin/env node

/**
 * Test script for Financial Workspace functionality
 * Tests saving and retrieving daily financial records
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testFinancialWorkspace() {
  console.log('🧪 Testing Financial Workspace...\n');

  try {
    // 1. Get branches
    console.log('1️⃣ Fetching branches...');
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('id, name')
      .limit(1);

    if (branchError) throw branchError;
    if (!branches || branches.length === 0) {
      console.log('❌ No branches found. Please create a branch first.');
      return;
    }

    const testBranch = branches[0];
    console.log(`✅ Using branch: ${testBranch.name} (ID: ${testBranch.id})\n`);

    // 2. Create a test daily record
    console.log('2️⃣ Creating test daily financial record...');
    const testDate = new Date().toISOString().split('T')[0];
    
    const testRecord = {
      branch_id: testBranch.id,
      record_date: testDate,
      status: 'DRAFT',
      revenue_data: {
        restaurant: 15000,
        bar: 8000,
        pool: 2000,
        rooms: 25000,
        other: 5000
      },
      total_revenue: 55000,
      payment_data: {
        cash: 20000,
        mpesa: 25000,
        card: 10000
      },
      total_payments: 55000,
      banking_data: {
        banked: 18000,
        account: 'KCB - 1234567890',
        ref: 'TR-TEST-001'
      },
      expected_cash: 20000,
      unbanked_cash: 2000,
      cogs_data: {
        opening: 10000,
        central: 5000,
        deliveries: 3000,
        closing: 8000
      },
      total_cogs: 10000,
      expense_data: {
        petty_cash: 2000,
        suppliers: 3000,
        transaction: 500,
        wastage: 200,
        shorts: 100,
        credit: 1000,
        other: 500
      },
      total_expenses: 7300,
      net_profit: 37700,
      notes: 'Test record created by test script'
    };

    const { data: savedRecord, error: saveError } = await supabase
      .from('daily_financial_records')
      .upsert(testRecord, { onConflict: 'branch_id,record_date' })
      .select()
      .single();

    if (saveError) throw saveError;
    console.log(`✅ Record saved successfully!`);
    console.log(`   ID: ${savedRecord.id}`);
    console.log(`   Date: ${savedRecord.record_date}`);
    console.log(`   Revenue: KES ${savedRecord.total_revenue.toLocaleString()}`);
    console.log(`   Net Profit: KES ${savedRecord.net_profit.toLocaleString()}\n`);

    // 3. Retrieve the record
    console.log('3️⃣ Retrieving daily records...');
    const { data: records, error: fetchError } = await supabase
      .from('daily_financial_records')
      .select('*')
      .eq('branch_id', testBranch.id)
      .order('record_date', { ascending: false })
      .limit(5);

    if (fetchError) throw fetchError;
    console.log(`✅ Found ${records.length} record(s):`);
    records.forEach(rec => {
      console.log(`   - ${rec.record_date}: KES ${Number(rec.total_revenue).toLocaleString()} revenue, ${rec.status}`);
    });
    console.log('');

    // 4. Test monthly adjustments
    console.log('4️⃣ Creating test monthly adjustment...');
    const currentDate = new Date();
    const testAdjustment = {
      branch_id: testBranch.id,
      fiscal_year: currentDate.getFullYear(),
      fiscal_month: currentDate.getMonth() + 1,
      electricity: 15000,
      salaries: 250000,
      water: 8000,
      rent: 50000,
      nssf: 12000,
      shif: 8000,
      tax: 20000,
      levy: 5000,
      licenses: 3000,
      total_monthly_expenses: 371000,
      monthly_profit: 100000
    };

    const { data: savedAdjustment, error: adjError } = await supabase
      .from('monthly_financial_adjustments')
      .upsert(testAdjustment, { onConflict: 'branch_id,fiscal_year,fiscal_month' })
      .select()
      .single();

    if (adjError) throw adjError;
    console.log(`✅ Monthly adjustment saved!`);
    console.log(`   Period: ${savedAdjustment.fiscal_year}-${String(savedAdjustment.fiscal_month).padStart(2, '0')}`);
    console.log(`   Total Expenses: KES ${Number(savedAdjustment.total_monthly_expenses).toLocaleString()}\n`);

    // 5. Test director dashboard query
    console.log('5️⃣ Testing director dashboard query...');
    const { data: directorData, error: directorError } = await supabase
      .from('daily_financial_records')
      .select('total_revenue, total_expenses, net_profit, record_date, branch_id, branches(name)');

    if (directorError) throw directorError;
    
    const totalRevenue = directorData.reduce((sum, rec) => sum + Number(rec.total_revenue || 0), 0);
    const totalExpenses = directorData.reduce((sum, rec) => sum + Number(rec.total_expenses || 0), 0);
    const netProfit = directorData.reduce((sum, rec) => sum + Number(rec.net_profit || 0), 0);

    console.log(`✅ Director Dashboard Summary:`);
    console.log(`   Total Revenue: KES ${totalRevenue.toLocaleString()}`);
    console.log(`   Total Expenses: KES ${totalExpenses.toLocaleString()}`);
    console.log(`   Net Profit: KES ${netProfit.toLocaleString()}`);
    console.log(`   Records: ${directorData.length}\n`);

    console.log('✅ All tests passed! Financial workspace is working correctly.\n');
    console.log('📊 Next steps:');
    console.log('   1. Branch accountants can now enter daily financial data');
    console.log('   2. Data will automatically appear in director dashboard');
    console.log('   3. Access at: /dashboard/branch-accountant/financial-workspace');
    console.log('   4. View in director at: /dashboard/director\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  }
}

testFinancialWorkspace();
