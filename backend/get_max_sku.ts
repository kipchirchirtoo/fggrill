import db from './src/db';

async function main() {
  console.log("=== FINDING MAX SKU ===");
  try {
    const res = await db.query(
      "SELECT sku FROM inventory_items WHERE sku LIKE 'FG-%' ORDER BY LENGTH(sku) DESC, sku DESC LIMIT 50"
    );
    console.log("Top SKUs:");
    const numbers = res.rows
      .map(r => {
        const numPart = r.sku.substring(3);
        const num = parseInt(numPart, 10);
        return { sku: r.sku, num };
      })
      .filter(x => !isNaN(x.num))
      .sort((a, b) => b.num - a.num);
    
    console.log("Highest numbered SKUs:");
    numbers.slice(0, 15).forEach(n => console.log(`  - ${n.sku} (${n.num})`));
  } catch (e: any) {
    console.error("Error:", e.message);
  }
  process.exit(0);
}

main();
