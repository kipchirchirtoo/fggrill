import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function AuditorSalesPage() {
  const { branchId } = useParams<{ branchId: string }>();
  return <PageShell title="Auditor Sales" description={`Branch: ${branchId}`} />;
}
