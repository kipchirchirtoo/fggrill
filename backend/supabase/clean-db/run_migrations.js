#!/usr/bin/env node
'use strict';

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const DATABASE_URL = process.env.DATABASE_URL_NEW;
if (!DATABASE_URL) {
  console.error('DATABASE_URL_NEW is required in backend/.env');
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const ALL_FILES = fs.readdirSync(MIGRATIONS_DIR)
  .filter(file => file.endsWith('.sql'))
  .sort();

/**
 * Split SQL text into individual statements, respecting:
 *  - Dollar-quoted blocks ($$...$$, $body$...$body$, etc.)
 *  - Single-quoted strings
 *  - Line and block comments
 */
function splitStatements(sql) {
  const stmts = [];
  let current = '';
  let i = 0;
  const len = sql.length;

  while (i < len) {
    // Line comment
    if (sql[i] === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const commentEnd = end === -1 ? len : end + 1;
      current += sql.slice(i, commentEnd);
      i = commentEnd;
      continue;
    }

    // Block comment
    if (sql[i] === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const commentEnd = end === -1 ? len : end + 2;
      current += sql.slice(i, commentEnd);
      i = commentEnd;
      continue;
    }

    // Dollar quoting: match $tag$
    if (sql[i] === '$') {
      const tagEnd = sql.indexOf('$', i + 1);
      if (tagEnd !== -1) {
        const tag = sql.slice(i, tagEnd + 1); // e.g. '$$' or '$body$'
        // Only treat as dollar-quote if tag matches [A-Za-z0-9_]* inside
        const inner = tag.slice(1, -1);
        if (/^[A-Za-z0-9_]*$/.test(inner)) {
          const closeIdx = sql.indexOf(tag, tagEnd + 1);
          if (closeIdx !== -1) {
            current += sql.slice(i, closeIdx + tag.length);
            i = closeIdx + tag.length;
            continue;
          }
        }
      }
    }

    // Single-quoted string
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < len) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }

    // Statement terminator
    if (sql[i] === ';') {
      current += ';';
      i++;
      const trimmed = current.trim();
      if (trimmed && trimmed !== ';') stmts.push(trimmed);
      current = '';
      continue;
    }

    current += sql[i];
    i++;
  }

  // Trailing statement without semicolon
  const trimmed = current.trim();
  if (trimmed) stmts.push(trimmed);

  return stmts;
}

async function runMigration(client, filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  if (!fs.existsSync(filepath)) {
    console.error(`  ❌ File not found: ${filepath}`);
    return { ok: false, skipped: 0, errors: [`File not found: ${filename}`] };
  }

  const sql = fs.readFileSync(filepath, 'utf8');
  const stmts = splitStatements(sql).filter(s => {
    // Skip pure comment blocks
    const stripped = s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    return stripped.length > 0;
  });

  console.log(`\n${'='.repeat(62)}`);
  console.log(`  ${filename}  (${stmts.length} statements)`);
  console.log('='.repeat(62));

  let okCount = 0;
  let errCount = 0;
  const errors = [];

  for (let idx = 0; idx < stmts.length; idx++) {
    const stmt = stmts[idx];
    try {
      await client.query('SAVEPOINT sp');
      await client.query(stmt);
      await client.query('RELEASE SAVEPOINT sp');
      okCount++;
    } catch (err) {
      await client.query('ROLLBACK TO SAVEPOINT sp').catch(() => {});
      await client.query('RELEASE SAVEPOINT sp').catch(() => {});

      const msg = err.message;
      // These are expected/harmless when re-running migrations
      const harmless =
        msg.includes('already exists') ||
        msg.includes('relation') && msg.includes('already exists') ||
        msg.includes('function') && msg.includes('already exists') ||
        msg.includes('Nothing to do') ||
        msg.includes('duplicate key value');

      if (harmless) {
        okCount++;
        // Silently skip harmless already-exists errors
      } else {
        errCount++;
        const preview = stmt.slice(0, 120).replace(/\s+/g, ' ');
        errors.push(`[stmt ${idx + 1}] ${msg} | SQL: ${preview}...`);
        console.error(`  ⚠  stmt ${idx + 1}: ${msg.slice(0, 100)}`);
        if (err.detail) console.error(`     detail: ${err.detail}`);
      }
    }
  }

  if (errCount === 0) {
    console.log(`  ✅ Done  (${okCount} OK, 0 errors)`);
  } else {
    console.log(`  ⚠  Done  (${okCount} OK, ${errCount} errors)`);
  }

  return { ok: errCount === 0, skipped: 0, errors };
}

async function main() {
  const targetFile = process.argv[2];
  const filesToRun = targetFile ? [targetFile] : ALL_FILES;

  console.log('Connecting to new Supabase database (session pooler)...');
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    statement_timeout: 180000,
  });

  try {
    await client.connect();
    console.log('✅ Connected\n');

    await client.query('BEGIN');

    // Show baseline
    const before = await client.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
    );
    console.log(`Tables before: ${before.rows[0].cnt}`);

    const summary = [];

    for (const file of filesToRun) {
      const result = await runMigration(client, file);
      summary.push({ file, ...result });
    }

    await client.query('COMMIT');

    // Final counts
    const after = await client.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
    );
    const fnCount = await client.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.routines WHERE routine_schema='public' AND routine_type='FUNCTION'`
    );
    const vwCount = await client.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.views WHERE table_schema='public'`
    );

    const allPassed = summary.every(s => s.ok);
    console.log(`\n${'═'.repeat(62)}`);
    console.log('  FINAL SUMMARY');
    console.log('═'.repeat(62));
    summary.forEach(s => {
      const icon = s.ok ? '✅' : '⚠ ';
      console.log(`  ${icon}  ${s.file}`);
      if (s.errors.length) s.errors.forEach(e => console.log(`       ${e}`));
    });
    console.log(`\n  Tables    : ${before.rows[0].cnt} → ${after.rows[0].cnt}  (+${after.rows[0].cnt - before.rows[0].cnt})`);
    console.log(`  Functions : ${fnCount.rows[0].cnt}`);
    console.log(`  Views     : ${vwCount.rows[0].cnt}`);
    console.log(`\n  ${allPassed ? '✅ ALL MIGRATIONS PASSED' : '⚠  SOME MIGRATIONS HAD ERRORS (see above)'}`);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Fatal error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
