import { Database, Table, Key, GitBranch } from 'lucide-react';

export default function DatabaseDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Database className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Database Schema</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    The system uses PostgreSQL as the primary relational database, managed via Supabase. It features a normalized schema designed for data integrity and scalability.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <Table className="w-5 h-5 text-stone-500" />
                        Core Tables
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'users (Auth & Profiles)',
                            'branches (Hotel Locations)',
                            'rooms (Inventory)',
                            'bookings (Reservations)',
                            'orders (POS & Restaurant)',
                            'transactions (Financial Records)'
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 flex-shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <GitBranch className="w-5 h-5 text-stone-500" />
                        Relationships
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Multi-tenant architecture via branch_id',
                            'Foreign key constraints for referential integrity',
                            'Cascading deletes for cleanup',
                            'Indexed columns for performance',
                            'JSONB columns for flexible data (e.g., settings)',
                            'Audit logging triggers'
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 flex-shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
