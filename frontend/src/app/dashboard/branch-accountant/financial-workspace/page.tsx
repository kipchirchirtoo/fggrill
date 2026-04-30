'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { financeAPI } from '@/lib/api/finance';
import { 
  Calendar as CalendarIcon, 
  RefreshCw, 
  Download, 
  FileText, 
  DollarSign, 
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO } from 'date-fns';
import { DailyEntryModal } from './components/DailyEntryModal';
import { MonthlyAdjustmentsModal } from './components/MonthlyAdjustmentsModal';

interface DailyRecord {
  id: string;
  record_date: string;
  status: 'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'FLAGGED';
  total_revenue: number;
  total_payments: number;
  expected_cash: number;
  unbanked_cash: number;
  net_profit: number;
}

export default function FinancialWorkspacePage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchRecords = useCallback(async () => {
    if (!currentBranchId) return;

    setIsLoading(true);
    try {
      const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

      const response = await financeAPI.workspace.getDailyRecords({
        branch_id: currentBranchId,
        start_date: start,
        end_date: end
      });

      if (response.success) {
        setRecords(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch records:', error);
      toast.error(error.message || 'Failed to load financial records');
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId, currentDate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleModalClose = (wasSaved: boolean) => {
    setIsModalOpen(false);
    setSelectedDate(null);
    if (wasSaved) {
      fetchRecords();
    }
  };

  // Calendar Generation
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  const getRecordForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return records.find(r => r.record_date === dateStr);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUBMITTED': return <Clock className="h-4 w-4 text-blue-500" />;
      case 'REVIEWED': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'FLAGGED': return <AlertCircle className="h-4 w-4 text-rose-500" />;
      case 'DRAFT':
      default: return <FileText className="h-4 w-4 text-stone-400" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'SUBMITTED': return 'bg-blue-50 border-blue-200';
      case 'REVIEWED': return 'bg-emerald-50 border-emerald-200';
      case 'FLAGGED': return 'bg-rose-50 border-rose-200';
      case 'DRAFT': return 'bg-stone-50 border-stone-200';
      default: return 'bg-white border-stone-100 hover:border-stone-300';
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout
        title="Financial Workspace"
        subtitle="Daily financial tracking and reconciliation"
      >
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex items-center gap-4">
              <IOSButton 
                variant="secondary"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              >
                Previous
              </IOSButton>
              <h2 className="text-lg font-semibold min-w-[150px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </h2>
              <IOSButton 
                variant="secondary"
                onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              >
                Next
              </IOSButton>
            </div>
            
            <div className="flex items-center gap-2">
              <IOSButton
                variant="secondary"
                leftIcon={<DollarSign />}
                onClick={() => setIsMonthlyModalOpen(true)}
              >
                Monthly Adjustments
              </IOSButton>
              <IOSButton
                variant="secondary"
                leftIcon={<RefreshCw className={isLoading ? "animate-spin" : ""} />}
                onClick={fetchRecords}
              >
                Refresh
              </IOSButton>
              <IOSButton
                variant="primary"
                leftIcon={<Download />}
                onClick={() => {
                  if (!currentBranchId) return;
                  const url = financeAPI.workspace.exportMonthlyStatement({
                    branch_id: currentBranchId,
                    fiscal_year: currentDate.getFullYear(),
                    fiscal_month: currentDate.getMonth() + 1
                  });
                  window.open(`${process.env.NEXT_PUBLIC_API_URL || 'https://api.fggrill.com'}${url}`, '_blank');
                }}
              >
                Export Month
              </IOSButton>
            </div>
          </div>

          {/* Monthly Summary Cards could go here */}

          {/* Calendar Grid */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 auto-rows-[120px]">
              {/* Padding for first day of month */}
              {Array.from({ length: startOfMonth(currentDate).getDay() }).map((_, i) => (
                <div key={`pad-${i}`} className="border-r border-b border-stone-100 bg-stone-50/50" />
              ))}
              
              {daysInMonth.map(date => {
                const record = getRecordForDate(date);
                const isCurrentDay = isToday(date);
                
                return (
                  <div 
                    key={date.toISOString()}
                    onClick={() => handleDateClick(date)}
                    className={`
                      border-r border-b border-stone-200 p-2 cursor-pointer transition-all duration-200
                      ${getStatusColor(record?.status)}
                      ${isCurrentDay ? 'ring-2 ring-inset ring-[#007AFF]' : ''}
                      hover:shadow-md relative
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`
                        text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                        ${isCurrentDay ? 'bg-[#007AFF] text-white' : 'text-stone-700'}
                      `}>
                        {format(date, 'd')}
                      </span>
                      {record && (
                        <div title={`Status: ${record.status}`}>
                          {getStatusIcon(record.status)}
                        </div>
                      )}
                    </div>
                    
                    {record && (
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-stone-500">Rev:</span>
                          <span className="font-medium text-stone-900">
                            {Number(record.total_revenue || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-stone-500">Net:</span>
                          <span className={`font-medium ${Number(record.net_profit) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {Number(record.net_profit || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        {Number(record.unbanked_cash) > 0 && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-rose-600 bg-rose-100 px-1 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3" />
                            Unbanked
                          </div>
                        )}
                      </div>
                    )}
                    
                    {!record && date <= new Date() && (
                      <div className="mt-6 flex justify-center">
                        <span className="text-xs text-stone-400 font-medium">Add Entry</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {isModalOpen && selectedDate && (
          <DailyEntryModal 
            isOpen={isModalOpen}
            onClose={handleModalClose}
            date={selectedDate}
            branchId={currentBranchId!}
            existingRecord={getRecordForDate(selectedDate)}
          />
        )}

        {isMonthlyModalOpen && (
          <MonthlyAdjustmentsModal
            isOpen={isMonthlyModalOpen}
            onClose={() => setIsMonthlyModalOpen(false)}
            year={currentDate.getFullYear()}
            month={currentDate.getMonth() + 1}
            branchId={currentBranchId!}
          />
        )}
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}
