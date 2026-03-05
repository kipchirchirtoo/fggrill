const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixRestaurantSchemaCache() {
  console.log('🔧 Fixing restaurant schema cache relationships...\n');

  try {
    // Check if restaurant_reservations table exists
    const { data: reservations, error: resError } = await supabase
      .from('restaurant_reservations')
      .select('*')
      .limit(1);

    if (resError) {
      console.error('❌ Error accessing restaurant_reservations:', resError.message);
      return;
    }

    console.log('✅ restaurant_reservations table accessible');

    // Check if restaurant_customers table exists
    const { data: customers, error: custError } = await supabase
      .from('restaurant_customers')
      .select('*')
      .limit(1);

    if (custError) {
      console.error('❌ Error accessing restaurant_customers:', custError.message);
      return;
    }

    console.log('✅ restaurant_customers table accessible');

    // Try to query with the relationship
    const { data: testData, error: testError } = await supabase
      .from('restaurant_reservations')
      .select(`
        *,
        customer:restaurant_customers(*)
      `)
      .limit(1);

    if (testError) {
      console.error('❌ Relationship query failed:', testError.message);
      console.log('\n📋 This is a schema cache issue in the backend.');
      console.log('The backend needs to be restarted to refresh the schema cache.');
    } else {
      console.log('✅ Relationship query successful!');
      console.log('Schema cache is working correctly.');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

fixRestaurantSchemaCache();
