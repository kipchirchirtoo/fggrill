require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkSchema() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*&limit=1`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });
    
    const data = await response.json();
    console.log('Users table columns:', Object.keys(data[0] || {}));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkSchema();
