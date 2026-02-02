'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    ChefHat, Plus, RefreshCw, ArrowLeft, DollarSign, Percent, X, Save, AlertCircle
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
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/kitchen-operations">
                                <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500 hover:text-stone-900">
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="page-title">Recipes & BOM</h1>
                                <p className="page-subtitle">Manage recipes and ingredient costs</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={fetchRecipes}
                                className="btn-secondary"
                                disabled={isLoading}
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="btn-primary"
                            >
                                <Plus className="h-4 w-4" />
                                <span>New Recipe</span>
                            </button>
                        </div>
                    </div>

                    {/* Recipes Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {isLoading ? (
                            <div className="col-span-full py-16 text-center text-stone-400">
                                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                                <p>Loading recipes...</p>
                            </div>
                        ) : recipes.length === 0 ? (
                            <div className="col-span-full py-16 text-center border-2 border-dashed border-stone-100 rounded-xl bg-stone-50">
                                <ChefHat className="h-10 w-10 mx-auto mb-3 text-stone-300" />
                                <p className="text-stone-500 font-medium">No recipes found</p>
                            </div>
                        ) : (
                            recipes.map((recipe) => (
                                <div key={recipe.id} className="card-elevated p-5 hover:border-stone-300 transition-colors">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="font-bold text-stone-900 text-[15px]">{recipe.menu_item_name}</h3>
                                            <p className="text-[13px] text-stone-500 mt-0.5">{recipe.portion_size}</p>
                                        </div>
                                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase ${recipe.is_active ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-600'
                                            }`}>
                                            {recipe.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        <div className="bg-stone-50 rounded-lg p-2.5">
                                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 uppercase mb-1">
                                                <DollarSign className="h-3 w-3" />
                                                Standard Cost
                                            </div>
                                            <p className="font-bold text-stone-900">KES {recipe.standard_cost?.toFixed(2) || '0.00'}</p>
                                        </div>
                                        <div className="bg-stone-50 rounded-lg p-2.5">
                                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-500 uppercase mb-1">
                                                <Percent className="h-3 w-3" />
                                                Food Cost
                                            </div>
                                            <p className={`font-bold ${(recipe.food_cost_percentage || 0) > 35 ? 'text-red-600' :
                                                (recipe.food_cost_percentage || 0) > 30 ? 'text-amber-600' :
                                                    'text-green-600'
                                                }`}>
                                                {recipe.food_cost_percentage?.toFixed(1) || '0.0'}%
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                                        <div className="text-[13px] text-stone-500 cursor-help" title="View details">
                                            {recipe.ingredients?.length || 0} Ingredients
                                        </div>
                                        <button className="text-[13px] font-semibold text-blue-600 hover:text-blue-700">
                                            Edit Details
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* New Recipe Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0 overflow-hidden">
                            <DialogHeader className="px-6 py-5 border-b border-stone-100 bg-stone-50/50">
                                <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold text-stone-900">
                                    <ChefHat className="h-5 w-5 text-stone-500" />
                                    Create New Recipe
                                </DialogTitle>
                            </DialogHeader>

                            <div className="overflow-y-auto px-6 py-6 flex-1 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div className="md:col-span-2 space-y-1.5">
                                        <label className="input-label">Menu Item Name</label>
                                        <input
                                            value={formData.menu_item_name}
                                            onChange={(e) => setFormData({ ...formData, menu_item_name: e.target.value })}
                                            placeholder="e.g. Grilled Chicken"
                                            className="input-field"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="input-label">Portion Size</label>
                                        <input
                                            value={formData.portion_size}
                                            onChange={(e) => setFormData({ ...formData, portion_size: e.target.value })}
                                            placeholder="e.g. 1 Plate"
                                            className="input-field"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-1.5">
                                        <label className="input-label">Portions per Recipe</label>
                                        <input
                                            type="number"
                                            value={formData.portions_per_recipe}
                                            onChange={(e) => setFormData({ ...formData, portions_per_recipe: Number(e.target.value) })}
                                            className="input-field"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="input-label">Selling Price (KES)</label>
                                        <input
                                            type="number"
                                            value={formData.selling_price}
                                            onChange={(e) => setFormData({ ...formData, selling_price: Number(e.target.value) })}
                                            className="input-field"
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-stone-100 pt-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-bold text-stone-900">Ingredients (BOM)</h3>
                                        <button
                                            onClick={addIngredient}
                                            className="btn-secondary py-1.5 px-3 h-auto text-xs"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            <span>Add Ingredient</span>
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.ingredients.map((ing, index) => (
                                            <div key={index} className="grid grid-cols-12 gap-3 items-end bg-stone-50 p-3 rounded-lg border border-stone-100">
                                                <div className="col-span-2 space-y-1">
                                                    <label className="input-label">SKU</label>
                                                    <input
                                                        value={ing.item_sku}
                                                        onChange={(e) => updateIngredient(index, 'item_sku', e.target.value)}
                                                        placeholder="SKU"
                                                        className="input-field py-1.5 text-xs h-8"
                                                    />
                                                </div>
                                                <div className="col-span-3 space-y-1">
                                                    <label className="input-label">Name</label>
                                                    <input
                                                        value={ing.item_name}
                                                        onChange={(e) => updateIngredient(index, 'item_name', e.target.value)}
                                                        placeholder="Item Name"
                                                        className="input-field py-1.5 text-xs h-8"
                                                    />
                                                </div>
                                                <div className="col-span-2 space-y-1">
                                                    <label className="input-label">Qty</label>
                                                    <input
                                                        type="number"
                                                        value={ing.quantity_per_portion}
                                                        onChange={(e) => updateIngredient(index, 'quantity_per_portion', Number(e.target.value))}
                                                        className="input-field py-1.5 text-xs h-8"
                                                    />
                                                </div>
                                                <div className="col-span-2 space-y-1">
                                                    <label className="input-label">Cost</label>
                                                    <input
                                                        type="number"
                                                        value={ing.unit_cost}
                                                        onChange={(e) => updateIngredient(index, 'unit_cost', Number(e.target.value))}
                                                        className="input-field py-1.5 text-xs h-8"
                                                    />
                                                </div>
                                                <div className="col-span-2 space-y-1">
                                                    <label className="input-label">Unit</label>
                                                    <input
                                                        value={ing.unit_of_measure}
                                                        onChange={(e) => updateIngredient(index, 'unit_of_measure', e.target.value)}
                                                        placeholder="kg"
                                                        className="input-field py-1.5 text-xs h-8"
                                                    />
                                                </div>
                                                <div className="col-span-1 flex justify-center pb-1">
                                                    <button
                                                        onClick={() => removeIngredient(index)}
                                                        className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50">
                                <button className="btn-secondary flex-1" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="btn-primary flex-1"
                                    onClick={handleCreateRecipe}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4" />
                                            <span>Save Recipe</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
