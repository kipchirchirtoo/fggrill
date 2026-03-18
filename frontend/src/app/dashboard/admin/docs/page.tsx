'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/auth-context';
import { 
  FileText, 
  Download, 
  ChevronRight, 
  BookOpen, 
  Search,
  Printer,
  ExternalLink,
  ShieldCheck,
  Package,
  Truck,
  Landmark,
  Bed,
  Shield,
  Utensils,
  TrendingUp,
  Users,
  RefreshCw,
  Layout,
  Activity,
  ArrowLeft
} from 'lucide-react';
import { moduleGuides, ModuleGuide } from './module-guides';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { toast } from 'sonner';

const iconMap: Record<string, any> = {
  ShieldCheck,
  Package,
  Truck,
  Landmark,
  Bed,
  Shield,
  Utensils,
  TrendingUp,
  Users,
  RefreshCw,
  Layout,
  Activity,
};

export default function AdminDocsPage() {
  const [selectedModule, setSelectedModule] = useState<ModuleGuide | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGuides = moduleGuides.filter(guide => 
    guide.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    guide.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownloadPDF = async (guide?: ModuleGuide) => {
    toast.info('Connecting to generation service...');
    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        reportType: 'documentation',
        format: 'pdf',
        filters: {
          moduleId: guide?.id || 'all'
        }
      };

      const res = await fetch(`${API_URL}/api/reports/export`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FamousGate_Doc_${guide?.id || 'Manual'}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success('Documentation prepared by HIRALL SOLUTIONS');
    } catch (e: any) {
      toast.error('PDF generation failed. Please try again later.');
      console.error('PDF Export Error:', e);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-8 animate-ios-fade-in max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="px-2 py-0.5 rounded-full bg-stone-900 text-white text-[10px] font-bold uppercase tracking-widest">
                  Internal
                </div>
                <div className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold uppercase tracking-widest">
                  Confidential
                </div>
              </div>
              <h1 className="text-[32px] font-bold text-stone-900 tracking-tight font-sf-pro-display">Systems Documentation</h1>
              <p className="text-stone-500 max-w-2xl">
                Comprehensive training guides and operational manuals for the FamousGate Hotels Management System. 
                Authored by <span className="font-bold text-stone-900">HIRALL SOLUTIONS</span>.
              </p>
            </div>
            {!selectedModule && (
                <div className="flex items-center gap-3">
                <button
                    onClick={() => handleDownloadPDF()}
                    className="flex items-center gap-2 px-6 py-3 rounded-full bg-stone-900 text-white text-sm font-bold shadow-lg shadow-stone-200 hover:scale-[1.02] transition-all active:scale-95"
                >
                    <Printer className="h-4 w-4" />
                    <span>Print Full Manual</span>
                </button>
                </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar / Grid */}
            <div className={`${selectedModule ? 'hidden lg:block lg:w-1/3' : 'w-full'} space-y-6`}>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input 
                  placeholder="Search modules..."
                  className="w-full pl-11 pr-4 py-4 bg-white border border-stone-200 rounded-2xl text-[14px] focus:outline-none focus:ring-4 focus:ring-stone-900/5 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                {filteredGuides.map((guide) => {
                  const Icon = iconMap[guide.icon] || FileText;
                  const isActive = selectedModule?.id === guide.id;

                  return (
                    <button
                      key={guide.id}
                      onClick={() => setSelectedModule(guide)}
                      className={`flex items-center gap-4 p-5 rounded-2xl border transition-all text-left group
                        ${isActive 
                          ? 'bg-white border-stone-900 shadow-xl shadow-stone-200 ring-4 ring-stone-900/5' 
                          : 'bg-white border-stone-100 hover:border-stone-300 shadow-sm'
                        }`}
                    >
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors
                        ${isActive ? 'bg-stone-900 text-white' : 'bg-stone-50 text-stone-400 group-hover:bg-stone-100 group-hover:text-stone-600'}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-[15px] truncate ${isActive ? 'text-stone-900' : 'text-stone-700'}`}>
                          {guide.title}
                        </p>
                        <p className="text-[12px] text-stone-400 truncate mt-0.5">
                          {guide.description}
                        </p>
                      </div>
                      <ChevronRight className={`h-4 w-4 transition-all
                        ${isActive ? 'text-stone-900 translate-x-1' : 'text-stone-300 group-hover:text-stone-400'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Area */}
            <div className={`flex-1 ${!selectedModule ? 'hidden lg:flex items-center justify-center min-h-[500px] bg-stone-50 rounded-3xl border-2 border-dashed border-stone-200' : 'block'}`}>
              {!selectedModule ? (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto shadow-sm">
                    <BookOpen className="h-10 w-10 text-stone-200" />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-bold text-stone-900">Education Hub</h3>
                    <p className="text-stone-400 max-w-[280px] mx-auto text-sm mt-1">Select a module from the list to view its comprehensive documentation and training guide.</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-3xl border border-stone-200 shadow-sm flex flex-col h-full animate-ios-slide-up">
                  {/* Content Header */}
                  <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                    <div className="flex items-center gap-4">
                      <button 
                         onClick={() => setSelectedModule(null)}
                         className="lg:hidden p-2 rounded-full hover:bg-stone-100 text-stone-400"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                      <div className="w-14 h-14 rounded-2xl bg-stone-900 text-white flex items-center justify-center shadow-lg shadow-stone-200">
                        {(() => {
                          const Icon = iconMap[selectedModule.icon] || FileText;
                          return <Icon className="h-7 w-7" />;
                        })()}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-stone-900">{selectedModule.title}</h2>
                        <p className="text-sm text-stone-500">{selectedModule.description}</p>
                      </div>
                    </div>
                    <button 
                        onClick={() => handleDownloadPDF(selectedModule)}
                        className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full border border-stone-200 text-stone-600 text-xs font-bold hover:bg-white hover:border-stone-900 transition-all active:scale-95 shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download Guide</span>
                    </button>
                  </div>

                  {/* Documentation Body */}
                  <div className="p-8 space-y-12 overflow-y-auto max-h-[75vh] custom-scrollbar">
                    {/* Features Grid */}
                    <section>
                      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">Key Capabilities</h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {selectedModule.features.map((feature, i) => (
                          <div key={i} className="flex gap-4 p-4 rounded-2xl bg-stone-50 border border-stone-100 group hover:bg-white hover:border-stone-200 transition-all">
                            <div className="w-2 h-2 rounded-full bg-stone-900 mt-2 shrink-0 group-hover:scale-125 transition-transform" />
                            <p className="text-[14px] text-stone-700 leading-relaxed font-medium">
                              <span className="font-bold text-stone-900">{feature.split(':')[0]}:</span>
                              {feature.split(':')[1]}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Detailed Content */}
                    <section className="prose prose-stone max-w-none">
                      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">Deep Dive Analysis</h3>
                      <div className="space-y-6 text-stone-700 leading-[1.8] text-[15px] bg-stone-50/50 p-8 rounded-3xl border border-stone-100">
                         {selectedModule.content.split('\n').map((line, i) => {
                             if (line.trim().startsWith('###')) {
                                 return <h4 key={i} className="text-lg font-bold text-stone-900 mt-8 mb-4">{line.replace(/###/g, '').trim()}</h4>
                             }
                             if (line.trim().startsWith('####')) {
                                 return <h5 key={i} className="text-[15px] font-bold text-stone-900 mt-6 mb-2">{line.replace(/####/g, '').trim()}</h5>
                             }
                             return <p key={i} className="mb-4">{line.trim()}</p>
                         })}
                      </div>
                    </section>

                    {/* How to Use */}
                    <section>
                      <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-6">Operational Steps</h3>
                      <div className="space-y-3">
                        {selectedModule.howToUse.map((step, i) => (
                          <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-stone-100 bg-white">
                            <div className="w-7 h-7 rounded-lg bg-stone-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
                                {i + 1}
                            </div>
                            <p className="text-[14px] text-stone-700 font-medium">{step}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                    
                    {/* Branding Quote */}
                    <div className="pt-12 mt-12 border-t border-stone-100 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-900 text-xs shadow-inner">
                           HS
                        </div>
                        <div>
                          <p className="text-[12px] font-bold text-stone-900 uppercase tracking-tighter">Developed by HIRALL SOLUTIONS</p>
                          <p className="text-[10px] text-stone-400">Excellence in Enterprise Resource Management</p>
                        </div>
                      </div>
                      <div className="text-[10px] text-stone-400 font-medium bg-stone-50 px-3 py-1.5 rounded-full">
                         Document Reference: FAMOUSGATE-DOC-{selectedModule.id.toUpperCase()}-2026
                      </div>
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
