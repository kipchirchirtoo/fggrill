#!/usr/bin/env node

/**
 * Verification Script for Offline Login Fix
 * 
 * This script checks that all necessary changes are in place
 * for the offline login and redirection fix.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying Offline Login Fix...\n');

let allChecksPass = true;

// Helper function to check if file contains text
function fileContains(filePath, searchText, description) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const found = content.includes(searchText);
        
        if (found) {
            console.log(`✅ ${description}`);
        } else {
            console.log(`❌ ${description}`);
            allChecksPass = false;
        }
        
        return found;
    } catch (error) {
        console.log(`❌ ${description} - File not found: ${filePath}`);
        allChecksPass = false;
        return false;
    }
}

// Helper function to check if file exists
function fileExists(filePath, description) {
    const exists = fs.existsSync(filePath);
    
    if (exists) {
        console.log(`✅ ${description}`);
    } else {
        console.log(`❌ ${description}`);
        allChecksPass = false;
    }
    
    return exists;
}

console.log('📁 Checking Files...\n');

// Check main.js modifications
console.log('Checking electron/main.js:');
fileContains(
    'electron/main.js',
    'console.log(`[Protocol] Resolving:',
    '  Enhanced protocol handler with logging'
);
fileContains(
    'electron/main.js',
    'mainWindow.webContents.on(\'console-message\'',
    '  Renderer console logging enabled'
);
fileContains(
    'electron/main.js',
    'ipcMain.handle(\'navigate\'',
    '  IPC navigation handler added'
);

console.log('\nChecking electron/preload.js:');
fileContains(
    'electron/preload.js',
    'navigate: (url) => ipcRenderer.invoke(\'navigate\', url)',
    '  Navigate function exposed'
);
fileContains(
    'electron/preload.js',
    'window.DragEvent = class DragEvent',
    '  DragEvent polyfill present'
);
fileContains(
    'electron/preload.js',
    'window.PointerEvent = class PointerEvent',
    '  PointerEvent polyfill present'
);

console.log('\nChecking frontend/src/app/terminal/page.tsx:');
fileContains(
    'frontend/src/app/terminal/page.tsx',
    'console.log(\'[Terminal] handleLogin called\')',
    '  Enhanced logging in login handler'
);
fileContains(
    'frontend/src/app/terminal/page.tsx',
    'electronAPI.navigate',
    '  IPC navigation usage'
);
fileContains(
    'frontend/src/app/terminal/page.tsx',
    'window.location.href = redirectUrl',
    '  Fallback navigation present'
);

console.log('\n📄 Checking Documentation...\n');
fileExists('OFFLINE_LOGIN_FIX.md', 'Comprehensive fix documentation');
fileExists('test-offline-login.md', 'Test script documentation');
fileExists('OFFLINE_LOGIN_SOLUTION_SUMMARY.md', 'Solution summary');

console.log('\n🏗️  Checking Build Requirements...\n');
fileExists('frontend/out', 'Frontend build directory exists');
fileExists('frontend/out/terminal.html', 'Terminal page built');
fileExists('frontend/out/_next', 'Next.js static assets built');

console.log('\n📊 Verification Summary\n');

if (allChecksPass) {
    console.log('✅ All checks passed! The offline login fix is properly implemented.');
    console.log('\n📋 Next Steps:');
    console.log('   1. Run: npm run electron:dev');
    console.log('   2. Test offline login with a valid PIN');
    console.log('   3. Follow test-offline-login.md for comprehensive testing');
    console.log('   4. Check console logs for any errors');
    process.exit(0);
} else {
    console.log('❌ Some checks failed. Please review the errors above.');
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Ensure all files are modified correctly');
    console.log('   2. Run: cd frontend && npm run build');
    console.log('   3. Review OFFLINE_LOGIN_FIX.md for details');
    console.log('   4. Check git status to see what changed');
    process.exit(1);
}
