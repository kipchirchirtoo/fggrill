'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
  Truck, Package, Upload, CheckCircle2, AlertTriangle, ArrowLeft, Loader2, FileText, Camera
} from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Dispatch {
  id: string;
  dispatch_number: string;
  from_branch_name: string;
  status: string;
  items: Array<{
    id: string;
    item_name: string;
    quantity: number;
    unit: string;
  }>;
  driver_name?: string;
  vehicle_registration?: string;
  branch_otp?: string;
  created_at: string;
}

export default function ReceiveDeliveryPage() {
  const { user } = useAuth();
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [selectedDispatch, setSelectedDispatch] = useState<Dispatch | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [otpInput, setOtpInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [verifiedDispatchId, setVerifiedDispatchId] = useState<string | null>(null);

  useEffect(() => {
    fetchDispatches();
  }, []);

  const fetchDispatches = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getDispatchesWithOTP({
        status: 'in_transit',
        to_branch_id: user?.branch_id?.toString(),
      });
      if (res.success) {
        setDispatches(res.data || []);
      }
    } catch (error) {
      console.error('Failed to load dispatches:', error);
      toast.error('Failed to load pending deliveries');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDispatch = (dispatch: Dispatch) => {
    setSelectedDispatch(dispatch);
    setShowOTPModal(true);
    setOtpInput('');
  };

  const handleVerifyOTP = async () => {
    if (!selectedDispatch || !otpInput.trim()) {
      toast.error('Please enter the Branch OTP');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await storeAPI.verifyBranchOTP(selectedDispatch.id, otpInput.trim());
      if (res.success) {
        toast.success('OTP verified successfully');
        setVerifiedDispatchId(selectedDispatch.id);
        setShowOTPModal(false);
        setShowUploadModal(true);
      } else {
        throw new Error(res.message || 'Invalid OTP');
      }
    } catch (error: any) {
      toast.error(error.message || 'OTP verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
        toast.error('Only JPEG, PNG, and PDF files are allowed');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedFile || !verifiedDispatchId) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsUploading(true);
    try {
      const res = await storeAPI.uploadDispatchDocument(verifiedDispatchId, selectedFile, 'stock_sheet');
      if (res.success) {
        toast.success('Document uploaded successfully');
        setShowUploadModal(false);
        setSelectedFile(null);
        setVerifiedDispatchId(null);
        fetchDispatches();
      } else {
        throw new Error(res.message || 'Upload failed');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Receive Delivery</h1>
              <p className="text-stone-500 mt-0.5">Verify OTP and upload signed stock sheet</p>
            </div>
            <Link href="/dashboard/branch-store">
              <button className="btn-secondary">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
            </Link>
          </div>

          {/* Pending Deliveries */}
          {isLoading ? (
            <div className="card-elevated p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-stone-400" />
              <p className="text-stone-500">Loading pending deliveries...</p>
            </div>
          ) : dispatches.length === 0 ? (
            <div className="card-elevated p-12 text-center">
              <Truck className="h-12 w-12 mx-auto mb-3 text-stone-300" />
              <h3 className="text-lg font-medium text-stone-400 mb-2">No Pending Deliveries</h3>
              <p className="text-stone-500">All deliveries have been received</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dispatches.map((dispatch) => (
                <div key={dispatch.id} className="card-elevated p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-stone-900">{dispatch.dispatch_number}</h3>
                      <p className="text-sm text-stone-500">From {dispatch.from_branch_name}</p>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full uppercase">
                      In Transit
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {dispatch.driver_name && (
                      <div className="flex items-center gap-2 text-sm text-stone-600">
                        <Package className="h-4 w-4 text-stone-400" />
                        <span>Driver: {dispatch.driver_name}</span>
                      </div>
                    )}
                    {dispatch.vehicle_registration && (
                      <div className="flex items-center gap-2 text-sm text-stone-600">
                        <Truck className="h-4 w-4 text-stone-400" />
                        <span>Vehicle: {dispatch.vehicle_registration}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-stone-100 pt-4 mb-4">
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Items ({dispatch.items?.length || 0})</p>
                    <div className="grid grid-cols-2 gap-2">
                      {dispatch.items?.slice(0, 4).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-stone-50 rounded-lg">
                          <span className="text-sm text-stone-700 truncate">{item.item_name}</span>
                          <span className="text-xs font-bold text-stone-500 ml-2">{item.quantity} {item.unit}</span>
                        </div>
                      ))}
                      {(dispatch.items?.length || 0) > 4 && (
                        <div className="p-2 text-xs text-stone-400 italic">
                          + {(dispatch.items?.length || 0) - 4} more items
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectDispatch(dispatch)}
                    className="btn-primary w-full"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Receive Delivery
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OTP Verification Modal */}
        <Dialog open={showOTPModal} onOpenChange={setShowOTPModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enter Branch OTP</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-stone-600 mb-4">
                Enter the Branch OTP (B-XXXX) provided by the central store to verify this delivery.
              </p>
              <input
                type="text"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.toUpperCase())}
                placeholder="B-XXXX"
                className="input-field text-center text-lg font-mono tracking-wider"
                maxLength={6}
                autoFocus
              />
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => setShowOTPModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyOTP}
                  disabled={isVerifying || !otpInput.trim()}
                  className="btn-primary flex-1"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Verify OTP
                    </>
                  )}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Document Upload Modal */}
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Signed Stock Sheet</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-stone-600 mb-4">
                Upload a photo or PDF of the signed stock sheet to complete the delivery.
              </p>

              <div className="border-2 border-dashed border-stone-300 rounded-lg p-8 text-center mb-4">
                {selectedFile ? (
                  <div>
                    <FileText className="h-12 w-12 mx-auto mb-2 text-green-600" />
                    <p className="text-sm font-medium text-stone-900">{selectedFile.name}</p>
                    <p className="text-xs text-stone-500 mt-1">
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <Camera className="h-12 w-12 mx-auto mb-2 text-stone-300" />
                    <p className="text-sm text-stone-500">No file selected</p>
                  </div>
                )}
              </div>

              <input
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="btn-secondary w-full mb-4 cursor-pointer text-center">
                <Upload className="h-4 w-4 mr-2 inline" />
                Choose File
              </label>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadDocument}
                  disabled={isUploading || !selectedFile}
                  className="btn-primary flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
