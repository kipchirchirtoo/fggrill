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
  Shield, Search, RefreshCw, Download, Building2, 
  CheckCircle2, XCircle, AlertTriangle, Clock, Calendar,
  FileText, ClipboardCheck, Eye, Loader2, AlertCircle,
  ThumbsUp, ThumbsDown, TrendingUp, TrendingDown, Filter,
  ChevronRight, FileWarning, Scale, Award, FileSpreadsheet,
  ChevronDown, X
} from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

interface ComplianceItem {
  id: string;
  category: string;
  requirement: string;
  branch_id: number;
  branch_name: string;
  status: 'compliant' | 'non_compliant' | 'pending' | 'expired';
  due_date: string;
  last_checked: string;
  checked_by: string;
  notes: string;
  priority: 'high' | 'medium' | 'low';
  documents: { name: string; url: string }[];
}

interface BranchComplianceSummary {
  branch_id: number;
  branch_name: string;
  total_requirements: number;
  compliant: number;
  non_compliant: number;
  pending: number;
  expired: number;
  compliance_rate: number;
}

interface ComplianceOverview {
  total_requirements: number;
  compliant: number;
  non_compliant: number;
  pending: number;
  expired: number;
  overall_compliance_rate: number;
  branch_summaries: BranchComplianceSummary[];
  items: ComplianceItem[];
  categories: string[];
  upcoming_deadlines: ComplianceItem[];
  critical_issues: ComplianceItem[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
const PYTHON_SERVICE = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:5001';

function ComplianceContent() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [overview, setOverview] = useState<ComplianceOverview | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState<ComplianceItem | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel' | null>(null);

  // Get selected branch name for header
  const selectedBranchName = branchFilter === 'all' 
    ? null 
    : overview?.branch_summaries.find(b => b.branch_id.toString() === branchFilter)?.branch_name;

  const fetchComplianceData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const response = await fetch(
        `${API_BASE}/api/central-operations/branch-oversight/compliance`,
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
        toast.error('Failed to load compliance data');
      }
    } catch (error) {
      console.error('Error fetching compliance data:', error);
      toast.error('Failed to load compliance data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchComplianceData();
  }, [fetchComplianceData]);

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
          reportType: 'compliance',
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
        a.download = `FG_Compliance_Report_${new Date().toISOString().split('T')[0]}.${extension}`;
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

  const filteredItems = overview?.items.filter(item => {
    const matchesSearch = searchQuery === '' || 
      item.requirement.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBranch = branchFilter === 'all' || item.branch_id.toString() === branchFilter;
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    
    return matchesSearch && matchesBranch && matchesCategory && matchesStatus;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'compliant':
        return <IOSBadge variant="filled" color="success">Compliant</IOSBadge>;
      case 'non_compliant':
        return <IOSBadge variant="filled" color="danger">Non-Compliant</IOSBadge>;
      case 'pending':
        return <IOSBadge variant="filled" color="warning">Pending</IOSBadge>;
      case 'expired':
        return <IOSBadge variant="filled" color="danger">Expired</IOSBadge>;
      default:
        return <IOSBadge variant="filled" color="secondary">{status}</IOSBadge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">High</span>;
      case 'medium':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">Medium</span>;
      case 'low':
        return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">Low</span>;
      default:
        return null;
    }
  };

  const getComplianceColor = (rate: number) => {
    if (rate >= 90) return 'text-gray-600';
    if (rate >= 75) return 'text-gray-600';
    return 'text-gray-600';
  };

