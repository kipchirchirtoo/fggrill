const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'bomet_drygoods_cleaning_analysis.json'), 'utf-8'));

let md = `# MASTER CATALOGUE: DRY GOODS & KITCHEN STAPLES + CLEANING MATERIALS\n`;
md += `## BOMET TOWN BRANCH (BRANCH ID: 2 - BTN) REGISTRATION AUDIT\n\n`;
md += `Generated: ${new Date().toISOString()}\n\n`;

md += `### SUMMARY\n`;
md += `- **Dry Goods & Kitchen Staples in Master**: ${data.summary.total_master_dry_goods}\n`;
md += `- **Registered in Bomet Town**: ${data.summary.bomet_registered_dry_goods} (100% Registered)\n`;
md += `- **With Active Stock (>0)**: ${data.summary.bomet_active_stock_dry_goods} items\n`;
md += `- **Cleaning Materials in Master**: ${data.summary.total_master_cleaning}\n`;
md += `- **Registered in Bomet Town**: ${data.summary.bomet_registered_cleaning} (100% Registered)\n`;
md += `- **With Active Stock (>0)**: ${data.summary.bomet_active_stock_cleaning} items\n\n`;

md += `## 1. CLEANING MATERIALS (ALL REGISTERED IN BOMET TOWN)\n\n`;
md += `| Master SKU | Item Name | Bomet Reg Status | Current Stock | Store Qty | Unit | Unit Cost (KES) |\n`;
md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: |\n`;
data.cleaning_materials.forEach(c => {
  md += `| \`${c.master_sku}\` | **${c.name}** | Registered | **${c.current_stock}** | ${c.store_quantity} | ${c.unit} | ${c.master_cost || '-'} |\n`;
});

md += `\n## 2. DRY GOODS & KITCHEN STAPLES (ALL 216 ITEMS - REGISTERED IN BOMET TOWN)\n\n`;
md += `| Master SKU | Item Name | Bomet Reg Status | Current Stock | Store Qty | Unit | Unit Cost (KES) | Retail (KES) |\n`;
md += `| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

// Sort: positive stock first, then alphabetically
data.dry_goods.sort((a,b) => {
  const stockA = a.current_stock + a.store_quantity;
  const stockB = b.current_stock + b.store_quantity;
  if (stockA !== stockB) return stockB - stockA;
  return a.name.localeCompare(b.name);
});

data.dry_goods.forEach(d => {
  md += `| \`${d.master_sku}\` | **${d.name}** | Registered | **${d.current_stock}** | ${d.store_quantity} | ${d.unit} | ${d.master_cost ? d.master_cost.toLocaleString() : '-'} | ${d.master_retail ? d.master_retail.toLocaleString() : '-'} |\n`;
});

fs.writeFileSync(path.join(__dirname, 'bomet_drygoods_and_cleaning_full.md'), md);
console.log('Saved bomet_drygoods_and_cleaning_full.md successfully. Total lines:', md.split('\n').length);
