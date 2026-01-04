import { Network, Server, Database, Globe, Shield, Cpu, Share2 } from 'lucide-react';

export default function ArchitectureDocs() {
    return (
        <div className="space-y-8">
            <div className="border-b border-stone-200 pb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-stone-100 rounded-lg">
                        <Network className="w-6 h-6 text-stone-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-stone-900">System Architecture</h1>
                </div>
                <p className="text-lg text-stone-600 max-w-3xl">
                    The Famous Gate Management System is built on a modern, distributed microservices architecture designed for high availability, scalability, and real-time responsiveness.
                </p>
            </div>

            <div className="space-y-12">
                {/* High Level Diagram (Conceptual) */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-stone-900">High-Level Overview</h2>
                    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                            <div className="flex flex-col items-center text-center space-y-3">
                                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-stone-200 flex items-center justify-center">
                                    <Globe className="w-8 h-8 text-stone-400" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-900">Frontend</h3>
                                    <p className="text-xs text-stone-500">Next.js SPA</p>
                                </div>
                            </div>

                            <div className="flex flex-col items-center">
                                <div className="w-full h-px bg-stone-200 relative">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">REST / WS</div>
                                </div>
                            </div>

                            <div className="flex flex-col items-center text-center space-y-3">
                                <div className="w-16 h-16 bg-stone-900 rounded-2xl shadow-lg flex items-center justify-center">
                                    <Server className="w-8 h-8 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-stone-900">Core Backend</h3>
                                    <p className="text-xs text-stone-500">Express.js API</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-stone-200 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-amber-50 rounded-lg">
                                    <Cpu className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-stone-900">Python Microservices</h4>
                                    <p className="text-sm text-stone-600">Specialized workers for PDF generation, email automation, and analytics.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <Database className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-stone-900">Data Layer</h4>
                                    <p className="text-sm text-stone-600">PostgreSQL database with Supabase for real-time sync and storage.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Communication Flow */}
                <section className="space-y-6">
                    <h2 className="text-2xl font-bold text-stone-900">Communication Flow</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-6 bg-white border border-stone-200 rounded-xl">
                            <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
                                <Share2 className="w-4 h-4 text-stone-400" />
                                Real-time Updates
                            </h3>
                            <p className="text-sm text-stone-600 leading-relaxed">
                                The system uses Socket.IO and Supabase Realtime to push updates to clients instantly. When an order is placed in the POS, it appears on the Kitchen screen without a page refresh.
                            </p>
                        </div>
                        <div className="p-6 bg-white border border-stone-200 rounded-xl">
                            <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-stone-400" />
                                Security Layer
                            </h3>
                            <p className="text-sm text-stone-600 leading-relaxed">
                                All requests pass through a JWT-based authentication middleware. Role-Based Access Control (RBAC) ensures that users can only access data and actions appropriate for their role.
                            </p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
