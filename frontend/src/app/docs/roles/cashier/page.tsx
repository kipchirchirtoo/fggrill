import { Calculator, Banknote, Receipt, Search, CheckCircle, Clock } from 'lucide-react';

export default function CashierDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Banknote className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Cashier Role</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    The Cashier is responsible for processing guest payments, verifying transactions, and ensuring accurate financial closure for both hotel and restaurant services.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <Calculator className="w-5 h-5 text-stone-500" />
                        Core Functions
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Bill lookup via barcode scan or ID',
                            'Processing multi-method payments',
                            'M-Pesa transaction verification',
                            'Generating fiscal receipts',
                            'Handling refunds and voids',
                            'Daily cash reconciliation'
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
                        <Clock className="w-5 h-5 text-stone-500" />
                        Workflow
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Scan bill to retrieve details',
                            'Confirm amount with guest',
                            'Select payment method',
                            'Verify external payment (M-Pesa/Card)',
                            'Post payment to ledger',
                            'Print and hand over receipt'
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
                <h2 className="text-2xl font-bold text-stone-900">Payment Methods</h2>
                <div className="grid sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-white border border-stone-200 rounded-xl text-center">
                        <Banknote className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
                        <p className="font-bold text-stone-900">Cash</p>
                        <p className="text-xs text-stone-500">Direct physical currency</p>
                    </div>
                    <div className="p-4 bg-white border border-stone-200 rounded-xl text-center">
                        <div className="w-8 h-8 mx-auto mb-2 bg-emerald-500 rounded-lg flex items-center justify-center text-white font-black text-xs">M</div>
                        <p className="font-bold text-stone-900">M-Pesa</p>
                        <p className="text-xs text-stone-500">Mobile money verification</p>
                    </div>
                    <div className="p-4 bg-white border border-stone-200 rounded-xl text-center">
                        <Receipt className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                        <p className="font-bold text-stone-900">Card</p>
                        <p className="text-xs text-stone-500">POS Terminal processing</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
