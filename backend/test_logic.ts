import { UserRole } from './src/types/auth.types';

// Mock request and response
const mockReq = {
  query: { scope: 'branch' },
  user: {
    id: '7dd8fe92-13b5-4e5c-ac54-1789934de910',
    role: 'branch_storekeeper',
    branch_id: 5
  }
};

function testLogic(req) {
  const { scope } = req.query;
  const user = req.user;
  const userBranchId = user?.branch_id || user?.branchId;
  
  // Note: I'm using the strings directly here to avoid enum issues for now
  const isCentral = !userBranchId || user?.role === 'super_admin' || user?.role === 'general_manager' || user?.role === 'central_storekeeper';

  console.log('User Role:', user?.role);
  console.log('User Branch ID:', userBranchId);
  console.log('Is Central:', isCentral);

  if (!isCentral) {
    const branchId = Number(userBranchId);
    if (scope === 'branch') {
      console.log(`Query: .eq('branch_id', ${branchId})`);
    } else if (scope === 'global') {
      console.log(`Query: .is('branch_id', null)`);
    } else {
      console.log(`Query: .or('branch_id.eq.${branchId},branch_id.is.null')`);
    }
  } else {
    console.log('Query: No filters (see everything)');
  }
}

testLogic(mockReq);
