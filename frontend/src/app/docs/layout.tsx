'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Book,
    Menu,
    X,
    ChevronRight,
    Search,
    Shield,
    Server,
    Layout,
    Database,
    Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();

    const navigation = [
        {
            title: 'Getting Started',
            items: [
                { title: 'Introduction', href: '/docs' },
                { title: 'System Architecture', href: '/docs/architecture' },
                { title: 'Installation', href: '/docs/installation' },
            ]
        },
        {
            title: 'Modules & Roles',
            items: [
                { title: 'Superadmin', href: '/docs/roles/superadmin' },
                { title: 'Branch Manager', href: '/docs/roles/branch-manager' },
                { title: 'Accountant & Auditor', href: '/docs/roles/finance' },
                { title: 'POS & Kitchen', href: '/docs/roles/pos-kitchen' },
                { title: 'Bar & Restaurant', href: '/docs/roles/bar' },
                { title: 'Reception & Front Desk', href: '/docs/roles/reception' },
                { title: 'Cashier', href: '/docs/roles/cashier' },
                { title: 'Housekeeping', href: '/docs/roles/housekeeping' },
            ]
        },
        {
            title: 'Technical Reference',
            items: [
                { title: 'Frontend Structure', href: '/docs/technical/frontend' },
                { title: 'Backend API', href: '/docs/technical/backend' },
                { title: 'Python Microservices', href: '/docs/technical/python-services' },
                { title: 'Database Schema', href: '/docs/technical/database' },
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-white">
            {/* Top Navigation */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-stone-200 z-50">
                <div className="h-full max-w-[1440px] mx-auto px-4 lg:px-8 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden p-2 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                            <Menu className="w-5 h-5 text-stone-600" />
                        </button>
                        <Link href="/" className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">F</span>
                            </div>
                            <span className="font-semibold text-stone-900 hidden sm:block">Kyogong Docs</span>
                        </Link>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-sm text-stone-500 w-64">
                            <Search className="w-4 h-4" />
                            <span>Search documentation...</span>
                            <kbd className="ml-auto text-[10px] font-mono bg-white border border-stone-200 px-1.5 py-0.5 rounded">⌘K</kbd>
                        </div>
                        <a
                            href="/dashboard"
                            className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
                        >
                            Go to Dashboard
                        </a>
                    </div>
                </div>
            </header>

            <div className="pt-16 max-w-[1440px] mx-auto flex">
                {/* Sidebar Navigation */}
                <aside className={`
          fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-stone-200 pt-16 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-[calc(100vh-64px)] lg:overflow-y-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
                    <nav className="p-6 space-y-8">
                        {navigation.map((section, idx) => (
                            <div key={idx}>
                                <h3 className="text-xs font-semibold text-stone-900 uppercase tracking-wider mb-3">
                                    {section.title}
                                </h3>
                                <ul className="space-y-1">
                                    {section.items.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <li key={item.href}>
                                                <Link
                                                    href={item.href}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isActive
                                                        ? 'bg-stone-100 text-stone-900 font-medium'
                                                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                                                        }`}
                                                >
                                                    {isActive && <ChevronRight className="w-3 h-3 text-stone-900" />}
                                                    {item.title}
                                                </Link>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>
                </aside>

                {/* Mobile Overlay */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-black/20 z-30 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Main Content */}
                <main className="flex-1 min-w-0 px-4 py-10 lg:px-12 lg:py-12">
                    <div className="max-w-4xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
