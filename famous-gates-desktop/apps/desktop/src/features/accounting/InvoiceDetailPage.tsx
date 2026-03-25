import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PageShell title="Invoice Detail" description={`Invoice ID: ${id}`} />;
}
