import { Shield, Users, Building2, Settings, Activity, Lock } from 'lucide-react';

export default function SuperadminDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Shield className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Superadmin Role</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    The Superadmin role has complete control over the entire system, including all branches, users, and system-wide settings.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <Lock className="w-5 h-5 text-stone-500" />
                        Key Responsibilities
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'System-wide configuration and settings',
                            'User management and role assignment',
                            'Branch creation and management',
                            'Global financial oversight',
                            'Audit log review',
                            'Security policy enforcement'
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
                        <Activity className="w-5 h-5 text-stone-500" />
                        Dashboard Features
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Real-time system health monitoring',
                            'Global revenue and occupancy stats',
                            'Active user sessions overview',
                            'Critical alerts and notifications',
                            'Database and backup status',
                            'API performance metrics'
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-stone-400 flex-shrink-0" />
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-stone-900">Module Capabilities</h2>

                <div className="space-y-6">
                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                User Management
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-stone-600 text-sm leading-relaxed">
                                Superadmins can create, edit, and deactivate user accounts across all branches. They assign roles (e.g., Branch Manager, Accountant) and can reset passwords or force logouts for security.
                            </p>
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-amber-800">
                                <strong>Note:</strong> Only Superadmins can create other Superadmin accounts or Branch Managers.
                            </div>
                        </div>
                    </div>

                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                                <Building2 className="w-4 h-4" />
                                Branch Management
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-stone-600 text-sm leading-relaxed">
                                Create new hotel branches, configure their specific settings (room types, amenities, pricing rules), and assign managers. The Superadmin view allows for comparing performance across different locations.
                            </p>
                        </div>
                    </div>

                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                                <Settings className="w-4 h-4" />
                                System Settings
                            </h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-stone-600 text-sm leading-relaxed">
                                Configure global settings such as:
                            </p>
                            <ul className="grid sm:grid-cols-2 gap-2 text-sm text-stone-600">
                                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-stone-400 rounded-full" /> Email server configuration (SMTP)</li>
                                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-stone-400 rounded-full" /> Payment gateway integration keys</li>
                                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-stone-400 rounded-full" /> Backup schedules</li>
                                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-stone-400 rounded-full" /> Security policies (password strength, session timeout)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
