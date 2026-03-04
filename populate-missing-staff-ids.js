require('dotenv').config({ path: 'backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function populateMissingStaffIds() {
  console.log('🔧 Populating Missing staff_id Values\n');
  console.log('='.repeat(80));

  try {
    // 1. Check records with NULL staff_id
    console.log('\n📋 Step 1: Finding records with NULL staff_id...');
    
    const nullStaffCredit = await pool.query(`
      SELECT id, description, date
      FROM staff_credit_bills
      WHERE staff_id IS NULL
      ORDER BY date DESC;
    `);

    const nullStaffAdvances = await pool.query(`
      SELECT id, reason, request_date
      FROM staff_advances
      WHERE staff_id IS NULL
      ORDER BY request_date DESC;
    `);

    const nullStaffLoans = await pool.query(`
      SELECT id, reason, start_date
      FROM staff_loans
      WHERE staff_id IS NULL
      ORDER BY start_date DESC;
    `);

    console.log(`\nRecords with NULL staff_id:`);
    console.log(`  Credit Bills: ${nullStaffCredit.rows.length}`);
    console.log(`  Advances: ${nullStaffAdvances.rows.length}`);
    console.log(`  Loans: ${nullStaffLoans.rows.length}`);

    // 2. Get all staff profiles for matching
    console.log('\n📋 Step 2: Loading staff profiles...');
    
    const staffProfiles = await pool.query(`
      SELECT 
        sp.id,
        sp.first_name,
        sp.last_name,
        UPPER(sp.first_name || ' ' || sp.last_name) as full_name_upper
      FROM staff_profiles sp
      WHERE sp.status = 'active';
    `);

    console.log(`  Found ${staffProfiles.rows.length} active staff members`);

    // 3. Try to match and update credit bills
    console.log('\n📋 Step 3: Matching credit bills...');
    
    let creditUpdated = 0;
    for (const record of nullStaffCredit.rows) {
      // Extract name from description
      const match = record.description.match(/- ([A-Z\s]+)$/);
      if (match) {
        const nameInDesc = match[1].trim();
        
        // Find matching staff
        const staff = staffProfiles.rows.find(s => 
          s.full_name_upper === nameInDesc ||
          s.full_name_upper.includes(nameInDesc) ||
          nameInDesc.includes(s.full_name_upper)
        );

        if (staff) {
          await pool.query(`
            UPDATE staff_credit_bills
            SET staff_id = $1
            WHERE id = $2;
          `, [staff.id, record.id]);
          
          console.log(`  ✓ Matched "${nameInDesc}" → ${staff.first_name} ${staff.last_name}`);
          creditUpdated++;
        } else {
          console.log(`  ✗ No match for "${nameInDesc}"`);
        }
      }
    }

    // 4. Try to match and update advances
    console.log('\n📋 Step 4: Matching advances...');
    
    let advancesUpdated = 0;
    for (const record of nullStaffAdvances.rows) {
      const match = record.reason?.match(/- ([A-Z\s]+)$/);
      if (match) {
        const nameInReason = match[1].trim();
        
        const staff = staffProfiles.rows.find(s => 
          s.full_name_upper === nameInReason ||
          s.full_name_upper.includes(nameInReason) ||
          nameInReason.includes(s.full_name_upper)
        );

        if (staff) {
          await pool.query(`
            UPDATE staff_advances
            SET staff_id = $1
            WHERE id = $2;
          `, [staff.id, record.id]);
          
          console.log(`  ✓ Matched "${nameInReason}" → ${staff.first_name} ${staff.last_name}`);
          advancesUpdated++;
        }
      }
    }

    // 5. Try to match and update loans
    console.log('\n📋 Step 5: Matching loans...');
    
    let loansUpdated = 0;
    for (const record of nullStaffLoans.rows) {
      const match = record.reason?.match(/- ([A-Z\s]+)$/);
      if (match) {
        const nameInReason = match[1].trim();
        
        const staff = staffProfiles.rows.find(s => 
          s.full_name_upper === nameInReason ||
          s.full_name_upper.includes(nameInReason) ||
          nameInReason.includes(s.full_name_upper)
        );

        if (staff) {
          await pool.query(`
            UPDATE staff_loans
            SET staff_id = $1
            WHERE id = $2;
          `, [staff.id, record.id]);
          
          console.log(`  ✓ Matched "${nameInReason}" → ${staff.first_name} ${staff.last_name}`);
          loansUpdated++;
        }
      }
    }

    // 6. Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ UPDATE COMPLETE');
    console.log('='.repeat(80));
    console.log(`\nRecords updated:`);
    console.log(`  Credit Bills: ${creditUpdated} / ${nullStaffCredit.rows.length}`);
    console.log(`  Advances: ${advancesUpdated} / ${nullStaffAdvances.rows.length}`);
    console.log(`  Loans: ${loansUpdated} / ${nullStaffLoans.rows.length}`);
    console.log(`\nTotal: ${creditUpdated + advancesUpdated + loansUpdated} records updated`);
    
    const remaining = (nullStaffCredit.rows.length - creditUpdated) + 
                     (nullStaffAdvances.rows.length - advancesUpdated) + 
                     (nullStaffLoans.rows.length - loansUpdated);
    
    if (remaining > 0) {
      console.log(`\n⚠️  ${remaining} records still have NULL staff_id`);
      console.log('   These records either:');
      console.log('   - Have no name pattern in description/reason');
      console.log('   - Have names that don\'t match any active staff');
      console.log('   - Need manual review');
    }

    console.log('\n🚀 Next steps:');
    console.log('   1. Refresh the staff audit page');
    console.log('   2. Verify staff names are now showing correctly');
    console.log('   3. Review any remaining "Unknown Staff" entries\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

populateMissingStaffIds();
