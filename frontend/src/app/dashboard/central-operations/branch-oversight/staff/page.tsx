'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { toast } from 'sonner';
import { 
  Users, Search, RefreshCw, Download, Building2, 
  UserCheck, UserX, Clock, Calendar, Star, Award,
  TrendingUp, TrendingDown, Filter, Loader2, Mail,
  Phone, Briefcase, BarChart3, PieChart, AlertTriangle,
  CheckCircle2, XCircle, Eye, FileText, FileSpreadsheet,
  ChevronDown, X
} from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  branch_id: number;
  branch_name: string;
  status: 'active' | 'inactive' | 'on_leave';
  hire_date: string;
  performance_score: number;
  attendance_rate: number;
  shifts_completed: number;
  shifts_missed: number;
  overtime_hours: number;
  customer_rating: number;
}

interface BranchStaffSummary {
  branch_id: number;
  branch_name: string;
  total_staff: number;
  active: number;
  on_leave: number;
  avg_performance: number;
  avg_attendance: number;
}

interface StaffOverview {
  total_staff: number;
  active_staff: number;
  on_leave: number;
  avg_performance: number;
  avg_attendance: number;
  top_performers: StaffMember[];
  needs_attention: StaffMember[];
  branch_summaries: BranchStaffSummary[];
  all_staff: StaffMember[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const PYTHON_SERVICE = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:5001';

function StaffOverviewContent() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState<StaffOverview | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | null>(null);

  const departments = ['Kitchen', 'Service', 'Reception', 'Housekeeping', 'Management', 'Security'];

  // Get selected branch name for header
  const selectedBranchName = branchFilter === 'all' 
    ? null 
    : overview?.branch_summaries.find(b => b.branch_id.toString() === branchFilter)?.branch_name;

  const fetchStaffData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE}/api/central-operations/branch-oversight/staff`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setOverview(data.data);
      } else {
        toast.error('Failed to load staff data');
      }
    } catch (error) {
      console.error('Error fetching staff data:', error);
      toast.error('Failed to load staff data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffData();
  }, [fetchStaffData]);

  const exportReport = async (format: 'pdf' | 'excel') => {
    if (!overview) {
      toast.error('No data available to export');
      return;
    }
    
    setExportLoading(true);
    setExportFormat(format);
    setShowExportMenu(false);
    
    try {
      const endpoint = format === 'excel' 
        ? `${PYTHON_SERVICE}/api/reports/generate/excel`
        : `${PYTHON_SERVICE}/api/reports/generate/branded-pdf`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportType: 'staff_overview',
          filters: {
            branch: branchFilter,
            generated_date: new Date().toISOString().split('T')[0]
          },
          useRealData: false,
          data: overview
        })
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const extension = format === 'excel' ? 'xlsx' : 'pdf';
        a.download = `FG_Staff_Overview_${new Date().toISOString().split('T')[0]}.${extension}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        toast.success(`Report exported as ${format.toUpperCase()}`);
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to generate report. Make sure Python service is running.');
    } finally {
      setExportLoading(false);
      setExportFormat(null);
    }
  };

  const filteredStaff = overview?.all_staff.filter(staff => {
    const matchesSearch = searchQuery === '' || 
      staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.role.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBranch = branchFilter === 'all' || staff.branch_id.toString() === branchFilter;
    const matchesDepartment = departmentFilter === 'all' || staff.department === departmentFilter;
    const matchesStatus = statusFilter === 'all' || staff.status === statusFilter;
    
    return matchesSearch && matchesBranch && matchesDepartment && matchesStatus;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <IOSBadge variant="filled" color="success">Active</IOSBadge>;
      case 'on_leave':
        return <IOSBadge variant="filled" color="warning">On Leave</IOSBadge>;
      case 'inactive':
        return <IOSBadge variant="filled" color="secondary">Inactive</IOSBadge>;
      default:
        return <IOSBadge variant="filled" color="secondary">{status}</IOSBadge>;
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-gray-600 bg-gray-100';
    if (score >= 75) return 'text-gray-600 bg-gray-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.CENTRAL_OPERATIONS_MANAGER
    ]}>
      <BranchAwareDashboardLayout
        title={branchFilter === 'all' 
          ? "Staff Overview" 
          : `${selectedBranchName || 'Branch'} Staff Overview`
        }
        subtitle={branchFilter === 'all' 
          ? "Monitor staff performance across all branches" 
          : `Staff performance metrics for ${selectedBranchName || 'selected branch'}`
        }
        requireBranchContext={false}
        hideBranchSelector={true}
        actionButton={
          <div className="flex space-x-2 items-center flex-wrap gap-2">
            {/* Branch Selector */}
            <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-ios-lg px-3 py-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="text-sm bg-transparent border-none focus:outline-none cursor-pointer pr-6"
              >
                <option value="all">All Branches</option>
                {overview?.branch_summaries.map(branch => (
                  <option key={branch.branch_id} value={branch.branch_id.toString()}>
                    {branch.branch_name}
                  </option>
                ))}
              </select>
            </div>
            
            <IOSButton 
              variant="secondary" 
              onClick={() => fetchStaffData()}
              disabled={isLoading}
              leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </IOSButton>
            
            {/* Export Dropdown */}
            <div className="relative">
              <IOSButton 
                variant="primary" 
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={exportLoading || !overview}
                leftIcon={exportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                rightIcon={<ChevronDown className="h-4 w-4" />}
              >
                {exportLoading ? `Exporting ${exportFormat?.toUpperCase()}...` : 'Export'}
              </IOSButton>
              
              {showExportMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowExportMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-ios-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
                    <div className="p-2 border-b border-gray-100 bg-gray-50">
                      <p className="text-xs font-medium text-gray-500 uppercase">Export Report As</p>
                    </div>
                    <button
                      onClick={() => exportReport('pdf')}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors"
                    >
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <FileText className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">PDF Document</p>
                        <p className="text-xs text-gray-500">Professional branded report</p>
                      </div>
                    </button>
                    <button
                      onClick={() => exportReport('excel')}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3 transition-colors border-t border-gray-100"
                    >
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <FileSpreadsheet className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Excel Spreadsheet</p>
                        <p className="text-xs text-gray-500">Editable data with formatting</p>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : overview ? (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Staff</p>
                    <p className="text-lg font-bold text-gray-900">{overview.total_staff}</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <UserCheck className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Active</p>
                    <p className="text-lg font-bold text-gray-900">{overview.active_staff}</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Calendar className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">On Leave</p>
                    <p className="text-lg font-bold text-gray-900">{overview.on_leave}</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Award className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Performance</p>
                    <p className="text-lg font-bold text-gray-900">{overview.avg_performance}%</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Clock className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg Attendance</p>
                    <p className="text-lg font-bold text-gray-900">{overview.avg_attendance}%</p>
                  </div>
                </div>
              </IOSCard>
            </div>

            {/* Branch Staff Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {overview.branch_summaries.map((branch) => (
                <IOSCard key={branch.branch_id} className="p-4 border border-gray-200">
                  <div className="flex items-center space-x-2 mb-3">
                    <Building2 className="h-5 w-5 text-gray-400" />
                    <h3 className="font-semibold">{branch.branch_name}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total Staff</span>
                      <span className="font-medium text-gray-900">{branch.total_staff}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Active</span>
                      <span className="font-medium text-gray-900">{branch.active}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">On Leave</span>
                      <span className="font-medium text-gray-900">{branch.on_leave}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Performance</span>
                      <span className="font-medium text-gray-900">
                        {branch.avg_performance}%
                      </span>
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>

            {/* Top Performers & Needs Attention */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-4">
                  <Award className="h-5 w-5 text-gray-500" />
                  <h3 className="font-semibold">Top Performers</h3>
                </div>
                <div className="space-y-3">
                  {overview.top_performers.map((staff, idx) => (
                    <div key={staff.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center space-x-3">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          idx === 0 ? 'bg-gray-200 text-gray-800' :
                          idx === 1 ? 'bg-gray-100 text-gray-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-medium">{staff.name}</p>
                          <p className="text-xs text-gray-500">{staff.role} • {staff.branch_name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">{staff.performance_score}%</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <Star className="h-3 w-3 text-gray-400 fill-gray-400 mr-1" />
                          {staff.customer_rating}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </IOSCard>

              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-gray-500" />
                  <h3 className="font-semibold">Needs Attention</h3>
                </div>
                <div className="space-y-3">
                  {overview.needs_attention.map((staff) => (
                    <div key={staff.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div>
                        <p className="font-medium">{staff.name}</p>
                        <p className="text-xs text-gray-500">{staff.role} • {staff.branch_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-600">{staff.performance_score}%</p>
                        <p className="text-xs text-gray-500">Attendance: {staff.attendance_rate}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </IOSCard>
            </div>

            {/* Staff List with Filters */}
            <IOSCard className="overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search staff..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-ios-lg text-sm"
                    />
                  </div>
                  <select
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-ios-lg text-sm bg-white"
                  >
                    <option value="all">All Branches</option>
                    {overview.branch_summaries.map(b => (
                      <option key={b.branch_id} value={b.branch_id}>{b.branch_name}</option>
                    ))}
                  </select>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-ios-lg text-sm bg-white"
                  >
                    <option value="all">All Departments</option>
                    {departments.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-ios-lg text-sm bg-white"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Performance</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Attendance</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rating</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredStaff.map((staff) => (
                      <tr key={staff.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{staff.name}</p>
                            <p className="text-xs text-gray-500">{staff.email}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm">{staff.role}</p>
                            <p className="text-xs text-gray-500">{staff.department}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">{staff.branch_name}</td>
                        <td className="px-4 py-3 text-center">{getStatusBadge(staff.status)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPerformanceColor(staff.performance_score)}`}>
                            {staff.performance_score}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPerformanceColor(staff.attendance_rate)}`}>
                            {staff.attendance_rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <Star className="h-4 w-4 text-gray-400 fill-gray-400" />
                            <span className="text-sm">{staff.customer_rating}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <IOSButton 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedStaff(staff);
                              setShowDetailModal(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </IOSButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {filteredStaff.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-gray-200 mb-4" />
                  <p className="text-gray-500">No staff found matching your filters</p>
                </div>
              )}
            </IOSCard>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <Users className="h-16 w-16 text-gray-200 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Staff Data</h3>
            <p className="text-gray-500">Unable to load staff overview</p>
          </div>
        )}

        {/* Staff Detail Modal */}
        {showDetailModal && selectedStaff && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-ios-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold">{selectedStaff.name}</h2>
                    <p className="text-gray-500">{selectedStaff.role} • {selectedStaff.department}</p>
                  </div>
                  <IOSButton variant="ghost" size="sm" onClick={() => setShowDetailModal(false)}>
                    <XCircle className="h-5 w-5" />
                  </IOSButton>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{selectedStaff.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{selectedStaff.phone}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span>{selectedStaff.branch_name}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>Hired: {new Date(selectedStaff.hire_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-500">Status</span>
                      {getStatusBadge(selectedStaff.status)}
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-500">Performance</span>
                      <span className={`font-bold ${selectedStaff.performance_score >= 80 ? 'text-gray-600' : 'text-gray-600'}`}>
                        {selectedStaff.performance_score}%
                      </span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-500">Attendance</span>
                      <span className={`font-bold ${selectedStaff.attendance_rate >= 90 ? 'text-gray-600' : 'text-gray-600'}`}>
                        {selectedStaff.attendance_rate}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-600">{selectedStaff.shifts_completed}</p>
                    <p className="text-xs text-gray-500">Shifts Completed</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-600">{selectedStaff.shifts_missed}</p>
                    <p className="text-xs text-gray-500">Shifts Missed</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-600">{selectedStaff.overtime_hours}</p>
                    <p className="text-xs text-gray-500">Overtime Hours</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-center space-x-1">
                      <Star className="h-5 w-5 text-gray-400 fill-gray-400" />
                      <p className="text-2xl font-bold text-gray-600">{selectedStaff.customer_rating}</p>
                    </div>
                    <p className="text-xs text-gray-500">Customer Rating</p>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <IOSButton variant="secondary" onClick={() => setShowDetailModal(false)}>
                    Close
                  </IOSButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function StaffOverviewPage() {
  return (
    <BranchPageWrapper>
      <StaffOverviewContent />
    </BranchPageWrapper>
  );
}
