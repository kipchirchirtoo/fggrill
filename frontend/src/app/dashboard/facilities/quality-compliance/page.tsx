'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { Card } from '@/components/ui/minimal/card';
import { IOSButton } from '@/components/ui/ios-button';
import { facilitiesAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { ShieldCheck, RefreshCw, CheckCircle, XCircle, AlertTriangle, TrendingUp, Star } from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

function QualityComplianceContent() {
  const { activeBranch, activeBranchId } = useBranch();
  const [data, setData] = useState<any>({
    inspectionStats: { total: 0, passed: 0, failed: 0, avgScore: 0 },
    qualityScores: [],
    complianceItems: [],
    recentIssues: []
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeBranchId) fetchData();
  }, [activeBranchId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await facilitiesAPI.getQualityCompliance(activeBranchId);
      if (response.success) {
        setData(response.data || data);
      }
    } catch (error) {
      console.error('Error fetching quality data:', error);
      toast.error('Failed to load quality data');
    } finally {
      setIsLoading(false);
    }
  };

  const passRate = data.inspectionStats.total > 0 
    ? Math.round((data.inspectionStats.passed / data.inspectionStats.total) * 100) 
    : 0;

  return (
    <ProtectedRoute allowedRoles={[UserRole.FACILITIES_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <BranchAwareDashboardLayout
        title="Quality & Compliance"
        subtitle={`Quality metrics for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
        }
      >
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-6 text-center border">
              <div className="flex items-center justify-center mb-2">
                <ShieldCheck className="h-8 w-8 text-gray-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{data.inspectionStats.total}</p>
              <p className="text-sm text-gray-500">Total Inspections</p>
            </Card>
            <Card className="p-6 text-center border">
              <div className="flex items-center justify-center mb-2">
                <CheckCircle className="h-8 w-8 text-gray-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{passRate}%</p>
              <p className="text-sm text-gray-500">Pass Rate</p>
            </Card>
            <Card className="p-6 text-center border">
              <div className="flex items-center justify-center mb-2">
                <Star className="h-8 w-8 text-gray-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{data.inspectionStats.avgScore || 0}%</p>
              <p className="text-sm text-gray-500">Avg. Score</p>
            </Card>
            <Card className="p-6 text-center border">
              <div className="flex items-center justify-center mb-2">
                <AlertTriangle className="h-8 w-8 text-gray-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{data.inspectionStats.failed || 0}</p>
              <p className="text-sm text-gray-500">Failed Inspections</p>
            </Card>
          </div>

          {/* Quality Score Breakdown */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quality Score Breakdown</h3>
            <div className="space-y-4">
              {Array.isArray(data.qualityScores) && data.qualityScores.length > 0 ? (
                data.qualityScores.map((item: any) => (
                  <div key={item.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      <span className="text-sm font-bold text-gray-700">
                        {item.score}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className="h-2.5 rounded-full bg-gray-500"
                        style={{ width: `${item.score}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Target: {item.target}%</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No quality scores available</p>
              )}
            </div>
          </Card>

          {/* Compliance Checklist */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Compliance Checklist</h3>
            <div className="space-y-3">
              {Array.isArray(data.complianceItems) && data.complianceItems.length > 0 ? (
                data.complianceItems.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {item.status === 'compliant' && <CheckCircle className="h-5 w-5 text-gray-600" />}
                      {item.status === 'pending' && <AlertTriangle className="h-5 w-5 text-gray-600" />}
                      {item.status === 'overdue' && <XCircle className="h-5 w-5 text-gray-600" />}
                      <span className="font-medium text-gray-900">{item.item || item.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">Due: {item.dueDate || item.due_date}</span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No compliance items available</p>
              )}
            </div>
          </Card>

          {/* Recent Issues */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Quality Issues</h3>
            <div className="space-y-3">
              {Array.isArray(data.recentIssues) && data.recentIssues.length > 0 ? (
                data.recentIssues.map((item: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Room {item.room || item.room_number}</p>
                      <p className="text-sm text-gray-500">{item.issue || item.description}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-400">{item.date || item.created_at}</span>
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                        {item.severity || item.priority}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No recent issues</p>
              )}
            </div>
          </Card>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function QualityCompliancePage() {
  return (
    <BranchPageWrapper>
      <QualityComplianceContent />
    </BranchPageWrapper>
  );
}
