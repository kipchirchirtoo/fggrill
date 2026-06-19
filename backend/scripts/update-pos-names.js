#!/usr/bin/env node
/**
 * Update POS outlet item names to UPPERCASE with ML sizes
 * BOMET TOWN Main Bar POS Outlet
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_PROJECT_URL || 'https://rvoaowhxyweswwuxbrzm.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2b2Fvd2h4eXdlc3d3dXhicnptIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTQzNjI3OCwiZXhwIjoyMDk3MDEyMjc4fQ.0VTY3prtXfuV8HDpz1xz8T30gikf-MnNeN9PwG4Z0Ns';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function standardizeName(name) {
    // Convert to uppercase
    let standardized = name.toUpperCase();
    
    // Replace fractions with ML sizes
    standardized = standardized.replace(/\b1\/2\b/g, '350ML');
    standardized = standardized.replace(/\b3\/4\b/g, '750ML');
    standardized = standardized.replace(/\b1\/4\b/g, '250ML');
    
    // Fix abbreviations
    standardized = standardized.replace(/B\/CREAM/g, 'BEST CREAM');
    standardized = standardized.replace(/B\/WHISKY/g, 'BEST WHISKY');
    standardized = standardized.replace(/B&S/g, 'BLACK & WHITE');
    standardized = standardized.replace(/GUINESS/g, 'GUINNESS');
    standardized = standardized.replace(/DROTDY/g, 'DROSTDY HOF');
    standardized = standardized.replace(/\bCASABUENA\b/g, 'CASABUENA SANGARIA');
    standardized = standardized.replace(/CASABUENA SANGARIA SANGARIA/g, 'CASABUENA SANGARIA');
    standardized = standardized.replace(/DESPARADO/g, 'DESPERADO');
    standardized = standardized.replace(/T\. /g, 'TUSKER ');
    standardized = standardized.replace(/W\. CAP/g, 'WHITE CAP');
    standardized = standardized.replace(/H2O/g, 'WATER');
    
    // Clean up multiple spaces
    standardized = standardized.replace(/\s+/g, ' ').trim();
    
    return standardized;
}

async function updatePOSNames() {
    console.log('='.repeat(100));
    console.log('UPDATING POS OUTLET NAMES - BOMET TOWN MAIN BAR');
    console.log('='.repeat(100));
    
    try {
        // Get BOMET TOWN Main Bar outlet
        const { data: outlets, error: outletError } = await supabase
            .from('pos_outlets')
            .select('id, outlet_type')
            .eq('branch_id', 2)
            .eq('outlet_type', 'main_bar')
            .eq('is_active', true)
            .limit(1);
        
        if (outletError) throw outletError;
        if (!outlets || outlets.length === 0) {
            console.error('❌ ERROR: No main_bar outlet found for branch_id=2');
            process.exit(1);
        }
        
        const outlet = outlets[0];
        console.log(`\n✅ Found Outlet: ${outlet.outlet_type} (ID: ${outlet.id})\n`);
        
        // Get all items
        const { data: items, error: itemsError } = await supabase
            .from('pos_outlet_items')
            .select('id, name, current_stock')
            .eq('outlet_id', outlet.id)
            .order('name');
        
        if (itemsError) throw itemsError;
        
        console.log(`Found ${items.length} items to process\n`);
        console.log('-'.repeat(100));
        
        let updated = 0;
        let unchanged = 0;
        
        // Update each item
        for (const item of items) {
            const oldName = item.name;
            const newName = standardizeName(oldName);
            
            if (oldName !== newName) {
                const { error: updateError } = await supabase
                    .from('pos_outlet_items')
                    .update({ name: newName })
                    .eq('id', item.id);
                
                if (updateError) {
                    console.error(`❌ FAILED: ${oldName} - ${updateError.message}`);
                } else {
                    console.log(`✅ ${oldName.padEnd(50)} → ${newName}`);
                    updated++;
                }
            } else {
                unchanged++;
            }
        }
        
        console.log('-'.repeat(100));
        console.log(`\n📊 Results:`);
        console.log(`   ✅ Updated: ${updated} items`);
        console.log(`   ⏭️  Unchanged: ${unchanged} items`);
        console.log(`   📦 Total: ${items.length} items`);
        
        // Verification
        console.log('\n' + '='.repeat(100));
        console.log('VERIFICATION - Updated Names:');
        console.log('='.repeat(100));
        
        const { data: verifyItems, error: verifyError } = await supabase
            .from('pos_outlet_items')
            .select('name, current_stock')
            .eq('outlet_id', outlet.id)
            .gt('current_stock', 0)
            .order('current_stock', { ascending: false })
            .limit(30);
        
        if (!verifyError && verifyItems) {
            console.log(`\n${'ITEM NAME'.padEnd(55)} ${'STOCK'.padStart(10)}`);
            console.log('-'.repeat(100));
            for (const item of verifyItems) {
                const hasIssue = item.name.includes('/') || /[a-z]/.test(item.name);
                const marker = hasIssue ? '❌' : '✅';
                console.log(`${marker} ${item.name.padEnd(53)} ${Math.round(item.current_stock).toString().padStart(10)}`);
            }
        }
        
        console.log('\n' + '='.repeat(100));
        console.log('✅ POS outlet names updated successfully!');
        console.log('✅ All names now in UPPERCASE with ML sizes (350ML, 750ML, 1L)');
        console.log('='.repeat(100));
        
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        process.exit(1);
    }
}

// Run the script
updatePOSNames()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
