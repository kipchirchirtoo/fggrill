'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
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

export default function RestaurantMenuPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>(user?.branch_id || 'all');

  // Modal states
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    category_id: '',
    preparation_time: 15,
    branch_id: '',
  });
  
  // Image upload states
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [itemsRes, categoriesRes, branchesRes] = await Promise.all([
        restaurantAPI.getMenuItems(),
        restaurantAPI.getCategories(),
        systemAPI.getBranches(),
      ]);

      if (itemsRes.success) setItems(itemsRes.data || []);
      if (categoriesRes.success) setCategories(categoriesRes.data || []);
      if (branchesRes.success) setBranches(branchesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category_id === categoryFilter;
    const matchesBranch = branchFilter === 'all' || !item.branch_id || item.branch_id === branchFilter;
    return matchesSearch && matchesCategory && matchesBranch;
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
            await restaurantAPI.uploadMenuItemImage(itemId!, base64, imageFile.type);
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
    setFormData({ name: '', description: '', price: 0, category_id: '', preparation_time: 15, branch_id: user?.branch_id || '' });
    clearImage();
    setItemModalOpen(true);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RESTAURANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
              <p className="text-gray-500">Manage menu items and categories</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </IOSButton>
              <IOSButton onClick={openNewModal}>
                <Plus className="h-4 w-4 mr-2" />
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

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
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
              <IOSButton onClick={openNewModal} className="mt-4">
                <Plus className="h-4 w-4 mr-2" /> Add First Item
              </IOSButton>
            </IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <IOSCard key={item.id} className={`overflow-hidden ${!item.is_available ? 'opacity-60' : ''}`}>
                  {/* Item Image */}
                  <div className="h-40 bg-gradient-to-br from-orange-100 to-yellow-100 relative">
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
                        <Soup className="h-16 w-16 text-orange-300" />
                      </div>
                    )}
                    {!item.is_available && (
                      <div className="absolute top-2 right-2">
                        <IOSBadge variant="error">Unavailable</IOSBadge>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-bold">{item.name}</h3>
                        <p className="text-sm text-gray-500">{item.category_name}</p>
                      </div>
                      <p className="font-bold text-lg text-[#34C759]">KES {item.price?.toLocaleString()}</p>
                    </div>

                    {item.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t">
                      <IOSButton
                        size="sm"
                        variant={item.is_available ? 'secondary' : 'primary'}
                        onClick={() => handleToggleAvailability(item)}
                      >
                        {item.is_available ? (
                          <><EyeOff className="h-3 w-3 mr-1" /> Hide</>
                        ) : (
                          <><Eye className="h-3 w-3 mr-1" /> Show</>
                        )}
                      </IOSButton>
                      <div className="flex gap-2">
                        <IOSButton size="sm" variant="secondary" onClick={() => openEditModal(item)}>
                          <Edit2 className="h-3 w-3" />
                        </IOSButton>
                        <IOSButton size="sm" variant="destructive" onClick={() => handleDeleteItem(item)}>
                          <Trash2 className="h-3 w-3" />
                        </IOSButton>
                      </div>
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        {/* Item Modal */}
        <Dialog open={itemModalOpen} onOpenChange={setItemModalOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Image Upload */}
              <div>
                <label className="text-sm font-medium mb-2 block">Item Image</label>
                <div className="border-2 border-dashed rounded-ios-lg p-4">
                  {imagePreview ? (
                    <div className="relative">
                      <div className="relative h-40 w-full rounded-ios-lg overflow-hidden">
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
                        className="absolute top-2 right-2 p-1 bg-[#FF3B30] text-white rounded-full hover:bg-[#FF3B30]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center py-6 cursor-pointer hover:bg-gray-50 rounded-ios-lg"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Camera className="h-10 w-10 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">Click to upload image</p>
                      <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Item name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Price (KES) *</label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Category *</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full p-2 border rounded-ios-lg"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Branch</label>
                  <select
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    className="w-full p-2 border rounded-ios-lg"
                  >
                    <option value="">All Branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2 border rounded-ios-lg"
                  rows={2}
                  placeholder="Brief description of the dish"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Prep Time (minutes)</label>
                <Input
                  type="number"
                  value={formData.preparation_time}
                  onChange={(e) => setFormData({ ...formData, preparation_time: parseInt(e.target.value) || 15 })}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <IOSButton variant="secondary" onClick={() => { setItemModalOpen(false); clearImage(); }} className="flex-1">
                  Cancel
                </IOSButton>
                <IOSButton onClick={handleSaveItem} disabled={isUploadingImage} className="flex-1">
                  {isUploadingImage ? 'Uploading...' : selectedItem ? 'Update' : 'Create'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
