import Link from 'next/link';
import { Metadata } from 'next';
import {
    ArrowRight,
    Book,
    Shield,
    Server,
    Database,
    Layout,
    Users,
    Building2,
    CreditCard
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Documentation',
};

export default function DocsPage() {
    return (
        <div className="space-y-12">
            {/* Hero Section */}
            <div className="space-y-6">
                <h1 className="text-4xl font-bold text-stone-900 tracking-tight">
                    Kyogong System Documentation
                </h1>
                <p className="text-xl text-stone-600 leading-relaxed max-w-2xl">
                    Comprehensive guide for the Kyogong Management System. Learn about the architecture, modules, and how to use the platform effectively.
                </p>
                <div className="flex items-center gap-4">
                    <Link
                        href="/docs/architecture"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white rounded-lg font-medium hover:bg-stone-800 transition-colors"
                    >
                        Start Reading
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                        href="/docs/roles/superadmin"
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-stone-200 text-stone-700 rounded-lg font-medium hover:bg-stone-50 transition-colors"
                    >
                        Role Guides
                    </Link>
                </div>
            </div>

            {/* Quick Links Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 hover:border-stone-200 transition-colors">
                    <div className="w-10 h-10 bg-white rounded-xl border border-stone-200 flex items-center justify-center mb-4">
                        <Layout className="w-5 h-5 text-amber-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900 mb-2">Frontend Architecture</h3>
                    <p className="text-sm text-stone-600 mb-4">
                        Next.js 14 application structure, Tailwind CSS styling, and component library.
                    </p>
                    <Link href="/docs/technical/frontend" className="text-sm font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1">
                        Learn more <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>

                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 hover:border-stone-200 transition-colors">
                    <div className="w-10 h-10 bg-white rounded-xl border border-stone-200 flex items-center justify-center mb-4">
                        <Server className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900 mb-2">Backend Services</h3>
                    <p className="text-sm text-stone-600 mb-4">
                        Express.js API, Python microservices for receipts and emails.
                    </p>
                    <Link href="/docs/technical/backend" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                        Learn more <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>

                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100 hover:border-stone-200 transition-colors">
                    <div className="w-10 h-10 bg-white rounded-xl border border-stone-200 flex items-center justify-center mb-4">
                        <Shield className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-stone-900 mb-2">Security & Roles</h3>
                    <p className="text-sm text-stone-600 mb-4">
                        Authentication, role-based access control (RBAC), and data protection.
                    </p>
                    <Link href="/docs/roles/superadmin" className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                        Learn more <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            </div>

            {/* Modules Overview */}
            <div>
                <h2 className="text-2xl font-bold text-stone-900 mb-6">System Modules</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { title: 'Branch Management', icon: Users, href: '/docs/roles/branch-manager' },
                        { title: 'Finance & Audit', icon: CreditCard, href: '/docs/roles/finance' },
                        { title: 'POS & Kitchen', icon: Layout, href: '/docs/roles/pos-kitchen' },
                    ].map((module) => (
                        <Link key={module.title} href={module.href}>
                            <div className="flex items-center gap-3 p-4 bg-white border border-stone-200 rounded-xl hover:shadow-sm transition-all">
                                <module.icon className="w-5 h-5 text-stone-400" />
                                <span className="font-medium text-stone-900">{module.title}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
