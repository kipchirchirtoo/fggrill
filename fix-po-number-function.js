const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixPONumberFunction() {
  console.log('Fixing generate_po_number function...');

  const sql = `
-- Drop old function if exists
DROP FUNCTION IF EXISTS generate_po_number();

-- Create corrected function that references store_purchase_orders table
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
  year TEXT;
  month TEXT;
  counter INT;
  po_number TEXT;
BEGIN
  year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  
  -- Fixed: Changed from purchase_orders to store_purchase_orders
  SELECT COALESCE(MAX(SUBSTRING(po_number FROM '\\d+$')::INT), 0) + 1
  INTO counter
  FROM store_purchase_orders
  WHERE po_number LIKE 'PO-' || year || month || '-%';
  
  po_number := 'PO-' || year || month || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN po_number;
END;
$$ LANGUAGE plpgsql;
`;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('Error executing SQL:', error);
      
      // Try direct execution
      console.log('Trying direct execution...');
      const { error: directError } = await supabase.from('_sql').insert({ query: sql });
      
      if (directError) {
        console.error('Direct execution also failed:', directError);
        console.log('\n=== MANUAL FIX REQUIRED ===');
        console.log('Run this SQL in Supabase SQL Editor:\n');
        console.log(sql);
        return;
      }
    }

    console.log('✅ Function fixed successfully!');
    
    // Test the function
    console.log('\nTesting function...');
    const { data: testResult, error: testError } = await supabase.rpc('generate_po_number');
    
    if (testError) {
      console.error('Test failed:', testError);
    } else {
      console.log('✅ Test successful! Generated PO number:', testResult);
    }

  } catch (err) {
    console.error('Unexpected error:', err);
    console.log('\n=== MANUAL FIX REQUIRED ===');
    console.log('Run this SQL in Supabase SQL Editor:\n');
    console.log(sql);
  }
}

fixPONumberFunction();
