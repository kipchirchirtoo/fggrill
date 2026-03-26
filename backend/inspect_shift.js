const { Client } = require('pg');
const fs = require('fs');

async function inspect() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();

    const res = await client.query("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'valid_shift'");
    
    if (res.rows.length === 0) {
        fs.writeFileSync('constraint_shift.txt', 'Constraint not found');
    } else {
        fs.writeFileSync('constraint_shift.txt', res.rows[0].pg_get_constraintdef);
    }
    
    await client.end();
}
inspect().catch(console.error);
