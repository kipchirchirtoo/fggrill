'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, Calendar, Bed, DollarSign,
  Star, Award, Gift, Clock, ChevronLeft, Edit, FileText,
  Crown, Shield, Sparkles, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { guestAPI, guestLoyaltyAPI, documentsAPI } from '@/lib/api';
import DocumentUploadModal from '@/components/modals/DocumentUploadModal';

interface Guest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  id_type?: string;
  id_number?: string;
  date_of_birth?: string;
  vip_status?: boolean;
  notes?: string;
  preferences?: Record<string, any>;
  created_at: string;
}

interface LoyaltyData {
  tier: string;
  points: number;
  pointsMultiplier: number;
  benefits: string[];
  statistics: {
    totalStays: number;
    totalNights: number;
    totalSpent: number;
  };
  nextTier?: {
    name: string;
    pointsNeeded: number;
  };
}

interface StayHistory {
  bookings: any[];
  statistics: {
    totalStays: number;
    totalNights: number;
    totalSpent: number;
    averageStayValue: number;
    firstStay: string | null;
    lastStay: string | null;
  };
}

const tierColors: Record<string, { bg: string; text: string; icon: any }> = {
  Bronze: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: Shield },
  Silver: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', icon: Star },
  Gold: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: Award },
  Platinum: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', icon: Crown },
};

export default function GuestProfilePage() {
  const params = useParams();
  const router = useRouter();
  const guestId = params.id as string;

  const [guest, setGuest] = useState<Guest | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null);
  const [history, setHistory] = useState<StayHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDocModal, setShowDocModal] = useState(false);

  useEffect(() => {
    if (guestId) {
      fetchGuestData();
    }
  }, [guestId]);

  const fetchGuestData = async () => {
    setLoading(true);
    try {
      const [guestRes, loyaltyRes, historyRes] = await Promise.all([
        guestAPI.getGuest(guestId),
        guestLoyaltyAPI.getLoyalty(guestId),
        guestLoyaltyAPI.getHistory(guestId),
      ]);

      if (guestRes.success) setGuest(guestRes.data);
      if (loyaltyRes.success) setLoyalty(loyaltyRes.data);
      if (historyRes.success) setHistory(historyRes.data);
    } catch (error) {
      toast.error('Failed to load guest data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getTierStyle = (tier: string) => {
    return tierColors[tier] || tierColors.Bronze;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!guest) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Guest not found</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-blue-600 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const tierStyle = getTierStyle(loyalty?.tier || 'Bronze');
  const TierIcon = tierStyle.icon;

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Guest Profile
          </h1>
        </div>
        <button
          onClick={() => setShowDocModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        >
          <FileText className="w-4 h-4" />
          Documents
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Edit className="w-4 h-4" />
          Edit Guest
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile & Loyalty */}
        <div className="space-y-6">
          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {guest.first_name[0]}{guest.last_name[0]}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {guest.first_name} {guest.last_name}
                </h2>
                {guest.vip_status && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    VIP Guest
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <Mail className="w-4 h-4" />
                <span>{guest.email}</span>
              </div>
              {guest.phone && (
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                  <Phone className="w-4 h-4" />
                  <span>{guest.phone}</span>
                </div>
              )}
              {(guest.city || guest.country) && (
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span>{[guest.city, guest.country].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {guest.date_of_birth && (
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(guest.date_of_birth).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Loyalty Card */}
          {loyalty && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className={`rounded-2xl p-6 border ${tierStyle.bg} border-gray-200 dark:border-gray-700`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Loyalty Status</h3>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${tierStyle.bg} ${tierStyle.text}`}>
                  <TierIcon className="w-4 h-4" />
                  <span className="font-medium">{loyalty.tier}</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-400">Points Balance</span>
                    <span className="font-bold text-gray-900 dark:text-white">{loyalty.points.toLocaleString()}</span>
                  </div>
                  {loyalty.nextTier && (
                    <>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                          style={{ width: `${Math.min(100, (loyalty.points / (loyalty.points + loyalty.nextTier.pointsNeeded)) * 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {loyalty.nextTier.pointsNeeded.toLocaleString()} points to {loyalty.nextTier.name}
                      </p>
                    </>
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Member Benefits
                  </h4>
                  <ul className="space-y-1">
                    {loyalty.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Gift className="w-3 h-3 text-green-500" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column - Stats & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <Bed className="w-4 h-4" />
                <span className="text-sm">Total Stays</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {history?.statistics.totalStays || 0}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Total Nights</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {history?.statistics.totalNights || 0}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Total Spent</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(history?.statistics.totalSpent || 0)}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Avg. Stay Value</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(history?.statistics.averageStayValue || 0)}
              </p>
            </motion.div>
          </div>

          {/* Stay History */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Stay History
            </h3>

            {history?.bookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No stay history available
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Confirmation</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Check-in</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Check-out</th>
                      <th className="text-left py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Room</th>
                      <th className="text-right py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Amount</th>
                      <th className="text-center py-3 px-2 text-sm font-medium text-gray-500 dark:text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history?.bookings.slice(0, 10).map((booking: any) => (
                      <tr key={booking.id} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-3 px-2">
                          <span className="font-mono text-sm text-gray-900 dark:text-white">
                            {booking.confirmation_number}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(booking.check_in_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(booking.check_out_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-900 dark:text-white">
                          {booking.room?.room_number || '-'} ({booking.room_type?.name || 'N/A'})
                        </td>
                        <td className="py-3 px-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(booking.total_amount || 0)}
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            booking.status === 'checked_out'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : booking.status === 'checked_in'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                              : booking.status === 'cancelled'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}>
                            {booking.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>

          {/* Preferences */}
          {guest.preferences && Object.keys(guest.preferences).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Guest Preferences
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(guest.preferences).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Document Modal */}
      <DocumentUploadModal
        isOpen={showDocModal}
        onClose={() => setShowDocModal(false)}
        guestId={guestId}
        guestName={`${guest.first_name} ${guest.last_name}`}
      />
    </div>
  );
}
