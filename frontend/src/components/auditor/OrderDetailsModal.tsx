'use client';

import React from 'react';
import { X } from 'lucide-react';

interface OrderDetailsModalProps {
    order: any;
    isOpen: boolean;
    onClose: () => void;
}

export const OrderDetailsModal = ({ order, isOpen, onClose }: OrderDetailsModalProps) => {
    if (!isOpen || !order) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden border border-stone-100 flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-5 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-stone-900 tracking-tight">Transaction Detail</h3>
                        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">{order.order_number || `#${order.id?.substr(0, 8)}`}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                        <div>
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Guest / Customer</p>
                            <p className="text-[14px] font-bold text-stone-900">{order.guest_name || order.customer_name || 'Walk-in Guest'}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Time / Date</p>
                            <p className="text-[14px] font-bold text-stone-900">{new Date(order.created_at).toLocaleString()}</p>
                        </div>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-3">Items Breakdown</p>
                        <div className="bg-stone-50/50 rounded-xl border border-stone-100 divide-y divide-stone-100 overflow-hidden">
                            {(order.items || []).length > 0 ? (
                                order.items.map((item: any, idx: number) => (
                                    <div key={idx} className="px-4 py-3.5 flex justify-between items-center transition-colors hover:bg-white/80">
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-semibold text-stone-800 truncate">{item.menu_item?.name || item.stock_item?.item_name || item.item_name || 'Unknown Item'}</p>
                                            <p className="text-[10px] font-medium text-stone-400">Quantity: {item.quantity}</p>
                                        </div>
                                        <p className="text-[13px] font-bold text-stone-900">KES {(item.quantity * (item.unit_price || item.price || 0)).toLocaleString()}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="px-4 py-12 text-center text-stone-400 text-[11px] font-medium italic">
                                    No itemized breakdown available
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-6 border-t border-stone-100 flex justify-between items-center">
                        <span className="text-[12px] font-bold text-stone-500 uppercase tracking-widest">Grand Total</span>
                        <span className="text-2xl font-bold text-stone-900">KES {(order.total_amount || order.total || order.amount || 0).toLocaleString()}</span>
                    </div>
                </div>

                <div className="px-6 py-5 bg-stone-50/50 flex justify-end gap-3 border-t border-stone-100">
                    <button onClick={onClose} className="px-6 h-10 rounded-xl bg-white border border-stone-200 text-stone-600 font-bold text-[13px] hover:bg-stone-50 transition-all">Dismiss</button>
                    <button className="px-6 h-10 rounded-xl bg-stone-900 text-white font-bold text-[13px] shadow-lg shadow-stone-200 hover:shadow-xl transition-all active:scale-95">
                        Flag for Review
                    </button>
                </div>
            </div>
        </div>
    );
};
