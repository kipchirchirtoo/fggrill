import { Layout, Code, Box, Layers, Zap, Palette } from 'lucide-react';

export default function FrontendDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Layout className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">Frontend Architecture</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    Built with Next.js 14, the frontend is a modern, responsive Single Page Application (SPA) designed for performance and user experience.
                </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <div className="p-6 bg-stone-50 rounded-xl border border-stone-200">
                    <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-stone-500" />
                        Core Stack
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Next.js 14 (App Router)',
                            'React 18',
                            'TypeScript',
                            'Tailwind CSS 3.3',
                            'Framer Motion (Animations)',
                            'Lucide React (Icons)'
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
                        <Zap className="w-5 h-5 text-stone-500" />
                        State Management & Data
                    </h3>
                    <ul className="space-y-3">
                        {[
                            'Zustand (Global Client State)',
                            'React Query (Server State & Caching)',
                            'Supabase Client (Real-time Subscriptions)',
                            'Context API (Auth & Theme)',
                            'Zod (Schema Validation)',
                            'React Hook Form (Form Management)'
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
                <h2 className="text-2xl font-bold text-stone-900">Key Directories</h2>
                <div className="bg-stone-900 text-stone-300 rounded-xl p-6 font-mono text-sm overflow-x-auto">
                    <pre className="leading-relaxed">
                        {`src/
├── app/                 # Next.js App Router pages
│   ├── (public)/        # Publicly accessible routes
│   ├── dashboard/       # Protected role-based dashboards
│   ├── login/           # Authentication pages
│   └── docs/            # Documentation (You are here)
├── components/          # Reusable UI components
│   ├── ui/              # Base design system (Buttons, Cards)
│   ├── layout/          # Layout wrappers (Sidebar, Header)
│   └── modals/          # Dialogs and popups
├── lib/                 # Utilities and configurations
│   ├── api.ts           # Axios instance & API endpoints
│   ├── auth-context.tsx # Authentication logic
│   └── utils.ts         # Helper functions
└── types/               # TypeScript definitions`}
                    </pre>
                </div>
            </div>
        </div>
    );
}
