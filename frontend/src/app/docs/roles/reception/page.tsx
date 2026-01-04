import { ConciergeBell, Calendar, Key, UserCheck, LogIn, LogOut } from 'lucide-react';

export default function ReceptionDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <ConciergeBell className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Reception & Front Desk</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    The central hub for guest interactions, managing the entire guest lifecycle from reservation to check-out.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-stone-500" />
                        Reservation Management
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Create and modify bookings',
                            'View room availability calendar',
                            'Manage group reservations',
                            'Handle deposit payments',
                            'Send confirmation emails',
                            'Track special requests'
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
                        <Key className="w-5 h-5 text-stone-500" />
                        Guest Services
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Express check-in/check-out',
                            'Key card issuance',
                            'Wake-up call scheduling',
                            'Concierge services logging',
                            'Guest profile management',
                            'Loyalty program enrollment'
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
                <h2 className="text-2xl font-bold text-stone-900">Daily Operations</h2>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                                <LogIn className="w-4 h-4" />
                                Arrivals
                            </h3>
                        </div>
                        <div className="p-6">
                            <p className="text-stone-600 text-sm leading-relaxed mb-4">
                                Monitor expected arrivals and prepare for guest check-in.
                            </p>
                            <ul className="text-sm text-stone-600 space-y-1">
                                <li>• Verify room readiness with Housekeeping</li>
                                <li>• Prepare registration cards</li>
                                <li>• Pre-authorize credit cards</li>
                            </ul>
                        </div>
                    </div>

                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                                <LogOut className="w-4 h-4" />
                                Departures
                            </h3>
                        </div>
                        <div className="p-6">
                            <p className="text-stone-600 text-sm leading-relaxed mb-4">
                                Manage the check-out process and ensure accurate billing.
                            </p>
                            <ul className="text-sm text-stone-600 space-y-1">
                                <li>• Review folio charges with guest</li>
                                <li>• Process final payment</li>
                                <li>• Collect room keys</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
