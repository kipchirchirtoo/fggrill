import dynamic from 'next/dynamic';

const PageContent = dynamic(() => import('./PageContent'), { ssr: false });

// FIX: Added for static export
export async function generateStaticParams() {
    return [{ id: 'static_export' }];
}

// FIX: We specifically destructure params and DO NOT accept or pass searchParams
// accessing searchParams causes a bail out of static generation.
export default function Page({ params }: { params: any }) {
    return <PageContent params={params} />;
}