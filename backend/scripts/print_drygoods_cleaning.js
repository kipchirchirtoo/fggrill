const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'bomet_drygoods_cleaning_analysis.json'), 'utf-8'));

console.log('=== DRY GOODS (Master: 216, All Registered in Bomet) ===');
console.log('Sample Dry Goods with positive stock (first 25):');
const withStock = data.dry_goods.filter(d => d.current_stock > 0 || d.store_quantity > 0)
  .sort((a,b) => (b.current_stock + b.store_quantity) - (a.current_stock + a.store_quantity));

console.table(withStock.slice(0, 25).map(d => ({
  sku: d.master_sku,
  name: d.name,
  current: d.current_stock,
  store: d.store_quantity,
  unit: d.unit,
  cost: d.master_cost,
  retail: d.master_retail
})));

console.log('\n=== CLEANING MATERIALS (Master: 6, All Registered in Bomet) ===');
console.table(data.cleaning_materials.map(c => ({
  sku: c.master_sku,
  name: c.name,
  current: c.current_stock,
  store: c.store_quantity,
  unit: c.unit,
  cost: c.master_cost
})));
