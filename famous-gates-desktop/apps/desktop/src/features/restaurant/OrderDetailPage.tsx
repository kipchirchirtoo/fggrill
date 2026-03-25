import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PageShell title="Order Detail" description={`Order ID: ${id}`} />;
}
