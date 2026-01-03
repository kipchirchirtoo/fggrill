'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { centralOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import {
    Plus, Search, Filter, RefreshCw,
    Package, Truck, FileText, ChevronRight,
    CheckCircle, XCircle, Clock, Eye
} from 'lucide-react';
import { format } from 'date-fns';

interface POItem {
    id?: string;
    item_sku: string;
    item_name?: string;
    quantity: number;
    unit_price: number;
    unit?: string;
}

interface PurchaseOrder {
    id: string;
    po_number: string;
    supplier_id: number;
    supplier_name?: string;
    status: 'PENDING' | 'APPROVED' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
    total_amount: number;
    notes?: string;
    created_at: string;
    updated_at: string;
    approved_at?: string;
    received_at?: string;
    items: POItem[];
}

export default function PurchaseOrdersPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.CENTRAL_OPERATIONS_MANAGER, UserRole.CENTRAL_STOREKEEPER]}>
            <BranchAwareDashboardLayout>
                <PurchaseOrdersContent />
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}

function PurchaseOrdersContent() {
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [filteredPOs, setFilteredPOs] = useState<PurchaseOrder[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [inventory, setInventory] = useState<any[]>([]);

    // Create PO form state
    const [newPOSupplier, setNewPOSupplier] = useState('');
    const [newPOItems, setNewPOItems] = useState<POItem[]>([{ item_sku: '', quantity: 1, unit_price: 0 }]);
    const [newPONotes, setNewPONotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchPurchaseOrders();
        fetchSuppliers();
        fetchInventory();
    }, []);

    useEffect(() => {
        filterPOs();
    }, [purchaseOrders, searchQuery, selectedStatus]);

    const fetchPurchaseOrders = async () => {
        setIsLoading(true);
        try {
            const response = await centralOperationsAPI.getPurchaseOrders();
            if (response.success) {
                setPurchaseOrders(response.data || []);
            } else {
                toast.error(response.message || 'Failed to fetch purchase orders');
            }
        } catch (error) {
            console.error('Error fetching purchase orders:', error);
            toast.error('Failed to load purchase orders');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSuppliers = async () => {
        try {
            const response = await centralOperationsAPI.getSuppliers();
            if (response.success) {
                setSuppliers(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching suppliers:', error);
        }
    };

    const fetchInventory = async () => {
        try {
            const response = await centralOperationsAPI.getWarehouseInventory();
            if (response.success) {
                setInventory(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
        }
    };

    const filterPOs = () => {
        let filtered = [...purchaseOrders];
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(po =>
                po.po_number.toLowerCase().includes(query) ||
                po.supplier_name?.toLowerCase().includes(query)
            );
        }
        if (selectedStatus !== 'all') {
            filtered = filtered.filter(po => po.status === selectedStatus);
        }
        setFilteredPOs(filtered);
    };

    const handleCreatePO = async () => {
        if (!newPOSupplier) {
            toast.error('Please select a supplier');
            return;
        }
        if (newPOItems.some(item => !item.item_sku || item.quantity <= 0)) {
            toast.error('Please fill in all item fields correctly');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await centralOperationsAPI.createPurchaseOrder({
                supplier_id: parseInt(newPOSupplier),
                items: newPOItems,
                notes: newPONotes
            });
            if (response.success) {
                toast.success('Purchase order created successfully');
                setShowCreateModal(false);
                fetchPurchaseOrders();
                resetForm();
            } else {
                toast.error(response.message || 'Failed to create purchase order');
            }
        } catch (error) {
            console.error('Error creating PO:', error);
            toast.error('Failed to create purchase order');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApprovePO = async (id: string) => {
        try {
            const response = await centralOperationsAPI.approvePurchaseOrder(id);
            if (response.success) {
                toast.success('Purchase order approved');
                setShowDetailsModal(false);
                fetchPurchaseOrders();
            } else {
                toast.error(response.message || 'Failed to approve purchase order');
            }
        } catch (error) {
            console.error('Error approving PO:', error);
            toast.error('Failed to approve purchase order');
        }
    };

    const handleReceivePO = async (id: string) => {
        try {
            const response = await centralOperationsAPI.receivePurchaseOrder(id, {
                received_at: new Date().toISOString()
            });
            if (response.success) {
                toast.success('Purchase order received and stock updated');
                setShowDetailsModal(false);
                fetchPurchaseOrders();
            } else {
                toast.error(response.message || 'Failed to receive purchase order');
            }
        } catch (error) {
            console.error('Error receiving PO:', error);
            toast.error('Failed to receive purchase order');
        }
    };

    const resetForm = () => {
        setNewPOSupplier('');
        setNewPOItems([{ item_sku: '', quantity: 1, unit_price: 0 }]);
        setNewPONotes('');
    };

    const handleAddItem = () => {
        setNewPOItems([...newPOItems, { item_sku: '', quantity: 1, unit_price: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        setNewPOItems(newPOItems.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: keyof POItem, value: any) => {
        const updated = [...newPOItems];
        (updated[index] as any)[field] = value;
        setNewPOItems(updated);
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PENDING': return <IOSBadge color="warning">Pending</IOSBadge>;
            case 'APPROVED': return <IOSBadge color="primary">Approved</IOSBadge>;
            case 'ORDERED': return <IOSBadge color="info">Ordered</IOSBadge>;
            case 'RECEIVED': return <IOSBadge color="success">Received</IOSBadge>;
            case 'CANCELLED': return <IOSBadge color="danger">Cancelled</IOSBadge>;
            default: return <IOSBadge color="secondary">{status}</IOSBadge>;
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
                    <p className="text-gray-500">Manage procurement from external suppliers</p>
                </div>
                <div className="flex space-x-3">
                    <IOSButton
                        variant="secondary"
                        leftIcon={<RefreshCw className="h-4 w-4" />}
                        onClick={fetchPurchaseOrders}
                    >
                        Refresh
                    </IOSButton>
                    <IOSButton
                        variant="primary"
                        leftIcon={<Plus className="h-4 w-4" />}
                        onClick={() => setShowCreateModal(true)}
                    >
                        New Purchase Order
                    </IOSButton>
                </div>
            </div>

            {/* Filters */}
            <IOSCard className="p-4">
                <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by PO # or supplier..."
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-ios-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Filter className="h-4 w-4 text-gray-400" />
                        <select
                            className="border border-gray-200 rounded-ios-lg text-sm p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="PENDING">Pending</option>
                            <option value="APPROVED">Approved</option>
                            <option value="ORDERED">Ordered</option>
                            <option value="RECEIVED">Received</option>
                            <option value="CANCELLED">Cancelled</option>
                        </select>
                    </div>
                </div>
            </IOSCard>

            {/* PO List */}
            <IOSCard className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                <th className="p-4 text-sm font-semibold text-gray-600">PO Number</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Supplier</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Date</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Total</th>
                                <th className="p-4 text-sm font-semibold text-gray-600">Status</th>
                                <th className="p-4 text-sm font-semibold text-gray-600 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center">
                                        <div className="flex justify-center">
                                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredPOs.length > 0 ? (
                                filteredPOs.map((po) => (
                                    <tr key={po.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-sm font-medium text-gray-900">{po.po_number}</td>
                                        <td className="p-4 text-sm text-gray-600">{po.supplier_name}</td>
                                        <td className="p-4 text-sm text-gray-600">{format(new Date(po.created_at), 'MMM d, yyyy')}</td>
                                        <td className="p-4 text-sm font-semibold text-gray-900">
                                            ₦{po.total_amount.toLocaleString()}
                                        </td>
                                        <td className="p-4 text-sm">
                                            {getStatusBadge(po.status)}
                                        </td>
                                        <td className="p-4 text-right">
                                            <IOSButton
                                                variant="ghost"
                                                size="sm"
                                                leftIcon={<Eye className="h-4 w-4" />}
                                                onClick={() => {
                                                    setSelectedPO(po);
                                                    setShowDetailsModal(true);
                                                }}
                                            >
                                                Details
                                            </IOSButton>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        No purchase orders found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </IOSCard>

            {/* Create PO Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <IOSCard className="w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="text-xl font-bold">New Purchase Order</h2>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                                    <select
                                        className="w-full p-2 border border-gray-200 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        value={newPOSupplier}
                                        onChange={(e) => setNewPOSupplier(e.target.value)}
                                    >
                                        <option value="">Select Supplier</option>
                                        {suppliers.map(s => (
                                            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">Items</label>
                                    <IOSButton variant="secondary" size="sm" leftIcon={<Plus className="h-3 w-3" />} onClick={handleAddItem}>
                                        Add Item
                                    </IOSButton>
                                </div>
                                <div className="space-y-3">
                                    {newPOItems.map((item, index) => (
                                        <div key={index} className="flex flex-wrap md:flex-nowrap items-end gap-3 p-3 bg-gray-50 rounded-ios-lg">
                                            <div className="flex-1 min-w-[200px]">
                                                <label className="block text-[10px] uppercase text-gray-500 mb-1">Item</label>
                                                <select
                                                    className="w-full p-2 border border-gray-200 rounded-ios-lg bg-white"
                                                    value={item.item_sku}
                                                    onChange={(e) => handleItemChange(index, 'item_sku', e.target.value)}
                                                >
                                                    <option value="">Select Item</option>
                                                    {inventory.map(inv => (
                                                        <option key={inv.item_sku} value={inv.item_sku}>{inv.item_name} ({inv.item_sku})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-24">
                                                <label className="block text-[10px] uppercase text-gray-500 mb-1">Qty</label>
                                                <input
                                                    type="number"
                                                    className="w-full p-2 border border-gray-200 rounded-ios-lg bg-white"
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                                                    min="1"
                                                />
                                            </div>
                                            <div className="w-32">
                                                <label className="block text-[10px] uppercase text-gray-500 mb-1">Unit Price</label>
                                                <input
                                                    type="number"
                                                    className="w-full p-2 border border-gray-200 rounded-ios-lg bg-white"
                                                    value={item.unit_price}
                                                    onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                                                    min="0"
                                                />
                                            </div>
                                            <button
                                                onClick={() => handleRemoveItem(index)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                                                disabled={newPOItems.length === 1}
                                            >
                                                <XCircle className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                                <textarea
                                    className="w-full p-2 border border-gray-200 rounded-ios-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    value={newPONotes}
                                    onChange={(e) => setNewPONotes(e.target.value)}
                                    placeholder="Additional instructions or notes..."
                                />
                            </div>
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
                            <IOSButton variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</IOSButton>
                            <IOSButton variant="primary" onClick={handleCreatePO} disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : 'Create Purchase Order'}
                            </IOSButton>
                        </div>
                    </IOSCard>
                </div>
            )}

            {/* PO Details Modal */}
            {showDetailsModal && selectedPO && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                    <IOSCard className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold">{selectedPO.po_number}</h2>
                                <div className="mt-1">{getStatusBadge(selectedPO.status)}</div>
                            </div>
                            <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-600">
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500">Supplier</p>
                                    <p className="font-semibold text-gray-900">{selectedPO.supplier_name}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500">Created Date</p>
                                    <p className="font-semibold text-gray-900">{format(new Date(selectedPO.created_at), 'MMM d, yyyy')}</p>
                                </div>
                                {selectedPO.approved_at && (
                                    <div>
                                        <p className="text-gray-500">Approved Date</p>
                                        <p className="font-semibold text-gray-900">{format(new Date(selectedPO.approved_at), 'MMM d, yyyy')}</p>
                                    </div>
                                )}
                                {selectedPO.received_at && (
                                    <div>
                                        <p className="text-gray-500">Received Date</p>
                                        <p className="font-semibold text-gray-900">{format(new Date(selectedPO.received_at), 'MMM d, yyyy')}</p>
                                    </div>
                                )}
                            </div>

                            <div>
                                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Order Items</h3>
                                <div className="border rounded-ios-lg overflow-hidden">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="p-3 font-semibold text-gray-600">Item</th>
                                                <th className="p-3 font-semibold text-gray-600 text-center">Qty</th>
                                                <th className="p-3 font-semibold text-gray-600 text-right">Price</th>
                                                <th className="p-3 font-semibold text-gray-600 text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {selectedPO.items.map((item, index) => (
                                                <tr key={index}>
                                                    <td className="p-3">
                                                        <p className="font-medium text-gray-900">{item.item_name}</p>
                                                        <p className="text-xs text-gray-500">{item.item_sku}</p>
                                                    </td>
                                                    <td className="p-3 text-center">{item.quantity} {item.unit}</td>
                                                    <td className="p-3 text-right">₦{item.unit_price.toLocaleString()}</td>
                                                    <td className="p-3 text-right font-semibold">₦{(item.quantity * item.unit_price).toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 font-bold">
                                            <tr>
                                                <td colSpan={3} className="p-3 text-right">Grand Total:</td>
                                                <td className="p-3 text-right text-blue-600 text-lg">₦{selectedPO.total_amount.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {selectedPO.notes && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700 mb-1 uppercase tracking-wider">Notes</h3>
                                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-ios-lg italic">"{selectedPO.notes}"</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
                            <IOSButton variant="secondary" onClick={() => setShowDetailsModal(false)}>Close</IOSButton>
                            {selectedPO.status === 'PENDING' && (
                                <IOSButton
                                    variant="primary"
                                    leftIcon={<CheckCircle className="h-4 w-4" />}
                                    onClick={() => handleApprovePO(selectedPO.id)}
                                >
                                    Approve Order
                                </IOSButton>
                            )}
                            {selectedPO.status === 'APPROVED' && (
                                <IOSButton
                                    variant="primary"
                                    leftIcon={<Package className="h-4 w-4" />}
                                    onClick={() => handleReceivePO(selectedPO.id)}
                                >
                                    Confirm Receipt
                                </IOSButton>
                            )}
                        </div>
                    </IOSCard>
                </div>
            )}
        </div>
    );
}
