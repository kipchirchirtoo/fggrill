const fs = require('fs');
const path = require('path');

console.log('🏨 Fixing hotel name from "Kyogongs" to "Famous Gates Hotels"...\n');

// Files to update
const filesToUpdate = [
    'backend/.env',
    'backend/src/utils/emailTemplates.ts',
    'backend/src/utils/emailTemplates.enterprise.ts',
    'backend/src/utils/bookingEmailTemplates.ts',
    'backend/src/routes/notification.routes.ts',
    'backend/src/controllers/payroll.controller.ts',
    'backend/src/controllers/payroll-simple.controller.ts',
    'backend/src/utils/pdfGenerator.ts'
];

let totalReplacements = 0;

filesToUpdate.forEach(filePath => {
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  File not found: ${filePath}`);
            return;
        }

        let content = fs.readFileSync(filePath, 'utf8');
        const originalContent = content;
        
        // Replace all variations of Kyogongs
        const replacements = [
            { from: /Kyogongs/g, to: 'Famous Gates Hotels' },
            { from: /Kyogong(?!s)/g, to: 'Famous Gates Hotels' }, // Kyogong without 's'
            { from: /KYOGONGS/g, to: 'FAMOUS GATES HOTELS' },
            { from: /kyogongs/g, to: 'famous-gates-hotels' }
        ];

        let fileReplacements = 0;
        replacements.forEach(({ from, to }) => {
            const matches = content.match(from);
            if (matches) {
                fileReplacements += matches.length;
                content = content.replace(from, to);
            }
        });

        if (content !== originalContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Updated ${filePath} (${fileReplacements} replacements)`);
            totalReplacements += fileReplacements;
        } else {
            console.log(`ℹ️  No changes needed in ${filePath}`);
        }
    } catch (error) {
        console.error(`❌ Error updating ${filePath}:`, error.message);
    }
});

console.log(`\n✅ Total replacements: ${totalReplacements}`);
console.log('\n📝 Summary:');
console.log('   - Hotel chain name: Famous Gates Hotels');
console.log('   - Branch 1 name: Kyogong (in database)');
console.log('   - Email: kyogongsbmt@gmail.com (unchanged)');
console.log('   - Phone: 0706 782 828 (unchanged)');
console.log('\n⚠️  IMPORTANT: Run "npm run build" in backend folder to rebuild!');
console.log('⚠️  IMPORTANT: Restart backend server after rebuild!');
