const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres.utsvlihpudfraxzcmtle:Allan%4013900@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
});

const executeMigration = async () => {
    try {
        const res = await pool.query(`
      DO $$ BEGIN
        CREATE TYPE adjustment_type AS ENUM ('deduction', 'addition');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE adjustment_category AS ENUM (
            'credit_bill', 'advance', 'loan_installment', 
            'nssf', 'shif', 'paye', 'housing_levy', 
            'uniform', 'absent_day', 'contribution', 
            'extra_day', 'other'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      
      DO $$ BEGIN
        CREATE TYPE adjustment_status AS ENUM ('pending', 'applied', 'cancelled');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS public.staff_payroll_adjustments (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          staff_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE CASCADE,
          type adjustment_type NOT NULL,
          category adjustment_category NOT NULL,
          amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
          description TEXT,
          month VARCHAR(2) NOT NULL,
          year INTEGER NOT NULL,
          status adjustment_status DEFAULT 'pending',
          payroll_id UUID REFERENCES public.staff_payroll(id) ON DELETE SET NULL,
          created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
      );

      DROP TRIGGER IF EXISTS update_staff_payroll_adjustments_timestamp ON public.staff_payroll_adjustments;
      CREATE TRIGGER update_staff_payroll_adjustments_timestamp
      BEFORE UPDATE ON public.staff_payroll_adjustments
      FOR EACH ROW
      EXECUTE FUNCTION public.update_staff_profile_timestamp();
    `);
        console.log('Migration successful');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
};

executeMigration();
