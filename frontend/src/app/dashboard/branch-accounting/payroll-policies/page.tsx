'use client';

import { useState, useEffect, useCallback } from 'react';
import { staffAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, RefreshCw, Shield, Users, Save, ToggleLeft, ToggleRight } from 'lucide-react';

interface StaffDeductionSettings {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  department: string;
  position: string;
  basic_salary: number;
  nssf_enabled: boolean | null;
  shif_enabled: boolean | null;
  housing_fund_enabled: boolean | null;
}

export default function PayrollPoliciesPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [staffList, setStaffList] = useState<StaffDeductionSettings[]>([]);
  const [filteredStaff, setFilteredStaff] = useState<StaffDeductionSettings[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchStaff = useCallback(async () => {
    if (!currentBranchId) {
      setStaffList([]);
      setFilteredStaff([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await staffAPI.getStaff({
        branch_id: currentBranchId,
        status: 'active',
        limit: 500,
      });

      if (response.success && response.data) {
        const mapped = response.data.map((s: any) => ({
          id: s.id,
          first_name: s.first_name || '',
          last_name: s.last_name || '',
          employee_number: s.employee_number || '',
          department: s.department || '',
          position: s.position || '',
          basic_salary: s.basic_salary || 0,
          nssf_enabled: s.nssf_enabled ?? true,
          shif_enabled: s.shif_enabled ?? true,
          housing_fund_enabled: s.housing_fund_enabled ?? true,
        }));
        setStaffList(mapped);
        setFilteredStaff(mapped);
      } else {
        setStaffList([]);
        setFilteredStaff([]);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load staff');
      setStaffList([]);
      setFilteredStaff([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStaff(staffList);
      return;
    }
    const q = searchQuery.toLowerCase();
    const filtered = staffList.filter(
      (s) =>
        s.first_name.toLowerCase().includes(q) ||
        s.last_name.toLowerCase().includes(q) ||
        s.employee_number.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.position.toLowerCase().includes(q)
    );
    setFilteredStaff(filtered);
  }, [searchQuery, staffList]);

  const toggleField = (id: string, field: keyof StaffDeductionSettings) => {
    setStaffList((prev) => {
      const updated = prev.map((s) =>
        s.id === id ? { ...s, [field]: !s[field as keyof StaffDeductionSettings] } : s
      );
      setFilteredStaff(updated.filter((s) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          s.first_name.toLowerCase().includes(q) ||
          s.last_name.toLowerCase().includes(q) ||
          s.employee_number.toLowerCase().includes(q) ||
          s.department.toLowerCase().includes(q) ||
          s.position.toLowerCase().includes(q)
        );
      }));
      setHasChanges(true);
      return updated;
    });
  };

  const saveSettings = async (staffId: string) => {
    const staff = staffList.find((s) => s.id === staffId);
    if (!staff) return;

    setSavingIds((prev) => new Set(prev).add(staffId));
    try {
      const response = await staffAPI.updateStaffMember(staffId, {
        nssf_enabled: staff.nssf_enabled,
        shif_enabled: staff.shif_enabled,
        housing_fund_enabled: staff.housing_fund_enabled,
      });

      if (response.success) {
        toast.success(`${staff.first_name} ${staff.last_name} deduction settings saved`);
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save settings');
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(staffId);
        return next;
      });
    }
  };

  const saveAllSettings = async () => {
    const promises = staffList.map((s) =>
      staffAPI.updateStaffMember(s.id, {
        nssf_enabled: s.nssf_enabled,
        shif_enabled: s.shif_enabled,
        housing_fund_enabled: s.housing_fund_enabled,
      })
    );

    setIsLoading(true);
    try {
      await Promise.all(promises);
      toast.success('All deduction settings saved successfully');
      setHasChanges(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save some settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['super_admin', 'general_manager', 'branch_manager', 'accountant', 'branch_accountant', 'hr_manager']}>
      <DashboardLayout>
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-stone-900">Payroll Policies & Adjustments</h1>
              <p className="text-sm text-stone-500 mt-1">
                Configure statutory deductions (NSSF, SHIF, Housing Fund) per employee
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchStaff}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {hasChanges && (
                <button
                  onClick={saveAllSettings}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  Save All Changes
                </button>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-stone-500">Total Staff</p>
                  <p className="text-xl font-bold text-stone-900">{staffList.length}</p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-stone-500">NSSF Enabled</p>
                  <p className="text-xl font-bold text-stone-900">
                    {staffList.filter((s) => s.nssf_enabled).length}
                  </p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-stone-500">SHIF Enabled</p>
                  <p className="text-xl font-bold text-stone-900">
                    {staffList.filter((s) => s.shif_enabled).length}
                  </p>
                </div>
              </div>
            </IOSCard>
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-stone-500">Housing Fund</p>
                  <p className="text-xl font-bold text-stone-900">
                    {staffList.filter((s) => s.housing_fund_enabled).length}
                  </p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <Input
              type="text"
              placeholder="Search by name, employee number, department, or position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full"
            />
          </div>

          {/* Staff Table */}
          <IOSCard className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50">
                    <th className="text-left py-3 px-4 font-semibold text-stone-700">Staff</th>
                    <th className="text-left py-3 px-4 font-semibold text-stone-700">Department</th>
                    <th className="text-left py-3 px-4 font-semibold text-stone-700">Position</th>
                    <th className="text-right py-3 px-4 font-semibold text-stone-700">Basic Salary</th>
                    <th className="text-center py-3 px-4 font-semibold text-stone-700">NSSF</th>
                    <th className="text-center py-3 px-4 font-semibold text-stone-700">SHIF</th>
                    <th className="text-center py-3 px-4 font-semibold text-stone-700">Housing</th>
                    <th className="text-center py-3 px-4 font-semibold text-stone-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && staffList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-500">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading staff...
                      </td>
                    </tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-stone-500">
                        {searchQuery ? 'No staff match your search' : 'No active staff found'}
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((staff) => (
                      <tr key={staff.id} className="border-b border-stone-100 hover:bg-stone-50/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-stone-900">
                              {staff.first_name} {staff.last_name}
                            </span>
                            <span className="text-xs text-stone-500">{staff.employee_number}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-stone-600 capitalize">{staff.department}</td>
                        <td className="py-3 px-4 text-stone-600 capitalize">{staff.position}</td>
                        <td className="py-3 px-4 text-right font-mono text-stone-700">
                          KES {staff.basic_salary.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleField(staff.id, 'nssf_enabled')}
                              className="transition-transform active:scale-95"
                              title={staff.nssf_enabled ? 'NSSF deduction enabled' : 'NSSF deduction disabled'}
                            >
                              {staff.nssf_enabled ? (
                                <ToggleRight className="h-6 w-6 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-6 w-6 text-stone-300" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleField(staff.id, 'shif_enabled')}
                              className="transition-transform active:scale-95"
                              title={staff.shif_enabled ? 'SHIF deduction enabled' : 'SHIF deduction disabled'}
                            >
                              {staff.shif_enabled ? (
                                <ToggleRight className="h-6 w-6 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-6 w-6 text-stone-300" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => toggleField(staff.id, 'housing_fund_enabled')}
                              className="transition-transform active:scale-95"
                              title={
                                staff.housing_fund_enabled
                                  ? 'Housing Fund enabled'
                                  : 'Housing Fund disabled'
                              }
                            >
                              {staff.housing_fund_enabled ? (
                                <ToggleRight className="h-6 w-6 text-green-600" />
                              ) : (
                                <ToggleLeft className="h-6 w-6 text-stone-300" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => saveSettings(staff.id)}
                              disabled={savingIds.has(staff.id)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                              {savingIds.has(staff.id) ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                              {savingIds.has(staff.id) ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </IOSCard>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 text-xs text-stone-500">
            <div className="flex items-center gap-2">
              <ToggleRight className="h-4 w-4 text-green-600" />
              <span>Deduction enabled</span>
            </div>
            <div className="flex items-center gap-2">
              <ToggleLeft className="h-4 w-4 text-stone-300" />
              <span>Deduction disabled</span>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
