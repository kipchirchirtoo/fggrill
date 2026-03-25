import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PageShell title="Purchase Order" description={`PO ID: ${id}`} />;
}
