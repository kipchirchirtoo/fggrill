
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

import { getBranchRequests } from './src/services/branch-inventory.service';
import { supabase } from './src/config/database';

async function test() {
    try {
        console.log('Testing getBranchRequests(null)...');
        const requests = await getBranchRequests(null);
        console.log('Success:', requests.length, 'requests found');
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
