import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function AttendanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PageShell title="Attendance Detail" description={`Record ID: ${id}`} />;
}
