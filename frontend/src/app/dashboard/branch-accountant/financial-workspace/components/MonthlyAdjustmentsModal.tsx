'use client';

import React, { useState, useEffect } from 'react';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { financeAPI } from '@/lib/api/finance';
import { toast } from 'sonner';
import { X, Save, Calculator, Landmark } from 'lucide-react';

interface MonthlyAdjustmentsModalProps {
  isOpen: boolean;
  onClose: (wasSaved: boolean) => void;
  year: number;
  month: number;
  branchId: number;
}

export function MonthlyAdjustmentsModal({ isOpen, onClose, year, month, branchId }: MonthlyAdjustmentsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const [adjustments, setAdjustments] = useState({
    electricity: 0,
    salaries: 0,
    water: 0,
    rent: 0,
    nssf: 0,
    shif: 0,
    tax: 0,
    levy: 0,
    licenses: 0
  });

  const [subscriptions, setSubscriptions] = useState<any>({});
  
  useEffect(() => {
    const fetchAdjustments = async () => {
      try {
        const response = await financeAPI.workspace.getMonthlyAdjustments({
          branch_id: branchId,
          fiscal_year: year,
          fiscal_month: month
        });
        if (response.success && response.data.length > 0) {
          const data = response.data[0];
          setAdjustments({
            electricity: data.electricity || 0,
            salaries: data.salaries || 0,
            water: data.water || 0,
            rent: data.rent || 0,
            nssf: data.nssf || 0,
            shif: data.shif || 0,
            tax: data.tax || 0,
            levy: data.levy || 0,
            licenses: data.licenses || 0
          });
          setSubscriptions(data.subscriptions || {});
        }
      } catch (error) {
        console.error('Failed to fetch monthly adjustments:', error);
      }
    };

    if (isOpen) {
      fetchAdjustments();
    }
  }, [isOpen, branchId, year, month]);

  const totalMonthlyExpenses = Object.values(adjustments).reduce((a, b) => Number(a) + Number(b), 0);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await financeAPI.workspace.saveMonthlyAdjustment({
        branch_id: branchId,
        fiscal_year: year,
        fiscal_month: month,
        ...adjustments,
        subscriptions,
        total_monthly_expenses: totalMonthlyExpenses
      });
      toast.success('Monthly adjustments saved successfully');
      onClose(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save adjustments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setAdjustments({ ...adjustments, [field]: value === '' ? '' : Number(value) });
  };

  if (!isOpen) return null;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
          <div>
            <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[#007AFF]" />
              Monthly Adjustments
            </h2>
            <p className="text-sm text-stone-500">{monthNames[month - 1]} {year}</p>
          </div>
          <button onClick={() => onClose(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Salaries & Wages</label>
              <Input
                type="number"
                value={adjustments.salaries}
                onChange={(e) => handleInputChange('salaries', e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Rent</label>
              <Input
                type="number"
                value={adjustments.rent}
                onChange={(e) => handleInputChange('rent', e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Electricity</label>
              <Input
                type="number"
                value={adjustments.electricity}
                onChange={(e) => handleInputChange('electricity', e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Water</label>
              <Input
                type="number"
                value={adjustments.water}
                onChange={(e) => handleInputChange('water', e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">NSSF Contributions</label>
              <Input
                type="number"
                value={adjustments.nssf}
                onChange={(e) => handleInputChange('nssf', e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">SHIF/NHIF</label>
              <Input
                type="number"
                value={adjustments.shif}
                onChange={(e) => handleInputChange('shif', e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Corporate Tax</label>
              <Input
                type="number"
                value={adjustments.tax}
                onChange={(e) => handleInputChange('tax', e.target.value)}
                className="font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Catering Levy</label>
              <Input
                type="number"
                value={adjustments.levy}
                onChange={(e) => handleInputChange('levy', e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">Licenses & Permits</label>
              <Input
                type="number"
                value={adjustments.licenses}
                onChange={(e) => handleInputChange('licenses', e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex justify-between items-center">
            <div className="flex items-center gap-2 text-stone-600">
              <Calculator className="w-4 h-4" />
              <span className="font-semibold">Total Monthly Adjustments</span>
            </div>
            <span className="text-xl font-bold text-[#007AFF]">KES {totalMonthlyExpenses.toLocaleString()}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end gap-3">
          <IOSButton variant="secondary" onClick={() => onClose(false)}>Cancel</IOSButton>
          <IOSButton 
            variant="primary" 
            leftIcon={<Save />}
            onClick={handleSave}
            disabled={isLoading}
          >
            Save Adjustments
          </IOSButton>
        </div>
      </div>
    </div>
  );
}
