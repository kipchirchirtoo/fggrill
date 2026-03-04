/**
 * FIX POS PINS IMMEDIATELY
 * Set POS PINs for all users based on their roles
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://utsvlihpudfraxzcmtle.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY'
);

async function fixPOSPins() {
  console.log('🔧 FIXING POS PINS FOR ALL USERS\n');
  
  try {
    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, role, pos_pin')
      .order('email');
    
    if (usersError) {
      console.error('❌ Failed to get users:', usersError.message);
      return;
    }
    
    console.log(`Found ${users.length} users\n`);
    
    // PIN assignment logic
    const pinAssignments = {
      // Restaurant staff - R prefix
      'restaurant': 'R1001',
      'restaurant_manager': 'R1002',
      'head_chef': 'R1003',
      'sous_chef': 'R1004',
      'line_cook': 'R1005',
      'prep_cook': 'R1006',
      'waiter': 'R1007',
      'waitress': 'R1008',
      'head_waiter': 'R1009',
      'food_runner': 'R1010',
      'busser': 'R1011',
      'host_hostess': 'R1012',
      'pos_kitchen': 'R1013',
      'kitchen': 'R1014',
      'kitchen_helper': 'R1015',
      'dishwasher': 'R1016',
      
      // Bar staff - B prefix
      'barmaid': 'B2001',
      'barman': 'B2002',
      'bartender': 'B2003',
      'barista': 'B2004',
      'bar_manager': 'B2005',
      
      // Cashier/Finance - C prefix
      'cashier': 'C3001',
      'accountant': 'C3002',
      'kyogong_spa_cashier': 'C3003',
      'kyogong_executive_bar_cashier': 'C3004',
      'kyogong_sports_bar_cashier': 'C3005',
      'kyogong_reception_cashier': 'C3006',
      
      // Management - Can use any prefix
      'manager': 'C4001',
      'branch_manager': 'C4002',
      'super_admin': 'C4003',
      
      // Other roles
      'reception': 'R5001',
      'hr': 'C5002',
      'auditor': 'C5003',
      'centralstore': 'R5004',
      'branchstore': 'R5005'
    };
    
    let successCount = 0;
    let failCount = 0;
    
    for (const user of users) {
      const pin = pinAssignments[user.role] || `R${9000 + successCount}`;
      
      try {
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            pos_pin: pin,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (updateError) {
          console.error(`❌ ${user.email} (${user.role}): ${updateError.message}`);
          failCount++;
        } else {
          console.log(`✅ ${user.email} (${user.role}) → PIN: ${pin}`);
          successCount++;
        }
      } catch (err) {
        console.error(`❌ ${user.email}: ${err.message}`);
        failCount++;
      }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total users: ${users.length}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log('\n📋 PIN ASSIGNMENTS:');
    console.log('   Restaurant staff: R1001-R1016');
    console.log('   Bar staff: B2001-B2005');
    console.log('   Cashiers: C3001-C3006');
    console.log('   Management: C4001-C4003');
    console.log('   Other: R5001-R5005');
    console.log('\n⚠️  Users can now login with their assigned PINs!');
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
  }
}

fixPOSPins().catch(console.error);
