'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/user-roles';
import { 
  Search, ChevronRight, Building, Calendar, 
  Database, User, ArrowRight, Layers, FileText
} from 'lucide-react';
import { format } from 'date-fns';

export default function DrillDownPage() {
  const [level, setLevel] = useState<'COMPANY' | 'BRANCH' | 'DATE' | 'STREAM'>('COMPANY');
  const [selections, setSelections] = useState<any>({
    branch: null,
    date: null,
    stream: null
  });

  const path = [
    { label: 'Famous Gate Hotels', level: 'COMPANY' },
    ...(selections.branch ? [{ label: selections.branch.name, level: 'BRANCH' }] : []),
    ...(selections.date ? [{ label: format(new Date(selections.date), 'MMM d, yyyy'), level: 'DATE' }] : []),
    ...(selections.stream ? [{ label: selections.stream, level: 'STREAM' }] : [])
  ];

  const handleNavigate = (newLevel: any, data?: any) => {
    setLevel(newLevel);
    if (newLevel === 'BRANCH') setSelections({ ...selections, branch: data });
    if (newLevel === 'DATE') setSelections({ ...selections, date: data });
    if (newLevel === 'STREAM') setSelections({ ...selections, stream: data });
  };

  const resetTo = (newLevel: any) => {
    setLevel(newLevel);
    if (newLevel === 'COMPANY') setSelections({ branch: null, date: null, stream: null });
    if (newLevel === 'BRANCH') setSelections({ ...selections, date: null, stream: null });
    if (newLevel === 'DATE') setSelections({ ...selections, stream: null });
  };

  return (
    <ProtectedRoute roles={[UserRole.DIRECTOR, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Deep Drill-Down</h1>
              <p className="text-stone-500 mt-1">Full transparency from company to transaction level</p>
            </div>
          </div>

          {/* Breadcrumbs Path */}
          <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-stone-200 shadow-sm overflow-x-auto">
            {path.map((item, i) => (
              <React.Fragment key={item.level}>
                {i > 0 && <ChevronRight className="w-4 h-4 text-stone-300 flex-shrink-0" />}
                <button 
                  onClick={() => resetTo(item.level as any)}
                  className={`text-sm font-bold whitespace-nowrap transition-colors ${
                    i === path.length - 1 ? 'text-[#007AFF]' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Explorer Area */}
          <div className="bg-white rounded-3xl border border-stone-200 shadow-xl overflow-hidden min-h-[500px]">
            <div className="px-8 py-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/30">
               <h3 className="text-lg font-black text-stone-800 uppercase tracking-tighter">
                 Explore {level} Data
               </h3>
               <div className="relative">
                 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                 <input 
                   placeholder="Search entries..." 
                   className="pl-9 pr-4 py-2 text-sm bg-white border border-stone-200 rounded-xl outline-none w-64 shadow-sm focus:ring-2 focus:ring-[#007AFF]/10"
                 />
               </div>
            </div>

            <div className="p-8">
              {level === 'COMPANY' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {['Famous Gate Kyogong', 'Famous Gate Thika', 'Famous Gate Kitengela'].map(name => (
                    <DrillCard 
                      key={name}
                      icon={<Building className="w-6 h-6" />}
                      title={name}
                      subtitle="Branch View"
                      onClick={() => handleNavigate('BRANCH', { name })}
                    />
                  ))}
                </div>
              )}

              {level === 'BRANCH' && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <DrillCard 
                      key={i}
                      icon={<Calendar className="w-6 h-6" />}
                      title={format(subDays(new Date(), i), 'MMM d, yyyy')}
                      subtitle="Daily Record"
                      onClick={() => handleNavigate('DATE', format(subDays(new Date(), i), 'yyyy-MM-dd'))}
                    />
                  ))}
                </div>
              )}

              {level === 'DATE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {['Revenue Streams', 'Payment Methods', 'Expense Categories', 'Audit Logs'].map(title => (
                    <DrillCard 
                      key={title}
                      icon={<Layers className="w-6 h-6" />}
                      title={title}
                      subtitle="Data Layer"
                      onClick={() => handleNavigate('STREAM', title)}
                    />
                  ))}
                </div>
              )}

              {level === 'STREAM' && (
                <div className="space-y-4">
                  <div className="bg-stone-50 p-6 rounded-2xl border border-dashed border-stone-200 text-center">
                    <Database className="w-10 h-10 text-stone-300 mx-auto mb-4" />
                    <p className="text-stone-500 font-medium">Viewing granular entries for {selections.stream} on {format(new Date(selections.date), 'MMM d, yyyy')}</p>
                    <div className="mt-8 grid grid-cols-1 gap-2 text-left">
                       {Array.from({ length: 5 }).map((_, i) => (
                         <div key={i} className="bg-white p-4 rounded-xl border border-stone-100 flex justify-between items-center shadow-sm">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold">#{i+1}</div>
                              <div>
                                <p className="font-bold text-stone-900">Transaction TXN-00{i+1}</p>
                                <p className="text-xs text-stone-500">Recorded by Branch Accountant</p>
                              </div>
                            </div>
                            <div className="text-right">
                               <p className="font-black text-[#007AFF]">KES {(Math.random() * 50000).toFixed(0)}</p>
                               <button className="text-[10px] font-bold text-stone-400 hover:text-[#007AFF] uppercase tracking-widest">View Details</button>
                            </div>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function DrillCard({ icon, title, subtitle, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className="group bg-white p-6 rounded-2xl border border-stone-200 shadow-sm hover:border-[#007AFF] hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-[#007AFF]/5 rounded-full -mr-8 -mt-8 group-hover:scale-150 transition-transform duration-500" />
      
      <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 w-fit mb-4 group-hover:bg-[#007AFF] group-hover:text-white transition-colors">
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">{subtitle}</p>
        <h4 className="text-lg font-bold text-stone-900 group-hover:text-[#007AFF] transition-colors">{title}</h4>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#007AFF] opacity-0 group-hover:opacity-100 transition-opacity">
        Explore <ArrowRight className="w-3 h-3" />
      </div>
    </button>
  );
}

function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}
