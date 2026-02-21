import nextDynamic from 'next/dynamic';

const PageContent = nextDynamic(() => import('./PageContent'), { ssr: false });

// This page uses dynamic routing and should not be statically generated
export const dynamic = 'force-dynamic';

export default function Page({ params }: { params: any }) {
    return <PageContent params={params} />;
}