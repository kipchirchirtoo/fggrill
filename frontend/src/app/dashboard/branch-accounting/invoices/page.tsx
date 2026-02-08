'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { FileText, Plus, Search, Building2, User, ShoppingBag, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function BranchInvoicesPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [activeTab, setActiveTab] = useState<'all' | 'conference' | 'guest' | 'general'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createType, setCreateType] = useState<'conference' | 'guest' | 'general' | null>(null);

    const handleCreate = (type: 'conference' | 'guest' | 'general') => {
        setCreateType(type);
        setShowCreateModal(true);
        toast.info(`Creating ${type} invoice placeholder - connecting to backend...`);
        // In real implementation: Open modal with specific form fields for the type
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <FileText className="h-6 w-6 text-blue-600" />
                                Invoices
                            </h1>
                            <p className="text-gray-500">Generate high-level invoices for conferences, guests, and branch sales.</p>
                        </div>

                        <div className="flex gap-2">
                            <IOSButton onClick={() => handleCreate('conference')} leftIcon={<Building2 />}>Conference Invoice</IOSButton>
                            <IOSButton variant="secondary" onClick={() => handleCreate('guest')} leftIcon={<User />}>Guest Invoice</IOSButton>
                            {/* <IOSButton variant="secondary" onClick={() => handleCreate('general')} leftIcon={<ShoppingBag />}>General Sale</IOSButton> */}
                        </div>
                    </div>

                    <IOSCard className="p-0">
                        {/* Simple filter bar */}
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex gap-4">
                                <button onClick={() => setActiveTab('all')} className={`text-sm font-medium ${activeTab === 'all' ? 'text-blue-600' : 'text-gray-500'}`}>All</button>
                                <button onClick={() => setActiveTab('conference')} className={`text-sm font-medium ${activeTab === 'conference' ? 'text-blue-600' : 'text-gray-500'}`}>Conference</button>
                                <button onClick={() => setActiveTab('guest')} className={`text-sm font-medium ${activeTab === 'guest' ? 'text-blue-600' : 'text-gray-500'}`}>High-Level Guest</button>
                            </div>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                <input type="text" placeholder="Search invoices..." className="w-full pl-8 pr-3 py-1.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                        </div>

                        <div className="text-center py-20 text-gray-500">
                            <FileText className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                            <p>No invoices found. Create one to get started.</p>
                            <p className="text-xs text-gray-400 mt-1">All created invoices are automatically sent to Auditor for review.</p>
                        </div>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
