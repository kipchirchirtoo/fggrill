const {Client}=require('pg');
require('dotenv').config({path:'./backend/.env'});
const c=new Client({connectionString:process.env.DATABASE_URL});
c.connect()
  .then(()=>c.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='stock_takes' ORDER BY ordinal_position"))
  .then(r=>{
    console.log('Stock_takes columns:');
    r.rows.forEach(row=>console.log(`  ${row.column_name}: ${row.data_type}`));
    c.end();
  })
  .catch(e=>{
    console.error(e.message);
    process.exit(1);
  });
