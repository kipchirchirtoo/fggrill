import { supabase } from '../config/supabase';
import crypto from 'crypto';

async function verifyStaffFix() {
    const testEmail = `test-staff-${Date.now()}@example.com`;
    const firstName = 'Test';
    const lastName = 'Staff';
    const role = 'waiter';
    const department = 'restaurant';
    const branchId = 1;

    console.log(`Attempting to create test staff with email: ${testEmail}`);

    try {
        // 1. Create User
        const newUserId = crypto.randomUUID();
        const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert([{
                id: newUserId,
                email: testEmail,
                first_name: firstName,
                last_name: lastName,
                role: 'restaurant',
                department: department,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (userError) {
            console.error('Error creating user:', userError);
            return;
        }
        console.log('User created successfully:', newUser.id);

        // 2. Create Staff Profile
        const position = 'Waiter';
        const staffData = {
            user_id: newUser.id,
            department: 'restaurant',
            position: position,
            shift: 'morning',
            salary: 25000,
            hire_date: new Date().toISOString().split('T')[0],
            status: 'active',
            branch_id: branchId,
            created_at: new Date().toISOString()
        };

        const { data: staffProfile, error: staffError } = await supabase
            .from('staff_profiles')
            .insert([staffData])
            .select()
            .single();

        if (staffError) {
            console.error('Error creating staff profile:', staffError);
            // Cleanup
            await supabase.from('users').delete().eq('id', newUser.id);
            return;
        }
        console.log('Staff profile created successfully:', staffProfile.id);

        // 3. Verify retrieval
        const { data: retrievedStaff, error: getError } = await supabase
            .from('staff_profiles')
            .select(`
        *,
        user:users!user_id(
          id,
          email,
          first_name,
          last_name,
          role
        )
      `)
            .eq('id', staffProfile.id)
            .single();

        if (getError) {
            console.error('Error retrieving staff:', getError);
        } else {
            console.log('Staff retrieved successfully:', retrievedStaff.user.email);
            console.log('Position:', retrievedStaff.position);
        }

        // Cleanup
        await supabase.from('staff_profiles').delete().eq('id', staffProfile.id);
        await supabase.from('users').delete().eq('id', newUser.id);
        console.log('Cleanup completed.');

    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

verifyStaffFix();
