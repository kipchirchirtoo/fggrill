'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { barAPI } from '@/lib/api';
import {
  Wine, Plus, RefreshCw, Search, Edit2, Trash2, Eye, EyeOff, Tag, X, Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import Image from 'next/image';

interface Drink {
  id: string;
  name: string;
  description?: string;
  price: number;
  cost_price?: number;
  category_id: string;
  category?: { name: string };
  unit?: string;
  is_available: boolean;
  branch_id?: string;
  image_url?: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}

export default function BarMenuManagementPage() {
  const { user } = useAuth();
  const { activeBranchId } = useBranch();
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modal states
  const [drinkModalOpen, setDrinkModalOpen] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [drinkFormData, setDrinkFormData] = useState({
    name: '',
    description: '',
    price: 0,
    cost_price: 0,
    category_id: '',
    unit: 'glass',
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    sort_order: 1,
  });

  // Image upload states
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [drinksRes, categoriesRes] = await Promise.all([
        barAPI.getDrinks(),
        barAPI.getCategories(),
      ]);

      if (drinksRes.success) setDrinks(drinksRes.data || []);
      if (categoriesRes.success) setCategories(categoriesRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredDrinks = drinks.filter((drink) => {
    const matchesSearch = drink.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || drink.category_id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleToggleAvailability = async (drink: Drink) => {
    try {
      await barAPI.toggleDrinkAvailability(drink.id);
      toast.success(`${drink.name} is now ${drink.is_available ? 'unavailable' : 'available'}`);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update drink');
    }
  };

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

  const handleSaveDrink = async () => {
    if (!drinkFormData.name || !drinkFormData.price || !drinkFormData.category_id) {
      toast.error('Please fill required fields (Name, Price, Category)');
      return;
    }

    setIsSubmitting(true);
    try {
      let drinkId = selectedDrink?.id;

      if (selectedDrink) {
        await barAPI.updateDrink(selectedDrink.id, {
          ...drinkFormData,
          branch_id: activeBranchId,
        });
        toast.success('Drink updated');
      } else {
        const res = await barAPI.createDrink({
          ...drinkFormData,
          branch_id: activeBranchId,
        });
        drinkId = res.data?.id;
        toast.success('Drink created');
      }

      // Upload image if selected
      if (imageFile && drinkId) {
        setIsUploadingImage(true);
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result as string;
            await barAPI.uploadDrinkImage(drinkId!, base64, imageFile.type, imageFile.name);
            toast.success('Image uploaded');
            fetchData();
          };
          reader.readAsDataURL(imageFile);
        } catch (imgError: any) {
          toast.error('Failed to upload image');
        } finally {
          setIsUploadingImage(false);
        }
      } else {
        fetchData();
      }

      setDrinkModalOpen(false);
      resetDrinkForm();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save drink');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDrink = async (drink: Drink) => {
    if (!confirm(`Delete ${drink.name}?`)) return;
    try {
      await barAPI.deleteDrink(drink.id);
      toast.success('Drink deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete drink');
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryFormData.name) {
      toast.error('Category name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedCategory) {
        await barAPI.updateCategory(selectedCategory.id, categoryFormData);
        toast.success('Category updated');
      } else {
        await barAPI.createCategory(categoryFormData);
        toast.success('Category created');
      }
      setCategoryModalOpen(false);
      resetCategoryForm();
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (!confirm(`Delete ${category.name}? This will affect all drinks in this category.`)) return;
    try {
      await barAPI.deleteCategory(category.id);
      toast.success('Category deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete category');
    }
  };

  const resetDrinkForm = () => {
    setSelectedDrink(null);
    setDrinkFormData({
      name: '',
      description: '',
      price: 0,
      cost_price: 0,
      category_id: '',
      unit: 'glass',
    });
    clearImage();
  };

  const resetCategoryForm = () => {
    setSelectedCategory(null);
    setCategoryFormData({
      name: '',
      description: '',
      sort_order: categories.length + 1,
    });
  };

  const openEditDrinkModal = (drink: Drink) => {
    setSelectedDrink(drink);
    setDrinkFormData({
      name: drink.name,
      description: drink.description || '',
      price: drink.price,
      cost_price: drink.cost_price || 0,
      category_id: drink.category_id,
      unit: drink.unit || 'glass',
    });
    setImagePreview(drink.image_url || null);
    setImageFile(null);
    setDrinkModalOpen(true);
  };

  const openNewDrinkModal = () => {
    resetDrinkForm();
    setDrinkModalOpen(true);
  };

  const openEditCategoryModal = (category: Category) => {
    setSelectedCategory(category);
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
      sort_order: category.sort_order || 1,
    });
    setCategoryModalOpen(true);
  };

  const openNewCategoryModal = () => {
    resetCategoryForm();
    setCategoryModalOpen(true);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bar Menu Management</h1>
              <p className="text-gray-500">Manage bar drinks and categories</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchData} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                Refresh
              </IOSButton>
              <IOSButton variant="secondary" onClick={openNewCategoryModal} leftIcon={<Tag />}>
                Add Category
              </IOSButton>
              <IOSButton onClick={openNewDrinkModal} leftIcon={<Plus />}>
                Add Drink
              </IOSButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Total Drinks</p>
              <p className="text-2xl font-bold">{drinks.length}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Categories</p>
              <p className="text-2xl font-bold">{categories.length}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Available</p>
              <p className="text-2xl font-bold text-[#34C759]">{drinks.filter(d => d.is_available).length}</p>
            </IOSCard>
            <IOSCard className="p-4">
              <p className="text-sm text-gray-500">Hidden</p>
              <p className="text-2xl font-bold text-[#FF3B30]">{drinks.filter(d => !d.is_available).length}</p>
            </IOSCard>
          </div>

          {/* Categories Management */}
          <IOSCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Drink Categories</h2>
              <IOSButton size="sm" onClick={openNewCategoryModal} leftIcon={<Plus />}>
                Add Category
              </IOSButton>
            </div>
            {categories.length === 0 ? (
              <div className="text-center py-8 text-stone-500">
                <Tag className="h-8 w-8 mx-auto mb-2 text-stone-300" />
                <p>No categories yet. Add your first category to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {categories.map((category) => (
                  <div key={category.id} className="p-3 border rounded-ios-lg flex items-center justify-between hover:bg-stone-50 transition-colors">
                    <div>
                      <p className="font-medium text-stone-800 capitalize">{category.name}</p>
                      <p className="text-sm text-stone-500">
                        {drinks.filter(d => d.category_id === category.id).length} drinks
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <IOSButton
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditCategoryModal(category)}
                      >
                        <Edit2 className="h-3 w-3" />
                      </IOSButton>
                      <IOSButton
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteCategory(category)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </IOSButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </IOSCard>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-stone-400" />
                <Input
                  placeholder="Search drinks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 border rounded-ios-lg bg-white"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </IOSCard>

          {/* Drinks Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-stone-400" />
            </div>
          ) : filteredDrinks.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Wine className="h-12 w-12 mx-auto text-stone-300 mb-4" />
              <p className="text-stone-500 mb-4">
                {drinks.length === 0 ? 'No drinks yet. Add your first drink to get started.' : 'No drinks match your search.'}
              </p>
              {drinks.length === 0 && (
                <IOSButton onClick={openNewDrinkModal} leftIcon={<Plus />}>
                  Add First Drink
                </IOSButton>
              )}
            </IOSCard>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredDrinks.map((drink) => (
                <div
                  key={drink.id}
                  className={`bg-[#fefefe] rounded-[1rem] p-2 text-[#141417] shadow-md hover:shadow-lg transition-all duration-200 ${!drink.is_available ? 'opacity-60' : ''}`}
                >
                  {/* Card Hero Section */}
                  <div className="bg-stone-100 rounded-t-[0.5rem] p-4 text-sm">
                    {/* Header with category and availability */}
                    <div className="flex justify-between items-center gap-4 font-bold">
                      <span className="text-xs uppercase tracking-wide text-stone-600">
                        {drink.category?.name || 'Uncategorized'}
                      </span>
                      {drink.is_available ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Available
                        </span>
                      ) : (
                        <IOSBadge variant="light" color="danger">Hidden</IOSBadge>
                      )}
                    </div>

                    {/* Item Name - Main Title */}
                    <h3 className="my-4 text-xl font-semibold pr-4 leading-tight line-clamp-2">
                      {drink.name}
                    </h3>

                    {/* Image */}
                    <div className="relative h-32 w-full overflow-hidden rounded-lg bg-white/50">
                      {drink.image_url ? (
                        <Image
                          src={drink.image_url}
                          alt={drink.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Wine className="h-12 w-12 text-stone-300" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="p-3">
                    {/* Price Row */}
                    <div className="flex justify-between items-center mb-3 font-bold text-sm">
                      <span className="text-lg font-bold text-[#141417]">
                        KES {drink.price?.toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-500">{drink.unit || 'glass'}</span>
                    </div>

                    {drink.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{drink.description}</p>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <button
                        className={`font-normal border-none cursor-pointer text-center py-2 px-4 rounded-[1rem] text-sm transition-colors ${drink.is_available
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-[#141417] text-white hover:bg-[#2a2a2f]'
                          }`}
                        onClick={() => handleToggleAvailability(drink)}
                      >
                        {drink.is_available ? (
                          <span className="flex items-center gap-1"><EyeOff className="h-3 w-3" /> Hide</span>
                        ) : (
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Show</span>
                        )}
                      </button>
                      <div className="flex gap-2">
                        <button
                          className="p-2 bg-gray-100 text-gray-700 rounded-[0.75rem] hover:bg-gray-200 transition-colors"
                          onClick={() => openEditDrinkModal(drink)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 bg-red-50 text-red-600 rounded-[0.75rem] hover:bg-red-100 transition-colors"
                          onClick={() => handleDeleteDrink(drink)}
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

        {/* Drink Modal */}
        <Dialog open={drinkModalOpen} onOpenChange={setDrinkModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0">
            <DialogHeader className="px-6 py-4 border-b border-stone-100 bg-white">
              <DialogTitle className="flex items-center gap-2 text-xl font-sf-pro-display">
                <Wine className="h-5 w-5 text-stone-600" />
                {selectedDrink ? 'Refine Drink Selection' : 'Create New Collection Entry'}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Image Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Product Visual</h4>
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
                      <p className="text-sm font-semibold text-stone-600">Capture Product Image</p>
                      <p className="text-xs text-stone-400 mt-1">Recommended: Square Aspect Ratio (Max 5MB)</p>
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

              {/* Basic Info Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest px-1">Product Identities</h4>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Drink Designation *</label>
                  <Input
                    value={drinkFormData.name}
                    onChange={(e) => setDrinkFormData({ ...drinkFormData, name: e.target.value })}
                    placeholder="e.g. Johnnie Walker Black Label"
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Selling Price (KES) *</label>
                    <Input
                      type="number"
                      value={drinkFormData.price}
                      onChange={(e) => setDrinkFormData({ ...drinkFormData, price: parseFloat(e.target.value) || 0 })}
                      className="h-11 rounded-xl font-sf-pro-display text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Acquisition Cost (KES)</label>
                    <Input
                      type="number"
                      value={drinkFormData.cost_price}
                      onChange={(e) => setDrinkFormData({ ...drinkFormData, cost_price: parseFloat(e.target.value) || 0 })}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Inventory Category *</label>
                    <select
                      value={drinkFormData.category_id}
                      onChange={(e) => setDrinkFormData({ ...drinkFormData, category_id: e.target.value })}
                      className="w-full h-11 border border-stone-200 rounded-xl px-4 text-sm bg-white focus:ring-2 focus:ring-stone-900 outline-none"
                    >
                      <option value="">Choose a collection...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Unit of Measure</label>
                    <select
                      value={drinkFormData.unit}
                      onChange={(e) => setDrinkFormData({ ...drinkFormData, unit: e.target.value })}
                      className="w-full h-11 border border-stone-200 rounded-xl px-4 text-sm bg-white focus:ring-2 focus:ring-stone-900 outline-none"
                    >
                      <option value="glass">Glass</option>
                      <option value="bottle">Bottle</option>
                      <option value="shot">Shot</option>
                      <option value="can">Can</option>
                      <option value="500ml">500ml</option>
                      <option value="300ml">300ml</option>
                      <option value="750ml">750ml</option>
                      <option value="tot">Tot</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Serving Notes</label>
                  <textarea
                    value={drinkFormData.description}
                    onChange={(e) => setDrinkFormData({ ...drinkFormData, description: e.target.value })}
                    className="w-full border border-stone-200 rounded-xl px-4 py-3 min-h-[100px] text-sm bg-white focus:ring-2 focus:ring-stone-900 outline-none"
                    placeholder="Optional details about the drink..."
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-4">
              <IOSButton variant="secondary" onClick={() => setDrinkModalOpen(false)} className="flex-1 h-12 text-base font-semibold">
                Cancel
              </IOSButton>
              <IOSButton onClick={handleSaveDrink} disabled={isSubmitting || isUploadingImage} className="flex-1 h-12 text-base font-semibold">
                {isUploadingImage ? 'Uploading Image...' : isSubmitting ? 'Processing...' : selectedDrink ? 'Save Variations' : 'Add to Collection'}
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>

        {/* Category Modal */}
        <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
          <DialogContent className="max-w-xl flex flex-col overflow-hidden p-0 max-h-[85vh]">
            <DialogHeader className="px-6 py-4 border-b border-stone-100 bg-white">
              <DialogTitle className="flex items-center gap-2 text-xl font-sf-pro-display">
                <Tag className="h-5 w-5 text-stone-600" />
                {selectedCategory ? 'Edit Bar Category' : 'Create Bar Collection'}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Collection Title *</label>
                <Input
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                  placeholder="e.g. Rare Malts"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Menu Order</label>
                  <Input
                    type="number"
                    value={categoryFormData.sort_order}
                    onChange={(e) => setCategoryFormData({ ...categoryFormData, sort_order: parseInt(e.target.value) || 1 })}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-500 uppercase tracking-wider px-1">Collection Summary</label>
                <textarea
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 min-h-[100px] text-sm bg-white focus:ring-2 focus:ring-stone-900 outline-none"
                  placeholder="Strategic description for the bar team..."
                />
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-4">
              <IOSButton variant="secondary" onClick={() => setCategoryModalOpen(false)} className="flex-1 h-12 text-base font-semibold">
                Discard
              </IOSButton>
              <IOSButton onClick={handleSaveCategory} disabled={isSubmitting} className="flex-1 h-12 text-base font-semibold">
                {isSubmitting ? 'Saving...' : selectedCategory ? 'Apply Changes' : 'Initialize Collection'}
              </IOSButton>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
