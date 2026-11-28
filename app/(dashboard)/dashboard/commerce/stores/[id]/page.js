'use client';

import { useParams } from 'next/navigation';
import StoreWorkspace from '@/components/commerce/StoreWorkspace';

export default function StoreDetailPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  return <StoreWorkspace key={id} storeId={id} />;
}
