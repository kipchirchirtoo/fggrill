-- Add CHOMA_ZONE_KDS role to the database
-- Created: 2026-07-26

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumlabel = 'choma_zone_kds'
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
        ) THEN
            ALTER TYPE user_role ADD VALUE 'choma_zone_kds';
        END IF;
    END IF;
END$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'roles'
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'roles'
              AND column_name = 'code'
        ) THEN
            INSERT INTO public.roles (
                code,
                name,
                scope,
                permissions,
                is_system,
                role_name,
                created_at,
                updated_at
            )
            SELECT
                'choma_zone_kds',
                'Choma Zone KDS',
                'outlet',
                jsonb_build_object(
                    'source', 'legacy_user_roles',
                    'actions', jsonb_build_array(),
                    'legacy_role_name', 'choma_zone_kds'
                ),
                true,
                'Choma Zone KDS',
                NOW(),
                NOW()
            WHERE NOT EXISTS (
                SELECT 1
                FROM public.roles
                WHERE code = 'choma_zone_kds'
            );
        ELSIF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'roles'
              AND column_name = 'display_name'
        ) THEN
            INSERT INTO public.roles (name, display_name, description, created_at)
            SELECT
                'choma_zone_kds',
                'Choma Zone KDS',
                'Branch-scoped Choma Zone kitchen display role that logs directly into the Choma Zone KDS screen.',
                NOW()
            WHERE NOT EXISTS (
                SELECT 1
                FROM public.roles
                WHERE name = 'choma_zone_kds'
            );
        END IF;
    END IF;
END$$;
