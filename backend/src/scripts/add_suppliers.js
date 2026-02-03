require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const suppliers = [
    { name: 'Kenya Meat Commission', person: 'John Doe', phone: '0711000111', vat: 'P051000000X' },
    { name: 'Brookside Dairy', person: 'Jane Smith', phone: '0711000222', vat: 'P051000011B' },
    { name: 'Kenchic Ltd', person: 'Alice King', phone: '0711000333', vat: 'P051000022K' },
    { name: 'Farmer\'s Choice', person: 'Bob Mart', phone: '0711000444', vat: 'P051000033F' },
    { name: 'Unilever Kenya', person: 'Charlie Pave', phone: '0711000555', vat: 'P051000044U' },
    { name: 'East African Breweries', person: 'Dave Brew', phone: '0711000666', vat: 'P051000055E' }
];

async function addSuppliers() {
    console.log('Adding test suppliers to store_suppliers...');

    for (const s of suppliers) {
        const { data: existing } = await supabase
            .from('store_suppliers')
            .select('id')
            .eq('name', s.name)
            .maybeSingle();

        if (existing) {
            console.log(`Supplier ${s.name} already exists.`);
            continue;
        }

        const { data: code } = await supabase.rpc('generate_supplier_code');
        const supplierCode = code || `SUP${Math.floor(Math.random() * 100000)}`;

        const { data, error } = await supabase
            .from('store_suppliers')
            .insert({
                supplier_code: supplierCode,
                name: s.name,
                contact_person: s.person,
                phone: s.phone,
                vat_number: s.vat,
                status: 'active',
                payment_terms: 'credit_30_days',
                country: 'Kenya',
                created_at: new Date().toISOString()
            })
            .select();

        if (error) console.error(`Error adding ${s.name}:`, error.message);
        else console.log(`Added ${s.name} (${data[0].id})`);
    }
}

addSuppliers();
