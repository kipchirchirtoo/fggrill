const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixPONumberFunction() {
    try {
        console.log('Creating/updating generate_po_number function...');

        const { data, error } = await supabase.rpc('exec_sql', {
            sql: `
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
  
  SELECT COALESCE(MAX(SUBSTRING(po_number FROM '\\d+$')::INT), 0) + 1
  INTO counter
  FROM store_purchase_orders
  WHERE po_number LIKE 'PO-' || year || month || '-%';
  
  po_number := 'PO-' || year || month || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN po_number;
END;
$$ LANGUAGE plpgsql;
            `
        });

        if (error) {
            console.error('Error creating function:', error);
            
            // Try direct SQL execution
            console.log('\nTrying direct SQL execution...');
            const sql = `
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
  
  SELECT COALESCE(MAX(SUBSTRING(po_number FROM '\\d+$')::INT), 0) + 1
  INTO counter
  FROM store_purchase_orders
  WHERE po_number LIKE 'PO-' || year || month || '-%';
  
  po_number := 'PO-' || year || month || '-' || LPAD(counter::TEXT, 4, '0');
  RETURN po_number;
END;
$$ LANGUAGE plpgsql;
            `;

            const { error: directError } = await supabase.rpc('exec', { sql });
            
            if (directError) {
                console.error('Direct execution also failed:', directError);
                console.log('\n=== MANUAL SQL TO RUN ===');
                console.log(sql);
                console.log('=== END SQL ===\n');
            } else {
                console.log('✓ Function created successfully via direct execution');
            }
        } else {
            console.log('✓ Function created successfully');
        }

        // Test the function
        console.log('\nTesting function...');
        const { data: testData, error: testError } = await supabase.rpc('generate_po_number');
        
        if (testError) {
            console.error('Error testing function:', testError);
        } else {
            console.log('✓ Function test successful. Generated PO number:', testData);
        }

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

fixPONumberFunction();
