'use client';

import React, { useState } from 'react';
import {
    ChefHat, UtensilsCrossed, Wine, Building2, DollarSign,
    ShieldCheck, Building, Settings, CreditCard, Home,
    BookOpen, ChevronDown, ChevronRight, Search, Package, Users,
    Warehouse, BarChart3, Calendar, Bed, Brush, Wrench, ClipboardList,
    Truck, FileText, Receipt, PieChart, TrendingUp, Bell, MessageSquare,
    Wifi, Car, Mail, Printer, Database, Server, Code, Layers,
    CheckCircle, AlertTriangle, Info, Zap, Shield, Lock
} from 'lucide-react';

interface DocSectionProps {
    id: string;
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

function DocSection({ id, title, icon: Icon, children, defaultOpen = false }: DocSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <section id={id} className="border border-stone-200 rounded-xl overflow-hidden mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-5 py-4 bg-stone-50 flex items-center justify-between hover:bg-stone-100 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white border border-stone-200 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-stone-600" />
                    </div>
                    <h2 className="text-[15px] font-semibold text-stone-900">{title}</h2>
                </div>
                {isOpen ? <ChevronDown className="h-4 w-4 text-stone-400" /> : <ChevronRight className="h-4 w-4 text-stone-400" />}
            </button>
            {isOpen && (
                <div className="px-5 py-5 bg-white text-[13px] text-stone-600 leading-relaxed">
                    {children}
                </div>
            )}
        </section>
    );
}

