'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI } from '@/lib/api/staff';
import { ArrowLeft, Award, TrendingUp, Target, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function StaffPerformancePage() {
  const params = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<any>(null);
  const staffId = params.id as string;

  useEffect(() => {
    fetchKPIs();
  }, [staffId]);

  const fetchKPIs = async () => {
    setIsLoading(true);
    try {
      const response = await staffAPI.getPerformance({ staff_id: staffId, period: '30' });
      
      if (response.success && response.data) {
        // The API returns { performance: [...], summary: {...} }
        // Find this specific staff member's data in the performance array
        const performanceArray = response.data.performance || [];
        const staffPerformance = performanceArray.find((p: any) => p.staff_id === staffId);
        
        if (staffPerformance) {
          // TEMPORARY: Also fetch attendance to calculate correct values
          try {
            const attResponse = await staffAPI.getAttendance({ staff_id: staffId });
            if (attResponse.success && attResponse.data && attResponse.data.length > 0) {
              const records = attResponse.data;
              const presentDays = records.filter((r: any) => r.status === 'present').length;
              const lateDays = records.filter((r: any) => r.status === 'late' || r.is_late).length;
              const totalDays = records.length;
              const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
              
              // Override with calculated values from actual attendance
              staffPerformance.present_days = presentDays;
              staffPerformance.late_days = lateDays;
              staffPerformance.attendance_rate = attendanceRate;
              staffPerformance.total_tasks = staffPerformance.total_tasks || 0;
              staffPerformance.completed_tasks = staffPerformance.completed_tasks || 0;
            }
          } catch (e) {
            console.error('Error fetching attendance for performance:', e);
          }
          
          setKpis(staffPerformance);
        } else {
          // Fallback to default values if individual data not found
          setKpis({
            attendance_rate: 0,
            punctuality_score: 0,
            task_completion_rate: 0,
            performance_score: 0,
            present_days: 0,
            late_days: 0,
            total_tasks: 0,
            completed_tasks: 0,
            revenue_contribution: 0
          });
        }
      }
    } catch (error: any) {
      console.error('Error fetching KPIs:', error);
      toast.error(error.message || 'Failed to load performance data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.HR_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <Link href={`/dashboard/branch-manager/staff/${staffId}`} className="text-stone-400 hover:text-stone-900 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="text-[12px] font-bold text-stone-400 uppercase tracking-widest">
              Staff / Performance KPIs
            </span>
          </div>

          <div className="flex items-center justify-between">
            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Performance KPIs</h1>
            <button onClick={fetchKPIs} disabled={isLoading} className="btn-secondary">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
            </div>
          ) : kpis ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="stat-card">
                  <div className="stat-icon bg-emerald-50 text-emerald-600">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <p className="stat-value">{kpis.attendance_rate || 0}%</p>
                  <p className="stat-label">Attendance Rate</p>
                </div>
                <div className="stat-card">
                  <div className="stat-icon bg-purple-50 text-purple-600">
                    <Clock className="h-5 w-5" />
                  </div>
                  <p className="stat-value">{kpis.punctuality_score || 0}%</p>
                  <p className="stat-label">Punctuality</p>
                </div>
                <div className="stat-card">
                  <div className="stat-icon bg-amber-50 text-amber-600">
                    <Target className="h-5 w-5" />
                  </div>
                  <p className="stat-value">{kpis.task_completion_rate || 0}%</p>
                  <p className="stat-label">Task Completion</p>
                </div>
                <div className="stat-card">
                  <div className="stat-icon bg-blue-50 text-blue-600">
                    <Award className="h-5 w-5" />
                  </div>
                  <p className="stat-value">{kpis.performance_score || 0}%</p>
                  <p className="stat-label">Overall Score</p>
                </div>
              </div>

              <div className="card-elevated p-6">
                <h3 className="text-[15px] font-semibold text-stone-900 mb-4">Performance Details</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                    <span className="text-sm text-stone-600">Present Days</span>
                    <span className="text-sm font-medium text-stone-900">{kpis.present_days || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                    <span className="text-sm text-stone-600">Late Days</span>
                    <span className="text-sm font-medium text-stone-900">{kpis.late_days || 0}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                    <span className="text-sm text-stone-600">Completed Tasks</span>
                    <span className="text-sm font-medium text-stone-900">{kpis.completed_tasks || 0} / {kpis.total_tasks || 0}</span>
                  </div>
                  {kpis.revenue_contribution > 0 && (
                    <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                      <span className="text-sm text-stone-600">Revenue Contribution</span>
                      <span className="text-sm font-medium text-stone-900">
                        {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(kpis.revenue_contribution)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="card-elevated p-6 text-center py-20">
              <TrendingUp className="h-12 w-12 text-stone-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-stone-900">No Performance Data</h3>
              <p className="text-sm text-stone-500 mt-1">Performance data is not available for this staff member.</p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
