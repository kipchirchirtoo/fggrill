import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../state/AppStateProvider';

export function DashboardHome() {
  const { session, isLoading } = useAppState();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (!session) {
        navigate('/login');
        return;
      }

      const role = session.role;

      // POS / offline roles — stay in local AppShell
      if (role === 'pos_kitchen' || role === 'restaurant' || role === 'waiter') {
        navigate('/dashboard/pos-kitchen');
      } else if (role === 'kitchen') {
        navigate('/dashboard/kitchen');
      } else if (role === 'cashier') {
        navigate('/dashboard/cashier');

      // All other roles → RemoteShell (full website)
      } else if (role === 'super_admin') {
        navigate('/remote/admin');
      } else if (role === 'general_manager') {
        navigate('/remote/gm');
      } else if (role === 'branch_manager') {
        navigate('/remote/branch-manager');
      } else if (role === 'auditor') {
        navigate('/remote/auditor');
      } else if (role === 'accountant' || role === 'branch_accountant') {
        navigate('/remote/branch-accounting');
      } else if (role === 'receptionist' || role === 'reception') {
        navigate('/remote/reception');
      } else if (role === 'hr') {
        navigate('/remote/hr');
      } else if (role === 'procurement') {
        navigate('/remote/procurement');
      } else if (role === 'storekeeper' || role === 'branch_store') {
        navigate('/remote/branch-store');
      } else if (role === 'central_store') {
        navigate('/remote/central-store');
      } else if (role === 'housekeeping') {
        navigate('/remote/housekeeping');
      } else if (role === 'maintenance') {
        navigate('/remote/maintenance');
      } else {
        // Default fallback — show admin remote
        navigate('/remote/admin');
      }
    }
  }, [session, isLoading, navigate]);

  return (
    <div className="flex h-[80vh] items-center justify-center">
      <div className="flex flex-col items-center space-y-6">
        <div className="h-16 w-16 rounded-full border-4 border-stone-100 border-t-stone-900 animate-spin" />
        <div className="text-center">
          <h2 className="text-lg font-black text-stone-900 uppercase tracking-widest">Initializing Portal</h2>
          <p className="text-sm text-stone-400 font-medium mt-1">Famous Gates Hybrid Desktop</p>
        </div>
      </div>
    </div>
  );
}
