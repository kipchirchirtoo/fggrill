#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');

const args = new Set(process.argv.slice(2));
const getArgValue = (name, fallback = undefined) => {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
};

const dryRun = args.has('--dry-run');
const allowDestructive = args.has('--allow-destructive');
const baselineExisting = args.has('--baseline-existing');
const includeBackendSrc = args.has('--include-backend-src');
const fromName = getArgValue('--from');
const onlyName = getArgValue('--only');

const envFiles = [
  path.join(rootDir, 'backend/.env'),
  path.join(rootDir, 'frontend/.env'),
  path.join(rootDir, 'python-services/.env')
];

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false, quiet: true });
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL was not found in backend/.env, frontend/.env, or python-services/.env.');
  process.exit(1);
}

const migrationDirs = [
  path.join(rootDir, 'database/migrations'),
  ...(includeBackendSrc ? [path.join(rootDir, 'backend/src/database/migrations')] : [])
];

const destructiveNamePatterns = [
  /^00_drop_existing\.sql$/i,
  /^COMBINED_MIGRATION\.sql$/i,
  /^RUN_ALL_STOREKEEPING\.sql$/i
];

const destructiveSqlPatterns = [
  /\bDROP\s+DATABASE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bDROP\s+TABLE\b/i,
  /\bTRUNCATE\s+TABLE\b/i
];

const ensureForwardSlashes = (value) => value.split(path.sep).join('/');

const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');

const listMigrationFiles = () => {
  const files = [];
  for (const dir of migrationDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.sql')) continue;
      const absolutePath = path.join(dir, entry);
      if (!fs.statSync(absolutePath).isFile()) continue;
      const relativePath = ensureForwardSlashes(path.relative(rootDir, absolutePath));
      files.push({ name: entry, relativePath, absolutePath });
    }
  }

  files.sort((a, b) => a.relativePath.localeCompare(b.relativePath, undefined, {
    numeric: true,
    sensitivity: 'base'
  }));

  let filtered = files;
  if (fromName) {
    filtered = filtered.filter((file) => file.name >= fromName || file.relativePath.endsWith(`/${fromName}`));
  }
  if (onlyName) {
    filtered = filtered.filter((file) =>
      file.name === onlyName || file.relativePath === onlyName || file.relativePath.endsWith(`/${onlyName}`)
    );
  }
  return filtered;
};

const isDestructive = (file, sql) => {
  if (destructiveNamePatterns.some((pattern) => pattern.test(file.name))) return true;
  return destructiveSqlPatterns.some((pattern) => pattern.test(sql));
};

const createClient = () => new Client({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('supabase.co') || databaseUrl.includes('sslmode=require')
    ? { rejectUnauthorized: false }
    : undefined
});

const main = async () => {
  const migrations = listMigrationFiles();
  if (!migrations.length) {
    console.log('No migration files found for the selected options.');
    return;
  }

  const client = createClient();
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        id BIGSERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_ms INTEGER NOT NULL DEFAULT 0
      )
    `);
    await client.query(`
      ALTER TABLE public.schema_migrations
        ADD COLUMN IF NOT EXISTS filename TEXT,
        ADD COLUMN IF NOT EXISTS checksum TEXT,
        ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS execution_ms INTEGER NOT NULL DEFAULT 0
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS schema_migrations_filename_unique
        ON public.schema_migrations(filename)
        WHERE filename IS NOT NULL
    `);

    const { rows } = await client.query(
      'SELECT filename, checksum FROM public.schema_migrations WHERE filename IS NOT NULL'
    );
    const applied = new Map(rows.map((row) => [row.filename, row.checksum]));

    const candidates = migrations.map((file) => {
      const sql = fs.readFileSync(file.absolutePath, 'utf8');
      return {
        ...file,
        sql,
        checksum: sha256(sql),
        destructive: isDestructive(file, sql),
        appliedChecksum: applied.get(file.relativePath)
      };
    });

    const changed = candidates.filter((file) =>
      file.appliedChecksum && file.appliedChecksum !== file.checksum
    );
    if (changed.length) {
      console.error('Applied migration checksum mismatch detected:');
      for (const file of changed) {
        console.error(` - ${file.relativePath}`);
      }
      console.error('Refusing to continue. Create a new migration instead of editing an applied one.');
      process.exitCode = 1;
      return;
    }

    const unapplied = candidates.filter((file) => !file.appliedChecksum);
    const skippedDestructive = unapplied.filter((file) => file.destructive && !allowDestructive);
    const runnable = unapplied.filter((file) => !file.destructive || allowDestructive);

    console.log(`Migration directories: ${migrationDirs.map((dir) => path.relative(rootDir, dir)).join(', ')}`);
    console.log(`Applied migrations tracked: ${applied.size}`);
    console.log(`Unapplied migrations found: ${unapplied.length}`);
    if (skippedDestructive.length) {
      console.log(`Skipped destructive/baseline migrations: ${skippedDestructive.length}`);
      for (const file of skippedDestructive) console.log(` - SKIP ${file.relativePath}`);
    }

    if (baselineExisting && runnable.length) {
      if (dryRun) {
        console.log(`DRY RUN baseline would mark ${runnable.length} migrations as applied.`);
        return;
      }
      for (const file of runnable) {
        await client.query(
          'INSERT INTO public.schema_migrations (filename, checksum, execution_ms) VALUES ($1, $2, 0) ON CONFLICT (filename) DO NOTHING',
          [file.relativePath, file.checksum]
        );
        console.log(`BASELINE ${file.relativePath}`);
      }
      return;
    }

    if (!runnable.length) {
      console.log('No safe unapplied migrations to run.');
      return;
    }

    if (dryRun) {
      console.log('DRY RUN migrations that would run:');
      for (const file of runnable) console.log(` - ${file.relativePath}`);
      return;
    }

    for (const file of runnable) {
      const started = Date.now();
      console.log(`RUN ${file.relativePath}`);
      await client.query('BEGIN');
      try {
        await client.query(file.sql);
        const executionMs = Date.now() - started;
        await client.query(
          'INSERT INTO public.schema_migrations (filename, checksum, execution_ms) VALUES ($1, $2, $3)',
          [file.relativePath, file.checksum, executionMs]
        );
        await client.query('COMMIT');
        console.log(`OK  ${file.relativePath} (${executionMs} ms)`);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`FAIL ${file.relativePath}`);
        throw error;
      }
    }
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
