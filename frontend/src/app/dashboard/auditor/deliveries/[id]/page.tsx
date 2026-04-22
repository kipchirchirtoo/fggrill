'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft, Package, FileText, CheckCircle2, AlertTriangle, Loader2, MapPin, Calendar, User, Truck, Image as ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DeliveryDetail {
  id: string;
  dispatch_number: string;
  from_branch_name: string;
  to_branch_name: string;
  status: string;
  driver_name?: string;
  vehicle_registration?: string;
  items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    unit: string;
  }>;
  documents: Array<{
    id: string;
    document_url: string;
    document_type: string;
    uploaded_at: string;
    uploaded_by: string;
  }>;
  audit_log: Array<{
    id: string;
    action: string;
    performed_by: string;
    notes?: string;
    created_at: string;
  }>;
  created_at: string;
  completed_at?: string;
}

export default function AuditorDeliveryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const dispatchId = params.id as string;

  const [delivery, setDelivery] = useState<DeliveryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');

  useEffect(() => {
    fetchDeliveryDetail();
  }, [dispatchId]);

  const fetchDeliveryDetail = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getAuditorDeliveryDetail(dispatchId);
      if (res.success) {
        setDelivery(res.data);
      } else {
        throw new Error(res.message || 'Failed to load delivery');
      }
    } catch (error: any) {
      console.error('Failed to load delivery:', error);
      toast.error(error.message || 'Failed to load delivery details');
      router.push('/dashboard/auditor/deliveries');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReview = async (status: 'approved' | 'flagged') => {
    if (status === 'flagged' && !reviewNotes.trim()) {
      toast.error('Please provide notes for flagging this delivery');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await storeAPI.reviewDelivery(dispatchId, {
        status,
        notes: reviewNotes.trim() || undefined,
      });
      if (res.success) {
        toast.success(`Delivery ${status === 'approved' ? 'approved' : 'flagged'} successfully`);
        router.push('/dashboard/auditor/deliveries');
      } else {
        throw new Error(res.message || 'Review failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const viewDocument = (url: string) => {
    if (url.match(/\.(jpg|jpeg|png|gif)$/i)) {
      setSelectedImage(url);
      setShowImageModal(true);
    } else {
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
        <DashboardLayout>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-stone-400" />
              <p className="text-stone-500">Loading delivery details...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  if (!delivery) {
    return null;
  }

  return (
    <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <Link href="/dashboard/auditor/deliveries">
                <button className="btn-secondary mb-3">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Deliveries
                </button>
              </Link>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">
                {delivery.dispatch_number}
              </h1>
              <p className="text-stone-500 mt-0.5">Review delivery details and approve or flag</p>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="card-elevated p-6">
            <h2 className="text-lg font-semibold mb-4">Delivery Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-stone-400" />
                <div>
                  <p className="text-xs text-stone-500">Route</p>
                  <p className="text-sm font-medium text-stone-900">
                    {delivery.from_branch_name} → {delivery.to_branch_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-stone-400" />
                <div>
                  <p className="text-xs text-stone-500">Completed</p>
                  <p className="text-sm font-medium text-stone-900">
                    {new Date(delivery.completed_at || delivery.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {delivery.driver_name && (
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-stone-400" />
                  <div>
                    <p className="text-xs text-stone-500">Driver</p>
                    <p className="text-sm font-medium text-stone-900">{delivery.driver_name}</p>
                  </div>
                </div>
              )}
              {delivery.vehicle_registration && (
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-stone-400" />
                  <div>
                    <p className="text-xs text-stone-500">Vehicle</p>
                    <p className="text-sm font-medium text-stone-900">{delivery.vehicle_registration}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="card-elevated p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items ({delivery.items?.length || 0})
            </h2>
            <div className="space-y-2">
              {delivery.items?.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                  <span className="text-sm font-medium text-stone-900">{item.item_name}</span>
                  <span className="text-sm text-stone-600">
                    {item.quantity} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div className="card-elevated p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Uploaded Documents ({delivery.documents?.length || 0})
            </h2>
            {delivery.documents?.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {delivery.documents.map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => viewDocument(doc.document_url)}
                    className="flex items-center gap-3 p-4 bg-stone-50 hover:bg-stone-100 rounded-lg transition-colors text-left"
                  >
                    <ImageIcon className="h-8 w-8 text-stone-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">
                        {doc.document_type.replace('_', ' ')}
                      </p>
                      <p className="text-xs text-stone-500">
                        {new Date(doc.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-500 text-center py-8">No documents uploaded</p>
            )}
          </div>

          {/* Audit Log */}
          {delivery.audit_log && delivery.audit_log.length > 0 && (
            <div className="card-elevated p-6">
              <h2 className="text-lg font-semibold mb-4">Audit Trail</h2>
              <div className="space-y-3">
                {delivery.audit_log.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-stone-400 mt-2" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-stone-900">{log.action}</p>
                      <p className="text-xs text-stone-500 mt-1">
                        {log.performed_by} • {new Date(log.created_at).toLocaleString()}
                      </p>
                      {log.notes && (
                        <p className="text-xs text-stone-600 mt-2 italic">{log.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Section */}
          {delivery.status !== 'approved' && delivery.status !== 'flagged' && (
            <div className="card-elevated p-6">
              <h2 className="text-lg font-semibold mb-4">Review Delivery</h2>
              <div className="space-y-4">
                <div>
                  <label className="label">Review Notes (Optional for approval, required for flagging)</label>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add any notes about this delivery..."
                    className="input-field min-h-[100px]"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleReview('approved')}
                    disabled={isSubmitting}
                    className="btn-primary flex-1"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Approve Delivery
                  </button>
                  <button
                    onClick={() => handleReview('flagged')}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-2" />
                    )}
                    Flag Discrepancy
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Image Modal */}
        <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Document Preview</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <img src={selectedImage} alt="Document" className="w-full h-auto rounded-lg" />
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
