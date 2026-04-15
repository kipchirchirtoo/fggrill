import { supabase } from './src/config/supabase';

async function debugSuppliers() {
  try {
    const { data: suppliers, error } = await supabase
      .from('store_suppliers')
      .select('id, name, supplier_code, branch_id, created_by_id, status');

    if (error) {
      console.error('Error fetching suppliers:', error);
      return;
    }

    console.log('--- Current store_suppliers content ---');
    console.table(suppliers);

    // Also check branches to see what IDs mean
    const { data: branches , error } = await supabase.from('branches').select('id, name');
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    console.log('\n--- Branches ---');
    console.table(branches);

    // Check users to see who added them
    if (suppliers && suppliers.length > 0) {
      const uids = suppliers.map(s => s.created_by_id).filter(Boolean);
      const { data: users , error } = await supabase.from('users').select('id, first_name, last_name').in('id', uids);
      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      console.log('\n--- Users who added suppliers ---');
      console.table(users);
    }
  } catch (err) {
    console.error('Fatal error:', err);
  }
}

debugSuppliers();
