import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function StaffDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PageShell title="Staff Detail" description={`Staff ID: ${id}`} />;
}
