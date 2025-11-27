'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Calendar, Plus, Search, Filter, ChevronDown, MoreVertical } from 'lucide-react';
import { ReservationModal } from '@/components/modals/ReservationModals';
import { QuickActionsModal, AddNewItemModal, CreateRequisitionModal, CreatePOModal, AddSupplierModal } from '@/components/modals/AdminActionModals';
import { ReservationsTable } from '@/components/tables/ReservationsTable';

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Reservation interface
interface Reservation {
  id: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  amount: number;
}

export default function ReservationsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showRequisition, setShowRequisition] = useState(false);
  const [showPO, setShowPO] = useState(false);
  const [showSupplier, setShowSupplier] = useState(false);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch reservations
  useEffect(() => {
    const fetchReservations = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/bookings`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch reservations');
        }

        const data = await response.json();
        setReservations(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        // toast.error('Failed to load reservations'); // toast is not defined
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
  }, []);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reservations</h1>
              <p className="text-gray-600 mt-1">Manage hotel bookings and reservations</p>
            </div>
            <button
              onClick={() => setShowNewReservation(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="h-5 w-5" />
              New Reservation
            </button>
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-100">
            {/* Search and Filters */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search reservations..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="appearance-none pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="checked-in">Checked In</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>

            {/* Reservations Table */}
            <ReservationsTable
              reservations={reservations.filter(reservation =>
                (filterStatus === 'all' || reservation.status === filterStatus) &&
                (searchTerm === '' ||
                  reservation.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  reservation.roomNumber.includes(searchTerm))
              )}
            />
          </div>
        </div>

        {/* New Reservation Modal */}
        <ReservationModal
          isOpen={showNewReservation}
          onClose={() => setShowNewReservation(false)}
          mode="create"
        />
        {/* Quick Actions Button */}
        <button
          onClick={() => setShowQuickActions(true)}
          className="fixed bottom-6 right-6 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700"
        >
          <MoreVertical className="h-6 w-6" />
        </button>

        {/* Admin Action Modals */}
        <QuickActionsModal
          isOpen={showQuickActions}
          onClose={() => setShowQuickActions(false)}
          onAddItem={() => setShowAddItem(true)}
          onCreateRequisition={() => setShowRequisition(true)}
          onCreatePO={() => setShowPO(true)}
          onAddSupplier={() => setShowSupplier(true)}
        />
        <AddNewItemModal
          isOpen={showAddItem}
          onClose={() => setShowAddItem(false)}
        />
        <CreateRequisitionModal
          isOpen={showRequisition}
          onClose={() => setShowRequisition(false)}
        />
        <CreatePOModal
          isOpen={showPO}
          onClose={() => setShowPO(false)}
        />
        <AddSupplierModal
          isOpen={showSupplier}
          onClose={() => setShowSupplier(false)}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
