/**
 * Low-memory production build.
 *
 * `tsc` type-checks the whole program at once; for this backend that needs well over 700 MB,
 * which exceeds Render's free 512 MB instances (the build was aborted with "core dumped" and
 * the service then failed to start because dist/server.js did not exist).
 *
 * This script compiles every file on its own with ts.transpileModule (same output settings as
 * tsconfig.json, no cross-file type-checking), so memory use stays small and it finishes in a
 * few seconds. Type safety is still enforced separately with `npm run typecheck`.
 *
 *   node scripts/build.js            -> ./dist
 *   BUILD_OUT=/tmp/x node scripts/build.js
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const outDir = path.resolve(process.env.BUILD_OUT || path.join(root, 'dist'));

const configFile = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
if (configFile.error) {
    console.error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
    process.exit(1);
}
const { options } = ts.convertCompilerOptionsFromJson(configFile.config.compilerOptions, root);
const compilerOptions = {
    ...options,
    isolatedModules: true,
    sourceMap: false,
    declaration: false,
    inlineSourceMap: false,
    noEmit: false,
};

const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(full);
        return [full];
    });

const files = walk(srcDir).filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.endsWith('.test.ts'));

let failed = 0;
for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const result = ts.transpileModule(source, {
        compilerOptions,
        fileName: file,
        reportDiagnostics: true,
    });
    const errors = (result.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error);
    if (errors.length) {
        failed += 1;
        for (const d of errors) {
            console.error(`${path.relative(root, file)}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
        }
        continue;
    }
    const target = path.join(outDir, path.relative(srcDir, file)).replace(/\.ts$/, '.js');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, result.outputText);
}

if (failed > 0) {
    console.error(`Build failed: ${failed} file(s) have syntax errors.`);
    process.exit(1);
}
console.log(`Built ${files.length} files -> ${path.relative(root, outDir) || '.'}`);
