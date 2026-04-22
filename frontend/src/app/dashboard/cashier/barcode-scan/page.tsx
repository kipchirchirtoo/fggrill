'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
  Barcode, Search, Loader2, ArrowLeft, CreditCard, FileText
} from 'lucide-react';
import Link from 'next/link';

interface BillDetail {
  id: string;
  bill_number: string;
  order_id?: string;
  total_amount: number;
  status: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  created_at: string;
}

export default function BarcodeScanPage() {
  const { user } = useAuth();
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [billDetail, setBillDetail] = useState<BillDetail | null>(null);

  const handleScan = async () => {
    if (!barcodeInput.trim()) {
      toast.error('Please enter a barcode');
      return;
    }

    setIsScanning(true);
    try {
      const res = await storeAPI.scanPOSBarcode(barcodeInput.trim());
      if (res.success && res.data) {
        setBillDetail(res.data);
        toast.success('Bill retrieved successfully');
      } else {
        throw new Error(res.message || 'Barcode not found');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to scan barcode');
      setBillDetail(null);
    } finally {
      setIsScanning(false);
    }
  };

  const handleProcessPayment = () => {
    if (billDetail) {
      toast.success('Redirecting to payment...');
      // Navigate to payment screen with bill details
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CASHIER, UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Scan Barcode</h1>
              <p className="text-stone-500 mt-0.5">Scan bill barcode to retrieve details</p>
            </div>
            <Link href="/dashboard/cashier">
              <button className="btn-secondary">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </button>
            </Link>
          </div>

          {/* Scanner */}
          <div className="card-elevated p-8">
            <div className="flex items-center gap-3 mb-6">
              <Barcode className="h-8 w-8 text-stone-400" />
              <div>
                <h2 className="text-lg font-semibold text-stone-900">Enter Barcode</h2>
                <p className="text-sm text-stone-500">Scan or manually enter the bill barcode</p>
              </div>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                placeholder="Scan or type barcode..."
                className="input-field flex-1 text-lg font-mono"
                autoFocus
              />
              <button
                onClick={handleScan}
                disabled={isScanning || !barcodeInput.trim()}
                className="btn-primary px-8"
              >
                {isScanning ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Scan
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Bill Details */}
          {billDetail && (
            <div className="card-elevated p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-stone-200">
                <div>
                  <h3 className="text-xl font-bold text-stone-900">{billDetail.bill_number}</h3>
                  <p className="text-sm text-stone-500 mt-1">
                    {new Date(billDetail.created_at).toLocaleString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  billDetail.status === 'paid'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {billDetail.status}
                </span>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-stone-700 mb-3">Items</h4>
                <div className="space-y-2">
                  {billDetail.items?.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-stone-900">{item.name}</p>
                        <p className="text-xs text-stone-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="text-sm font-bold text-stone-900">
                        KES {(item.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-semibold text-stone-900">Total Amount</span>
                  <span className="text-2xl font-bold text-stone-900">
                    KES {billDetail.total_amount.toLocaleString()}
                  </span>
                </div>

                {billDetail.status !== 'paid' && (
                  <button
                    onClick={handleProcessPayment}
                    className="btn-primary w-full"
                  >
                    <CreditCard className="h-5 w-5 mr-2" />
                    Process Payment
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
