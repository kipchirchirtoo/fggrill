import { useParams } from 'react-router-dom';
import { PageShell } from '../../components/PageShell';

export function StockItemPage() {
  const { sku } = useParams<{ sku: string }>();
  return <PageShell title="Stock Item" description={`SKU: ${sku}`} />;
}