function FeatureItem({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) {
    return (
        <div className="flex gap-3 py-2">
            <div className="w-7 h-7 rounded-md bg-stone-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon className="h-3.5 w-3.5 text-stone-500" />
            </div>
            <div>
                <p className="font-medium text-stone-900">{title}</p>
                <p className="text-stone-500 text-[12px] mt-0.5">{description}</p>
            </div>
        </div>
    );
}

function ApiEndpoint({ method, path, description }: { method: string, path: string, description: string }) {
    const methodColors: Record<string, string> = {
        GET: 'bg-emerald-100 text-emerald-700',
        POST: 'bg-blue-100 text-blue-700',
        PUT: 'bg-amber-100 text-amber-700',
        DELETE: 'bg-red-100 text-red-700',
    };

    return (
        <div className="flex items-start gap-3 py-2 border-b border-stone-100 last:border-0">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${methodColors[method] || 'bg-stone-100 text-stone-700'}`}>
                {method}
            </span>
            <div className="flex-1">
                <code className="text-[11px] font-mono text-stone-800 bg-stone-100 px-1.5 py-0.5 rounded">{path}</code>
                <p className="text-[11px] text-stone-500 mt-1">{description}</p>
            </div>
        </div>
    );
}

export default function DocsPage() {
    const [searchQuery, setSearchQuery] = useState('');

    const tableOfContents = [
        { id: 'overview', label: 'System Overview' },
        { id: 'architecture', label: 'Architecture' },
        { id: 'pos-kitchen', label: 'POS Kitchen' },
        { id: 'kitchen', label: 'Kitchen Display' },
        { id: 'bartender', label: 'Bartender' },
        { id: 'receptionist', label: 'Receptionist' },
        { id: 'cashier', label: 'Cashier' },
        { id: 'branch-manager', label: 'Branch Manager' },
        { id: 'central-ops', label: 'Central Operations' },
        { id: 'accountant', label: 'Accountant' },
        { id: 'auditor', label: 'Auditor' },
        { id: 'superadmin', label: 'Super Admin' },
        { id: 'backend-api', label: 'Backend API' },
        { id: 'python-services', label: 'Python Services' },
        { id: 'database', label: 'Database Schema' },
        { id: 'security', label: 'Security' },
    ];

    return (
        <div className="min-h-screen bg-[#FAFAF8]">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-xl bg-stone-900 flex items-center justify-center">
                            <BookOpen className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900">System Documentation</h1>
                            <p className="text-[13px] text-stone-500">Famous Gate Hotel Management System v2.0</p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Search documentation..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-[13px] placeholder:text-stone-400 focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar - Table of Contents */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6 bg-white border border-stone-200 rounded-xl p-4">
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-3">Contents</h3>
                            <nav className="space-y-1">
                                {tableOfContents.map((item) => (
                                    <a
                                        key={item.id}
                                        href={`#${item.id}`}
                                        className="block px-3 py-1.5 text-[12px] text-stone-600 hover:text-stone-900 hover:bg-stone-50 rounded-lg transition-colors"
                                    >
                                        {item.label}
                                    </a>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* System Overview */}
                        <DocSection id="overview" title="System Overview" icon={Info} defaultOpen>
                            <p className="mb-4">
                                The <strong>Famous Gate Hotel Management System</strong> is a comprehensive, enterprise-grade platform
                                designed to manage all aspects of hotel operations. Built with a modern tech stack, it provides
                                role-based dashboards for every department from reception to finance.
                            </p>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
                                <div className="bg-stone-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-stone-900">73</p>
                                    <p className="text-[11px] text-stone-500">API Controllers</p>
                                </div>
                                <div className="bg-stone-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-stone-900">25</p>
                                    <p className="text-[11px] text-stone-500">Dashboard Modules</p>
                                </div>
                                <div className="bg-stone-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-stone-900">12</p>
                                    <p className="text-[11px] text-stone-500">User Roles</p>
                                </div>
                                <div className="bg-stone-50 rounded-lg p-3 text-center">
                                    <p className="text-2xl font-bold text-stone-900">33</p>
                                    <p className="text-[11px] text-stone-500">Backend Services</p>
                                </div>
                            </div>

                            <h4 className="font-semibold text-stone-900 mt-6 mb-3">Key Capabilities</h4>
                            <div className="grid md:grid-cols-2 gap-2">
                                <FeatureItem icon={Bed} title="Room Management" description="Real-time room status, availability, and housekeeping coordination." />
                                <FeatureItem icon={Calendar} title="Booking Engine" description="Online reservations with dynamic pricing and rate plans." />
                                <FeatureItem icon={UtensilsCrossed} title="POS & Restaurant" description="Full restaurant and bar POS with kitchen display system." />
                                <FeatureItem icon={Package} title="Inventory Control" description="Multi-branch inventory, stock requests, and dispatches." />
                                <FeatureItem icon={DollarSign} title="Financial Suite" description="Revenue tracking, P&L, cash flow, and forecasting." />
                                <FeatureItem icon={BarChart3} title="Analytics & Reports" description="PDF/Excel reports, KPIs, and ML-powered forecasting." />
                                <FeatureItem icon={Bell} title="Notifications" description="Real-time alerts, email automation, and SMS integration." />
                                <FeatureItem icon={Shield} title="Security" description="Role-based access, audit logs, and account lockout." />
                            </div>
                        </DocSection>

                        {/* Architecture */}
                        <DocSection id="architecture" title="System Architecture" icon={Layers}>
                            <p className="mb-4">
                                The system follows a modern three-tier architecture with clear separation between frontend, backend, and data services.
                            </p>

                            <div className="bg-stone-50 rounded-lg p-4 my-4">
                                <h4 className="font-semibold text-stone-900 mb-3">Technology Stack</h4>
                                <div className="grid md:grid-cols-3 gap-4 text-[12px]">
                                    <div>
                                        <p className="font-medium text-stone-700 mb-2">Frontend</p>
                                        <ul className="space-y-1 text-stone-500">
                                            <li>• Next.js 14 (App Router)</li>
                                            <li>• React 18 with TypeScript</li>
                                            <li>• Tailwind CSS</li>
                                            <li>• Framer Motion</li>
                                            <li>• Lucide Icons</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-medium text-stone-700 mb-2">Backend (Node.js)</p>
                                        <ul className="space-y-1 text-stone-500">
                                            <li>• Express.js + TypeScript</li>
                                            <li>• PostgreSQL (Supabase)</li>
                                            <li>• JWT Authentication</li>
                                            <li>• Socket.IO for real-time</li>
                                            <li>• Helmet, CORS, Rate Limiting</li>
                                        </ul>
                                    </div>
                                    <div>
                                        <p className="font-medium text-stone-700 mb-2">Python Services</p>
                                        <ul className="space-y-1 text-stone-500">
                                            <li>• Flask (Unified on port 5001)</li>
                                            <li>• ReportLab for PDFs</li>
                                            <li>• Pandas for analytics</li>
                                            <li>• Scikit-learn for ML</li>
                                            <li>• Brevo for emails</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <h4 className="font-semibold text-stone-900 mt-6 mb-3">Service Ports</h4>
                            <table className="w-full text-[12px]">
                                <thead>
                                    <tr className="border-b border-stone-200">
                                        <th className="text-left py-2 text-stone-500 font-medium">Service</th>
                                        <th className="text-left py-2 text-stone-500 font-medium">Port</th>
                                        <th className="text-left py-2 text-stone-500 font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="text-stone-600">
                                    <tr className="border-b border-stone-100"><td className="py-2">Frontend</td><td>3001</td><td>Next.js development server</td></tr>
                                    <tr className="border-b border-stone-100"><td className="py-2">Backend API</td><td>5000</td><td>Express.js REST API</td></tr>
                                    <tr className="border-b border-stone-100"><td className="py-2">Python Services</td><td>5001</td><td>Reports, Analytics, Email</td></tr>
                                </tbody>
                            </table>
                        </DocSection>

                        {/* POS Kitchen */}
                        <DocSection id="pos-kitchen" title="POS Kitchen Module" icon={UtensilsCrossed}>
                            <p className="mb-4">
                                The POS Kitchen module is designed for restaurant waitstaff to efficiently take orders, manage tables, and process payments.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Features</h4>
                            <FeatureItem icon={ClipboardList} title="Order Taking" description="Quick menu navigation with category filters. Add items to cart with quantity and special instructions." />
                            <FeatureItem icon={Receipt} title="Order Summary" description="Real-time order total with tax calculation. Split bills and apply discounts." />
                            <FeatureItem icon={CreditCard} title="Payment Processing" description="Multiple payment methods: Cash, Card, M-Pesa. Print thermal receipts." />
                            <FeatureItem icon={AlertTriangle} title="Wastage Recording" description="Record food wastage with reasons and quantities for inventory tracking." />

                            <h4 className="font-semibold text-stone-900 mt-6 mb-2">Workflow</h4>
                            <ol className="list-decimal list-inside space-y-2 text-stone-600">
                                <li>Navigate to the <strong>POS System</strong> tab to start a new order.</li>
                                <li>Select items from categories (Starters, Main Course, Beverages, etc.).</li>
                                <li>Adjust quantities and add special notes if needed.</li>
                                <li>Click <strong>Send to Kitchen</strong> to transmit the order.</li>
                                <li>When ready, process payment and print receipt.</li>
                            </ol>

                            <h4 className="font-semibold text-stone-900 mt-6 mb-2">Related API Endpoints</h4>
                            <div className="bg-stone-50 rounded-lg p-3">
                                <ApiEndpoint method="GET" path="/api/restaurant/menu/items" description="Fetch all menu items with categories." />
                                <ApiEndpoint method="POST" path="/api/restaurant/orders" description="Create a new order with items." />
                                <ApiEndpoint method="PUT" path="/api/restaurant/orders/:id/status" description="Update order status (preparing, ready, served)." />
                                <ApiEndpoint method="POST" path="/api/receipts/generate" description="Generate thermal receipt PDF." />
                            </div>
                        </DocSection>

                        {/* Kitchen Display */}
                        <DocSection id="kitchen" title="Kitchen Display System" icon={ChefHat}>
                            <p className="mb-4">
                                The Kitchen Display System (KDS) provides real-time visibility into incoming orders, allowing kitchen staff to manage preparation efficiently.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Features</h4>
                            <FeatureItem icon={Bell} title="Real-Time Orders" description="Orders appear instantly via WebSocket. Audio alerts for new orders." />
                            <FeatureItem icon={CheckCircle} title="Status Management" description="Mark items as 'In Progress' or 'Ready'. Bump completed orders." />
                            <FeatureItem icon={AlertTriangle} title="Wastage Tracking" description="Record wasted ingredients directly from the kitchen interface." />

                            <h4 className="font-semibold text-stone-900 mt-6 mb-2">Order Card States</h4>
                            <div className="flex gap-3 my-3">
                                <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[11px] font-medium">New</span>
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-[11px] font-medium">In Progress</span>
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[11px] font-medium">Ready</span>
                                <span className="px-3 py-1 bg-stone-100 text-stone-700 rounded-lg text-[11px] font-medium">Served</span>
                            </div>
                        </DocSection>

                        {/* Bartender */}
                        <DocSection id="bartender" title="Bartender Module" icon={Wine}>
                            <p className="mb-4">
                                The Bartender module provides a specialized POS for bar operations with features tailored to drink service.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Features</h4>
                            <FeatureItem icon={Receipt} title="Quick Order POS" description="Fast drink selection with favorites and quick-add buttons." />
                            <FeatureItem icon={ClipboardList} title="Customer Tabs" description="Open tabs for customers to consolidate orders across multiple rounds." />
                            <FeatureItem icon={Package} title="Inventory Alerts" description="Low stock warnings for spirits, beers, and mixers." />

                            <h4 className="font-semibold text-stone-900 mt-6 mb-2">Related API Endpoints</h4>
                            <div className="bg-stone-50 rounded-lg p-3">
                                <ApiEndpoint method="GET" path="/api/bar/menu" description="Fetch bar menu items." />
                                <ApiEndpoint method="POST" path="/api/bar/orders" description="Create bar order." />
                                <ApiEndpoint method="GET" path="/api/bar/tabs" description="Get all open customer tabs." />
                                <ApiEndpoint method="POST" path="/api/bar/tabs/:id/close" description="Close a tab and process payment." />
                            </div>
                        </DocSection>

                        {/* Receptionist */}
                        <DocSection id="receptionist" title="Receptionist Module" icon={Home}>
                            <p className="mb-4">
                                The Receptionist dashboard is the heart of guest operations, managing check-ins, reservations, and guest services.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Dashboard Sections</h4>
                            <FeatureItem icon={Calendar} title="Reservations" description="View upcoming bookings, manage modifications, and handle cancellations." />
                            <FeatureItem icon={Users} title="Check-In / Check-Out" description="Process guest arrivals with ID capture. Generate key cards. Handle departures with folio settlement." />
                            <FeatureItem icon={Bed} title="Room Status Board" description="Visual grid of all rooms with real-time status (Available, Occupied, Dirty, Maintenance)." />
                            <FeatureItem icon={Brush} title="Housekeeping Coordination" description="Request room cleaning, mark rooms as inspected, track housekeeping progress." />
                            <FeatureItem icon={Users} title="Guest Profiles" description="View guest history, preferences, and loyalty status." />

                            <h4 className="font-semibold text-stone-900 mt-6 mb-2">Check-In Workflow</h4>
                            <ol className="list-decimal list-inside space-y-2 text-stone-600">
                                <li>Search for the reservation by confirmation number or guest name.</li>
                                <li>Verify guest ID and capture details.</li>
                                <li>Assign a room from available inventory.</li>
                                <li>Collect any advance payment or deposit.</li>
                                <li>Generate key card and provide welcome information.</li>
                            </ol>
                        </DocSection>

                        {/* Cashier */}
                        <DocSection id="cashier" title="Cashier Station" icon={CreditCard}>
                            <p className="mb-4">
                                The Cashier Station is a dedicated interface for processing payments across all hotel services.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Payment Methods</h4>
                            <div className="grid grid-cols-3 gap-3 my-3">
                                <div className="bg-stone-50 rounded-lg p-3 text-center">
                                    <DollarSign className="h-5 w-5 mx-auto text-stone-500 mb-1" />
                                    <p className="text-[11px] font-medium text-stone-700">Cash</p>
                                </div>
                                <div className="bg-stone-50 rounded-lg p-3 text-center">
                                    <CreditCard className="h-5 w-5 mx-auto text-stone-500 mb-1" />
                                    <p className="text-[11px] font-medium text-stone-700">Card (Paystack)</p>
                                </div>
                                <div className="bg-stone-50 rounded-lg p-3 text-center">
                                    <Wifi className="h-5 w-5 mx-auto text-stone-500 mb-1" />
                                    <p className="text-[11px] font-medium text-stone-700">M-Pesa</p>
                                </div>
                            </div>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Features</h4>
                            <FeatureItem icon={Receipt} title="Bill Settlement" description="Settle room folios, restaurant bills, and bar tabs." />
                            <FeatureItem icon={Printer} title="Receipt Printing" description="Print thermal receipts or email PDF invoices." />
                            <FeatureItem icon={FileText} title="End-of-Day Report" description="Generate daily cash summary with all transactions." />
                        </DocSection>

                        {/* Branch Manager */}
                        <DocSection id="branch-manager" title="Branch Manager Dashboard" icon={Building}>
                            <p className="mb-4">
                                The Branch Manager has comprehensive oversight of all branch operations, from front desk to back office.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Dashboard Sections (19 Modules)</h4>
                            <div className="grid md:grid-cols-2 gap-2">
                                <FeatureItem icon={Calendar} title="Reservations" description="All branch reservations with calendar view." />
                                <FeatureItem icon={Users} title="Arrivals & Departures" description="Daily lists for guest movements." />
                                <FeatureItem icon={Bed} title="Room Management" description="Room inventory and status tracking." />
                                <FeatureItem icon={Brush} title="Housekeeping" description="Task assignment and completion tracking." />
                                <FeatureItem icon={Wrench} title="Maintenance" description="Work orders and asset management." />
                                <FeatureItem icon={UtensilsCrossed} title="Restaurant & Bar" description="Menu management and sales overview." />
                                <FeatureItem icon={Package} title="Inventory" description="Stock levels, requests, and incoming items." />
                                <FeatureItem icon={Users} title="Staff Management" description="Employee records and attendance." />
                                <FeatureItem icon={AlertTriangle} title="Wastage Reports" description="Track and analyze wastage." />
                                <FeatureItem icon={BarChart3} title="Reports" description="Branch performance reports." />
                            </div>
                        </DocSection>

                        {/* Central Operations */}
                        <DocSection id="central-ops" title="Central Operations Manager" icon={Building2}>
                            <p className="mb-4">
                                The Central Operations Manager oversees the entire organization, coordinating between branches and managing strategic operations.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Key Modules</h4>
                            <FeatureItem icon={Warehouse} title="Warehouse Management" description="Master inventory, stock requests from branches, dispatch coordination, and supplier management." />
                            <FeatureItem icon={Building} title="Branch Oversight" description="Compare performance across branches, monitor compliance, and staff allocation." />
                            <FeatureItem icon={TrendingUp} title="Strategic Planning" description="Budget planning, demand forecasting with ML, and procurement optimization." />
                            <FeatureItem icon={BarChart3} title="Analytics" description="Executive dashboards, trend analysis, and organization-wide KPIs." />

                            <h4 className="font-semibold text-stone-900 mt-6 mb-2">Warehouse Dispatch Workflow</h4>
                            <ol className="list-decimal list-inside space-y-2 text-stone-600">
                                <li>Branch managers submit stock requests.</li>
                                <li>Central ops reviews and approves requests.</li>
                                <li>Create dispatch with truck and driver details.</li>
                                <li>Branch confirms receipt and stock is reconciled.</li>
                            </ol>
                        </DocSection>

                        {/* Accountant */}
                        <DocSection id="accountant" title="Accountant / Finance Module" icon={DollarSign}>
                            <p className="mb-4">
                                The Finance module provides comprehensive financial management tools for accountants, including real-time reporting and analysis.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Financial Pages (15 Modules)</h4>
                            <div className="grid md:grid-cols-2 gap-2">
                                <FeatureItem icon={TrendingUp} title="Revenue by Branch" description="Detailed revenue breakdown per location." />
                                <FeatureItem icon={FileText} title="Invoices" description="Generate and track customer invoices." />
                                <FeatureItem icon={CreditCard} title="Payments" description="Payment history and reconciliation." />
                                <FeatureItem icon={Receipt} title="Expenses" description="Categorized expense tracking." />
                                <FeatureItem icon={PieChart} title="Cash Flow" description="Real-time cash inflow/outflow monitoring." />
                                <FeatureItem icon={BarChart3} title="Profit & Loss" description="P&L statements by period." />
                                <FeatureItem icon={TrendingUp} title="Forecast" description="Revenue and expense predictions." />
                                <FeatureItem icon={FileText} title="Tax Summary" description="Automated tax calculations." />
                            </div>

                            <h4 className="font-semibold text-stone-900 mt-6 mb-2">Related API Endpoints</h4>
                            <div className="bg-stone-50 rounded-lg p-3">
                                <ApiEndpoint method="GET" path="/api/finance/revenue" description="Get revenue data with filters." />
                                <ApiEndpoint method="GET" path="/api/finance/cashflow" description="Get cash flow analysis." />
                                <ApiEndpoint method="GET" path="/api/finance/profit-loss" description="Generate P&L statement." />
                                <ApiEndpoint method="GET" path="/api/forecasting/generate" description="Get ML-powered forecasts." />
                            </div>
                        </DocSection>

                        {/* Auditor */}
                        <DocSection id="auditor" title="Auditor Module" icon={ShieldCheck}>
                            <p className="mb-4">
                                The Auditor module provides comprehensive tools for financial oversight, compliance monitoring, and system auditing.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Audit Modules (5 Sections)</h4>
                            <FeatureItem icon={DollarSign} title="Financial Audit" description="Verify transactions, reconcile accounts, and detect anomalies." />
                            <FeatureItem icon={Package} title="Inventory Audit" description="Reconcile physical stock with system records." />
                            <FeatureItem icon={ShieldCheck} title="Compliance" description="Monitor adherence to policies and regulations." />
                            <FeatureItem icon={FileText} title="Audit Logs" description="Immutable log of all system actions with user attribution." />
                            <FeatureItem icon={BarChart3} title="Reports" description="Generate comprehensive audit reports." />

                            <h4 className="font-semibold text-stone-900 mt-6 mb-2">Audit Log Fields</h4>
                            <table className="w-full text-[12px] mt-2">
                                <thead>
                                    <tr className="border-b border-stone-200">
                                        <th className="text-left py-2 text-stone-500 font-medium">Field</th>
                                        <th className="text-left py-2 text-stone-500 font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="text-stone-600">
                                    <tr className="border-b border-stone-100"><td className="py-2">user_id</td><td>User who performed the action</td></tr>
                                    <tr className="border-b border-stone-100"><td className="py-2">action</td><td>Type of action (CREATE, UPDATE, DELETE)</td></tr>
                                    <tr className="border-b border-stone-100"><td className="py-2">method</td><td>HTTP method (POST, PUT, DELETE)</td></tr>
                                    <tr className="border-b border-stone-100"><td className="py-2">path</td><td>API endpoint accessed</td></tr>
                                    <tr className="border-b border-stone-100"><td className="py-2">ip</td><td>Client IP address</td></tr>
                                    <tr className="border-b border-stone-100"><td className="py-2">payload</td><td>Sanitized request data (passwords masked)</td></tr>
                                </tbody>
                            </table>
                        </DocSection>

                        {/* Super Admin */}
                        <DocSection id="superadmin" title="Super Admin" icon={Settings}>
                            <p className="mb-4">
                                The Super Admin has unrestricted access to all system modules and administrative functions.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Admin Capabilities</h4>
                            <FeatureItem icon={Settings} title="System Configuration" description="Manage global settings, branch configuration, and system parameters." />
                            <FeatureItem icon={Users} title="Role Migration" description="Update user roles and permissions across the system." />
                            <FeatureItem icon={AlertTriangle} title="Wastage Analytics" description="Organization-wide wastage analysis and trends." />
                            <FeatureItem icon={Layers} title="Full Access" description="Access any role's dashboard for troubleshooting or oversight." />

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-4">
                                <p className="text-[12px] text-amber-800">
                                    <strong>Note:</strong> Super Admin actions are logged in the audit trail with elevated visibility.
                                </p>
                            </div>
                        </DocSection>

                        {/* Backend API */}
                        <DocSection id="backend-api" title="Backend API Reference" icon={Server}>
                            <p className="mb-4">
                                The Node.js backend provides a RESTful API with 53 route modules and 73 controllers. All endpoints are prefixed with <code className="bg-stone-100 px-1 rounded">/api</code>.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Core Route Modules</h4>
                            <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/auth</span><span className="text-stone-400">Authentication</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/bookings</span><span className="text-stone-400">Reservations</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/rooms</span><span className="text-stone-400">Room inventory</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/guests</span><span className="text-stone-400">Guest profiles</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/restaurant</span><span className="text-stone-400">Menu & orders</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/bar</span><span className="text-stone-400">Bar operations</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/finance</span><span className="text-stone-400">Financial data</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/inventory</span><span className="text-stone-400">Stock management</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/housekeeping</span><span className="text-stone-400">Cleaning tasks</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/maintenance</span><span className="text-stone-400">Work orders</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/staff</span><span className="text-stone-400">HR & attendance</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>/api/reports</span><span className="text-stone-400">Report generation</span>
                                </div>
                            </div>
                        </DocSection>

                        {/* Python Services */}
                        <DocSection id="python-services" title="Python Services" icon={Code}>
                            <p className="mb-4">
                                All Python microservices are consolidated into a single Flask application on port 5001, providing specialized functionality for reports, analytics, and integrations.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Service Blueprints</h4>
                            <FeatureItem icon={FileText} title="Reports Generation" description="PDF and Excel reports with branded templates. Financial, HR, and operational reports." />
                            <FeatureItem icon={BarChart3} title="Analytics Engine" description="Budget analytics, performance metrics, and trend analysis." />
                            <FeatureItem icon={TrendingUp} title="ML Forecasting" description="Revenue and demand forecasting using ARIMA and Linear Regression models." />
                            <FeatureItem icon={Mail} title="Email Automation" description="Booking confirmation sequences, pre-arrival emails, and post-stay follow-ups." />
                            <FeatureItem icon={Receipt} title="Receipt Generation" description="Thermal receipt printing and invoice PDF generation." />
                            <FeatureItem icon={Database} title="KPI Dashboard" description="Real-time KPI calculations with revenue, occupancy, ADR, and RevPAR." />

                            <h4 className="font-semibold text-stone-900 mt-6 mb-2">Python API Endpoints</h4>
                            <div className="bg-stone-50 rounded-lg p-3">
                                <ApiEndpoint method="POST" path="/api/reports/generate/branded-pdf" description="Generate branded PDF report." />
                                <ApiEndpoint method="POST" path="/api/reports/generate/excel" description="Generate Excel report." />
                                <ApiEndpoint method="GET" path="/api/kpi/dashboard" description="Get KPI dashboard data." />
                                <ApiEndpoint method="POST" path="/api/email/schedule-booking-emails" description="Schedule email sequence." />
                                <ApiEndpoint method="POST" path="/api/barcode/generate" description="Generate barcode image." />
                            </div>
                        </DocSection>

                        {/* Database */}
                        <DocSection id="database" title="Database Schema" icon={Database}>
                            <p className="mb-4">
                                The system uses PostgreSQL (Supabase) with 19 core models and extensive relationships for hotel operations.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Core Tables</h4>
                            <div className="grid md:grid-cols-2 gap-x-6 gap-y-1 text-[12px]">
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>users</span><span className="text-stone-400">Staff accounts & roles</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>guests</span><span className="text-stone-400">Guest profiles</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>rooms</span><span className="text-stone-400">Room inventory</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>room_types</span><span className="text-stone-400">Room categories</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>bookings</span><span className="text-stone-400">Reservations</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>folios</span><span className="text-stone-400">Guest charges</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>payments</span><span className="text-stone-400">Transaction records</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>restaurant_orders</span><span className="text-stone-400">F&B orders</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>inventory_items</span><span className="text-stone-400">Stock items</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>housekeeping_tasks</span><span className="text-stone-400">Cleaning tasks</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>maintenance_tasks</span><span className="text-stone-400">Work orders</span>
                                </div>
                                <div className="flex justify-between py-1 border-b border-stone-100">
                                    <span>activity_logs</span><span className="text-stone-400">Audit trail</span>
                                </div>
                            </div>
                        </DocSection>

                        {/* Security */}
                        <DocSection id="security" title="Security Features" icon={Lock}>
                            <p className="mb-4">
                                The system implements multi-layered security to protect against common threats.
                            </p>

                            <h4 className="font-semibold text-stone-900 mt-4 mb-2">Security Measures</h4>
                            <FeatureItem icon={Lock} title="Authentication" description="JWT-based authentication with 1-hour token expiry. Secure password hashing with bcrypt." />
                            <FeatureItem icon={Shield} title="Account Lockout" description="Automatic lockout after 5 failed login attempts for 15 minutes." />
                            <FeatureItem icon={Zap} title="Rate Limiting" description="100 requests/15min globally, 20 requests/15min for auth endpoints." />
                            <FeatureItem icon={ShieldCheck} title="Security Headers" description="Helmet.js with CSP, HSTS, and XSS protection enabled." />
                            <FeatureItem icon={Users} title="Inactivity Timeout" description="Automatic logout after 15 minutes of inactivity on frontend." />
                            <FeatureItem icon={FileText} title="Audit Logging" description="All state-changing requests logged with sensitive data masking." />

                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mt-4">
                                <p className="text-[12px] text-emerald-800">
                                    <strong>Best Practice:</strong> Always use strong passwords (8+ characters, uppercase, lowercase, number, special character).
                                </p>
                            </div>
                        </DocSection>

                        {/* Footer */}
                        <div className="bg-stone-50 border border-stone-200 rounded-xl p-6 mt-8">
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center">
                                    <MessageSquare className="h-5 w-5 text-stone-500" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-stone-900 mb-1">Need Help?</h3>
                                    <p className="text-[12px] text-stone-500 mb-3">
                                        For technical support or questions about this documentation, contact your system administrator.
                                    </p>
                                    <p className="text-[11px] text-stone-400">
                                        System managed by <span className="text-amber-600 font-medium">Hirall</span> • +254 710 944 249 • admin@hirall.com
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
