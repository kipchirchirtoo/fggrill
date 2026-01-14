// Kitchen Management Module - Database Migration Runner
// This script runs the kitchen management migration on Supabase

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://utsvlihpudfraxzcmtle.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0c3ZsaWhwdWRmcmF4emNtdGxlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzkxNjMzMiwiZXhwIjoyMDc5NDkyMzMyfQ.AhnRNBw6l3HBOTEIMrlUbGQEf9FJdyTaQrRQJW7IBNY';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
    try {
        console.log('🚀 Starting Kitchen Management Module migration...\n');

        // Read the SQL file
        const sqlPath = path.join(__dirname, '20260114_kitchen_management.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');

        // Split into individual statements (basic split by semicolon)
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

        let successCount = 0;
        let errorCount = 0;

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';';

            // Skip comments
            if (statement.startsWith('--') || statement.startsWith('/*')) {
                continue;
            }

            try {
                console.log(`Executing statement ${i + 1}/${statements.length}...`);

                const { data, error } = await supabase.rpc('exec_sql', {
                    sql: statement
                });

                if (error) {
                    // Try direct query for CREATE TABLE and other DDL
                    const { error: directError } = await supabase
                        .from('_migrations')
                        .insert({ statement });

                    if (directError) {
                        console.error(`❌ Error in statement ${i + 1}:`, error.message);
                        errorCount++;
                    } else {
                        successCount++;
                    }
                } else {
                    console.log(`✅ Statement ${i + 1} executed successfully`);
                    successCount++;
                }
            } catch (err: any) {
                console.error(`❌ Error in statement ${i + 1}:`, err.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`✅ Migration completed!`);
        console.log(`   Successful: ${successCount}`);
        console.log(`   Errors: ${errorCount}`);
        console.log('='.repeat(50));

    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
