'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { ratePlansAPI } from '@/lib/api';
import { Plus, Edit2, Trash2, Check, X, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { RatePlanModal } from '@/components/modals/RatePlanModal';

export default function RateManagementPage() {
  const [ratePlans, setRatePlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const fetchRatePlans = async () => {
    setIsLoading(true);
    try {
      const res = await ratePlansAPI.getRatePlans();
      if (res.success) {
        setRatePlans(res.data || []);
      }
    } catch (error) {
      toast.error('Failed to load rate plans');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRatePlans();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rate plan?')) return;
    try {
      await ratePlansAPI.deleteRatePlan(id);
      toast.success('Rate plan deleted');
      fetchRatePlans();
    } catch (error) {
      toast.error('Failed to delete rate plan');
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Rate Management</h1>
              <p className="text-gray-500">Manage room rates, pricing rules, and restrictions</p>
            </div>
            <button
              onClick={() => {
                setSelectedPlan(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Rate Plan
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ratePlans.map((plan) => (
                <div key={plan.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
                        {plan.code}
                      </span>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      plan.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {plan.active ? 'Active' : 'Inactive'}
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 line-clamp-2">
                    {plan.description || 'No description provided'}
                  </p>

                  <div className="py-4 border-t border-b border-gray-100 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Type</span>
                      <span className="font-medium">{plan.rateType}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Pricing</span>
                      <span className="font-medium flex items-center gap-1">
                        {plan.isPercentage ? (
                          <><TrendingUp className="h-3 w-3" /> {plan.multiplier}x Base</>
                        ) : (
                          <>Fixed ${plan.fixedAmount}</>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Min Stay</span>
                      <span className="font-medium">{plan.minNights} Nights</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Refundable</span>
                      <span className={`font-medium ${plan.refundable ? 'text-green-600' : 'text-red-600'}`}>
                        {plan.refundable ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setSelectedPlan(plan);
                        setIsModalOpen(true);
                      }}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(plan.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {ratePlans.length === 0 && !isLoading && (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No Rate Plans</h3>
              <p className="text-gray-500 mb-4">Create your first rate plan to get started</p>
              <button
                onClick={() => {
                  setSelectedPlan(null);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create Rate Plan
              </button>
            </div>
          )}
        </div>

        <RatePlanModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSuccess={fetchRatePlans}
          initialData={selectedPlan}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
