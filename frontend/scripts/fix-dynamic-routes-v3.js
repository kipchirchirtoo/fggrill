const fs = require('fs');
const path = require('path');

function findDynamicPages(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (file.startsWith('[') && file.endsWith(']')) {
                const pageTsx = path.join(filePath, 'page.tsx');
                if (fs.existsSync(pageTsx)) {
                    fileList.push(pageTsx);
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
    const dir = path.dirname(filePath);

    // Get param name
    const dirName = path.basename(dir);
    let paramName = dirName.replace('[', '').replace(']', '');
    if (paramName.startsWith('...')) {
        paramName = paramName.substring(3);
    }

    const isCatchAll = dirName.includes('...');
    const paramValue = isCatchAll ? "['static_export']" : "'static_export'";

    // Check if this is likely our wrapper or a file we tampered with
    if (content.includes('// FIX: Added for static export') || content.includes('generateStaticParams')) {

        const contentPath = path.join(dir, 'PageContent.tsx');

        if (fs.existsSync(contentPath)) {
            // ONE: It's a wrapper (PageContent.tsx exists)
            // We rewrite the file completely to ensure clean syntax and use next/dynamic
            console.log(`Regenerating wrapper for ${filePath}`);

            const wrapperContent = `
import dynamic from 'next/dynamic';

const PageContent = dynamic(() => import('./PageContent'), { ssr: false });

// FIX: Added for static export
export async function generateStaticParams() {
    return [{ ${paramName}: ${paramValue} }];
}

export default function Page(props: any) {
    return <PageContent {...props} />;
}
`;
            fs.writeFileSync(filePath, wrapperContent.trim());
        } else {
            // TWO: It's a server component (or at least we didn't extract PageContent)
            // We truncate and append to fix potential syntax errors
            console.log(`Fixing server component ${filePath}`);

            if (content.includes('// FIX: Added for static export')) {
                const parts = content.split('// FIX: Added for static export');
                let cleanContent = parts[0].trim();

                const functionBody = `
// FIX: Added for static export
export async function generateStaticParams() {
    return [{ ${paramName}: ${paramValue} }];
}
`;
                fs.writeFileSync(filePath, cleanContent + '\n' + functionBody);
            }
        }
    }
});

console.log('Done!');
