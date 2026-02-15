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

    // Check if this is a wrapper or needs fixing
    // We look for existing wrappers or files we want to wrap
    const contentPath = path.join(dir, 'PageContent.tsx');

    if (fs.existsSync(contentPath)) {
        console.log(`Regenerating wrapper for ${filePath}`);

        const wrapperContent = `
import dynamic from 'next/dynamic';

const PageContent = dynamic(() => import('./PageContent'), { ssr: false });

// FIX: Added for static export
export async function generateStaticParams() {
    return [{ ${paramName}: ${paramValue} }];
}

// FIX: We specifically destructure params and DO NOT accept or pass searchParams
// accessing searchParams causes a bail out of static generation.
export default function Page({ params }: { params: any }) {
    return <PageContent params={params} />;
}
`;
        fs.writeFileSync(filePath, wrapperContent.trim());
    } else {
        // Server component - ensure generateStaticParams exists
        // This part remains similar but we don't change the component default export 
        // unless it looks like we broke it previously.
        // Actually, for pure server components that are NOT wrappers, we just appended the function.
        // We should leave them alone if they look correct, or re-append if missing.

        if (!content.includes('generateStaticParams')) {
            console.log(`Appending generateStaticParams to server component ${filePath}`);
            const functionBody = `
// FIX: Added for static export
export async function generateStaticParams() {
    return [{ ${paramName}: ${paramValue} }];
}
`;
            fs.writeFileSync(filePath, content + '\n\n' + functionBody);
        }
    }
});

console.log('Done!');
