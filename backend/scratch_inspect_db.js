const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load .env from backend directory
const backendDir = 'c:\\Users\\user\\OneDrive\\Desktop\\fggrill\\backend';
dotenv.config({ path: path.join(backendDir, '.env') });

const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in env!');
  console.error('SUPABASE_URL:', supabaseUrl);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      return { exists: false, count: 0, error: error.message };
    }
    return { exists: true, count: count ?? 0 };
  } catch (err) {
    return { exists: false, count: 0, error: err.message };
  }
}

async function getSummary(tableName, groupField) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select(groupField);
    
    if (error) return {};
    
    const summary = {};
    for (const row of data || []) {
      const val = String(row[groupField]);
      summary[val] = (summary[val] || 0) + 1;
    }
    return summary;
  } catch (err) {
    return {};
  }
}

async function getRecent(tableName, orderField, limit = 3) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(orderField, { ascending: false })
      .limit(limit);
    
    if (error) return [];
    return data || [];
  } catch (err) {
    return [];
  }
}

async function run() {
  console.log('=== Live DB Accountant Module Audit ===');
  console.log(`URL: ${supabaseUrl}`);

  const tables = [
    { name: 'daily_financial_records', group: 'status', order: 'record_date' },
    { name: 'monthly_financial_adjustments', group: 'fiscal_year', order: 'created_at' },
    { name: 'director_review_tasks', group: 'status', order: 'created_at' },
    { name: 'financial_workspace_submissions', group: 'status', order: 'record_date' },
    { name: 'financial_daily_snapshots', group: 'snapshot_date', order: 'snapshot_date' },
    { name: 'payroll_batches', group: 'status', order: 'period_year' },
    { name: 'payroll_batch_lines', group: 'designation', order: 'created_at' },
    { name: 'staff_credit_bills', group: 'status', order: 'bill_date' },
    { name: 'cashier_shift_logs', group: 'branch_id', order: 'shift_start' }
  ];

  const results = {};

  for (const t of tables) {
    console.log(`\nAuditing table: ${t.name}...`);
    const status = await checkTable(t.name);
    
    if (!status.exists) {
      console.log(`❌ Table ${t.name} does not exist or error: ${status.error}`);
      results[t.name] = { exists: false, error: status.error };
      continue;
    }

    console.log(`✅ Table ${t.name} exists. Row count: ${status.count}`);
    const summary = t.group ? await getSummary(t.name, t.group) : null;
    if (summary && Object.keys(summary).length > 0) {
      console.log('Group Summary:', summary);
    }

    const recent = t.order ? await getRecent(t.name, t.order, 2) : [];
    if (recent.length > 0) {
      console.log(`Recent 2 entries:`, recent.map(r => {
        // truncate fields to make summary readable
        const copy = { ...r };
        for (const k of Object.keys(copy)) {
          if (copy[k] && typeof copy[k] === 'object') copy[k] = '{...}';
          if (copy[k] && String(copy[k]).length > 60) copy[k] = String(copy[k]).substring(0, 57) + '...';
        }
        return copy;
      }));
    }

    results[t.name] = {
      exists: true,
      count: status.count,
      summary,
      recent: recent.slice(0, 1) // save 1 sample
    };
  }

  // write results to JSON in backend directory for check
  const outputPath = path.join(backendDir, 'accountant_db_inspection.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nInspection complete! Results written to ${outputPath}`);
}

run();
