'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import {
    ChefHat, Plus, RefreshCw, ArrowLeft, DollarSign, Percent
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

    useEffect(() => {
        fetchRecipes();
    }, []);

    const fetchRecipes = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/kitchen/recipes');
            if (response.data.success) {
                setRecipes(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching recipes:', error);
            toast.error('Failed to load recipes');
        } finally {
            setIsLoading(false);
        }
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
                            <IOSButton leftIcon={<Plus />}>
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
