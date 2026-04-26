import { GetStaticPaths, GetStaticProps } from 'next';
import HotelBranchPage from '@/components/hotel/HotelBranchPage';
import { FALLBACK_BRANCHES } from '@/services/hotels.service';

interface Props {
  branchId: string;
}

export default function HotelPage({ branchId }: Props) {
  return <HotelBranchPage branchId={branchId} />;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = FALLBACK_BRANCHES.map(b => ({
    params: { id: String(b.id) },
  }));
  return { paths, fallback: 'blocking' };
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const branchId = String(params?.id);
  // We can't easily fetch live data at build time for dynamic IDs without the API running,
  // but we can ensure the props pass the ID string correctly.
  return { props: { branchId } };
};
