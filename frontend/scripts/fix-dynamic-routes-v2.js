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
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);

    // Get param name from directory: [id] -> id
    const dirName = path.basename(dir);
    let paramName = dirName.replace('[', '').replace(']', '');
    // Handle catch-all [...slug] -> slug
    if (paramName.startsWith('...')) {
        paramName = paramName.substring(3);
    }

    // Construct the dummy param object
    // For catch-all, it should be an array. detecting...
    const isCatchAll = dirName.includes('...');
    const paramValue = isCatchAll ? "['static_export']" : "'static_export'";

    const functionBody = `export async function generateStaticParams() {
    return [{ ${paramName}: ${paramValue} }];
}`;

    console.log(`Processing ${filePath} with param ${paramName}`);

    // 1. If it's a wrapped file (wrapper), we can just replace the function or append it.
    // The wrapper we created previously looks like:
    /*
    // FIX: Added for static export
    export async function generateStaticParams() {
        return [];
    }
    */

    if (content.includes('generateStaticParams')) {
        // Replace existing function
        // Simple regex to replace the function block
        const regex = /export async function generateStaticParams\s*\(\)\s*{[\s\S]*?}/;
        content = content.replace(regex, functionBody);
        fs.writeFileSync(filePath, content);
        console.log('Updated existing generateStaticParams');
    } else {
        // Append it, but check for "use client"
        const isClientComponent = content.includes("'use client'") || content.includes('"use client"');
        if (isClientComponent) {
            // It's a client component that hasn't been wrapped? 
            // (Should have been wrapped by previous run, but maybe restored or missed)

            // Check if we already migrated this one
            const contentIfExistsPath = path.join(dir, `PageContent${ext}`);
            if (fs.existsSync(contentIfExistsPath)) {
                console.log(`Skipping wrapping ${filePath}, PageContent already exists, assuming this is the wrapper but missing function??`);
                // If it is the wrapper, it SHOULD have no 'use client'.
                // If it has 'use client', it's the original file.
                // But if PageContent exists, we have a mess. 
                // Let's assume previous script worked generally.
            } else {
                console.log(`Wrapping client component ${filePath}`);
                // Rename page.tsx -> PageContent.tsx
                const newContentPath = path.join(dir, `PageContent${ext}`);
                fs.renameSync(filePath, newContentPath);

                // Create new page.tsx wrapper
                const wrapperContent = `
import PageContent from './PageContent';

// FIX: Updated for static export
${functionBody}

export default function Page(props: any) {
    return <PageContent {...props} />;
}
`;
                fs.writeFileSync(filePath, wrapperContent.trim());
            }
        } else {
            // Server component, just append
            fs.appendFileSync(filePath, '\n\n' + functionBody);
            console.log('Appended generateStaticParams');
        }
    }
});

console.log('Done!');
