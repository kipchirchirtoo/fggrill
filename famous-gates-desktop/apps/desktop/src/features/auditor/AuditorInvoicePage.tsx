import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function AuditorInvoicePage() {
  const { id } = useParams<{ id: string }>();
  return <PageShell title="Auditor Invoice" description={`Invoice ID: ${id}`} />;
}
