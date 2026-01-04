import { Calculator, Shield, Scale, FileText, CheckCircle, Search } from 'lucide-react';

export default function FinanceDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Calculator className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Finance & Audit</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    Comprehensive financial management tools for Accountants and Auditors, ensuring accurate bookkeeping, compliance, and transparent reporting.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-stone-500" />
                        Accounting Workspace
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Double-entry journal recording',
                            'Multi-currency transaction support',
                            'Automated recurring entries',
                            'Accounts Payable & Receivable tracking',
                            'Tax calculation and filing preparation',
                            'Fixed asset register management'
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
                        <Shield className="w-5 h-5 text-stone-500" />
                        Audit & Compliance
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Real-time transaction audit trails',
                            'Suspicious activity flagging',
                            'Approval workflows for high-value items',
                            'Bank reconciliation tools',
                            'Internal control testing checklists',
                            'Regulatory compliance reporting'
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
                <h2 className="text-2xl font-bold text-stone-900">Key Workflows</h2>

                <div className="space-y-6">
                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                                <CheckCircle className="w-4 h-4" />
                                Journal Entry Approval
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="flex items-center gap-4 text-sm text-stone-600 mb-4">
                                <div className="px-3 py-1 bg-stone-100 rounded-full">Draft</div>
                                <div className="w-8 h-px bg-stone-300" />
                                <div className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">Review</div>
                                <div className="w-8 h-px bg-stone-300" />
                                <div className="px-3 py-1 bg-green-100 text-green-800 rounded-full">Posted</div>
                            </div>
                            <p className="text-stone-600 text-sm leading-relaxed">
                                All manual journal entries require a two-step verification process. Accountants create drafts, which must be reviewed and approved by a Senior Accountant or Auditor before posting to the General Ledger.
                            </p>
                        </div>
                    </div>

                    <div className="border border-stone-200 rounded-xl overflow-hidden">
                        <div className="bg-stone-50 px-6 py-4 border-b border-stone-200">
                            <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                                <Scale className="w-4 h-4" />
                                Reconciliation Process
                            </h3>
                        </div>
                        <div className="p-6">
                            <p className="text-stone-600 text-sm leading-relaxed mb-4">
                                The system automatically matches imported bank statement lines with recorded transactions based on amount, date, and reference.
                            </p>
                            <ul className="grid sm:grid-cols-2 gap-2 text-sm text-stone-600">
                                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-stone-400 rounded-full" /> Auto-match confidence scoring</li>
                                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-stone-400 rounded-full" /> Exception handling interface</li>
                                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-stone-400 rounded-full" /> Month-end closing checklists</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
