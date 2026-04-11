// Test identifier matching logic
const testCases = [
  { input: 'FG-005', dbValue: 'FGH005', shouldMatch: true },
  { input: 'FGH005', dbValue: 'FGH005', shouldMatch: true },
  { input: 'FGH-005', dbValue: 'FGH005', shouldMatch: true },
  { input: 'fgh005', dbValue: 'FGH005', shouldMatch: true },
  { input: '39339240', dbValue: '39339240', shouldMatch: true },
  { input: 'FG-001', dbValue: 'FGH001', shouldMatch: true },
  { input: 'FGB1', dbValue: 'FGB1', shouldMatch: true },
];

function normalizeId(id) {
  return (id || '').replace(/[-\s]/g, '').toUpperCase();
}

function extractNumeric(id) {
  return normalizeId(id).replace(/[A-Z]/g, '');
}

function matchesIdentifier(identifier, staffIdNumber, nationalId) {
  const normalizedInput = normalizeId(identifier);
  const numericPart = extractNumeric(identifier);
  
  // Exact match
  if (identifier === staffIdNumber || identifier === nationalId) {
    return { match: true, reason: 'exact' };
  }
  
  // Normalized match
  const staffIdNorm = normalizeId(staffIdNumber);
  const nationalIdNorm = normalizeId(nationalId);
  if (staffIdNorm === normalizedInput || nationalIdNorm === normalizedInput) {
    return { match: true, reason: 'normalized' };
  }
  
  // Numeric suffix match (FG-005 matches FGH005)
  if (numericPart && numericPart.length >= 2) {
    const staffNumeric = extractNumeric(staffIdNumber);
    if (staffNumeric === numericPart && staffIdNorm.startsWith('FG')) {
      return { match: true, reason: 'numeric-suffix' };
    }
  }
  
  return { match: false, reason: 'no-match' };
}

console.log('Testing identifier matching logic:\n');
testCases.forEach(({ input, dbValue, shouldMatch }) => {
  const result = matchesIdentifier(input, dbValue, null);
  const status = result.match === shouldMatch ? '✓' : '✗';
  console.log(`${status} Input: "${input}" vs DB: "${dbValue}" => ${result.match ? 'MATCH' : 'NO MATCH'} (${result.reason})`);
});

console.log('\n--- Real test case ---');
const realTest = matchesIdentifier('FG-005', 'FGH005', null);
console.log(`FG-005 vs FGH005: ${realTest.match ? 'MATCH' : 'NO MATCH'} (${realTest.reason})`);
