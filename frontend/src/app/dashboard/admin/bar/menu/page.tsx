'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { barAPI, financeAPI } from '@/lib/api';
import { Beer, RefreshCw, Plus, Search, Edit2, Trash2, DollarSign, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';

interface DrinkItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    category?: { name: string };
    category_id: string;
    is_available: boolean;
    unit?: string;
    branch_id?: number | null;
}

export default function AdminBarMenuPage() {
    const { user } = useAuth();
    const [items, setItems] = useState<DrinkItem[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<DrinkItem | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: 0,
        category_id: '',
        unit: 'shot',
        branch_id: ''
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const promises = [
                barAPI.getDrinks(undefined, undefined, true), // bypass cache
                barAPI.getCategories(undefined, true) // bypass cache
            ];

            if (user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER) {
                promises.push(financeAPI.getBranches());
            }

            const results = await Promise.all(promises);
            if (results[0].success) setItems(results[0].data || []);
            if (results[1].success) setCategories(results[1].data || []);
            if (results[2] && results[2].success) setBranches(results[2].data || []);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredItems = items.filter((i) => {
        const matchesSearch = i.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            i.category?.name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBranch = selectedBranchId === 'all' ||
            (selectedBranchId === 'global' ? !i.branch_id : String(i.branch_id) === selectedBranchId);
        return matchesSearch && matchesBranch;
    });

    const resetForm = () => setFormData({ name: '', description: '', price: 0, category_id: '', unit: 'shot', branch_id: '' });

    const handleAddItem = async () => {
        if (!formData.name || !formData.price || !formData.category_id) {
            toast.error('Fill required fields');
            return;
        }
        setIsSubmitting(true);
        try {
            await barAPI.createDrink(formData);
            toast.success('Drink added to menu');
            setAddModalOpen(false);
            resetForm();
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to add drink');
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (item: DrinkItem) => {
        setSelectedItem(item);
        setFormData({
            name: item.name,
            description: item.description || '',
            price: item.price,
            category_id: item.category_id || '',
            unit: item.unit || 'shot',
            branch_id: item.branch_id ? String(item.branch_id) : ''
        });
        setEditModalOpen(true);
    };

    const handleUpdateItem = async () => {
        if (!selectedItem || !formData.name) {
            toast.error('Fill required fields');
            return;
        }
        setIsSubmitting(true);
        try {
            await barAPI.updateDrink(selectedItem.id, formData);
            toast.success('Drink updated');
            setEditModalOpen(false);
            setSelectedItem(null);
            resetForm();
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update drink');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteItem = async () => {
        if (!selectedItem) return;
        setIsSubmitting(true);
        try {
            await barAPI.deleteDrink(selectedItem.id);
            toast.success('Drink deleted');
            setDeleteConfirmOpen(false);
            setSelectedItem(null);
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete drink');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleAvailability = async (id: string) => {
        try {
            await barAPI.toggleDrinkAvailability(id);
            toast.success('Availability updated');
            fetchData();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update availability');
        }
    };

    const getBranchName = (branchId?: number | null) => {
        if (!branchId) return 'All Branches';
        const branch = branches.find(b => b.id === branchId);
        return branch ? branch.name : 'Unknown Branch';
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Bar Menu Management</h1>
                            <p className="text-gray-500">Manage drinks and beverages</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
                            <IOSButton onClick={() => setAddModalOpen(true)} leftIcon={<Plus />}>Add Drink</IOSButton>
                        </div>
                    </div>

                    <IOSCard className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                                <Input
                                    placeholder="Search drinks or categories..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9"
                                />
                            </div>

                            {branches.length > 0 && (
                                <div className="md:w-64">
                                    <select
                                        value={selectedBranchId}
                                        onChange={(e) => setSelectedBranchId(e.target.value)}
                                        className="w-full p-2 border rounded-ios-lg bg-white h-10 text-sm"
                                    >
                                        <option value="all">All Branches</option>
                                        <option value="global">Global Items</option>
                                        {branches.map((branch) => (
                                            <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    </IOSCard>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <IOSCard className="p-12 text-center">
                            <Beer className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                            <p className="text-gray-500">No drinks found</p>
                        </IOSCard>
                    ) : (
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredItems.map((item) => (
                                <IOSCard key={item.id} className={`p-4 ${!item.is_available ? 'opacity-60' : ''}`}>
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="font-bold">{item.name}</p>
                                            <p className="text-sm text-gray-500">{item.category?.name || 'Uncategorized'}</p>
                                        </div>
                                        <IOSBadge className={item.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                                            {item.is_available ? 'In Stock' : 'Out of Stock'}
                                        </IOSBadge>
                                    </div>

                                    {/* Branch Indicator */}
                                    {branches.length > 0 && (
                                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                                            <MapPin className="h-3 w-3" />
                                            {getBranchName(item.branch_id)}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mt-4">
                                        <p className="font-bold text-lg flex items-center gap-1">
                                            <DollarSign className="h-4 w-4" />
                                            KES {item.price?.toLocaleString()}
                                            <span className="text-xs text-gray-400 font-normal ml-1">/ {item.unit || 'vessel'}</span>
                                        </p>
                                        <div className="flex gap-1">
                                            <IOSButton size="sm" variant="secondary" onClick={() => handleToggleAvailability(item.id)}>
                                                {item.is_available ? 'Disable' : 'Enable'}
                                            </IOSButton>
                                            <IOSButton size="sm" variant="ghost" onClick={() => openEditModal(item)}>
                                                <Edit2 className="h-4 w-4" />
                                            </IOSButton>
                                            <IOSButton size="sm" variant="ghost" className="text-red-500" onClick={() => { setSelectedItem(item); setDeleteConfirmOpen(true); }}>
                                                <Trash2 className="h-4 w-4" />
                                            </IOSButton>
                                        </div>
                                    </div>
                                </IOSCard>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add Modal */}
                <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
                    <DialogContent className="max-w-xl">
                        <DialogHeader><DialogTitle>Add New Drink</DialogTitle></DialogHeader>
                        <DialogBody>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium">Name *</label>
                                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Description</label>
                                    <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium">Price *</label>
                                        <Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Unit (e.g. shot, bottle)</label>
                                        <Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Category *</label>
                                    <select
                                        value={formData.category_id}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                        className="w-full p-2 border rounded-ios-lg bg-white"
                                    >
                                        <option value="">Select category</option>
                                        {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                </div>

                                {branches.length > 0 && (
                                    <div>
                                        <label className="text-sm font-medium">Branch</label>
                                        <select
                                            value={formData.branch_id}
                                            onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                            className="w-full p-2 border rounded-ios-lg bg-white"
                                        >
                                            <option value="">All Branches (Global)</option>
                                            {branches.map((branch) => (
                                                <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">Leave empty to make this item available to all branches.</p>
                                    </div>
                                )}
                            </div>
                        </DialogBody>
                        <DialogFooter>
                            <IOSButton variant="secondary" onClick={() => setAddModalOpen(false)} className="flex-1">Cancel</IOSButton>
                            <IOSButton onClick={handleAddItem} disabled={isSubmitting} className="flex-1">
                                {isSubmitting ? 'Adding...' : 'Add Drink'}
                            </IOSButton>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Modal */}
                <Dialog open={editModalOpen} onOpenChange={(open) => { setEditModalOpen(open); if (!open) setSelectedItem(null); }}>
                    <DialogContent className="max-w-xl">
                        <DialogHeader><DialogTitle>Edit Drink</DialogTitle></DialogHeader>
                        <DialogBody>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium">Name *</label>
                                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Description</label>
                                    <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium">Price *</label>
                                        <Input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium">Unit</label>
                                        <Input value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium">Category</label>
                                    <select
                                        value={formData.category_id}
                                        onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                                        className="w-full p-2 border rounded-ios-lg bg-white"
                                    >
                                        <option value="">Select category</option>
                                        {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                </div>

                                {branches.length > 0 && (
                                    <div>
                                        <label className="text-sm font-medium">Branch</label>
                                        <select
                                            value={formData.branch_id}
                                            onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                            className="w-full p-2 border rounded-ios-lg bg-white"
                                        >
                                            <option value="">All Branches (Global)</option>
                                            {branches.map((branch) => (
                                                <option key={branch.id} value={String(branch.id)}>{branch.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">Move item to a specific branch or make global.</p>
                                    </div>
                                )}
                            </div>
                        </DialogBody>
                        <DialogFooter>
                            <IOSButton variant="secondary" onClick={() => setEditModalOpen(false)} className="flex-1">Cancel</IOSButton>
                            <IOSButton onClick={handleUpdateItem} disabled={isSubmitting} className="flex-1">
                                {isSubmitting ? 'Updating...' : 'Update Drink'}
                            </IOSButton>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation */}
                <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle className="text-red-600">Delete Drink</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                            <p className="text-stone-600">Are you sure you want to delete this drink from the menu?</p>
                            {selectedItem && (
                                <div className="p-3 bg-stone-50 rounded-lg">
                                    <p className="font-medium">{selectedItem.name}</p>
                                    <p className="text-sm text-stone-500">KES {selectedItem.price?.toLocaleString()}</p>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <IOSButton variant="secondary" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>Cancel</IOSButton>
                                <IOSButton variant="destructive" className="flex-1" onClick={handleDeleteItem} disabled={isSubmitting}>
                                    {isSubmitting ? 'Deleting...' : 'Delete'}
                                </IOSButton>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </DashboardLayout >
        </ProtectedRoute >
    );
}
