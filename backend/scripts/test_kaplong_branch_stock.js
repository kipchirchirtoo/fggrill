require('dotenv').config({ path: 'c:/Users/user/OneDrive/Desktop/fggrill/backend/.env' });
const { getBranchStock } = require('../dist/services/branch-inventory.service');

async function test() {
  try {
    const stock = await getBranchStock(3);
    console.log('Total branch stock items for Kaplong:', stock.length);

    const categories = {};
    let uncategorised = 0;
    for (const item of stock) {
      const cat = item.category || 'Uncategorised';
      categories[cat] = (categories[cat] || 0) + 1;
      if (!item.category) uncategorised++;
    }

    console.log('Categories breakdown:');
    console.table(categories);
    console.log('Total uncategorised items:', uncategorised);

    const sampleBarItems = stock.filter(i => 
      ['FGB-KPL-AMARULA-1L', 'FGB-KPL-BAILEYS', 'FGB-KPL-CAPRICE', 'FGB-KPL-FAMOUS-GROUSE'].includes(i.item_sku)
    );
    console.log('Sample updated bar items:');
    console.table(sampleBarItems.map(i => ({
      sku: i.item_sku,
      name: i.item_name,
      category: i.category,
      unit: i.unit_of_measure,
      qty: i.quantity
    })));
  } catch (err) {
    console.error('Error testing getBranchStock:', err);
  }
}

test().then(() => process.exit(0));
