import { Sparkles, Bed, ClipboardCheck, AlertTriangle } from 'lucide-react';

export default function HousekeepingDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Sparkles className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Housekeeping</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    Manage room cleanliness, maintenance tasks, and staff assignments to ensure high standards of guest comfort.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <Bed className="w-5 h-5 text-stone-500" />
                        Room Status Management
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Real-time room status updates (Clean/Dirty/Inspecting)',
                            'Priority cleaning queue for early arrivals',
                            'Out-of-order room blocking',
                            'Deep cleaning scheduling',
                            'Linen inventory tracking',
                            'Lost and found logging'
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
                        <ClipboardCheck className="w-5 h-5 text-stone-500" />
                        Task Assignment
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Auto-assign rooms to attendants based on floor',
                            'Create ad-hoc tasks (e.g., "Extra towels")',
                            'Track cleaning times per room',
                            'Supervisor inspection checklists',
                            'Maintenance request generation',
                            'Staff performance reporting'
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
                <h2 className="text-2xl font-bold text-stone-900">Status Workflow</h2>
                <div className="bg-white border border-stone-200 rounded-xl p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
                        <div className="flex flex-col items-center text-center p-4 bg-stone-50 rounded-lg flex-1">
                            <div className="w-3 h-3 bg-stone-400 rounded-full mb-2" />
                            <span className="font-semibold">Dirty</span>
                            <span className="text-stone-500 text-xs mt-1">Guest checks out</span>
                        </div>
                        <div className="hidden md:block w-8 h-0.5 bg-stone-200" />
                        <div className="flex flex-col items-center text-center p-4 bg-blue-50 rounded-lg flex-1">
                            <div className="w-3 h-3 bg-blue-500 rounded-full mb-2" />
                            <span className="font-semibold text-blue-700">Cleaning</span>
                            <span className="text-blue-600 text-xs mt-1">Attendant starts work</span>
                        </div>
                        <div className="hidden md:block w-8 h-0.5 bg-stone-200" />
                        <div className="flex flex-col items-center text-center p-4 bg-amber-50 rounded-lg flex-1">
                            <div className="w-3 h-3 bg-amber-500 rounded-full mb-2" />
                            <span className="font-semibold text-amber-700">Inspecting</span>
                            <span className="text-amber-600 text-xs mt-1">Supervisor review</span>
                        </div>
                        <div className="hidden md:block w-8 h-0.5 bg-stone-200" />
                        <div className="flex flex-col items-center text-center p-4 bg-emerald-50 rounded-lg flex-1">
                            <div className="w-3 h-3 bg-emerald-500 rounded-full mb-2" />
                            <span className="font-semibold text-emerald-700">Clean</span>
                            <span className="text-emerald-600 text-xs mt-1">Ready for guest</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
