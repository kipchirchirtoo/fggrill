import CentralStoreRequestDetailClient from './client-page';

export async function generateStaticParams() {
    return [{ id: 'static_export' }];
}

export default function CentralStoreRequestDetailPage() {
    return <CentralStoreRequestDetailClient />;
}
