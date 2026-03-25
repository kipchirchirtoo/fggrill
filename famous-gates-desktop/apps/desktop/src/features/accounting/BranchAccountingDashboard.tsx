'use client';

import { useAuth } from '../../hooks/useAuth';
import { useBranch } from '../../hooks/useBranch';
import { 
  Package, CreditCard, FileText, LayoutDashboard, 
  ShoppingCart, ClipboardCheck, ArrowRight, Zap,
  TrendingUp, ShieldCheck
} from 'lucide-react';
import { cn } from '../../utils/cn';

export function BranchAccountingDashboard() {
  const { session } = useAuth();
  const { activeBranch } = useBranch();

  const cards = [
    { title: 'Shift Review', icon: ClipboardCheck, desc: 'Reconcile cashier shifts', color: 'text-blue-600', bg: 'bg-blue-50' },
    { title: 'Stock Takes', icon: Package, desc: 'Manage branch stock', color: 'text-orange-600', bg: 'bg-orange-50' },
    { title: 'Credit & Paid Bills', icon: CreditCard, desc: 'Staff and customer bills', color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { title: 'Payments', icon: Zap, desc: 'Record and verify payments', color: 'text-purple-600', bg: 'bg-purple-50' },
    { title: 'Purchases', icon: ShoppingCart, desc: 'Branch purchases and POs', color: 'text-amber-600', bg: 'bg-amber-50' },
    { title: 'Invoices', icon: FileText, desc: 'Create and view invoices', color: 'text-sky-600', bg: 'bg-sky-50' },
  ];

  return (
    <div className="h-full bg-stone-50 overflow-y-auto no-scrollbar p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center text-white shadow-xl">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">Branch Accounting</h1>
            <p className="text-stone-500 text-sm font-medium">{activeBranch?.name || 'Local Finance'} Control</p>
          </div>
        </div>

        {/* Stats Summary Mockup */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {[
             { label: 'Pending Reconciliations', value: '12', icon: ShieldCheck, color: 'text-blue-600' },
             { label: 'Unverified Payments', value: '4', icon: TrendingUp, color: 'text-emerald-600' },
             { label: 'Open Credits', value: 'KES 45,000', icon: CreditCard, color: 'text-orange-600' }
           ].map((s, i) => (
             <div key={i} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm">
                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-1">{s.label}</p>
                <div className="flex items-center justify-between mt-2">
                   <p className="text-2xl font-black text-stone-900">{s.value}</p>
                   <s.icon className={cn("h-5 w-5", s.color)} />
                </div>
             </div>
           ))}
        </div>

        {/* Grid of Accounting Modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <div key={i} className="group bg-white border border-stone-200 p-8 rounded-[2.5rem] hover:border-stone-900 transition-all cursor-pointer shadow-sm active:scale-95">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-stone-900 group-hover:text-white transition-all shadow-inner", card.bg, card.color)}>
                <card.icon className="h-7 w-7 transition-transform group-hover:scale-110" />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <h3 className="text-lg font-black text-stone-900">{card.title}</h3>
                  <p className="text-xs text-stone-400 font-medium mt-1">{card.desc}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-stone-300 group-hover:text-stone-900 transition-all translate-x-2 group-hover:translate-x-0" />
              </div>
            </div>
          ))}
        </div>

        {/* Action Bar */}
        <div className="bg-stone-900 rounded-[2.5rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
           <div className="text-center md:text-left">
              <h2 className="text-xl font-black">Financial Integrity</h2>
              <p className="text-stone-400 text-sm mt-1 max-w-sm">Ensure all branch transactions are captured, verified, and reconciled with the central gateway.</p>
           </div>
           <button className="h-14 px-10 rounded-2xl bg-white text-stone-900 font-black text-sm uppercase tracking-widest hover:bg-stone-100 transition-all active:scale-95">
              Run Reconciliation
           </button>
        </div>
      </div>
    </div>
  );
}
