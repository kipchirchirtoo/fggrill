const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'reception_db_structure.json'), 'utf8'));

for (const [table, info] of Object.entries(data)) {
  console.log(`=== TABLE: ${table} (Rows: ${info.rowCount}) ===`);
  console.log('Columns:');
  info.columns.forEach(c => {
    console.log(`  - ${c.column_name}: ${c.data_type} ${c.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${c.column_default ? 'DEFAULT ' + c.column_default : ''}`);
  });
  if (info.foreignKeys.length > 0) {
    console.log('Foreign Keys:');
    info.foreignKeys.forEach(fk => {
      console.log(`  - ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });
  }
  console.log('\n');
}
