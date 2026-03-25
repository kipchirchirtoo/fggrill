import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function BookingConfirmationPage() {
  const { confirmationNumber } = useParams<{ confirmationNumber: string }>();
  return (
    <PageShell
      title="Booking Confirmation"
      description={confirmationNumber ? `Confirmation: ${confirmationNumber}` : 'Confirm your booking'}
    />
  );
}
