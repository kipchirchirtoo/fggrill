'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI } from '@/lib/api/staff';
import { ArrowLeft, FileText, Download, Eye, Upload, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function StaffDocumentsPage() {
  const params = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);
  const staffId = params.id as string;

  useEffect(() => {
    fetchDocuments();
  }, [staffId]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await staffAPI.getStaffDocuments(staffId);
      if (response.success && response.data) {
        setDocuments(response.data);
      }
    } catch (error: any) {
      console.error('Error fetching documents:', error);
      toast.error(error.message || 'Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  const getDocumentIcon = (type: string) => {
    return <FileText className="h-5 w-5" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
              Staff / Documents
            </span>
          </div>

          <div className="flex items-center justify-between">
            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Documents</h1>
            <div className="flex gap-2">
              <button onClick={fetchDocuments} disabled={isLoading} className="btn-secondary">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button className="btn-primary">
                <Upload className="h-4 w-4" />
                Upload Document
              </button>
            </div>
          </div>

          <div className="card-elevated p-0 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-stone-300" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-20 px-6">
                <FileText className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-stone-900">No Documents</h3>
                <p className="text-sm text-stone-500 mt-1">No documents have been uploaded for this staff member.</p>
                <button className="btn-primary mt-4">
                  <Upload className="h-4 w-4" />
                  Upload First Document
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="table-header-cell">Document Name</th>
                      <th className="table-header-cell">Type</th>
                      <th className="table-header-cell">Size</th>
                      <th className="table-header-cell">Uploaded</th>
                      <th className="table-header-cell text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {documents.map((doc: any) => (
                      <tr key={doc.id} className="table-row">
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <div className="text-stone-400">
                              {getDocumentIcon(doc.document_type)}
                            </div>
                            <span className="text-[13px] font-medium text-stone-800">
                              {doc.document_name || doc.file_name}
                            </span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className="text-[12px] text-stone-600 capitalize">
                            {doc.document_type?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className="text-[12px] text-stone-600">
                            {formatFileSize(doc.file_size || 0)}
                          </span>
                        </td>
                        <td className="table-cell">
                          <span className="text-[12px] text-stone-600">
                            {new Date(doc.uploaded_at || doc.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="table-cell text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button className="p-1.5 rounded-md hover:bg-stone-100 transition-colors">
                              <Eye className="h-4 w-4 text-stone-500" />
                            </button>
                            <button className="p-1.5 rounded-md hover:bg-stone-100 transition-colors">
                              <Download className="h-4 w-4 text-stone-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
