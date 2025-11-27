'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Users, Plus, Search, Filter, ChevronDown } from 'lucide-react';
import { GuestModal } from '@/components/modals/GuestModals';
import { GuestsTable } from '@/components/tables/GuestsTable';

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Guest interface
interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  vipStatus: boolean;
  totalStays: number;
  totalSpent: number;
  lastStay: string;
  nextStay: string;
  idNumber: string;
}

export default function GuestsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVip, setFilterVip] = useState<'all' | 'vip' | 'regular'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch guests
  useEffect(() => {
    const fetchGuests = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_URL}/api/guests`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch guests');
        }

        const data = await response.json();
        setGuests(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        // toast.error('Failed to load guests');
      } finally {
        setIsLoading(false);
      }
    };

    fetchGuests();
  }, []);

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.RECEPTIONIST]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Guests Management</h1>
              <p className="text-gray-600 mt-1">Manage guest profiles and information</p>
            </div>
            <button
              onClick={() => setShowNewGuest(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="h-5 w-5" />
              New Guest
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Guests</p>
                  <p className="text-2xl font-bold text-gray-900">{guests.length}</p>
                </div>
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">VIP Guests</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {guests.filter(g => g.vipStatus).length}
                  </p>
                </div>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Stays</p>
                  <p className="text-2xl font-bold text-gray-900">2</p>
                </div>
                <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    KES {guests.reduce((acc, g) => acc + g.totalSpent, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Users className="h-5 w-5" />
                </div>
              </div>
            </div>
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
                  placeholder="Search guests..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div className="relative">
                <select
                  value={filterVip}
                  onChange={(e) => setFilterVip(e.target.value as 'all' | 'vip' | 'regular')}
                  className="appearance-none pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="all">All Guests</option>
                  <option value="vip">VIP Guests</option>
                  <option value="regular">Regular Guests</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              </div>
            </div>

            {/* Guests Table */}
            <GuestsTable
              guests={guests.filter(guest =>
                (filterVip === 'all' ||
                  (filterVip === 'vip' && guest.vipStatus) ||
                  (filterVip === 'regular' && !guest.vipStatus)) &&
                (searchTerm === '' ||
                  guest.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  guest.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  guest.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  guest.phone.includes(searchTerm))
              )}
            />
          </div>
        </div>

        {/* New Guest Modal */}
        <GuestModal
          isOpen={showNewGuest}
          onClose={() => setShowNewGuest(false)}
          mode="create"
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
