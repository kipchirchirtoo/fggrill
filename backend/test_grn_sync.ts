import 'dotenv/config';
import { recordBarStockMovement } from './src/services/unified-bar-stock.service';

async function main() {
  console.log('--- Testing GRN-style restock (sku only, no drinkId) ---');
  try {
    const result = await recordBarStockMovement({
      branchId: 2,
      sku: 'FGB-BER-0001', // Tusker Lager
      quantityDelta: 1,
      movementType: 'restock',
      referenceNumber: 'TEST-GRN-SYNC',
      notes: 'TEST GRN sync - will be reverted',
    });
    console.log('RESULT:', JSON.stringify(result));
  } catch (e: any) {
    console.error('THREW:', e.message, e.stack);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
