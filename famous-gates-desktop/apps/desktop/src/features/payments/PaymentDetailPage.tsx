import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PageShell title="Payment Detail" description={`Payment ID: ${id}`} />;
}
