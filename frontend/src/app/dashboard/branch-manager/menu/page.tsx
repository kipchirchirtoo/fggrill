'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { restaurantAPI, systemAPI } from '@/lib/api';
import {
  Soup, Plus, RefreshCw, Search, Edit2, Trash2, Eye, EyeOff,
  DollarSign, Tag, Image as ImageIcon, ToggleLeft, ToggleRight, Upload, X, Camera
} from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  category_id: string;
  category_name?: string;
  image_url?: string;
  is_available: boolean;
  preparation_time?: number;
  branch_id?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  items_count?: number;
}

interface Branch {
  id: string;
  name: string;
}

export default function BranchManagerMenuPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>(user?.branch_id?.toString() || 'all');

  // Modal states
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category_id: '',
    preparation_time: 15,
    branch_id: '',
  });
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
  });

  // Image upload states
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const currentBranchId = activeBranchId || user?.branch_id;
    try {
      const [itemsRes, categoriesRes, branchesRes] = await Promise.all([
        restaurantAPI.getMenuItems(undefined, currentBranchId as number),
        restaurantAPI.getCategories(),
        systemAPI.getBranches(),
      ]);

      console.log('API Response Debug:', {
        itemsRes,
        currentBranchId,
        itemsData: itemsRes.data
      });

      if (itemsRes.success) setItems(itemsRes.data || []);
      if (categoriesRes.success) setCategories(categoriesRes.data || []);
      if (branchesRes.success) setBranches(branchesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId, user?.branch_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
    const matchesBranch = branchFilter === 'all' || !item.branch_id || item.branch_id?.toString() === branchFilter;
    return matchesSearch && matchesCategory && matchesBranch;
  });

  // Debug logging
  console.log('Debug Menu Items:', {
    totalItems: items.length,
    filteredItems: filteredItems.length,
    items: items,
    branchFilter,
    currentBranchId: activeBranchId || user?.branch_id
  });

  // Image handling
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await restaurantAPI.toggleItemAvailability(item.id);
      toast.success(`${item.name} is now ${item.is_available ? 'unavailable' : 'available'}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update item');
    }
  };

  const handleSaveItem = async () => {
    if (!formData.name || !formData.price || !formData.category_id) {
      toast.error('Please fill required fields');
      return;
    }

    try {
      let itemId = selectedItem?.id;

      if (selectedItem) {
        await restaurantAPI.updateMenuItem(selectedItem.id, {
          ...formData,
          categoryId: formData.category_id,
          preparationTime: formData.preparation_time,
          branchId: formData.branch_id || null,
        });
        toast.success('Item updated');
      } else {
        const result = await restaurantAPI.createMenuItem({
          ...formData,
          categoryId: formData.category_id,
          preparationTime: formData.preparation_time,
          branchId: formData.branch_id || null,
        });
        itemId = result.data?.id;
        toast.success('Item created');
      }

      // Upload image if selected
      if (imageFile && itemId) {
        setIsUploadingImage(true);
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result as string;
            await restaurantAPI.uploadMenuItemImage(itemId!, base64, imageFile.type, imageFile.name);
            toast.success('Image uploaded');
            fetchData();
          };
          reader.readAsDataURL(imageFile);
        } catch (imgError: any) {
          toast.error('Failed to upload image');
        } finally {
          setIsUploadingImage(false);
        }
      }

      setItemModalOpen(false);
      clearImage();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save item');
    }
  };

  const handleDeleteItem = async (item: MenuItem) => {
    if (!confirm(`Delete ${item.name}?`)) return;
    try {
      await restaurantAPI.deleteMenuItem(item.id);
      toast.success('Item deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete item');
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryFormData.name) {
      toast.error('Category name is required');
      return;
    }

    try {
      if (selectedCategory) {
        await restaurantAPI.updateCategory(selectedCategory.id, categoryFormData);
        toast.success('Category updated');
      } else {
        await restaurantAPI.createCategory(categoryFormData);
        toast.success('Category created');
      }
      setCategoryModalOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!confirm(`Delete ${category.name}?`)) return;
    try {
      await restaurantAPI.deleteCategory(category.id);
      toast.success('Category deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const openEditModal = (item: MenuItem) => {
    setSelectedItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category_id: item.category_id,
      preparation_time: item.preparation_time || 15,
      branch_id: item.branch_id || '',
    });
    setImagePreview(item.image_url || null);
    setImageFile(null);
    setItemModalOpen(true);
  };

  const openNewModal = () => {
    setSelectedItem(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      category_id: '',
      preparation_time: 15,
      branch_id: user?.branch_id?.toString() || ''
    });
    clearImage();
    setItemModalOpen(true);
  };

  const openCategoryModal = (category?: Category) => {
    setSelectedCategory(category || null);
    setCategoryFormData({
      name: category?.name || '',
      description: category?.description || '',
    });
    setCategoryModalOpen(true);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
              <p className="text-gray-500">Manage restaurant menu items and categories</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw />}>
                Refresh
              </IOSButton>
              <IOSButton variant="secondary" onClick={() => openCategoryModal()} leftIcon={<Tag />}>
                Add Category
              </IOSButton>
              <IOSButton onClick={openNewModal} leftIcon={<Plus />}>
                Add Item
              </IOSButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Total Items</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Categories</p>
              <p className="text-2xl font-bold">{categories.length}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Available</p>
              <p className="text-2xl font-bold text-[#34C759]">{items.filter(i => i.is_available).length}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Unavailable</p>
              <p className="text-2xl font-bold text-[#FF3B30]">{items.filter(i => !i.is_available).length}</p>
            </IOSCard>
          </div>

          {/* Categories Management */}
          <IOSCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Categories</h2>
              <IOSButton size="sm" onClick={() => openCategoryModal()} leftIcon={<Plus />}>
                Add Category
              </IOSButton>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {categories.map((category) => (
                <div key={category.id} className="p-3 border rounded-ios-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-gray-500">{category.items_count || 0} items</p>
                  </div>
                  <div className="flex gap-1">
                    <IOSButton size="sm" variant="ghost" onClick={() => openCategoryModal(category)}>
                      <Edit2 className="h-3 w-3" />
                    </IOSButton>
                    <IOSButton size="sm" variant="destructive" onClick={() => handleDeleteCategory(category)}>
                      <Trash2 className="h-3 w-3" />
                    </IOSButton>
                  </div>
                </div>
              ))}
            </div>
          </IOSCard>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded-ios-lg"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              {user?.role === UserRole.SUPER_ADMIN && (
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="px-3 py-2 border rounded-ios-lg"
                >
                  <option value="all">All Branches</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                  ))}
                </select>
              )}
            </div>
          </IOSCard>

          {/* Menu Items */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Soup className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No menu items found</p>
              <IOSButton onClick={openNewModal} className="mt-4" leftIcon={<Plus />}>
                Add First Item
              </IOSButton>
            </IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`bg-[#fefefe] rounded-[1rem] p-2 text-[#141417] shadow-md hover:shadow-lg transition-all duration-200 ${!item.is_available ? 'opacity-60' : ''}`}
                >
                  {/* Card Hero Section */}
                  <div className="bg-[#fef4e2] rounded-t-[0.5rem] p-4 text-sm">
                    {/* Header with category and availability */}
                    <div className="flex justify-between items-center gap-4 font-bold">
                      <span className="text-xs uppercase tracking-wide text-amber-700">
                        {item.category_name || 'Menu Item'}
                      </span>
                      {item.is_available ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Available
                        </span>
                      ) : (
                        <IOSBadge variant="light" color="danger">Unavailable</IOSBadge>
                      )}
                    </div>

                    {/* Item Name - Main Title */}
                    <h3 className="my-4 text-xl font-semibold pr-4 leading-tight line-clamp-2">
                      {item.name}
                    </h3>

                    {/* Image */}
                    <div className="relative h-32 w-full overflow-hidden rounded-lg bg-white/50">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Soup className="h-12 w-12 text-amber-600/60" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-3">
                    {/* Price Row */}
                    <div className="flex justify-between items-center mb-3 font-bold text-sm">
                      <span className="text-lg font-bold text-[#141417]">
                        KES {item.price?.toLocaleString()}
                      </span>
                      {item.preparation_time && (
                        <span className="text-xs text-gray-500">{item.preparation_time} min</span>
                      )}
                    </div>

                    {item.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <button
                        className={`font-normal border-none cursor-pointer text-center py-2 px-4 rounded-[1rem] text-sm transition-colors ${item.is_available
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-[#141417] text-white hover:bg-[#2a2a2f]'
                          }`}
                        onClick={() => handleToggleAvailability(item)}
                      >
                        {item.is_available ? (
                          <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> Hide</span>
                        ) : (
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Show</span>
                        )}
                      </button>
                      <div className="flex gap-2">
                        <button
                          className="p-2 bg-gray-100 text-gray-700 rounded-[0.75rem] hover:bg-gray-200 transition-colors"
                          onClick={() => openEditModal(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 bg-red-50 text-red-600 rounded-[0.75rem] hover:bg-red-100 transition-colors"
                          onClick={() => handleDeleteItem(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Item Modal */}
        <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-sf-pro-display">
                <Soup className="h-5 w-5 text-amber-600" />
                {selectedItem ? 'Edit Culinary Masterpiece' : 'Design New Menu Item'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-8 py-4 px-1">
              {/* Media Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Item Presentation</h4>
                <div className="border border-stone-200 rounded-3xl p-6 bg-stone-50/50">
                  {imagePreview ? (
                    <div className="relative group">
                      <div className="relative h-64 w-full rounded-2xl overflow-hidden shadow-inner bg-white">
                        <Image
                          src={imagePreview}
                          alt="Preview"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={clearImage}
                        className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur-md text-red-600 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-stone-300 rounded-2xl cursor-pointer hover:bg-white hover:border-stone-400 transition-all"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="w-16 h-16 rounded-full bg-stone-200/50 flex items-center justify-center mb-4">
                        <Camera className="h-8 w-8 text-stone-400" />
                      </div>
                      <p className="text-sm font-semibold text-stone-600">Upload High-Qualty Image</p>
                      <p className="text-xs text-stone-400 mt-1">Recommended: 1200x800px (Max 5MB)</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Specifications Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Core Specifications</h4>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Dish Name *</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Herb-Crusted Grilled Salmon"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Menu Price (KES) *</label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                      className="h-11 rounded-xl font-sf-pro-display text-lg"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Serving Category *</label>
                    <select
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="w-full h-11 border border-stone-200 rounded-xl px-4 text-sm bg-white focus:ring-2 focus:ring-stone-900 outline-none"
                    >
                      <option value="">Choose a category...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Est. Preparation Time (min)</label>
                    <Input
                      type="number"
                      value={formData.preparation_time}
                      onChange={(e) => setFormData({ ...formData, preparation_time: parseInt(e.target.value) || 15 })}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Description & Ingredients</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 min-h-[100px] text-sm bg-white focus:ring-2 focus:ring-stone-900 outline-none"
                    placeholder="Describe the dish for the guest..."
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-stone-100">
                <IOSButton
                  variant="secondary"
                  onClick={() => { setItemModalOpen(false); clearImage(); }}
                  className="flex-1 h-12 text-base font-semibold"
                >
                  Discard
                </IOSButton>
                <IOSButton
                  onClick={handleSaveItem}
                  disabled={isUploadingImage}
                  className="flex-1 h-12 text-base font-semibold"
                >
                  {isUploadingImage ? 'Uploading Image...' : selectedItem ? 'Update Dish' : 'Publish Dish'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Category Modal */}
        <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-sf-pro-display">
                <Tag className="h-5 w-5 text-stone-600" />
                {selectedCategory ? 'Edit Menu Category' : 'Create New Category'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4 px-1">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Category Label *</label>
                <Input
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  placeholder="e.g. Signature Mains"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Strategic Description</label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 min-h-[100px] text-sm bg-white focus:ring-2 focus:ring-stone-900 outline-none"
                  placeholder="Briefly describe the purpose of this section..."
                />
              </div>
              <div className="flex gap-4 pt-4 border-t border-stone-100">
                <IOSButton variant="secondary" onClick={() => setCategoryModalOpen(false)} className="flex-1 h-12 text-base font-semibold">
                  Cancel
                </IOSButton>
                <IOSButton onClick={handleSaveCategory} className="flex-1 h-12 text-base font-semibold">
                  {selectedCategory ? 'Update Category' : 'Add Category'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
