'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    ChefHat, Plus, RefreshCw, ArrowLeft, DollarSign, Percent, X, Save
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Recipe {
    id: number;
    menu_item_name: string;
    portion_size: string;
    standard_cost: number;
    selling_price: number;
    food_cost_percentage: number;
    is_active: boolean;
    ingredients: any[];
}

export default function RecipesPage() {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        menu_item_name: '',
        portion_size: '1 Portion',
        portions_per_recipe: 1,
        selling_price: 0,
        ingredients: [{ item_sku: '', item_name: '', quantity_per_portion: 0, unit_of_measure: 'kg', unit_cost: 0 }]
    });

    useEffect(() => {
        fetchRecipes();
    }, []);

    const fetchRecipes = async () => {
        setIsLoading(true);
        try {
            const response = await api.kitchen.getRecipes();
            if (response.data?.success || response.success) {
                setRecipes(response.data?.data || response.data || []);
            }
        } catch (error) {
            console.error('Error fetching recipes:', error);
            toast.error('Failed to load recipes');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateRecipe = async () => {
        if (!formData.menu_item_name || formData.ingredients.length === 0) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await api.kitchen.createRecipe(formData);
            if (response.data?.success || response.success) {
                toast.success('Recipe created successfully');
                setIsModalOpen(false);
                setFormData({
                    menu_item_name: '',
                    portion_size: '1 Portion',
                    portions_per_recipe: 1,
                    selling_price: 0,
                    ingredients: [{ item_sku: '', item_name: '', quantity_per_portion: 0, unit_of_measure: 'kg', unit_cost: 0 }]
                });
                fetchRecipes();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to create recipe');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addIngredient = () => {
        setFormData({
            ...formData,
            ingredients: [...formData.ingredients, { item_sku: '', item_name: '', quantity_per_portion: 0, unit_of_measure: 'kg', unit_cost: 0 }]
        });
    };

    const removeIngredient = (index: number) => {
        const updated = formData.ingredients.filter((_, i) => i !== index);
        setFormData({ ...formData, ingredients: updated });
    };

    const updateIngredient = (index: number, field: string, value: any) => {
        const updated = [...formData.ingredients];
        updated[index] = { ...updated[index], [field]: value };
        setFormData({ ...formData, ingredients: updated });
    };

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.KITCHEN, UserRole.KITCHEN_OPERATIONS, UserRole.RESTAURANT,
            UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/kitchen-operations">
                                <button className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                                    <ArrowLeft className="h-5 w-5 text-stone-600" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">
                                    Recipes & BOM
                                </h1>
                                <p className="text-stone-500 text-sm mt-0.5">
                                    Manage recipes and ingredient costs
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton
                                onClick={fetchRecipes}
                                leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}
                                variant="secondary"
                            >
                                Refresh
                            </IOSButton>
                            <IOSButton
                                onClick={() => setIsModalOpen(true)}
                                leftIcon={<Plus />}
                            >
                                New Recipe
                            </IOSButton>
                        </div>
                    </div>

                    {/* Recipes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {isLoading ? (
                            <IOSCard className="p-8 text-center col-span-full">
                                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-400" />
                            </IOSCard>
                        ) : recipes.length === 0 ? (
                            <IOSCard className="p-8 text-center col-span-full">
                                <ChefHat className="h-12 w-12 mx-auto mb-2 text-stone-300" />
                                <p className="text-stone-500">No recipes found</p>
                            </IOSCard>
                        ) : (
                            recipes.map((recipe) => (
                                <IOSCard key={recipe.id} className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-stone-900 mb-1">{recipe.menu_item_name}</h3>
                                            <p className="text-sm text-stone-500">{recipe.portion_size}</p>
                                        </div>
                                        <IOSBadge className={recipe.is_active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-700'}>
                                            {recipe.is_active ? 'Active' : 'Inactive'}
                                        </IOSBadge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="bg-stone-50 rounded-lg p-2">
                                            <div className="flex items-center gap-1 text-xs text-stone-500 mb-1">
                                                <DollarSign className="h-3 w-3" />
                                                <span>Cost</span>
                                            </div>
                                            <p className="font-bold text-stone-900">KES {recipe.standard_cost?.toFixed(2) || '0.00'}</p>
                                        </div>
                                        <div className="bg-stone-50 rounded-lg p-2">
                                            <div className="flex items-center gap-1 text-xs text-stone-500 mb-1">
                                                <Percent className="h-3 w-3" />
                                                <span>Food Cost</span>
                                            </div>
                                            <p className={`font-bold ${(recipe.food_cost_percentage || 0) > 35 ? 'text-red-600' :
                                                (recipe.food_cost_percentage || 0) > 30 ? 'text-amber-600' :
                                                    'text-green-600'
                                                }`}>
                                                {recipe.food_cost_percentage?.toFixed(1) || '0.0'}%
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-xs text-stone-500">
                                        {recipe.ingredients?.length || 0} ingredient(s)
                                    </div>
                                </IOSCard>
                            ))
                        )}
                    </div>

                    {/* New Recipe Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create New Recipe</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4 pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium mb-1">Menu Item Name</label>
                                        <Input
                                            value={formData.menu_item_name}
                                            onChange={(e) => setFormData({ ...formData, menu_item_name: e.target.value })}
                                            placeholder="e.g. Grilled Chicken"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Portion Size</label>
                                        <Input
                                            value={formData.portion_size}
                                            onChange={(e) => setFormData({ ...formData, portion_size: e.target.value })}
                                            placeholder="e.g. 1 Plate"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Portions per Recipe</label>
                                        <Input
                                            type="number"
                                            value={formData.portions_per_recipe}
                                            onChange={(e) => setFormData({ ...formData, portions_per_recipe: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Selling Price (KES)</label>
                                        <Input
                                            type="number"
                                            value={formData.selling_price}
                                            onChange={(e) => setFormData({ ...formData, selling_price: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-medium">Ingredients (BOM)</h3>
                                        <IOSButton size="sm" variant="secondary" onClick={addIngredient} leftIcon={<Plus />}>
                                            Add Ingredient
                                        </IOSButton>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.ingredients.map((ing, index) => (
                                            <div key={index} className="grid grid-cols-12 gap-2 items-end bg-stone-50 p-3 rounded-lg">
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] text-stone-500 uppercase font-bold mb-1">SKU</label>
                                                    <Input
                                                        value={ing.item_sku}
                                                        onChange={(e) => updateIngredient(index, 'item_sku', e.target.value)}
                                                        placeholder="SKU"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <label className="block text-[10px] text-stone-500 uppercase font-bold mb-1">Name</label>
                                                    <Input
                                                        value={ing.item_name}
                                                        onChange={(e) => updateIngredient(index, 'item_name', e.target.value)}
                                                        placeholder="Item Name"
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] text-stone-500 uppercase font-bold mb-1">Qty/Portion</label>
                                                    <Input
                                                        type="number"
                                                        value={ing.quantity_per_portion}
                                                        onChange={(e) => updateIngredient(index, 'quantity_per_portion', Number(e.target.value))}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] text-stone-500 uppercase font-bold mb-1">Unit Cost</label>
                                                    <Input
                                                        type="number"
                                                        value={ing.unit_cost}
                                                        onChange={(e) => updateIngredient(index, 'unit_cost', Number(e.target.value))}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] text-stone-500 uppercase font-bold mb-1">Unit</label>
                                                    <Input
                                                        value={ing.unit_of_measure}
                                                        onChange={(e) => updateIngredient(index, 'unit_of_measure', e.target.value)}
                                                        placeholder="kg"
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <IOSButton
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-red-500 hover:text-red-600"
                                                        onClick={() => removeIngredient(index)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </IOSButton>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-6 border-t mt-6">
                                    <IOSButton variant="secondary" onClick={() => setIsModalOpen(false)}>
                                        Cancel
                                    </IOSButton>
                                    <IOSButton
                                        onClick={handleCreateRecipe}
                                        loading={isSubmitting}
                                        leftIcon={<Save />}
                                    >
                                        Save Recipe
                                    </IOSButton>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Info */}
                    <IOSCard className="p-4 bg-purple-50 border-purple-200">
                        <p className="text-sm text-stone-700">
                            <strong>Note:</strong> Recipes define the Bill of Materials (BOM) for each menu item. When a POS order is placed, ingredients are automatically deducted from kitchen stock based on the recipe.
                        </p>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
