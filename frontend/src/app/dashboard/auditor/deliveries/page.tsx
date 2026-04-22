'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
  Truck, Package, CheckCircle2, AlertTriangle, RefreshCw, Filter, ChevronRight, Calendar, MapPin
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Delivery {
  id: string;
  dispatch_number: string;
  from_branch_name: string;
  to_branch_name: string;
  status: string;
  items_count: number;
  documents_count: number;
  completed_at: string;
  created_at: string;
}

export default function AuditorDeliveriesPage() {
  const router = useRouter();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'flagged' | 'all'>('pending');

  useEffect(() => {
    fetchDeliveries();
  }, [statusFilter]);

  const fetchDeliveries = async () => {
    setIsLoading(true);
    try {
      const params = statusFilter === 'all' ? {} : { status: statusFilter };
      const res = await storeAPI.getAuditorDeliveries(params);
      if (res.success) {
        setDeliveries(res.data || []);
      }
    } catch (error) {
      console.error('Failed to load deliveries:', error);
      toast.error('Failed to load deliveries');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-700';
      case 'flagged':
        return 'bg-red-100 text-red-700';
      case 'completed':
      case 'pending':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-stone-100 text-stone-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'flagged':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Package className="h-4 w-4" />;
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Delivery Reviews</h1>
              <p className="text-stone-500 mt-0.5">Review and approve completed deliveries</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchDeliveries}
                disabled={isLoading}
                className="btn-secondary"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex gap-2 p-1 bg-stone-100 rounded-lg w-fit">
            {(['pending', 'approved', 'flagged', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Deliveries List */}
          {isLoading ? (
            <div className="card-elevated p-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-stone-400" />
              <p className="text-stone-500">Loading deliveries...</p>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <Truck className="h-12 w-12 mx-auto mb-3 text-stone-300" />
              <h3 className="text-lg font-medium text-stone-400 mb-2">No Deliveries Found</h3>
              <p className="text-stone-500">
                {statusFilter === 'pending'
                  ? 'All deliveries have been reviewed'
                  : `No ${statusFilter} deliveries at this time`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveries.map((delivery) => (
                <button
                  key={delivery.id}
                  onClick={() => router.push(`/dashboard/auditor/deliveries/${delivery.id}`)}
                  className="w-full card-elevated p-6 hover:shadow-lg transition-all text-left group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-stone-900 group-hover:text-stone-700 transition-colors">
                        {delivery.dispatch_number}
                      </h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-stone-500">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{delivery.from_branch_name} → {delivery.to_branch_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>{new Date(delivery.completed_at || delivery.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase flex items-center gap-1 ${getStatusBadge(delivery.status)}`}>
                        {getStatusIcon(delivery.status)}
                        {delivery.status}
                      </span>
                      <ChevronRight className="h-5 w-5 text-stone-300 group-hover:text-stone-500 transition-colors" />
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2 text-stone-600">
                      <Package className="h-4 w-4 text-stone-400" />
                      <span>{delivery.items_count || 0} items</span>
                    </div>
                    <div className="flex items-center gap-2 text-stone-600">
                      <CheckCircle2 className="h-4 w-4 text-stone-400" />
                      <span>{delivery.documents_count || 0} documents</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
