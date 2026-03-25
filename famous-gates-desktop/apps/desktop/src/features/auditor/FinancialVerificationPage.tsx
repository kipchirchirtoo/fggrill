import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function FinancialVerificationPage() {
  const { branchId } = useParams<{ branchId: string }>();
  return <PageShell title="Financial Verification" description={`Branch: ${branchId}`} />;
}
