require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role to bypass RLS

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createMainBranch() {
    console.log('🏨 Creating Kyogongs main branch...\n');

    try {
        // Check if branch already exists
        const { data: existing, error: checkError } = await supabase
            .from('branches')
            .select('*')
            .limit(1);

        if (checkError) {
            console.error('❌ Error checking branches:', checkError);
            return;
        }

        if (existing && existing.length > 0) {
            console.log('✅ Branch already exists. Updating contact information...');
            
            const { error: updateError } = await supabase
                .from('branches')
                .update({
                    name: 'Kyogongs',
                    settings: {
                        phone: '0706782828',
                        email: 'kyogongsbmt@gmail.com'
                    }
                })
                .eq('id', existing[0].id);

            if (updateError) {
                console.error('❌ Error updating branch:', updateError);
            } else {
                console.log('✅ Branch updated successfully!');
            }
        } else {
            console.log('📝 Creating new branch...');
            
            const { data, error: insertError } = await supabase
                .from('branches')
                .insert({
                    name: 'Kyogongs',
                    location: 'Bomet, Kenya',
                    status: 'active',
                    settings: {
                        phone: '0706782828',
                        email: 'kyogongsbmt@gmail.com'
                    }
                })
                .select();

            if (insertError) {
                console.error('❌ Error creating branch:', insertError);
            } else {
                console.log('✅ Branch created successfully!');
                console.log('   Branch ID:', data[0].id);
            }
        }

        console.log('\n📝 Receipt will now display:');
        console.log('   Hotel Name: KyogongS');
        console.log('   Phone: 0706782828');
        console.log('   Email: kyogongsbmt@gmail.com');
        console.log('\n✅ Done! Restart your app to see the changes.');

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

createMainBranch();
