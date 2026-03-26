const { Client } = require('pg');
const fs = require('fs');

async function backup() {
    const client = new Client({ connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres' });
    await client.connect();
    const res = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    const tables = res.rows.map(r => r.tablename);
    const backupData = {};
    for (const table of tables) {
        console.log('Backing up ' + table + '...');
        const dataRes = await client.query('SELECT * FROM "' + table + '"');
        backupData[table] = dataRes.rows;
    }
    fs.writeFileSync('db_backup.json', JSON.stringify(backupData, null, 2));
    console.log('Backup saved to db_backup.json');
    await client.end();
}
backup().catch(console.error);
