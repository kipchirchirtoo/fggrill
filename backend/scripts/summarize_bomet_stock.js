const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'bomet_stock_full_report.json'), 'utf-8'));

console.log('=== BOMET TOWN STORE STOCK SUMMARY ===');
console.log('Total Branch Stock Items Registered:', data.branch_stock.length);
console.log('Total Bar Stock Items Registered:', data.bar_stock.length);
console.log('Total Inventory Items Registered:', data.inventory_items.length);

// Check unresolved items in branch_stock
const unres = data.branch_stock.filter(i => i.category === 'UNCATEGORIZED');
console.log('\nUncategorized items in branch_stock:', unres.length);
console.table(unres);

// Category breakdown of all branch_stock
const catMap = {};
for (const item of data.branch_stock) {
  const cat = item.category || 'UNCATEGORIZED';
  if (!catMap[cat]) {
    catMap[cat] = {
      total_items: 0,
      items_with_stock: 0,
      total_current_stock: 0,
      total_store_qty: 0,
      sample_items: []
    };
  }
  catMap[cat].total_items++;
  if (item.current_stock > 0 || item.store_quantity > 0) {
    catMap[cat].items_with_stock++;
  }
  catMap[cat].total_current_stock += item.current_stock;
  catMap[cat].total_store_qty += item.store_quantity;
  if (catMap[cat].sample_items.length < 3) {
    catMap[cat].sample_items.push(`${item.name} (${item.sku}): cur=${item.current_stock}, store=${item.store_quantity} ${item.unit}`);
  }
}

console.log('\n=== BRANCH STOCK CATEGORY BREAKDOWN ===');
for (const [cat, stats] of Object.entries(catMap).sort((a,b) => b[1].total_items - a[1].total_items)) {
  console.log(`\n--- ${cat} (Total Items: ${stats.total_items} | With Stock > 0: ${stats.items_with_stock}) ---`);
  console.log(`    Current Stock: ${stats.total_current_stock} | Store Quantity: ${stats.total_store_qty}`);
  stats.sample_items.forEach(s => console.log(`    * ${s}`));
}

// Also check Bar Stock summary
console.log('\n=== BAR STOCK (Total Registered: ' + data.bar_stock.length + ') ===');
const barWithStock = data.bar_stock.filter(b => parseFloat(b.current_stock) > 0);
console.log('Bar Stock items with stock > 0:', barWithStock.length);
const barTotalUnits = data.bar_stock.reduce((sum, b) => sum + parseFloat(b.current_stock || 0), 0);
console.log('Bar Stock Total Units on Floor:', barTotalUnits);
