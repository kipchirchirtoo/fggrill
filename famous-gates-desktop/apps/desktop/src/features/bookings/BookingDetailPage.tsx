import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PageShell title="Booking Detail" description={`Booking ID: ${id}`} />;
}
