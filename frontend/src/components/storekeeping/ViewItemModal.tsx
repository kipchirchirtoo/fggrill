'use client';

import { useState, useEffect } from 'react';
import {
  Package, X, Tag, DollarSign, Boxes, Calendar,
  User, Truck, AlertTriangle, History, Edit, Trash2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ViewItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: any;
  onEdit?: (item: any) => void;
  onDelete?: (sku: string) => void;
  isManager?: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function ViewItemModal({ isOpen, onClose, item, onEdit, onDelete, isManager = false }: ViewItemModalProps) {
  const [stockHistory, setStockHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  // Fetch stock history when modal opens
  useEffect(() => {
    if (isOpen && item?.sku) {
      fetchStockHistory();
    }
  }, [isOpen, item?.sku]);

  const fetchStockHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/items/${encodeURIComponent(item.sku)}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStockHistory(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch stock history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!item) return null;

  const isLowStock = (item.quantity || 0) <= (item.reorder_level || 10);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <div className="p-0 border-b">
          <DialogHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-ios-lg">
                  <Package className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl">{item.item_name || item.description}</DialogTitle>
                  <p className="text-sm text-gray-500 font-mono">{item.sku}</p>
                </div>
              </div>
              {isLowStock && (
                <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  Low Stock
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-4 px-4 pt-2">
            <button
              onClick={() => setActiveTab('details')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'details'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Item Details
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'history'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Stock History
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Stock Status Card */}
              <div className={`p-4 rounded-xl ${isLowStock ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Current Stock</p>
                    <p className={`text-3xl font-bold ${isLowStock ? 'text-amber-700' : 'text-green-700'}`}>
                      {item.quantity || 0} <span className="text-lg font-normal">{item.unit_of_measure || 'units'}</span>
                    </p>
                  </div>
                  <Boxes className={`h-10 w-10 ${isLowStock ? 'text-amber-400' : 'text-green-400'}`} />
                </div>
                {isLowStock && (
                  <p className="text-sm text-amber-600 mt-2">
                    Reorder level: {item.reorder_level || 10}
                  </p>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-ios-lg">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Tag className="h-4 w-4" />
                    <span className="text-xs uppercase">Category</span>
                  </div>
                  <p className="font-medium">{item.category || 'General'}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-ios-lg">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs uppercase">Retail Price</span>
                  </div>
                  <p className="font-medium text-lg">KSh {(item.retail_price || 0).toLocaleString()}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-ios-lg">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs uppercase">Cost Price</span>
                  </div>
                  <p className="font-medium">KSh {(item.cost_price || 0).toLocaleString()}</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-ios-lg">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Truck className="h-4 w-4" />
                    <span className="text-xs uppercase">Supplier</span>
                  </div>
                  <p className="font-medium">{item.supplier || '-'}</p>
                </div>
              </div>

              {/* Barcode */}
              {item.barcode && (
                <div className="p-4 bg-gray-50 rounded-ios-lg">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <span className="text-xs uppercase">Barcode</span>
                  </div>
                  <p className="font-mono text-lg">{item.barcode}</p>
                </div>
              )}

              {/* Last Updated */}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                Last updated: {item.last_updated ? new Date(item.last_updated).toLocaleString() : 'N/A'}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              {isLoadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Loading history...</p>
                </div>
              ) : stockHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <History className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>No stock history available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stockHistory.slice(0, 20).map((record, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-ios-lg">
                      <div className={`p-2 rounded-full ${record.change_type === 'IN' ? 'bg-green-100 text-green-600' :
                          record.change_type === 'OUT' ? 'bg-red-100 text-red-600' :
                            'bg-blue-100 text-blue-600'
                        }`}>
                        {record.change_type === 'IN' ? '+' : record.change_type === 'OUT' ? '-' : '~'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">
                            {record.change_type === 'IN' ? 'Stock In' :
                              record.change_type === 'OUT' ? 'Stock Out' : 'Adjustment'}
                          </p>
                          <p className={`font-bold ${record.change_type === 'IN' ? 'text-green-600' :
                              record.change_type === 'OUT' ? 'text-red-600' : 'text-blue-600'
                            }`}>
                            {record.change_type === 'IN' ? '+' : ''}{record.quantity_change}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <span>{record.reason || '-'}</span>
                          <span>{new Date(record.created_at).toLocaleDateString()}</span>
                        </div>
                        {record.reference && (
                          <p className="text-xs font-mono text-indigo-600 mt-1">{record.reference}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between p-4 border-t bg-white">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {isManager && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => onDelete?.(item.sku)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => onEdit?.(item)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Item
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
