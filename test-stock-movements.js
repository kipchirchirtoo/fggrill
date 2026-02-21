const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://utsvlihpudfraxzcmtle.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY'
);

async function testStockMovements() {
  console.log('Testing stock movements API...\n');
  
  // Get movements for branch 1
  const { data: movements, error } = await supabase
    .from('branch_stock_movements')
    .select('*')
    .eq('branch_id', 1)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Sample movements:');
  console.log(JSON.stringify(movements, null, 2));
}

testStockMovements();
