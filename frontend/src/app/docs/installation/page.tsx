import { Terminal, Download, Play, CheckCircle, AlertTriangle, Settings } from 'lucide-react';

export default function InstallationDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Terminal className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Installation Guide</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    Follow these steps to set up the Kyogong Management System on your local development environment or production server.
                </p>
            </div>

            <div className="space-y-10">
                {/* Prerequisites */}
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold text-stone-900">Prerequisites</h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {[
                            { name: 'Node.js', version: 'v18.x or higher', icon: Download },
                            { name: 'Python', version: '3.10 or higher', icon: Download },
                            { name: 'PostgreSQL', version: 'v14 or higher', icon: Download },
                            { name: 'Git', version: 'Latest version', icon: Download },
                        ].map((item) => (
                            <div key={item.name} className="flex items-center gap-4 p-4 bg-stone-50 border border-stone-200 rounded-xl">
                                <div className="p-2 bg-white rounded-lg border border-stone-100">
                                    <item.icon className="w-5 h-5 text-stone-400" />
                                </div>
                                <div>
                                    <p className="font-bold text-stone-900">{item.name}</p>
                                    <p className="text-xs text-stone-500">{item.version}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Step by Step */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-stone-900">Step-by-Step Setup</h2>

                    <div className="space-y-8">
                        <div className="relative pl-8 border-l-2 border-stone-100 space-y-4">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 bg-stone-900 rounded-full border-4 border-white" />
                            <h3 className="font-bold text-stone-900">1. Clone the Repository</h3>
                            <div className="bg-stone-900 text-stone-300 rounded-xl p-4 font-mono text-sm">
                                git clone https://github.com/your-repo/famous-gate.git<br />
                                cd famous-gate
                            </div>
                        </div>

                        <div className="relative pl-8 border-l-2 border-stone-100 space-y-4">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 bg-stone-900 rounded-full border-4 border-white" />
                            <h3 className="font-bold text-stone-900">2. Backend Configuration</h3>
                            <p className="text-sm text-stone-600">Install dependencies and set up environment variables.</p>
                            <div className="bg-stone-900 text-stone-300 rounded-xl p-4 font-mono text-sm">
                                cd backend<br />
                                npm install<br />
                                cp .env.example .env
                            </div>
                            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-amber-800 flex gap-3">
                                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                                <p>Ensure you update the <code>.env</code> file with your database credentials and JWT secret.</p>
                            </div>
                        </div>

                        <div className="relative pl-8 border-l-2 border-stone-100 space-y-4">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 bg-stone-900 rounded-full border-4 border-white" />
                            <h3 className="font-bold text-stone-900">3. Frontend Setup</h3>
                            <div className="bg-stone-900 text-stone-300 rounded-xl p-4 font-mono text-sm">
                                cd ../frontend<br />
                                npm install<br />
                                npm run dev
                            </div>
                        </div>

                        <div className="relative pl-8 border-l-2 border-stone-100 space-y-4">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 bg-stone-900 rounded-full border-4 border-white" />
                            <h3 className="font-bold text-stone-900">4. Python Services</h3>
                            <div className="bg-stone-900 text-stone-300 rounded-xl p-4 font-mono text-sm">
                                cd ../python-services<br />
                                python -m venv venv<br />
                                source venv/bin/activate  # On Windows: venv\\Scripts\\activate<br />
                                pip install -r requirements.txt<br />
                                python app.py
                            </div>
                        </div>
                    </div>
                </section>

                {/* Verification */}
                <section className="p-6 bg-emerald-50 border border-emerald-100 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                        <h2 className="text-xl font-bold text-emerald-900">Verification</h2>
                    </div>
                    <p className="text-sm text-emerald-800 mb-4">
                        Once all services are running, you can verify the installation by visiting:
                    </p>
                    <ul className="space-y-2 text-sm text-emerald-700 font-medium">
                        <li>• Frontend: <code className="bg-white/50 px-1.5 py-0.5 rounded">http://localhost:3001</code></li>
                        <li>• Backend API: <code className="bg-white/50 px-1.5 py-0.5 rounded">http://localhost:5000/api/health</code></li>
                        <li>• Python Services: <code className="bg-white/50 px-1.5 py-0.5 rounded">http://localhost:5001/health</code></li>
                    </ul>
                </section>
            </div>
        </div>
    );
}
