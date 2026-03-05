const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getSuppliers() {
    const { data, error } = await supabase
        .from('store_suppliers')
        .select('id, name, supplier_code')
        .limit(5);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Suppliers:');
        data.forEach(s => console.log(`  ${s.name} (${s.supplier_code}): ${s.id}`));
    }
}

getSuppliers();
