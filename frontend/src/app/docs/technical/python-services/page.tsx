import { FileCode, Mail, Printer, BarChart, Zap } from 'lucide-react';

export default function PythonServicesDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <FileCode className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Python Microservices</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    A collection of specialized services handling compute-intensive tasks, document generation, and automation.
                </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <div className="w-10 h-10 bg-white rounded-lg border border-stone-200 flex items-center justify-center mb-4">
                        <Printer className="w-5 h-5 text-stone-700" />
                    </div>
                    <h3 className="font-semibold text-stone-900 mb-2">Receipt Generation</h3>
                    <p className="text-sm text-stone-600">
                        Generates PDF invoices and thermal receipts using ReportLab. Handles layout, branding, and QR code embedding.
                    </p>
                </div>

                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <div className="w-10 h-10 bg-white rounded-lg border border-stone-200 flex items-center justify-center mb-4">
                        <Mail className="w-5 h-5 text-stone-700" />
                    </div>
                    <h3 className="font-semibold text-stone-900 mb-2">Email Automation</h3>
                    <p className="text-sm text-stone-600">
                        Manages transactional emails (Booking Confirmations, Invoices) with HTML templates and SMTP integration.
                    </p>
                </div>

                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <div className="w-10 h-10 bg-white rounded-lg border border-stone-200 flex items-center justify-center mb-4">
                        <BarChart className="w-5 h-5 text-stone-700" />
                    </div>
                    <h3 className="font-semibold text-stone-900 mb-2">Analytics Engine</h3>
                    <p className="text-sm text-stone-600">
                        Processes complex data aggregations for reports, financial forecasting, and pricing optimization.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-stone-900">Service Architecture</h2>
                <div className="bg-stone-900 text-stone-300 rounded-xl p-6 font-mono text-sm overflow-x-auto">
                    <pre className="leading-relaxed">
                        {`python-services/
├── app.py                  # Main service entry point
├── receipts/               # Receipt generation logic
│   ├── receipt_generator.py
│   └── thermal_printer.py
├── email_automation/       # Email sending & templates
├── analytics/              # Data processing modules
├── pricing_engine/         # Dynamic pricing algorithms
└── requirements.txt        # Python dependencies`}
                    </pre>
                </div>
            </div>
        </div>
    );
}
