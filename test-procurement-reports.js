require('dotenv').config();

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

async function testProcurementReports() {
  console.log('🧪 Testing Procurement Reports Export...\n');

  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];

  const filters = {
    from_date: firstDay,
    to_date: lastDay
  };

  console.log('📅 Date Range:', filters);
  console.log('');

  // Test 1: Check Python service health
  console.log('1️⃣  Checking Python service health...');
  try {
    const healthResponse = await fetch(`${PYTHON_SERVICE_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Python service is running');
    console.log('   Status:', healthData);
  } catch (error) {
    console.error('❌ Python service is not accessible');
    console.error('   Error:', error.message);
    console.log('\n⚠️  The Python reports service must be running for exports to work.');
    console.log('   Start it with: cd python-services/reports && python app.py');
    return;
  }
  console.log('');

  // Test 2: Test VAT Report Export
  console.log('2️⃣  Testing VAT Report Export...');
  try {
    const vatResponse = await fetch(
      `${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'vat_report',
          filters,
          useRealData: true
        })
      }
    );

    if (vatResponse.ok) {
      const blob = await vatResponse.blob();
      console.log('✅ VAT Report generated successfully');
      console.log('   Size:', (blob.size / 1024).toFixed(2), 'KB');
    } else {
      const errorText = await vatResponse.text();
      console.error('❌ VAT Report generation failed');
      console.error('   Status:', vatResponse.status);
      console.error('   Error:', errorText.substring(0, 200));
    }
  } catch (error) {
    console.error('❌ VAT Report generation failed');
    console.error('   Error:', error.message);
  }
  console.log('');

  // Test 3: Test Procurement Intelligence Export
  console.log('3️⃣  Testing Procurement Intelligence Export...');
  try {
    const procResponse = await fetch(
      `${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'procurement_intelligence',
          filters,
          useRealData: true
        })
      }
    );

    if (procResponse.ok) {
      const blob = await procResponse.blob();
      console.log('✅ Procurement Intelligence Report generated successfully');
      console.log('   Size:', (blob.size / 1024).toFixed(2), 'KB');
    } else {
      const errorText = await procResponse.text();
      console.error('❌ Procurement Intelligence Report generation failed');
      console.error('   Status:', procResponse.status);
      console.error('   Error:', errorText.substring(0, 200));
    }
  } catch (error) {
    console.error('❌ Procurement Intelligence Report generation failed');
    console.error('   Error:', error.message);
  }
  console.log('');

  // Test 4: Check if data is available
  console.log('4️⃣  Checking if procurement data exists...');
  try {
    const dataResponse = await fetch(
      `${PYTHON_SERVICE_URL}/api/reports/data?type=vat_report&from_date=${firstDay}&to_date=${lastDay}`
    );

    if (dataResponse.ok) {
      const data = await dataResponse.json();
      console.log('✅ VAT data retrieved');
      console.log('   Records:', data.data?.length || 0);
      console.log('   Total VAT:', data.summary?.total_vat || 0);
    } else {
      console.error('❌ Failed to retrieve VAT data');
      console.error('   Status:', dataResponse.status);
    }
  } catch (error) {
    console.error('❌ Failed to retrieve VAT data');
    console.error('   Error:', error.message);
  }
  console.log('');

  console.log('📊 Test Summary:');
  console.log('   If all tests passed, the export should work in the UI.');
  console.log('   If tests failed, check:');
  console.log('   1. Python service is running (python-services/reports/app.py)');
  console.log('   2. Database connection is configured');
  console.log('   3. Supplier invoices exist in the database');
}

testProcurementReports().catch(console.error);
