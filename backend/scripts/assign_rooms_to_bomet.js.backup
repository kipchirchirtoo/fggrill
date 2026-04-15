require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Use environment variables directly
const supabaseUrl = process.env.SUPABASE_PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://utsvlihpudfraxzcmtle.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
    console.error('Error: No Supabase Key found in environment variables.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Starting Room Assignment Script (Env Loaded)...');
    console.log(`Using URL: ${supabaseUrl}`);
    console.log(`Using Key Length: ${supabaseKey.length}`);

    // 1. Find Bomet Branch
    let { data: branches, error: branchError } = await supabase
        .from('branches')
        .select('id, name')
        .ilike('name', '%Bomet%');

    if (branchError) {
        console.error('Error finding branch:', branchError);
        return;
    }

    let bometBranch;

    if (!branches || branches.length === 0) {
        console.log('No branch found matching "%Bomet%". Creating "Bomet Town" branch...');

        // Create new branch
        const { data: newBranch, error: createError } = await supabase
            .from('branches')
            .insert([{ name: 'Bomet Town', location: 'Bomet', phone: '0700000000', email: 'bomet@example.com' }])
            .select()
            .single();

        if (createError) {
            console.error('Error creating branch:', createError);

            // Fallback: Check if ANY branch exists to assign to?
            const { data: allBranches } = await supabase.from('branches').select('id, name').limit(1);
            if (allBranches && allBranches.length > 0) {
                console.log(`Fallback: Assigning to first available branch: ${allBranches[0].name}`);
                bometBranch = allBranches[0];
            } else {
                console.error('CRITICAL: No branches exist and failed to create one.');
                return;
            }
        } else {
            bometBranch = newBranch;
        }
    } else {
        bometBranch = branches[0];
    }

    console.log(`Target Branch: ${bometBranch.name} (${bometBranch.id})`);

    // 2. Count Rooms
    const { count: totalRooms } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true });

    console.log(`Total Rooms in DB: ${totalRooms}`);

    // 3. Update All Rooms
    console.log(`Assigning all rooms to ${bometBranch.name}...`);

    // Fetch all room IDs first to avoid RLS/Filter issues just in case
    const { data: allRooms } = await supabase.from('rooms').select('id');

    if (!allRooms || allRooms.length === 0) {
        console.log('No rooms found to update.');
        return;
    }

    const { data: updated, error: updateError } = await supabase
        .from('rooms')
        .update({ branch_id: bometBranch.id })
        .in('id', allRooms.map(r => r.id))
        .select();

    if (updateError) {
        console.error('Error updating rooms:', updateError);
    } else {
        console.log(`Successfully updated ${updated.length} rooms to branch ${bometBranch.name}`);
    }
}

main();
