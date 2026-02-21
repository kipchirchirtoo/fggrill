require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateHotelContactInfo() {
    console.log('🔄 Updating hotel contact information...\n');

    try {
        // First, let's see what branches exist
        const { data: branches, error: fetchError } = await supabase
            .from('branches')
            .select('id, name, location, settings');

        if (fetchError) {
            console.error('❌ Error fetching branches:', fetchError);
            return;
        }

        console.log('📋 Current branches:');
        branches.forEach(b => {
            console.log(`   - ID: ${b.id}, Name: ${b.name}, Location: ${b.location}`);
            console.log(`     Current settings:`, b.settings || 'None');
        });

        console.log('\n🔧 Updating contact information for all branches...');
        console.log('   Phone: 0706782828');
        console.log('   Email: famousgatesbmt@gmail.com\n');

        // Update all branches with the new contact info
        for (const branch of branches) {
            const currentSettings = branch.settings || {};
            const updatedSettings = {
                ...currentSettings,
                phone: '0706782828',
                email: 'famousgatesbmt@gmail.com'
            };

            const { error: updateError } = await supabase
                .from('branches')
                .update({ 
                    name: 'Famous Gates Hotels',
                    settings: updatedSettings 
                })
                .eq('id', branch.id);

            if (updateError) {
                console.error(`❌ Error updating branch ${branch.id}:`, updateError);
            } else {
                console.log(`✅ Updated branch ${branch.id} (${branch.name})`);
            }
        }

        console.log('\n✅ Contact information updated successfully!');
        console.log('\n📝 Next steps:');
        console.log('   1. Restart your application');
        console.log('   2. Print a test receipt to verify the changes');
        console.log('   3. The receipt should now show:');
        console.log('      - Hotel Name: FAMOUS GATES HOTELS');
        console.log('      - Phone: 0706782828');
        console.log('      - Email: famousgatesbmt@gmail.com');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

updateHotelContactInfo();
