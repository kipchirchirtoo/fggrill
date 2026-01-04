import { Server, Database, Shield, Globe, Cpu, FileJson } from 'lucide-react';

export default function BackendDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Server className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Backend API</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    A robust Node.js/Express REST API serving as the central logic layer, handling data persistence, authentication, and business rules.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-stone-500" />
                        Technology Stack
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Node.js Runtime',
                            'Express.js Framework',
                            'TypeScript',
                            'PostgreSQL (via pg driver)',
                            'Socket.IO (Real-time events)',
                            'Winston (Logging)'
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
                        Security & Auth
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'JWT (JSON Web Tokens)',
                            'Role-Based Access Control (RBAC)',
                            'Helmet (Security Headers)',
                            'Rate Limiting',
                            'CORS Configuration',
                            'Input Validation (Zod)'
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
                <h2 className="text-2xl font-bold text-stone-900">API Structure</h2>
                <div className="bg-stone-900 text-stone-300 rounded-xl p-6 font-mono text-sm overflow-x-auto">
                    <pre className="leading-relaxed">
                        {`src/
├── server.ts            # Entry point & App initialization
├── routes/              # Route definitions
│   ├── auth.routes.ts
│   ├── bookings.routes.ts
│   └── ...
├── controllers/         # Request handlers & Business logic
├── services/            # Reusable business services
├── models/              # Database models/queries
├── middleware/          # Express middleware (Auth, Error, Logging)
└── utils/               # Helper functions`}
                    </pre>
                </div>
            </div>
        </div>
    );
}
