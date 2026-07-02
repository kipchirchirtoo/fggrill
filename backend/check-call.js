require('dotenv').config();
require('ts-node/register');
(async () => {
  const { recordBarStockMovement } = require('./src/services/unified-bar-stock.service.ts');
  try {
    const result = await recordBarStockMovement({
      branchId: 2,
      outletId: '145b570d-6d9b-46bb-9b75-614ab8fedb59',
      drinkId: 'a02c42d7-9fdb-418a-b95d-1245bf684be8',
      sku: 'M-a02c42d7-9fdb-418a-b95d-1245bf684be8',
      quantityDelta: -1,
      movementType: 'sale',
      referenceId: 'test-shift-id',
      shiftId: 'f5f3320c-353a-4989-81e3-e83936130ee5',
      notes: 'TEST diagnostic call'
    });
    console.log('SUCCESS:', result);
  } catch (err) {
    console.log('THREW:', err);
  }
})();
