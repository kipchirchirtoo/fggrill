const axios = require('axios');

async function runTest() {
  const NODE_API = 'http://localhost:5000/api';
  console.log('Testing Async PDF Report Generation...');
  
  try {
    // 1. Trigger async report
    console.log(`Sending POST to ${NODE_API}/reports/generate/async...`);
    const startRes = await axios.post(`${NODE_API}/reports/generate/async`, {
      reportType: 'leave_management',
      filters: { branch_id: 1 },
      useRealData: false
    });
    
    console.log('Start Response:', startRes.data);
    
    if (!startRes.data.success) {
      console.error('Failed to start async report');
      process.exit(1);
    }
    
    const jobId = startRes.data.data.jobId || startRes.data.data.job_id;
    if (!jobId) {
      console.error('No Job ID returned:', startRes.data);
      process.exit(1);
    }
    console.log(`Started Job ID: ${jobId}`);
    
    // 2. Poll for status
    let status = 'pending';
    let retries = 0;
    while (status !== 'completed' && status !== 'failed' && retries < 15) {
      console.log(`Polling status (attempt ${retries + 1})...`);
      await new Promise(r => setTimeout(r, 2000));
      
      const statusRes = await axios.get(`${NODE_API}/reports/jobs/${jobId}/status`);
      status = statusRes.data.data.status;
      console.log(`Current Status: ${status}`);
      
      if (status === 'completed') {
        console.log('Job Completed successfully!');
        console.log('Result URL:', statusRes.data.data.result_url);
        process.exit(0);
      } else if (status === 'failed') {
        console.error('Job Failed!');
        console.error('Error Details:', statusRes.data.data.error);
        process.exit(1);
      }
      retries++;
    }
    
    console.log('Test timeout waiting for job completion.');
  } catch (error) {
    console.error('Error running test:', error.message);
    if (error.response) {
      console.error('Response details:', error.response.data);
    }
  }
}

runTest();
