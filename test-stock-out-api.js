const axios = require('axios');

async function testStockOutAPI() {
  try {
    console.log('Testing stock movements API...\n');
    
    const response = await axios.get('http://localhost:5000/api/storekeeping/stock-movements', {
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN_HERE' // Replace with actual token
      }
    });
    
    console.log('API Response Status:', response.status);
    console.log('Success:', response.data.success);
    console.log('Total movements:', response.data.data?.length || 0);
    
    if (response.data.data && response.data.data.length > 0) {
      const stockOuts = response.data.data.filter(m => 
        m.movement_type === 'STOCK_OUT' || m.movement_type === 'DISPATCH_OUT'
      );
      
      console.log('\nStock Out movements:', stockOuts.length);
      console.log('\nFirst stock out record:');
      console.log(JSON.stringify(stockOuts[0], null, 2));
      
      console.log('\nDate field check:');
      console.log('created_at:', stockOuts[0].created_at);
      console.log('Type:', typeof stockOuts[0].created_at);
      console.log('Is valid date?', !isNaN(new Date(stockOuts[0].created_at).getTime()));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testStockOutAPI();
