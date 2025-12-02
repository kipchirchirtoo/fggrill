'use client';

// Redirect to incoming page
import { redirect } from 'next/navigation';

export default function BranchReceivePage() {
  redirect('/dashboard/branch-store/incoming');
}
