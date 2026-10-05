const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'bomet_stock_full_report.json'), 'utf-8'));

// Fix uncategorized items
const fixes = {
  '500ml Mineral Water': { name: 'Mineral Water 500ml', category: 'SOFT DRINKS' },
  'FGH-BEV-REDBUL-0001': { name: 'Red Bull Energy Drink', category: 'ENERGY DRINKS' },
  'FGH-OTH-DESPER-0001': { name: 'Desperados Beer', category: 'BEERS' },
  'FGH-OTH-DOUBLE-0001': { name: 'JW Double Black', category: 'WHISKY' },
  'FGH-OTH-GLASSC-0001': { name: 'Glass Cleaner', category: 'CLEANING MATERIALS' },
  'FGH-OTH-JOHNNI-0001': { name: 'Johnnie Walker Red', category: 'WHISKY' },
  'FGH-OTH-KITCHE-0001': { name: 'Kitchen Cloth/Roll', category: 'NON CONSUMABLES' },
  'FGH-OTH-SAVANN-0001': { name: 'Savanna Cider', category: 'BEERS' },
  'FGH-OTH-SUPERB-0001': { name: 'Super Brite Sponge', category: 'CLEANING MATERIALS' },
  'FGH-OTH-WINDOW-0001': { name: 'Window Cleaner', category: 'CLEANING MATERIALS' },
  'KITCHEN-beef': { name: 'Kitchen Beef Meat', category: 'DRY GOODS' },
  'KITCHEN-rice': { name: 'Kitchen Rice Staple', category: 'DRY GOODS' }
};

for (const item of data.branch_stock) {
  if (fixes[item.sku]) {
    item.name = fixes[item.sku].name;
    item.category = fixes[item.sku].category;
  }
}

// Group by category
const byCat = {};
for (const item of data.branch_stock) {
  const cat = item.category;
  if (!byCat[cat]) byCat[cat] = [];
  byCat[cat].push(item);
}

// Output summary counts and active items table
let md = `# BOMET TOWN (BRANCH 2) STORE STOCK REPORT\n\n`;
md += `**Branch**: Bomet Town (ID: 2, Code: BTN)\n`;
md += `**Total Registered Store Stock Lines**: ${data.branch_stock.length}\n`;
md += `**Active Store Lines (Stock > 0)**: ${data.branch_stock.filter(i => i.current_stock > 0 || i.store_quantity > 0).length}\n`;
md += `**Total Store Stock Units**: ${data.branch_stock.reduce((sum, i) => sum + i.current_stock, 0).toLocaleString()}\n\n`;

for (const [cat, items] of Object.entries(byCat).sort((a,b) => a[0].localeCompare(b[0]))) {
  const activeItems = items.filter(i => i.current_stock > 0 || i.store_quantity > 0);
  md += `### ${cat} (${items.length} items registered, ${activeItems.length} in stock)\n\n`;
  md += `| SKU | Item Name | Current Stock | Store Qty | Unit | Unit Cost (KES) | Retail (KES) |\n`;
  md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n`;
  // Sort items: positive stock first, then alphabetically
  items.sort((a, b) => {
    if ((b.current_stock + b.store_quantity) !== (a.current_stock + a.store_quantity)) {
      return (b.current_stock + b.store_quantity) - (a.current_stock + a.store_quantity);
    }
    return a.name.localeCompare(b.name);
  });
  for (const item of items) {
    md += `| \`${item.sku}\` | **${item.name}** | **${item.current_stock}** | ${item.store_quantity} | ${item.unit} | ${item.unit_cost ? item.unit_cost.toLocaleString() : '-'} | ${item.retail_price ? item.retail_price.toLocaleString() : '-'} |\n`;
  }
  md += `\n`;
}

fs.writeFileSync(path.join(__dirname, 'bomet_stock_tables.md'), md);
console.log('Generated bomet_stock_tables.md successfully. Total length:', md.length);
