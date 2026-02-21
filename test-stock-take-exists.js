const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_PROJECT_URL,
  process.env.SUPABASE_ANON_KEY
);

async function checkStockTake() {
  const stockTakeId = '36053b04-1fc4-475f-a286-049fec61ad26';
  
  console.log('Checking for stock take:', stockTakeId);
  
  // Check in stock_counts table
  const { data, error } = await supabase
    .from('stock_counts')
    .select('*')
    .eq('id', stockTakeId)
    .single();
  
  if (error) {
    console.error('Error:', error);
    if (error.code === 'PGRST116') {
      console.log('\n❌ Stock take NOT FOUND in database');
      
      // List all stock takes
      const { data: allStockTakes } = await supabase
        .from('stock_counts')
        .select('id, count_date, status, branch_id')
        .order('count_date', { ascending: false })
        .limit(10);
      
      console.log('\nAvailable stock takes:');
      allStockTakes?.forEach(st => {
        console.log(`  - ID: ${st.id}`);
        console.log(`    Date: ${st.count_date}`);
        console.log(`    Status: ${st.status}`);
        console.log(`    Branch: ${st.branch_id}\n`);
      });
    }
  } else {
    console.log('\n✅ Stock take FOUND:');
    console.log(JSON.stringify(data, null, 2));
  }
}

checkStockTake().catch(console.error);
