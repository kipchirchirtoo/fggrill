'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { 
  Settings, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Edit3, 
  Info,
  ShieldCheck,
  Percent,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
interface PayrollPolicy {
  id: string;
  name: string;
  category: string;
  calculation_type: 'percentage' | 'flat' | 'range' | 'attendance_based';
  rate: number;
  value?: number; // fallback for current code
  is_active: boolean;
  description?: string;
  effective_date?: string;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  shif: 'SHIF/SHA',
  nssf: 'NSSF',
  housing_levy: 'Housing Levy',
  absenteeism: 'Absenteeism',
  uniform: 'Uniform',
  other: 'Other'
};

const POLICY_ICONS: Record<string, any> = {
  percentage: Percent,
  flat: DollarSign,
  range: AlertCircle,
  attendance_based: Settings
};

// ─── Main Page Component ─────────────────────────────────────────────────────
export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PayrollPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PayrollPolicy | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'other',
    calculation_type: 'flat',
    rate: 0,
    is_active: true,
    description: '',
    effective_date: new Date().toISOString().split('T')[0]
  });

  const fetchPolicies = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await api.payrollPolicies.getPolicies();
      if (res.success) {
        setPolicies(res.data || []);
      } else {
        toast.error(res.message || 'Failed to fetch policies');
      }
    } catch (error) {
      toast.error('Network error fetching policies');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const handleOpenModal = (policy?: PayrollPolicy) => {
    if (policy) {
      setEditingPolicy(policy);
      setFormData({
        name: policy.name,
        category: policy.category,
        calculation_type: (policy.calculation_type || (policy as any).formula_type) as any,
        rate: policy.rate !== undefined ? policy.rate : (policy as any).value || 0,
        is_active: policy.is_active,
        description: policy.description || '',
        effective_date: (policy.effective_date || policy.created_at || new Date().toISOString()).split('T')[0]
      });
    } else {
      setEditingPolicy(null);
      setFormData({
        name: '',
        category: 'other',
        calculation_type: 'flat',
        rate: 0,
        is_active: true,
        description: '',
        effective_date: new Date().toISOString().split('T')[0]
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let res;
      const submissionData = {
        name: formData.name,
        category: formData.category,
        formula_type: formData.calculation_type,
        rate: formData.rate,
        is_active: formData.is_active
      };

      if (editingPolicy) {
        res = await api.payrollPolicies.updatePolicy(editingPolicy.id, submissionData);
      } else {
        res = await api.payrollPolicies.createPolicy(submissionData);
      }

      if (res.success) {
        toast.success(editingPolicy ? 'Policy updated successfully' : 'Policy created successfully');
        setIsModalOpen(false);
        fetchPolicies();
      } else {
        toast.error(res.message || 'Action failed');
      }
    } catch (error) {
      toast.error('Error saving policy');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this policy? It may affect future payroll runs.')) return;
    try {
      const res = await api.payrollPolicies.deletePolicy(id);
      if (res.success) {
        toast.success('Policy deleted');
        fetchPolicies();
      } else {
        toast.error(res.message || 'Delete failed');
      }
    } catch (error) {
      toast.error('Error deleting policy');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1200px] mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-stone-900 tracking-tight flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-blue-600" />
              Payroll Policies
            </h1>
            <p className="text-stone-500 text-sm font-medium">
              Configure statutory rates, automatic deductions, and absenteeism rules.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <IOSButton 
              onClick={() => fetchPolicies(true)}
              disabled={isRefreshing || isLoading}
              className="bg-white text-stone-900 border border-stone-200 shadow-sm hover:bg-stone-50"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
              Refresh
            </IOSButton>
            <IOSButton 
              onClick={() => handleOpenModal()}
              className="bg-[#007AFF] text-white shadow-lg shadow-blue-100 border-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Policy
            </IOSButton>
          </div>
        </div>

        {/* Informational Alert */}
        <div className="bg-blue-50/50 border border-blue-100 rounded-[24px] p-6 flex gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0">
            <Info className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 tracking-tight">Traceable & Auditable</h3>
            <p className="text-blue-700/80 text-sm leading-relaxed mt-1">
              Changes to these policies will be tracked and applied to future payroll drafts. 
              The system uses these values to calculate SHIF, NSSF, and Absenteeism deductions automatically.
            </p>
          </div>
        </div>

        {/* Policies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white h-[200px] rounded-[32px] border border-stone-200 animate-pulse" />
            ))
          ) : policies.length === 0 ? (
            <div className="col-span-full py-24 text-center">
              <div className="w-20 h-20 rounded-full bg-stone-50 flex items-center justify-center mx-auto mb-6">
                <Settings className="w-10 h-10 text-stone-200" />
              </div>
              <h3 className="text-xl font-bold text-stone-900">No Policies Configured</h3>
              <p className="text-stone-500 mt-2">Create your first policy to start automated calculations.</p>
            </div>
          ) : (
            policies.map((p) => {
              const Icon = POLICY_ICONS[p.calculation_type] || Settings;
              return (
                <div 
                  key={p.id} 
                  className={cn(
                    "group bg-white rounded-[32px] border border-stone-200/60 p-6 transition-all hover:shadow-2xl hover:shadow-stone-200/50 relative overflow-hidden",
                    !p.is_active && "opacity-60 grayscale-[0.5]"
                  )}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-stone-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                      <Icon className="w-6 h-6 text-stone-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleOpenModal(p)}
                        className="p-2 hover:bg-stone-50 rounded-xl text-stone-400 hover:text-stone-900 transition-all"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id)}
                        className="p-2 hover:bg-red-50 rounded-xl text-stone-400 hover:text-red-600 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-stone-900 tracking-tight">{p.name}</h3>
                      {!p.is_active && (
                        <span className="text-[9px] font-black uppercase tracking-widest bg-stone-100 text-stone-400 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">{CATEGORY_LABELS[p.category] || p.category}</p>
                  </div>

                  <div className="mt-6 flex items-end justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Value</p>
                      <p className="text-2xl font-black text-stone-900">
                        {p.calculation_type === 'percentage' || (p as any).formula_type === 'percentage' 
                          ? `${p.rate || (p as any).value || 0}%` 
                          : `KES ${(p.rate || (p as any).value || 0).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Effective</p>
                      <p className="text-xs font-bold text-stone-600">
                        {new Date(p.effective_date || p.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {p.description && (
                    <p className="mt-4 text-xs text-stone-500 leading-relaxed line-clamp-2 italic">
                      "{p.description}"
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Policy Modal (Simplified) */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl p-8 border border-stone-200/60 animate-in zoom-in-95 duration-300">
               <div className="flex justify-between items-center mb-8">
                 <div>
                   <h2 className="text-2xl font-black text-stone-900 tracking-tight">
                     {editingPolicy ? 'Edit Policy' : 'Create New Policy'}
                   </h2>
                   <p className="text-stone-500 text-sm font-medium">Configure calculation rules</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors">
                   <Plus className="w-6 h-6 text-stone-400 rotate-45" />
                 </button>
               </div>

               <form onSubmit={handleSubmit} className="space-y-6">
                 <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest block mb-2 px-1">Policy Name</label>
                       <input 
                         required
                         value={formData.name}
                         onChange={e => setFormData({...formData, name: e.target.value})}
                         className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-stone-900 focus:ring-2 focus:ring-blue-500 transition-all"
                         placeholder="e.g. Standard SHIF"
                       />
                     </div>
                     <div>
                       <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest block mb-2 px-1">Category</label>
                       <select 
                         value={formData.category}
                         onChange={e => setFormData({...formData, category: e.target.value})}
                         className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-stone-900 focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                       >
                         {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                           <option key={val} value={val}>{label}</option>
                         ))}
                       </select>
                     </div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                     <div>
                       <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest block mb-2 px-1">Calc Type</label>
                       <select 
                         value={formData.calculation_type}
                         onChange={e => setFormData({...formData, calculation_type: (e.target.value as any)})}
                         className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-stone-900 focus:ring-2 focus:ring-500 transition-all appearance-none"
                       >
                          <option value="percentage">Percentage (%)</option>
                          <option value="flat">Fixed Amount (KES)</option>
                          <option value="attendance_based">Attendance Based</option>
                          <option value="range">Range Based</option>
                       </select>
                     </div>
                     <div>
                       <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest block mb-2 px-1">Value</label>
                       <input 
                         type="number"
                         step="0.01"
                         required
                          value={formData.rate}
                          onChange={e => setFormData({...formData, rate: parseFloat(e.target.value)})}
                         className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-stone-900 focus:ring-2 focus:ring-blue-500 transition-all"
                       />
                     </div>
                   </div>

                   <div>
                     <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest block mb-2 px-1">Effective Date</label>
                     <input 
                       type="date"
                       required
                       value={formData.effective_date}
                       onChange={e => setFormData({...formData, effective_date: e.target.value})}
                       className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-stone-900 focus:ring-2 focus:ring-blue-500 transition-all"
                     />
                   </div>

                   <div>
                     <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest block mb-2 px-1">Description</label>
                     <textarea 
                       value={formData.description}
                       onChange={e => setFormData({...formData, description: e.target.value})}
                       className="w-full bg-stone-50 border-none rounded-2xl px-4 py-3 text-sm font-bold text-stone-900 focus:ring-2 focus:ring-blue-500 transition-all min-h-[80px]"
                       placeholder="Explain the purpose of this policy..."
                     />
                   </div>

                   <div className="flex items-center gap-3 bg-stone-50 p-4 rounded-2xl">
                     <input 
                       type="checkbox"
                       id="is_active"
                       checked={formData.is_active}
                       onChange={e => setFormData({...formData, is_active: e.target.checked})}
                       className="w-5 h-5 rounded-lg border-stone-200 text-blue-600 focus:ring-blue-500"
                     />
                     <label htmlFor="is_active" className="text-sm font-bold text-stone-700 cursor-pointer select-none">Policy Is Active</label>
                   </div>
                 </div>

                 <div className="pt-4 flex gap-3">
                   <IOSButton 
                     type="button"
                     onClick={() => setIsModalOpen(false)}
                     className="flex-1 bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                   >
                     Cancel
                   </IOSButton>
                   <IOSButton 
                     type="submit"
                     className="flex-1 bg-stone-900 text-white shadow-xl shadow-stone-200 border-none"
                   >
                     {editingPolicy ? 'Update Policy' : 'Create Policy'}
                   </IOSButton>
                 </div>
               </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
