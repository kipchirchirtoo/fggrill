import 'dotenv/config';
import { recordBarStockMovement } from './src/services/unified-bar-stock.service';

const BRANCH_ID = 2; // Bomet

const ITEMS: { drinkId: string; name: string; quantity: number }[] = [
  { drinkId: '0af7ac4c-1ff3-4bcf-8663-012032b032ed', name: 'Pool Tokens', quantity: 120 },
  { drinkId: 'c9b185a6-c01f-45e3-94a4-44fc05e23967', name: 'Captain Morgan 750ml', quantity: 20 },
  { drinkId: 'e5898d14-5f98-4ddd-b9fa-c8ecfd16a9f6', name: 'Gordons 350ml', quantity: 4 },
  { drinkId: '125ef8fd-4e16-4b8c-9845-9e452ba1530b', name: 'Water 1L', quantity: 120 },
  { drinkId: 'ae3b8a1a-f3cb-46d4-8467-1f1adeb03fc2', name: 'Desperado', quantity: 12 },
];

async function main() {
  for (const item of ITEMS) {
    const result = await recordBarStockMovement({
      branchId: BRANCH_ID,
      drinkId: item.drinkId,
      quantityDelta: item.quantity,
      movementType: 'restock',
      referenceNumber: 'manual-restock-2026-06-23',
      notes: `Manual restock requested by branch (${item.name})`,
    });
    console.log(`${item.name}: ${result.previousStock} -> ${result.newStock} (source: ${result.source})`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Restock failed:', err);
    process.exit(1);
  });
