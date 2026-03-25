import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <PageShell title="Room Detail" description={`Room ID: ${id}`} />;
}