  const getComplianceBgColor = (rate: number) => {
    if (rate >= 90) return 'bg-gray-500';
    if (rate >= 75) return 'bg-gray-500';
    return 'bg-gray-500';
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.CENTRAL_OPERATIONS_MANAGER
    ]}>
      <BranchAwareDashboardLayout
        title={branchFilter === 'all' 
          ? "Compliance Management" 
          : `${selectedBranchName || 'Branch'} Compliance`
        }
        subtitle={branchFilter === 'all' 
          ? "Monitor regulatory compliance across all branches" 
          : `Compliance status for ${selectedBranchName || 'selected branch'}`
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
              onClick={() => fetchComplianceData()}
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
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <ClipboardCheck className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Total Requirements</p>
                    <p className="text-lg font-bold text-gray-900">{overview.total_requirements}</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Compliant</p>
                    <p className="text-lg font-bold text-gray-900">{overview.compliant}</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <XCircle className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Non-Compliant</p>
                    <p className="text-lg font-bold text-gray-900">{overview.non_compliant}</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Clock className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Pending</p>
                    <p className="text-lg font-bold text-gray-900">{overview.pending}</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Expired</p>
                    <p className="text-lg font-bold text-gray-900">{overview.expired}</p>
                  </div>
                </div>
              </IOSCard>
              
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Award className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Compliance Rate</p>
                    <p className="text-lg font-bold text-gray-900">
                      {overview.overall_compliance_rate}%
                    </p>
                  </div>
                </div>
              </IOSCard>
            </div>

            {/* Branch Compliance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {overview.branch_summaries.map((branch) => (
                <IOSCard key={branch.branch_id} className="p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5 text-gray-400" />
                      <h3 className="font-semibold">{branch.branch_name}</h3>
                    </div>
                    <span className="text-lg font-bold text-gray-900">
                      {branch.compliance_rate}%
                    </span>
                  </div>
                  
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div 
                      className="h-2 rounded-full bg-gray-600"
                      style={{ width: `${branch.compliance_rate}%` }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <p className="font-bold text-gray-900">{branch.compliant}</p>
                      <p className="text-gray-500">OK</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{branch.non_compliant}</p>
                      <p className="text-gray-500">Fail</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{branch.pending}</p>
                      <p className="text-gray-500">Pending</p>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{branch.expired}</p>
                      <p className="text-gray-500">Expired</p>
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>

            {/* Critical Issues & Upcoming Deadlines */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-4">
                  <AlertTriangle className="h-5 w-5 text-gray-500" />
                  <h3 className="font-semibold">Critical Issues</h3>
                </div>
                {overview.critical_issues.length > 0 ? (
                  <div className="space-y-3">
                    {overview.critical_issues.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 border border-gray-100"
                        onClick={() => { setSelectedItem(item); setShowDetailModal(true); }}
                      >
                        <div>
                          <p className="font-medium">{item.requirement}</p>
                          <p className="text-xs text-gray-500">{item.branch_name} • {item.category}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusBadge(item.status)}
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <CheckCircle2 className="h-12 w-12 mb-2" />
                    <p>No critical issues</p>
                  </div>
                )}
              </IOSCard>

              <IOSCard className="p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-4">
                  <Calendar className="h-5 w-5 text-gray-500" />
                  <h3 className="font-semibold">Upcoming Deadlines</h3>
                </div>
                {overview.upcoming_deadlines.length > 0 ? (
                  <div className="space-y-3">
                    {overview.upcoming_deadlines.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 border border-gray-100"
                        onClick={() => { setSelectedItem(item); setShowDetailModal(true); }}
                      >
                        <div>
                          <p className="font-medium">{item.requirement}</p>
                          <p className="text-xs text-gray-500">{item.branch_name} • Due: {new Date(item.due_date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getPriorityBadge(item.priority)}
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <CheckCircle2 className="h-12 w-12 mb-2" />
                    <p>No upcoming deadlines</p>
                  </div>
                )}
              </IOSCard>
            </div>

            {/* Compliance Items List */}
            <IOSCard className="overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search requirements..."
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
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-ios-lg text-sm bg-white"
                  >
                    <option value="all">All Categories</option>
                    {overview.categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-ios-lg text-sm bg-white"
                  >
                    <option value="all">All Status</option>
                    <option value="compliant">Compliant</option>
                    <option value="non_compliant">Non-Compliant</option>
                    <option value="pending">Pending</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requirement</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Due Date</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium">{item.requirement}</p>
                          <p className="text-xs text-gray-500">{item.notes}</p>
                        </td>
                        <td className="px-4 py-3 text-sm">{item.category}</td>
                        <td className="px-4 py-3 text-sm">{item.branch_name}</td>
                        <td className="px-4 py-3 text-center">{getStatusBadge(item.status)}</td>
                        <td className="px-4 py-3 text-center">{getPriorityBadge(item.priority)}</td>
                        <td className="px-4 py-3 text-center text-sm">
                          {new Date(item.due_date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <IOSButton 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedItem(item);
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
              
              {filteredItems.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12">
                  <ClipboardCheck className="h-12 w-12 text-gray-200 mb-4" />
                  <p className="text-gray-500">No compliance items found</p>
                </div>
              )}
            </IOSCard>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <Shield className="h-16 w-16 text-gray-200 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Compliance Data</h3>
            <p className="text-gray-500">Unable to load compliance information</p>
          </div>
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-ios-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-xl font-bold">{selectedItem.requirement}</h2>
                    <p className="text-gray-500">{selectedItem.category}</p>
                  </div>
                  <IOSButton variant="ghost" size="sm" onClick={() => setShowDetailModal(false)}>
                    <XCircle className="h-5 w-5" />
                  </IOSButton>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="space-y-3">
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-500">Branch</span>
                      <span className="font-medium">{selectedItem.branch_name}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-500">Status</span>
                      {getStatusBadge(selectedItem.status)}
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-500">Priority</span>
                      {getPriorityBadge(selectedItem.priority)}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-500">Due Date</span>
                      <span className="font-medium">{new Date(selectedItem.due_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-500">Last Checked</span>
                      <span className="font-medium">{new Date(selectedItem.last_checked).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-500">Checked By</span>
                      <span className="font-medium">{selectedItem.checked_by}</span>
                    </div>
                  </div>
                </div>

                {selectedItem.notes && (
                  <div className="mb-6">
                    <h4 className="font-semibold mb-2">Notes</h4>
                    <p className="p-3 bg-gray-50 rounded-lg text-gray-700">{selectedItem.notes}</p>
                  </div>
                )}

                {selectedItem.documents.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-semibold mb-2">Documents</h4>
                    <div className="space-y-2">
                      {selectedItem.documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <span>{doc.name}</span>
                          </div>
                          <IOSButton variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </IOSButton>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <IOSButton variant="secondary" onClick={() => setShowDetailModal(false)}>
                    Close
                  </IOSButton>
                  <IOSButton variant="primary" leftIcon={<CheckCircle2 className="h-4 w-4" />}>
                    Mark as Reviewed
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

export default function CompliancePage() {
  return (
    <BranchPageWrapper>
      <ComplianceContent />
    </BranchPageWrapper>
  );
}
