import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBranches() {
    const { data, error } = await supabase.from('branches').select('*');
    if (error) {
        console.error('Error fetching branches:', error);
    } else {
        console.log('Branches:', data);
    }
}

checkBranches();
