'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { storeAPI } from '@/lib/api';
import { TrendingDown, RefreshCw, Package, Calendar, User, Clock, FileText, Tag, ChevronRight } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StockMovement {
  id: string;
  item_sku: string;
  quantity: number;
  movement_type: string;
  reason?: string;
  notes?: string;
  performed_by?: string;
  created_at?: string;
  branch_id?: number;
  item?: {
    sku?: string;
    item_name?: string;
    category?: string;
  };
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return 'N/A';
  }
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function BranchStockOutPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<StockMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<StockMovement | null>(null);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getStockMovements();
      if (response.success) {
        const stockOuts = (response.data || []).filter(
          (m: any) => m.movement_type === 'STOCK_OUT' || m.movement_type === 'out'
        );

        // Resolve performed_by UUIDs to names
        const uuids = Array.from(new Set(
          stockOuts.map((m: any) => m.performed_by).filter((v: string) => v && UUID_REGEX.test(v))
        ));
        if (uuids.length > 0) {
          try {
            const staffRes = await storeAPI.getBranchStaffForUsage();
            if (staffRes.success && staffRes.data) {
              const nameMap: Record<string, string> = {};
              (staffRes.data as any[]).forEach((s: any) => {
                nameMap[s.id] = s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email || s.id;
              });
              stockOuts.forEach((m: any) => {
                if (m.performed_by && nameMap[m.performed_by]) {
                  m.performed_by = nameMap[m.performed_by];
                }
              });
            }
          } catch (e) { console.error('Failed to resolve user names:', e); }
        }

        setRecords(stockOuts);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const getItemName = (record: StockMovement) => {
    return record.item?.item_name || record.item_sku || 'Unknown Item';
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Stock Out Records</h1><p className="text-gray-500">Items issued from stock</p></div>
            <IOSButton variant="secondary" onClick={fetchRecords} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : records.length === 0 ? (
            <IOSCard className="p-12 text-center"><TrendingDown className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No stock out records</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <IOSCard
                  key={record.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedRecord(record)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-red-100 flex items-center justify-center">
                        <TrendingDown className="h-6 w-6 text-[#FF3B30]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{getItemName(record)}</p>
                        {record.item?.category && (
                          <p className="text-sm text-gray-500 flex items-center gap-1">
                            <Tag className="h-3 w-3" /> {record.item.category}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                          {record.reason && <span className="bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">{record.reason}</span>}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatDate(record.created_at)}
                          </span>
                          {record.performed_by && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" /> {record.performed_by}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-lg text-[#FF3B30]">-{Math.abs(record.quantity)}</p>
                      <ChevronRight className="h-5 w-5 text-gray-300" />
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        {/* Detail Dialog */}
        <Dialog open={!!selectedRecord} onOpenChange={(open) => { if (!open) setSelectedRecord(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-[#FF3B30]" />
                Stock Out Detail
              </DialogTitle>
            </DialogHeader>
            {selectedRecord && (
              <div className="space-y-4 mt-2 max-h-[70vh] overflow-y-auto pr-1">
                <div className="bg-red-50 rounded-xl p-4 text-center">
                  <p className="text-sm text-gray-500 mb-1">Quantity Issued</p>
                  <p className="text-3xl font-bold text-[#FF3B30]">-{Math.abs(selectedRecord.quantity)}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <Package className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Item</p>
                      <p className="font-semibold text-gray-900">{getItemName(selectedRecord)}</p>
                      {selectedRecord.item_sku && (
                        <p className="text-xs text-gray-400 mt-0.5">SKU: {selectedRecord.item_sku}</p>
                      )}
                    </div>
                  </div>

                  {selectedRecord.item?.category && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <Tag className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Category</p>
                        <p className="font-semibold text-gray-900">{selectedRecord.item.category}</p>
                      </div>
                    </div>
                  )}

                  {selectedRecord.reason && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <FileText className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Reason / Department</p>
                        <p className="font-semibold text-gray-900">{selectedRecord.reason}</p>
                      </div>
                    </div>
                  )}

                  {selectedRecord.notes && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <FileText className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Notes</p>
                        <p className="font-semibold text-gray-900">{selectedRecord.notes}</p>
                      </div>
                    </div>
                  )}

                  {selectedRecord.performed_by && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <User className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Recorded By</p>
                        <p className="font-semibold text-gray-900">{selectedRecord.performed_by}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <Clock className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Date & Time</p>
                      <p className="font-semibold text-gray-900">
                        {formatDate(selectedRecord.created_at)}
                        {formatTime(selectedRecord.created_at) && ` at ${formatTime(selectedRecord.created_at)}`}
                      </p>
                    </div>
                  </div>
                </div>

                <IOSButton variant="secondary" onClick={() => setSelectedRecord(null)} className="w-full">
                  Close
                </IOSButton>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
