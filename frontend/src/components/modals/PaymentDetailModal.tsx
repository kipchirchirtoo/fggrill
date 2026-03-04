'use client';

import { useState } from 'react';
import { IOSButton } from '@/components/ui/ios-button';
import { X, CheckCircle, AlertTriangle, User, Calendar, CreditCard, FileText, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { paymentsVerificationAPI } from '@/lib/api';

interface PaymentDetailModalProps {
  payment: any;
  onClose: () => void;
  onVerified?: () => void;
  userRole: string;
}

export function PaymentDetailModal({ payment, onClose, onVerified, userRole }: PaymentDetailModalProps) {
  const [accountantNotes, setAccountantNotes] = useState('');
  const [auditorNotes, setAuditorNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAccountantVerify = async () => {
    setLoading(true);
    try {
      const response = await paymentsVerificationAPI.verifyByAccountant(payment.id, accountantNotes);
      if (response.success) {
        toast.success('Payment verified and sent to auditor');
        onVerified?.();
        onClose();
      } else {
        toast.error(response.message || 'Failed to verify payment');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to verify payment');
    } finally {
      setLoading(false);
    }
  };

  const handleAuditorVerify = async (status: 'approved' | 'flagged') => {
    setLoading(true);
    try {
      const response = await paymentsVerificationAPI.verifyByAuditor(payment.id, status, auditorNotes);
      if (response.success) {
        toast.success(status === 'approved' ? 'Payment approved' : 'Payment flagged for review');
        onVerified?.();
        onClose();
      } else {
        toast.error(response.message || 'Failed to process payment');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  const canAccountantVerify = userRole === 'branch_accountant' && payment.status === 'pending';
  const canAuditorVerify = userRole === 'auditor' && payment.status === 'accountant_verified';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Payment Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Status</div>
              <div className="flex items-center gap-2 mt-1">
                {payment.status === 'pending' && (
                  <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Pending Verification
                  </span>
                )}
                {payment.status === 'accountant_verified' && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Awaiting Auditor
                  </span>
                )}
                {payment.status === 'auditor_verified' && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Approved
                  </span>
                )}
                {payment.status === 'flagged' && (
                  <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Flagged
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Amount</div>
              <div className="text-2xl font-bold text-gray-900">KES {parseFloat(payment.amount).toLocaleString()}</div>
            </div>
          </div>

          {/* Payment Information */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Payment Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500">Payment Method</div>
                <div className="font-medium text-gray-900">{payment.payment_method}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Reference Number</div>
                <div className="font-medium text-gray-900">{payment.reference_number || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Customer Name</div>
                <div className="font-medium text-gray-900">{payment.customer_name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Bill Reference</div>
                <div className="font-medium text-gray-900">{payment.bill_reference || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Audit Trail */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Audit Trail
            </h3>

            {/* Recorded By */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="h-5 w-5 text-gray-400 mt-0.5" />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Recorded by {payment.recorded_by_user?.full_name}</div>
                <div className="text-sm text-gray-500">{new Date(payment.recorded_at).toLocaleString()}</div>
                {payment.recorder_notes && (
                  <div className="text-sm text-gray-600 mt-1 italic">{payment.recorder_notes}</div>
                )}
              </div>
            </div>

            {/* Accountant Verification */}
            {payment.accountant_verified_by && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Verified by {payment.accountant_verified_by_user?.full_name}</div>
                  <div className="text-sm text-gray-500">{new Date(payment.accountant_verified_at).toLocaleString()}</div>
                  {payment.accountant_notes && (
                    <div className="text-sm text-gray-600 mt-1 italic">{payment.accountant_notes}</div>
                  )}
                </div>
              </div>
            )}

            {/* Auditor Verification */}
            {payment.auditor_verified_by && (
              <div className={`flex items-start gap-3 p-3 rounded-lg ${payment.auditor_status === 'approved' ? 'bg-green-50' : 'bg-red-50'}`}>
                {payment.auditor_status === 'approved' ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {payment.auditor_status === 'approved' ? 'Approved' : 'Flagged'} by {payment.auditor_verified_by_user?.full_name}
                  </div>
                  <div className="text-sm text-gray-500">{new Date(payment.auditor_verified_at).toLocaleString()}</div>
                  {payment.auditor_notes && (
                    <div className="text-sm text-gray-600 mt-1 italic">{payment.auditor_notes}</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Verification Actions */}
          {canAccountantVerify && (
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Accountant Verification
              </h3>
              <textarea
                placeholder="Add verification notes (optional)..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={accountantNotes}
                onChange={(e) => setAccountantNotes(e.target.value)}
              />
              <IOSButton
                onClick={handleAccountantVerify}
                disabled={loading}
                className="w-full"
                leftIcon={<CheckCircle />}
              >
                {loading ? 'Verifying...' : 'Verify Payment & Send to Auditor'}
              </IOSButton>
            </div>
          )}

          {canAuditorVerify && (
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Auditor Verification
              </h3>
              <textarea
                placeholder="Add auditor notes (optional)..."
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                value={auditorNotes}
                onChange={(e) => setAuditorNotes(e.target.value)}
              />
              <div className="flex gap-3">
                <IOSButton
                  onClick={() => handleAuditorVerify('approved')}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  leftIcon={<CheckCircle />}
                >
                  {loading ? 'Processing...' : 'Approve'}
                </IOSButton>
                <IOSButton
                  onClick={() => handleAuditorVerify('flagged')}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  leftIcon={<AlertTriangle />}
                >
                  {loading ? 'Processing...' : 'Flag for Review'}
                </IOSButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
