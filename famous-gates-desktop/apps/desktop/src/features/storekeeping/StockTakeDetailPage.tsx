import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function StockTakeDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PageShell title="Stock Take Detail" description={`Stock Take ID: ${id}`} />;
}
