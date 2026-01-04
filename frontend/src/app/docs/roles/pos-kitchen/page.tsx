import { ShoppingCart, ChefHat, Clock, UtensilsCrossed, Bell, FileText } from 'lucide-react';

export default function POSKitchenDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <UtensilsCrossed className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">POS & Kitchen</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    Integrated Point of Sale and Kitchen Display System (KDS) for seamless restaurant operations, from order taking to food preparation and service.
                </p>
            </div>

            <div className="space-y-8">
                <section>
                    <h2 className="text-2xl font-bold text-stone-900 mb-6 flex items-center gap-2">
                        <ShoppingCart className="w-6 h-6 text-stone-400" />
                        Point of Sale (POS)
                    </h2>
                    <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="text-lg font-semibold text-stone-900 mb-3">Order Management</h3>
                                <p className="text-stone-600 text-sm mb-4">
                                    Waiters use the POS interface to take orders for dine-in, takeaway, or room service.
                                </p>
                                <ul className="space-y-2 text-sm text-stone-600">
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-stone-400 rounded-full" /> Visual table selection map</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-stone-400 rounded-full" /> Menu categorization with search</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-stone-400 rounded-full" /> Custom item notes (e.g., "No onions")</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-stone-400 rounded-full" /> Bill splitting and merging</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-stone-900 mb-3">Billing & Payments</h3>
                                <p className="text-stone-600 text-sm mb-4">
                                    Process payments and generate fiscal receipts instantly.
                                </p>
                                <ul className="space-y-2 text-sm text-stone-600">
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-stone-400 rounded-full" /> Multiple payment methods (Cash, M-Pesa, Card)</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-stone-400 rounded-full" /> Room charge integration</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-stone-400 rounded-full" /> Discount application with authorization</li>
                                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-stone-400 rounded-full" /> Thermal printer support</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-stone-900 mb-6 flex items-center gap-2">
                        <ChefHat className="w-6 h-6 text-stone-400" />
                        Kitchen Display System (KDS)
                    </h2>
                    <div className="bg-stone-900 text-stone-300 rounded-xl p-6 shadow-lg">
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="p-4 bg-stone-800 rounded-lg border border-stone-700">
                                <div className="flex items-center gap-2 mb-3 text-amber-400">
                                    <Bell className="w-5 h-5" />
                                    <h3 className="font-semibold">Real-time Alerts</h3>
                                </div>
                                <p className="text-sm">
                                    New orders appear instantly on the kitchen screen with sound notifications. Urgent orders are highlighted.
                                </p>
                            </div>
                            <div className="p-4 bg-stone-800 rounded-lg border border-stone-700">
                                <div className="flex items-center gap-2 mb-3 text-blue-400">
                                    <Clock className="w-5 h-5" />
                                    <h3 className="font-semibold">Preparation Tracking</h3>
                                </div>
                                <p className="text-sm">
                                    Chefs mark items as "Preparing" and "Ready". The system tracks preparation time to monitor efficiency.
                                </p>
                            </div>
                            <div className="p-4 bg-stone-800 rounded-lg border border-stone-700">
                                <div className="flex items-center gap-2 mb-3 text-emerald-400">
                                    <FileText className="w-5 h-5" />
                                    <h3 className="font-semibold">Wastage Recording</h3>
                                </div>
                                <p className="text-sm">
                                    Directly log spoiled or returned items from the kitchen interface to update inventory automatically.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
