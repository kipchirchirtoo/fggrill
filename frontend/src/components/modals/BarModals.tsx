'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Search, Plus, Minus, ChevronRight, Trash2, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';

interface BarStockRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

interface RequestItemInput {
    inventory_item_id: string;
    item_name: string;
    requested_quantity: number;
    unit: string;
    current_stock: number;
    min_stock: number;
}

export function BarStockRequestModal({ isOpen, onClose, onSuccess }: BarStockRequestModalProps) {
    const { activeBranchId } = useBranch();
    const [step, setStep] = useState(1);
    const [items, setItems] = useState<any[]>([]);
    const [selectedItems, setSelectedItems] = useState<RequestItemInput[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [priority, setPriority] = useState('normal');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch bar inventory
    useEffect(() => {
        if (isOpen) {
            const fetchItems = async () => {
                setLoading(true);
                try {
                    const res = await api.barInventory.getStock({ branch_id: activeBranchId ?? undefined });
                    if (res.success) {
                        setItems(res.data);
                    }
                } catch (error) {
                    console.error('Failed to load bar inventory', error);
                    toast.error('Failed to load bar inventory');
                } finally {
                    setLoading(false);
                }
            };
            fetchItems();
            setStep(1);
        }
    }, [isOpen, activeBranchId]);

    const handleSubmit = async () => {
        if (selectedItems.length === 0) {
            toast.error('Please select at least one item');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.barStockRequests.create({
                bar_branch_id: activeBranchId ?? 0,
                items: selectedItems,
                priority,
                notes
            });
            toast.success('Stock request created successfully');
            onSuccess?.();
            onClose();
            resetForm();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create request');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setStep(1);
        setSelectedItems([]);
        setPriority('normal');
        setNotes('');
    };

    const addItem = (item: any) => {
        if (selectedItems.find(si => si.inventory_item_id === item.id)) {
            toast.error('Item already added');
            return;
        }

        setSelectedItems([
            ...selectedItems,
            {
                inventory_item_id: item.id,
                item_name: item.name,
                requested_quantity: 1,
                unit: item.unit || 'units',
                current_stock: item.current_bottles || 0,
                min_stock: item.par_level || 0
            }
        ]);
        toast.success(`${item.name} added`);
    };

    const removeItem = (itemId: string) => {
        setSelectedItems(selectedItems.filter(item => item.inventory_item_id !== itemId));
    };

    const updateQuantity = (itemId: string, quantity: number) => {
        setSelectedItems(
            selectedItems.map(item =>
                item.inventory_item_id === itemId ? { ...item, requested_quantity: Math.max(1, quantity) } : item
            )
        );
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]"
            >
                {/* Header */}
                <div className="bg-white px-6 py-5 border-b border-gray-100 shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Bar Stock Request</h2>
                            <div className="flex items-center gap-2 mt-2">
                                {[1, 2].map((s) => (
                                    <div
                                        key={s}
                                        className={`h-1.5 rounded-full transition-all duration-500 ${s <= step ? 'w-12 bg-indigo-600' : 'w-4 bg-gray-100'}`}
                                    />
                                ))}
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2.5 hover:bg-gray-50 rounded-full transition-all">
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-0">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                className="p-6 space-y-6"
                            >
                                <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-2">
                                    <ClipboardCheck className="h-4 w-4" />
                                    Phase 1: Request Details
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Priority Level</label>
                                        <div className="grid grid-cols-1 gap-2">
                                            {['normal', 'high', 'urgent'].map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setPriority(p)}
                                                    className={`px-4 py-3 rounded-2xl text-sm font-bold capitalize transition-all border-2 text-left flex items-center justify-between ${priority === p
                                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-md'
                                                        : 'border-gray-50 bg-gray-50 text-gray-400 hover:border-gray-100'
                                                        }`}
                                                >
                                                    {p}
                                                    <div className={`w-3 h-3 rounded-full ${p === 'normal' ? 'bg-green-500' : p === 'high' ? 'bg-orange-500' : 'bg-red-500'
                                                        }`} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Branch Context</label>
                                        <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-indigo-600">
                                                <AlertTriangle className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400">Current Site</p>
                                                <p className="text-sm font-bold text-gray-900 leading-none mt-1">
                                                    {activeBranchId ? `Branch ID: ${activeBranchId}` : 'Main Branch'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase ml-1">Additional Notes</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={4}
                                        placeholder="Explain why this stock is needed urgently or any special delivery notes..."
                                        className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-3xl outline-none transition-all text-sm resize-none"
                                    />
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ x: 20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: -20, opacity: 0 }}
                                className="flex flex-col min-h-[400px]"
                            >
                                <div className="p-4 border-b border-gray-50 bg-white">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Quick add item by name..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                                        />
                                    </div>
                                    {searchTerm && (
                                        <div className="mt-3 bg-white border border-gray-100 rounded-3xl shadow-xl overflow-hidden max-h-48 overflow-y-auto absolute left-4 right-4 z-10 animate-in fade-in slide-in-from-top-2">
                                            {filteredItems.length > 0 ? filteredItems.map(item => (
                                                <button
                                                    key={item.id}
                                                    onClick={() => { addItem(item); setSearchTerm(''); }}
                                                    className="w-full text-left px-5 py-4 hover:bg-indigo-50 flex justify-between items-center group transition-colors border-b border-gray-50 last:border-none"
                                                >
                                                    <div>
                                                        <p className="font-bold text-gray-900 group-hover:text-indigo-900">{item.name}</p>
                                                        <p className="text-xs text-gray-400">Current Stock: {item.current_bottles || 0}</p>
                                                    </div>
                                                    <Plus className="h-5 w-5 text-gray-300 group-hover:text-indigo-600" />
                                                </button>
                                            )) : (
                                                <div className="p-8 text-center text-gray-400 text-sm">No beverages found matching "{searchTerm}"</div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 p-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Selected Inventory ({selectedItems.length})</h3>
                                    </div>

                                    {selectedItems.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 text-gray-400">
                                            <Search className="h-10 w-10 mb-3 opacity-20" />
                                            <p className="text-sm font-medium">Use the search above to add beverages</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {selectedItems.map((item) => (
                                                <div key={item.inventory_item_id} className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-gray-900 truncate">{item.item_name}</p>
                                                        <div className="flex gap-3 text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-tight">
                                                            <span className="bg-gray-100 px-2 py-0.5 rounded">Stock: {item.current_stock}</span>
                                                            <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">Min: {item.min_stock}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl shrink-0">
                                                        <button
                                                            onClick={() => updateQuantity(item.inventory_item_id, item.requested_quantity - 1)}
                                                            className="p-2 hover:bg-white rounded-lg shadow-sm text-gray-600 transition-all active:scale-95"
                                                        >
                                                            <Minus className="h-4 w-4" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            value={item.requested_quantity}
                                                            onChange={(e) => updateQuantity(item.inventory_item_id, parseInt(e.target.value) || 1)}
                                                            className="w-12 text-center bg-transparent border-none outline-none font-bold text-indigo-900"
                                                            min="1"
                                                        />
                                                        <button
                                                            onClick={() => updateQuantity(item.inventory_item_id, item.requested_quantity + 1)}
                                                            className="p-2 hover:bg-white rounded-lg shadow-sm text-gray-600 transition-all active:scale-95"
                                                        >
                                                            <Plus className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => removeItem(item.inventory_item_id)}
                                                        className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="px-6 py-5 bg-gray-50 shrink-0 border-t border-gray-100">
                    <div className="flex gap-4">
                        {step === 1 ? (
                            <button
                                onClick={onClose}
                                className="px-6 py-4 bg-white border border-gray-200 text-gray-500 rounded-2xl hover:bg-gray-100 font-bold transition-all shadow-sm flex-1"
                            >
                                Cancel Request
                            </button>
                        ) : (
                            <button
                                onClick={() => setStep(1)}
                                className="px-8 py-4 bg-white border border-gray-200 text-gray-600 rounded-2xl hover:bg-gray-100 font-bold transition-all shadow-sm"
                            >
                                Back
                            </button>
                        )}

                        {step === 1 ? (
                            <button
                                onClick={() => setStep(2)}
                                className="flex-[1.5] px-8 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                            >
                                Select Items
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={selectedItems.length === 0 || isSubmitting}
                                className="flex-[1.5] px-8 py-4 bg-[#34C759] text-white rounded-2xl hover:bg-[#2EB150] font-bold shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:bg-gray-400 active:scale-[0.98]"
                            >
                                {isSubmitting ? 'Processing...' : 'Submit Request'}
                                {!isSubmitting && <ClipboardCheck className="h-5 w-5" />}
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
