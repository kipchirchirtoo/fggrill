import StockTakeDetailClientV2 from './client-page';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  return [{ id: 'static_export' }];
}

export default function StockTakeDetailPage({ params }: { params: { id: string } }) {
  return <StockTakeDetailClientV2 id={params.id} />;
}
