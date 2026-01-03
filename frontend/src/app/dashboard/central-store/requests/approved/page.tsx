'use client';

import { redirect } from 'next/navigation';

export default function ApprovedRequestsPage() {
  redirect('/dashboard/central-store/requests');
}
