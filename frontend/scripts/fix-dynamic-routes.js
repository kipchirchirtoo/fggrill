const fs = require('fs');
const path = require('path');

function findDynamicPages(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (file.startsWith('[') && file.endsWith(']')) {
                // It's a dynamic route folder
                // Check for page.tsx or page.js inside
                const pageTsx = path.join(filePath, 'page.tsx');
                const pageJs = path.join(filePath, 'page.js');

                if (fs.existsSync(pageTsx)) {
                    fileList.push(pageTsx);
                } else if (fs.existsSync(pageJs)) {
                    fileList.push(pageJs);
                }
            }
            findDynamicPages(filePath, fileList);
        }
    });

    return fileList;
}

const appDir = path.join(__dirname, '../src/app');
const dynamicPages = findDynamicPages(appDir);

console.log(`Found ${dynamicPages.length} dynamic pages.`);

dynamicPages.forEach(filePath => {
    let content = fs.readFileSync(filePath, 'utf8');

    // Check if generateStaticParams is already defined
    if (!content.includes('generateStaticParams')) {
        console.log(`Fixing: ${filePath}`);

        const appendContent = `
// FIX: Added for static export
export async function generateStaticParams() {
    return [];
}
`;
        fs.appendFileSync(filePath, appendContent);
    } else {
        console.log(`Skipping (already exists): ${filePath}`);
    }
});

console.log('Done!');
