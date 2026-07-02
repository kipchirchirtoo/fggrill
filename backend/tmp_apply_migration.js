// Applies a migration file via the exec_sql RPC (HTTPS, service-role key),
// statement by statement, since Postgres's plpgsql EXECUTE (which exec_sql
// almost certainly wraps) cannot run multiple ;-separated commands in one
// call. Splits on ';' while respecting $$...$$ dollar-quoted function
// bodies so embedded semicolons inside CREATE FUNCTION don't break early.
const fs = require('fs');
const { execSql } = require('./tmp_exec_sql.js');

function splitStatements(sql) {
  // Strip full-line comments first (none of ours contain ';').
  const noComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const statements = [];
  let current = '';
  let inDollar = false;
  let i = 0;
  while (i < noComments.length) {
    if (noComments[i] === '$' && noComments[i + 1] === '$') {
      inDollar = !inDollar;
      current += '$$';
      i += 2;
      continue;
    }
    if (noComments[i] === ';' && !inDollar) {
      current += ';';
      const trimmed = current.trim();
      if (trimmed.length > 1) statements.push(trimmed);
      current = '';
      i += 1;
      continue;
    }
    current += noComments[i];
    i += 1;
  }
  const tail = current.trim();
  if (tail.length > 0) statements.push(tail);
  return statements;
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: node tmp_apply_migration.js <path-to-sql-file>');
    process.exit(1);
  }
  const sql = fs.readFileSync(file, 'utf8');
  const statements = splitStatements(sql);
  console.log(`Found ${statements.length} statements in ${file}\n`);

  for (let idx = 0; idx < statements.length; idx++) {
    const stmt = statements[idx];
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 90);
    console.log(`[${idx + 1}/${statements.length}] ${preview}...`);
    const result = await execSql(stmt);
    if (result.status !== 200) {
      console.error(`  FAILED (status ${result.status}): ${result.body}`);
      console.error('\nSTOPPING - fix this statement before continuing. Nothing after this point was applied.');
      process.exit(1);
    }
    let parsed;
    try { parsed = JSON.parse(result.body); } catch { parsed = result.body; }
    if (parsed && parsed.ok === false) {
      console.error(`  FAILED: ${JSON.stringify(parsed)}`);
      console.error('\nSTOPPING - fix this statement before continuing. Nothing after this point was applied.');
      process.exit(1);
    }
    console.log('  OK');
  }
  console.log(`\nAll ${statements.length} statements applied successfully.`);
}

main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
