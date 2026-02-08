'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Users, Filter, Search, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function BranchCustomerCreditPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const router = useRouter();

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <IOSButton variant="secondary" onClick={() => router.back()} leftIcon={<ArrowLeft />}>Back</IOSButton>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    <Users className="h-6 w-6 text-blue-600" />
                                    Customer Credits
                                </h1>
                                <p className="text-gray-500">Manage corporate and walk-in customer credits.</p>
                            </div>
                        </div>
                    </div>

                    <IOSCard className="p-4">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input type="text" placeholder="Search customers..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <IOSButton variant="secondary" leftIcon={<Filter />}>Filter</IOSButton>
                        </div>

                        <div className="text-center py-12 text-gray-500">
                            <Users className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                            <p>No customer credit records found.</p>
                        </div>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
