import { getSuppliers as getStoreSuppliers } from './src/controllers/storekeeping/resources.controller';
import { getSuppliers as getGeneralSuppliers } from './src/controllers/suppliers.controller';
import { Request, Response } from 'express';

// Mock express response
const mockResponse = () => {
  const res: any = {};
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data: any) => {
    res.body = data;
    return res;
  };
  return res;
};

async function testCase(role: string, branchId: number, query: any) {
  const user = {
    id: 'dc62ca4d-b957-4ffa-be62-0ff30c5ccbce',
    role,
    branch_id: branchId,
    branchId
  };

  const reqStore = {
    query,
    user
  } as unknown as Request;
  const resStore = mockResponse();
  await getStoreSuppliers(reqStore, resStore);

  const reqGeneral = {
    query,
    user
  } as unknown as Request;
  const resGeneral = mockResponse();
  await getGeneralSuppliers(reqGeneral, resGeneral);

  const storeCount = resStore.body?.success ? resStore.body.data.length : 'ERROR';
  const storeBranchIds = resStore.body?.success ? [...new Set(resStore.body.data.map((s: any) => s.branch_id))] : [];

  const generalCount = resGeneral.body?.success ? resGeneral.body.data.length : 'ERROR';
  const generalBranchIds = resGeneral.body?.success ? [...new Set(resGeneral.body.data.map((s: any) => s.branch_id))] : [];

  console.log(`User: ${role} (Branch ${branchId}) | Query: ${JSON.stringify(query)}`);
  console.log(`  -> Store Controller: ${storeCount} items (branch_ids: ${JSON.stringify(storeBranchIds)})`);
  console.log(`  -> Gen Controller:   ${generalCount} items (branch_ids: ${JSON.stringify(generalBranchIds)})`);
}

async function runTests() {
  console.log('--- RUNNING DETAILED SUPPLIER SCOPING TESTS ---\n');

  // Case 1: Central Storekeeper default query (scope undefined)
  await testCase('central_storekeeper', 1, {});

  // Case 2: Central Storekeeper with scope = global
  await testCase('central_storekeeper', 1, { scope: 'global' });

  // Case 3: Central Storekeeper with scope = all
  await testCase('central_storekeeper', 1, { scope: 'all' });

  // Case 4: Central Storekeeper with scope = branch & branchId = 2
  await testCase('central_storekeeper', 1, { scope: 'branch', branchId: 2 });

  // Case 5: Branch Storekeeper (Bomet Town, branch 2) default query
  await testCase('branch_storekeeper', 2, {});

  // Case 6: Branch Storekeeper with scope = branch
  await testCase('branch_storekeeper', 2, { scope: 'branch' });

  // Case 7: Branch Storekeeper with scope = global
  await testCase('branch_storekeeper', 2, { scope: 'global' });

  // Case 8: Branch Storekeeper with scope = all
  await testCase('branch_storekeeper', 2, { scope: 'all' });

  // Case 9: Auditor (Branch 1) default query
  await testCase('auditor', 1, {});

  // Case 10: Director (Branch 1) default query
  await testCase('director', 1, {});
}

runTests().then(() => {
  console.log('--- TESTS COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}).catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
