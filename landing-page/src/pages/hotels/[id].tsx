import { GetStaticPaths, GetStaticProps } from 'next';
import HotelBranchPage from '@/components/hotel/HotelBranchPage';
import { FALLBACK_BRANCHES } from '@/services/hotels.service';

interface Props {
  branchId: number;
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
  const branchId = Number(params?.id);
  const branch = FALLBACK_BRANCHES.find(b => b.id === branchId);
  if (!branch) return { notFound: true };
  return { props: { branchId } };
};
