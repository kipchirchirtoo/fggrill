import BranchRequestDetailClient from './client-page';

export async function generateStaticParams() {
    return [{ id: 'static_export' }];
}

export default function BranchRequestDetailPage() {
    return <BranchRequestDetailClient />;
}
