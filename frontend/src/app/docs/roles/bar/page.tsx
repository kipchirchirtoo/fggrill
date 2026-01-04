import { Wine, GlassWater, ClipboardList, UserCheck } from 'lucide-react';

export default function BarDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Wine className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Bar Management</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    Specialized tools for bartenders to manage drink orders, tabs, and liquor inventory with speed and precision.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <GlassWater className="w-5 h-5 text-stone-500" />
                        Order Processing
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Quick-add interface for high-volume drinks',
                            'Custom cocktail modifiers',
                            'Happy hour pricing automation',
                            'Tab management (Open/Close/Transfer)',
                            'Split payments for groups',
                            'Recipe lookup integration'
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
                        <ClipboardList className="w-5 h-5 text-stone-500" />
                        Inventory Control
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Bottle-level stock tracking',
                            'Spillage and breakage logging',
                            'Shift-end stocktake forms',
                            'Par level reorder alerts',
                            'Supplier delivery receipt',
                            'Bin card history'
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
