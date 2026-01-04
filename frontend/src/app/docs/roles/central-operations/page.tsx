import { Building2, Truck, Package, DollarSign, BarChart3, ArrowDownUp } from 'lucide-react';

export default function CentralOperationsDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Building2 className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Central Operations</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    The Central Operations module is the hub for multi-branch management, overseeing the central warehouse, stock distribution, and aggregate performance analysis.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-stone-500" />
                        Warehouse Management
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Master inventory catalog maintenance',
                            'Stock level monitoring and reorder alerts',
                            'Processing branch stock requests',
                            'Managing supplier deliveries',
                            'Tracking wastage and shrinkage',
                            'Inter-branch transfer coordination'
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
                        <Truck className="w-5 h-5 text-stone-500" />
                        Logistics & Dispatch
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Dispatch planning and scheduling',
                            'Vehicle and driver assignment',
                            'Delivery tracking and confirmation',
                            'Return logistics management',
                            'Route optimization',
                            'Delivery dispute resolution'
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
                <h2 className="text-2xl font-bold text-stone-900">Strategic Tools</h2>

                <div className="grid md:grid-cols-2 gap-6">
                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Branch Oversight
                            </h3>
                        </div>
                        <div className="p-6">
                            <p className="text-stone-600 text-sm leading-relaxed mb-4">
                                Compare performance metrics across all branches to identify trends and anomalies.
                            </p>
                            <ul className="text-sm text-stone-600 space-y-1">
                                <li>• Revenue comparison charts</li>
                                <li>• Occupancy rate analysis</li>
                                <li>• Staff efficiency metrics</li>
                            </ul>
                        </div>
                    </div>

                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                                <DollarSign className="w-4 h-4" />
                                Budgeting & Planning
                            </h3>
                        </div>
                        <div className="p-6">
                            <p className="text-stone-600 text-sm leading-relaxed mb-4">
                                Set and monitor financial targets for each branch and department.
                            </p>
                            <ul className="text-sm text-stone-600 space-y-1">
                                <li>• Annual and monthly budget allocation</li>
                                <li>• Variance analysis (Actual vs Budget)</li>
                                <li>• Cost control monitoring</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
