/**
 * Test Barcode System - Complete Workflow
 * 
 * This script tests the entire barcode system workflow:
 * 1. Generate barcode
 * 2. Receive item with barcode
 * 3. Create dispatch with dual OTP
 * 4. Verify driver OTP
 * 5. Verify branch OTP
 * 6. Review delivery (auditor)
 */

const axios = require('axios');
require('dotenv').config();

const API_URL = process.env.API_URL || 'http://localhost:5000/api';
const TEST_TOKEN = process.env.TEST_TOKEN || 'your-test-jwt-token';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function testBarcodeSystem() {
  console.log('🧪 Testing Barcode System - Complete Workflow\n');
  
  try {
    // Test 1: Generate Barcode
    console.log('Test 1: Generate Barcode');
    const barcodeRes = await api.post('/dispatch/barcodes/generate');
    const barcode = barcodeRes.data.barcode;
    console.log('✅ Barcode generated:', barcode);
    console.log('');
    
    // Test 2: Receive Item with Barcode
    console.log('Test 2: Receive Item with Barcode');
    const itemRes = await api.post('/dispatch/items/receive', {
      name: 'Test Tomatoes',
      category: 'Vegetables',
      unit: 'kg',
      quantity: 50,
      barcode: barcode,
    });
    const itemId = itemRes.data.data.id;
    console.log('✅ Item received:', itemRes.data.data.name, '(ID:', itemId, ')');
    console.log('');
    
    // Test 3: Search Item by Barcode
    console.log('Test 3: Search Item by Barcode');
    const searchRes = await api.get(`/dispatch/barcodes/${barcode}`);
    console.log('✅ Item found by barcode:', searchRes.data.data.name);
    console.log('');
    
    // Test 4: Create Dispatch with Dual OTP
    console.log('Test 4: Create Dispatch with Dual OTP');
    const dispatchRes = await api.post('/dispatch/dispatches', {
      items: [
        { item_id: itemId, quantity: 20, unit: 'kg' }
      ],
      destination_branch: 'Nairobi',
      notes: 'Test dispatch for barcode system',
    });
    const dispatch = dispatchRes.data.data;
    console.log('✅ Dispatch created:', dispatch.dispatch_number);
    console.log('   Driver OTP:', dispatch.driver_otp);
    console.log('   Branch OTP:', dispatch.branch_otp);
    console.log('   Expires:', dispatch.expires_at);
    console.log('');
    
    // Test 5: Get Dispatch Details
    console.log('Test 5: Get Dispatch Details');
    const detailRes = await api.get(`/dispatch/dispatches/${dispatch.id}`);
    console.log('✅ Dispatch details retrieved');
    console.log('   Status:', detailRes.data.data.status);
    console.log('   Items:', detailRes.data.data.dispatch_items?.length || 0);
    console.log('');
    
    // Test 6: Verify Driver OTP
    console.log('Test 6: Verify Driver OTP');
    const driverOtpRes = await api.post(`/dispatch/dispatches/${dispatch.id}/verify-driver-otp`, {
      driver_otp: dispatch.driver_otp,
    });
    console.log('✅ Driver OTP verified');
    console.log('   New status:', driverOtpRes.data.status);
    console.log('');
    
    // Test 7: Verify Branch OTP
    console.log('Test 7: Verify Branch OTP');
    const branchOtpRes = await api.post(`/dispatch/dispatches/${dispatch.id}/verify-branch-otp`, {
      branch_otp: dispatch.branch_otp,
    });
    console.log('✅ Branch OTP verified');
    console.log('   New status:', branchOtpRes.data.status);
    console.log('');
    
    // Test 8: Get Auditor Deliveries
    console.log('Test 8: Get Auditor Deliveries');
    const auditorRes = await api.get('/dispatch/auditor/deliveries?status=completed');
    console.log('✅ Auditor deliveries retrieved:', auditorRes.data.data?.length || 0, 'deliveries');
    console.log('');
    
    // Test 9: Review Delivery (Approve)
    console.log('Test 9: Review Delivery (Approve)');
    const reviewRes = await api.post(`/dispatch/auditor/deliveries/${dispatch.id}/review`, {
      action: 'approve',
      notes: 'Test approval - all items verified',
    });
    console.log('✅ Delivery approved');
    console.log('   Final status:', reviewRes.data.status);
    console.log('');
    
    // Test 10: Generate POS Barcode
    console.log('Test 10: Generate POS Barcode');
    const posRes = await api.post('/dispatch/pos/barcodes/generate', {
      transaction_id: 'TEST-TXN-001',
      bill_id: 'TEST-BILL-001',
    });
    const posBarcode = posRes.data.barcode;
    console.log('✅ POS barcode generated:', posBarcode);
    console.log('');
    
    // Test 11: Scan POS Barcode
    console.log('Test 11: Scan POS Barcode');
    const scanRes = await api.get(`/dispatch/pos/barcodes/scan/${posBarcode}`);
    console.log('✅ POS barcode scanned');
    console.log('   Transaction ID:', scanRes.data.data.transaction_id);
    console.log('');
    
    console.log('🎉 All tests passed! Barcode system is fully functional.\n');
    
  } catch (error) {
    console.error('\n❌ Test failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

// Run tests
testBarcodeSystem().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
