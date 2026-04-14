'use client';

import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Package, CreditCard, FileText, LayoutDashboard, ShoppingCart, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { KeyboardShortcutOverlay, useKeyboardShortcutOverlay } from '@/components/KeyboardShortcutOverlay';

export default function BranchAccountingDashboard() {
    const { user } = useAuth();
    const shortcutOverlay = useKeyboardShortcutOverlay('branchAccountant');

    const cards = [
        { title: 'Shift Review', icon: ClipboardCheck, href: '/dashboard/branch-accounting/shift-review', desc: 'Reconcile cashier shifts', shortcut: 'Alt+S' },
        { title: 'Stock Takes', icon: Package, href: '/dashboard/branch-accounting/stock-take', desc: 'Manage branch stock' },
        { title: 'Credit & Paid Bills', icon: CreditCard, href: '/dashboard/branch-accounting/credit-bills', desc: 'Manage staff and customer bills' },
        { title: 'Payments', icon: CreditCard, href: '/dashboard/branch-accounting/payments', desc: 'Record and verify payments', shortcut: 'Alt+P' },
        { title: 'Purchases', icon: ShoppingCart, href: '/dashboard/branch-accounting/purchases', desc: 'Manage branch purchases and POs' },
        { title: 'Invoices', icon: FileText, href: '/dashboard/branch-accounting/invoices', desc: 'Create and view invoices' },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <LayoutDashboard className="h-6 w-6 text-blue-600" />
                            Branch Accounting
                        </h1>
                        <p className="text-gray-500">Overview of accounting operations. Press ? for shortcuts</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {cards.map((card) => (
                            <Link key={card.title} href={card.href} className="block group">
                                <IOSCard className="p-6 h-full transition-all duration-200 group-hover:shadow-lg group-hover:scale-[1.02]">
                                    <card.icon className="h-8 w-8 text-blue-600 mb-4" />
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">{card.title}</h3>
                                    <p className="text-sm text-gray-500">{card.desc}</p>
                                    {card.shortcut && (
                                        <p className="text-xs text-gray-400 mt-2 font-mono">{card.shortcut}</p>
                                    )}
                                </IOSCard>
                            </Link>
                        ))}
                    </div>
                </div>

                <KeyboardShortcutOverlay
                    isOpen={shortcutOverlay.isOpen}
                    onClose={shortcutOverlay.close}
                    currentModule="branchAccountant"
                />
            </DashboardLayout>
        </ProtectedRoute>
    );
}
