import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PageShell title="Supplier Detail" description={`Supplier ID: ${id}`} />;
}
