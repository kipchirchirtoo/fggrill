import nextDynamic from 'next/dynamic';

const PageContent = nextDynamic(() => import('./PageContent'), { ssr: false });

// This page uses dynamic routing and should not be statically generated
export async function generateStaticParams() {
    return [];
}

export default function Page() {
    return <PageContent />;
}