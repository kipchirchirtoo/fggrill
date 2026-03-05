const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testPOFunction() {
    console.log('Testing generate_po_number function...\n');
    
    const { data, error } = await supabase.rpc('generate_po_number');
    
    if (error) {
        console.error('❌ Error:', error);
        console.log('\n📋 Please run this SQL in Supabase SQL Editor:');
        console.log('---');
        console.log(require('fs').readFileSync('create-po-function-fixed.sql', 'utf8'));
        console.log('---');
    } else {
        console.log('✓ Function works! Generated PO number:', data);
    }
}

testPOFunction();
