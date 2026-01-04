import { Building2, Users, Bed, ClipboardList, TrendingUp, Calendar } from 'lucide-react';

export default function BranchManagerDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Building2 className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Branch Manager Role</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    The Branch Manager oversees the daily operations of a specific hotel branch, managing staff, guests, inventory, and facility maintenance.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-stone-500" />
                        Key Responsibilities
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Staff scheduling and performance monitoring',
                            'Guest satisfaction and complaint resolution',
                            'Room inventory and housekeeping oversight',
                            'Local procurement and stock management',
                            'Facility maintenance coordination',
                            'Daily financial reconciliation'
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
                        <TrendingUp className="w-5 h-5 text-stone-500" />
                        Dashboard Metrics
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Current occupancy rate',
                            'Daily revenue (Room & F&B)',
                            'Staff attendance status',
                            'Pending housekeeping tasks',
                            'Maintenance ticket status',
                            'Upcoming reservations'
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
                <h2 className="text-2xl font-bold text-stone-900">Operational Modules</h2>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                                <Bed className="w-4 h-4" />
                                Room & Reservation Management
                            </h3>
                        </div>
                        <div className="p-6">
                            <p className="text-stone-600 text-sm leading-relaxed mb-4">
                                View a live tape chart of room bookings, manage check-ins/check-outs, and handle room blocking for maintenance.
                            </p>
                            <ul className="text-sm text-stone-600 space-y-1">
                                <li>• Modify booking dates and room types</li>
                                <li>• Process special requests</li>
                                <li>• View guest history and preferences</li>
                            </ul>
                        </div>
                    </div>

                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Staff Management
                            </h3>
                        </div>
                        <div className="p-6">
                            <p className="text-stone-600 text-sm leading-relaxed mb-4">
                                Manage the branch team including receptionists, housekeepers, chefs, and waiters.
                            </p>
                            <ul className="text-sm text-stone-600 space-y-1">
                                <li>• Create weekly shifts and rosters</li>
                                <li>• Track attendance and overtime</li>
                                <li>• Conduct performance reviews</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
