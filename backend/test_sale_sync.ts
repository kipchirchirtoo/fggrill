import 'dotenv/config';
import { recordBarStockMovement } from './src/services/unified-bar-stock.service';

async function main() {
  console.log('--- Testing sale movement (matches real outlet-pos.controller.ts call shape) ---');
  try {
    const result = await recordBarStockMovement({
      branchId: 2,
      outletId: '145b570d-6d9b-46bb-9b75-614ab8fedb59',
      drinkId: '125ef8fd-4e16-4b8c-9845-9e452ba1530b',
      sku: 'M-125ef8fd-4e16-4b8c-9845-9e452ba1530b',
      quantityDelta: -1,
      movementType: 'sale',
      referenceId: 'test-shift',
      notes: 'TEST sale sync - will be reverted',
    });
    console.log('RESULT:', JSON.stringify(result));
  } catch (e: any) {
    console.error('THREW:', e.message);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
