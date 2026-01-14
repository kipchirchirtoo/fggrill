'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Plus, Minus } from 'lucide-react';
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
    const [items, setItems] = useState<any[]>([]);
    const [selectedItems, setSelectedItems] = useState<RequestItemInput[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [priority, setPriority] = useState('normal');
    const [notes, setNotes] = useState('');

    // Fetch bar inventory
    useEffect(() => {
        if (isOpen) {
            const fetchItems = async () => {
                setLoading(true);
                try {
                    const res = await api.barInventory.getStock({ branch_id: activeBranchId });
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
        }
    }, [isOpen, activeBranchId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedItems.length === 0) {
            toast.error('Please select at least one item');
            return;
        }

        try {
            await api.barStockRequests.create({
                bar_branch_id: activeBranchId ?? 0, // Fallback need handling
                items: selectedItems,
                priority,
                notes
            });
            toast.success('Stock request created successfully');
            onSuccess?.();
            onClose();
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : 'Failed to create request');
        }
    };

    const addItem = (item: any) => {
        if (selectedItems.find(si => si.inventory_item_id === item.id)) return;

        setSelectedItems([
            ...selectedItems,
            {
                inventory_item_id: item.id,
                item_name: item.name,
                requested_quantity: 1,
                unit: 'bottles', // Default or from item
                current_stock: item.current_bottles || 0,
                min_stock: item.par_level || 0
            }
        ]);
    };

    const removeItem = (itemId: string) => {
        setSelectedItems(selectedItems.filter(item => item.inventory_item_id !== itemId));
    };

    const updateQuantity = (itemId: string, quantity: number) => {
        setSelectedItems(
            selectedItems.map(item =>
                item.inventory_item_id === itemId ? { ...item, requested_quantity: quantity } : item
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        >
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Request Bar Stock</h2>
                        <p className="text-sm text-gray-500 mt-0.5">Create a requisition for the store</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* Meta Data */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                            <select
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                            >
                                <option value="normal">Normal</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                            <div className="px-3 py-2 bg-gray-50 rounded-ios-lg text-gray-700 border border-gray-200">
                                Current Branch
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Search Items</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search for beverages..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                            />
                        </div>
                        {/* Search Results Dropdown (if searching) */}
                        {searchTerm && (
                            <div className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto bg-gray-50">
                                {filteredItems.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => { addItem(item); setSearchTerm(''); }}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-200 text-sm flex justify-between items-center"
                                    >
                                        <span>{item.name}</span>
                                        <span className="text-xs text-gray-500">Stock: {item.current_bottles}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selected Items List */}
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">Selected Items</label>
                        {selectedItems.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500 text-sm">
                                No items selected. Search to add items.
                            </div>
                        ) : (
                            selectedItems.map((item) => (
                                <div key={item.inventory_item_id} className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
                                    <div className="flex-1">
                                        <p className="font-medium text-gray-900">{item.item_name}</p>
                                        <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                                            <span>Current: {item.current_stock}</span>
                                            <span>Par: {item.min_stock}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => updateQuantity(item.inventory_item_id, Math.max(1, item.requested_quantity - 1))}
                                            className="p-1 hover:bg-gray-100 rounded"
                                        >
                                            <Minus className="h-4 w-4 text-gray-600" />
                                        </button>
                                        <input
                                            type="number"
                                            value={item.requested_quantity}
                                            onChange={(e) => updateQuantity(item.inventory_item_id, parseInt(e.target.value) || 1)}
                                            className="w-16 text-center py-1 border border-gray-300 rounded"
                                            min="1"
                                        />
                                        <button
                                            onClick={() => updateQuantity(item.inventory_item_id, item.requested_quantity + 1)}
                                            className="p-1 hover:bg-gray-100 rounded"
                                        >
                                            <Plus className="h-4 w-4 text-gray-600" />
                                        </button>
                                    </div>
                                    <button onClick={() => removeItem(item.inventory_item_id)} className="p-2 hover:bg-red-50 text-red-600 rounded">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                            rows={3}
                            placeholder="Any specific instructions..."
                        />
                    </div>

                </div>

                <div className="flex justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-ios-lg hover:bg-white transition-colors text-gray-700 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={selectedItems.length === 0}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Submit Request
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
