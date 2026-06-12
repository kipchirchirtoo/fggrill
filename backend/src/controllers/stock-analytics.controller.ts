import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const parsePeriodDays = (value: unknown, fallback = 30): number => {
    const raw = String(value ?? '').trim().toLowerCase();
    const numeric = Number.parseInt(raw, 10);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;

    switch (raw) {
        case 'today':
        case 'day':
        case 'daily':
            return 1;
        case 'week':
        case 'weekly':
            return 7;
        case 'month':
        case 'monthly':
            return 30;
        case 'quarter':
        case 'quarterly':
            return 90;
        case 'year':
        case 'yearly':
            return 365;
        default:
            return fallback;
    }
};

/**
 * @desc    Get stock consumption trends
 * @route   GET /api/store/consumption-trends
 * @access  Private (Branch Manager, Auditor, Super Admin)
 */
export const getConsumptionTrends = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, period = '30', category } = req.query;

        console.log('🔍 [Stock Analytics] Fetching consumption trends:', { branch_id, period, category });

        if (!branch_id || branch_id === '0') {
            res.status(400).json({
                success: false,
                error: 'Branch ID is required'
            });
            return;
        }

        const days = parsePeriodDays(period);
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

        // Get stock out transactions (consumption) - try stock_out_records first, then branch_stock_movements
        let stockOuts: any[] = [];
        
        // Try stock_out_records first
        const { data: stockOutData, error: stockOutError } = await supabase
            .from('stock_out_records')
            .select('*')
            .eq('branch_id', branch_id)
            .gte('created_at', startDate)
            .order('created_at', { ascending: false });

        if (stockOutError) {
            console.error('❌ [Stock Analytics] Error fetching stock outs:', stockOutError);
        }

        // If no data from stock_out_records, try branch_stock_movements
        if (!stockOutData || stockOutData.length === 0) {
            console.log('📊 [Stock Analytics] No stock_out_records found, trying branch_stock_movements...');
            
            const { data: movements, error: movementsError } = await supabase
                .from('branch_stock_movements')
                .select('*')
                .eq('branch_id', branch_id)
                .in('movement_type', ['STOCK_OUT', 'USAGE', 'SALE', 'DISPATCH_OUT', 'CONSUMPTION'])
                .gte('created_at', startDate)
                .order('created_at', { ascending: false });

            if (movementsError) {
                console.error('❌ [Stock Analytics] Error fetching movements:', movementsError);
            } else {
                stockOuts = movements || [];
            }
        } else {
            stockOuts = stockOutData;
        }

        console.log(`✅ [Stock Analytics] Found ${stockOuts?.length || 0} consumption records`);

        // Get unique SKUs to fetch item details
        const uniqueSkus = [...new Set((stockOuts || []).map(s => s.item_sku))];
        
        // Fetch item details separately
        const { data: items, error: itemsError } = await supabase
            .from('simple_items')
            .select('sku, item_name, category, unit_of_measure')
            .in('sku', uniqueSkus);

        if (itemsError) {
            console.error('❌ [Stock Analytics] Error fetching items:', itemsError);
        }

        // Create a map of SKU to item details
        const itemMap = new Map((items || []).map(item => [item.sku, item]));

        // Filter by category if specified
        let filteredStockOuts = stockOuts || [];
        if (category) {
            filteredStockOuts = filteredStockOuts.filter(s => {
                const item = itemMap.get(s.item_sku);
                return item?.category === category;
            });
        }

        console.log(`✅ [Stock Analytics] Processing ${filteredStockOuts.length} records after filtering`);

        // Group by item and calculate trends
        const itemConsumption: Record<string, {
            item_sku: string;
            item_name: string;
            category: string;
            unit: string;
            total_quantity: number;
            transaction_count: number;
            daily_average: number;
            weekly_average: number;
            trend: 'increasing' | 'decreasing' | 'stable';
            last_7_days: number;
            previous_7_days: number;
        }> = {};

        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

        (filteredStockOuts).forEach(stockOut => {
            const sku = stockOut.item_sku;
            const quantity = Number(stockOut.quantity || 0);
            const createdAt = new Date(stockOut.created_at).getTime();
            const item = itemMap.get(sku);

            if (!itemConsumption[sku]) {
                itemConsumption[sku] = {
                    item_sku: sku,
                    item_name: item?.item_name || 'Unknown',
                    category: item?.category || 'Uncategorized',
                    unit: item?.unit_of_measure || 'units',
                    total_quantity: 0,
                    transaction_count: 0,
                    daily_average: 0,
                    weekly_average: 0,
                    trend: 'stable',
                    last_7_days: 0,
                    previous_7_days: 0
                };
            }

            itemConsumption[sku].total_quantity += quantity;
            itemConsumption[sku].transaction_count += 1;

            // Track last 7 days vs previous 7 days
            if (createdAt >= sevenDaysAgo) {
                itemConsumption[sku].last_7_days += quantity;
            } else if (createdAt >= fourteenDaysAgo) {
                itemConsumption[sku].previous_7_days += quantity;
            }
        });

        // Calculate averages and trends
        const trends = Object.values(itemConsumption).map(item => {
            item.daily_average = item.total_quantity / days;
            item.weekly_average = item.total_quantity / (days / 7);

            // Determine trend
            if (item.last_7_days > item.previous_7_days * 1.1) {
                item.trend = 'increasing';
            } else if (item.last_7_days < item.previous_7_days * 0.9) {
                item.trend = 'decreasing';
            } else {
                item.trend = 'stable';
            }

            return item;
        });

        // Sort by total consumption
        trends.sort((a, b) => b.total_quantity - a.total_quantity);

        // Calculate summary
        const summary = {
            total_items: trends.length,
            total_consumption: trends.reduce((sum, t) => sum + t.total_quantity, 0),
            increasing_trend: trends.filter(t => t.trend === 'increasing').length,
            decreasing_trend: trends.filter(t => t.trend === 'decreasing').length,
            stable_trend: trends.filter(t => t.trend === 'stable').length,
            top_5_consumed: trends.slice(0, 5)
        };

        res.status(200).json({
            success: true,
            data: {
                trends,
                summary,
                period_days: days
            }
        });
    } catch (error) {
        console.error('❌ [Stock Analytics] Error:', error);
        logger.error('Error fetching consumption trends:', error);
        next(error);
    }
};

/**
 * @desc    Get reorder suggestions based on consumption
 * @route   GET /api/store/reorder-suggestions
 * @access  Private
 */
export const getReorderSuggestions = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id } = req.query;

        console.log('🔍 [Stock Analytics] Generating reorder suggestions:', { branch_id });

        if (!branch_id || branch_id === '0') {
            res.status(400).json({
                success: false,
                error: 'Branch ID is required'
            });
            return;
        }

        // Get current stock levels
        const { data: branchStock, error: stockError } = await supabase
            .from('branch_stock')
            .select('*')
            .eq('branch_id', branch_id);

        if (stockError) throw stockError;

        // Get unique SKUs
        const uniqueSkus = (branchStock || []).map(s => s.item_sku);

        // Fetch item details separately
        const { data: items, error: itemsError } = await supabase
            .from('simple_items')
            .select('sku, item_name, category, unit_of_measure')
            .in('sku', uniqueSkus);

        if (itemsError) {
            console.error('❌ [Stock Analytics] Error fetching items:', itemsError);
        }

        // Create a map of SKU to item details
        const itemMap = new Map((items || []).map(item => [item.sku, item]));

        // Get consumption for last 30 days - try stock_out_records first, then branch_stock_movements
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        let consumption: any[] = [];
        
        const { data: stockOutData, error: stockOutError } = await supabase
            .from('stock_out_records')
            .select('item_sku, quantity')
            .eq('branch_id', branch_id)
            .gte('created_at', thirtyDaysAgo);

        if (stockOutError) {
            console.error('❌ [Stock Analytics] Error fetching stock outs:', stockOutError);
        }

        // If no data from stock_out_records, try branch_stock_movements
        if (!stockOutData || stockOutData.length === 0) {
            console.log('📊 [Stock Analytics] No stock_out_records found, trying branch_stock_movements...');
            
            const { data: movements, error: movementsError } = await supabase
                .from('branch_stock_movements')
                .select('item_sku, quantity')
                .eq('branch_id', branch_id)
                .in('movement_type', ['STOCK_OUT', 'USAGE', 'SALE', 'DISPATCH_OUT', 'CONSUMPTION'])
                .gte('created_at', thirtyDaysAgo);

            if (movementsError) {
                console.error('❌ [Stock Analytics] Error fetching movements:', movementsError);
            } else {
                consumption = movements || [];
            }
        } else {
            consumption = stockOutData;
        }

        console.log(`✅ [Stock Analytics] Found ${consumption?.length || 0} consumption records for rate calculation`);

        // Calculate daily consumption rate
        const consumptionRates: Record<string, number> = {};
        (consumption || []).forEach(c => {
            const sku = c.item_sku;
            consumptionRates[sku] = (consumptionRates[sku] || 0) + Number(c.quantity || 0);
        });

        // Generate suggestions
        const suggestions = (branchStock || [])
            .map(stock => {
                const dailyRate = (consumptionRates[stock.item_sku] || 0) / 30;
                const currentQty = Number(stock.quantity || 0);
                const reorderLevel = Number(stock.reorder_level || 0);
                const daysUntilStockout = dailyRate > 0 ? currentQty / dailyRate : 999;
                const item = itemMap.get(stock.item_sku);

                return {
                    item_sku: stock.item_sku,
                    item_name: item?.item_name || 'Unknown',
                    category: item?.category || 'Uncategorized',
                    current_quantity: currentQty,
                    reorder_level: reorderLevel,
                    daily_consumption_rate: dailyRate,
                    days_until_stockout: Math.floor(daysUntilStockout),
                    suggested_order_quantity: Math.ceil(dailyRate * 14), // 2 weeks supply
                    priority: currentQty <= reorderLevel ? 'urgent' : 
                             daysUntilStockout <= 7 ? 'high' : 
                             daysUntilStockout <= 14 ? 'medium' : 'low',
                    unit: item?.unit_of_measure || 'units'
                };
            })
            .filter(s => s.priority === 'urgent' || s.priority === 'high' || s.priority === 'medium')
            .sort((a, b) => {
                const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
                return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
            });

        console.log(`✅ [Stock Analytics] Generated ${suggestions.length} reorder suggestions`);

        res.status(200).json({
            success: true,
            data: {
                suggestions,
                summary: {
                    urgent: suggestions.filter(s => s.priority === 'urgent').length,
                    high: suggestions.filter(s => s.priority === 'high').length,
                    medium: suggestions.filter(s => s.priority === 'medium').length
                }
            }
        });
    } catch (error) {
        console.error('❌ [Stock Analytics] Error:', error);
        logger.error('Error generating reorder suggestions:', error);
        next(error);
    }
};

/**
 * @desc    Get stock movement timeline
 * @route   GET /api/store/stock-movement
 * @access  Private
 */
export const getStockMovement = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, item_sku, days = '30' } = req.query;

        console.log('🔍 [Stock Analytics] Fetching stock movement:', { branch_id, item_sku, days });

        if (!branch_id || branch_id === '0') {
            res.status(400).json({
                success: false,
                error: 'Branch ID is required'
            });
            return;
        }

        const period = parsePeriodDays(days);
        const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

        // Get stock in (receipts) - try stock_in_records first, then branch_stock_movements
        let stockIn: any[] = [];
        
        let stockInQuery = supabase
            .from('stock_in_records')
            .select('item_sku, quantity, created_at, source')
            .eq('branch_id', branch_id)
            .gte('created_at', startDate);

        if (item_sku) {
            stockInQuery = stockInQuery.eq('item_sku', item_sku);
        }

        const { data: stockInData, error: stockInError } = await stockInQuery;
        
        if (stockInError) {
            console.error('❌ [Stock Analytics] Error fetching stock in:', stockInError);
        }

        // If no data, try branch_stock_movements for IN movements
        if (!stockInData || stockInData.length === 0) {
            let movementInQuery = supabase
                .from('branch_stock_movements')
                .select('item_sku, quantity, created_at, notes')
                .eq('branch_id', branch_id)
                .in('movement_type', ['STOCK_IN', 'RECEIPT', 'TRANSFER_IN', 'PURCHASE'])
                .gte('created_at', startDate);

            if (item_sku) {
                movementInQuery = movementInQuery.eq('item_sku', item_sku);
            }

            const { data: movements } = await movementInQuery;
            stockIn = (movements || []).map(m => ({
                ...m,
                source: m.notes || 'Receipt'
            }));
        } else {
            stockIn = stockInData;
        }

        // Get stock out (consumption) - try stock_out_records first, then branch_stock_movements
        let stockOut: any[] = [];
        
        let stockOutQuery = supabase
            .from('stock_out_records')
            .select('item_sku, quantity, created_at, reason')
            .eq('branch_id', branch_id)
            .gte('created_at', startDate);

        if (item_sku) {
            stockOutQuery = stockOutQuery.eq('item_sku', item_sku);
        }

        const { data: stockOutData, error: stockOutError } = await stockOutQuery;
        
        if (stockOutError) {
            console.error('❌ [Stock Analytics] Error fetching stock out:', stockOutError);
        }

        // If no data, try branch_stock_movements for OUT movements
        if (!stockOutData || stockOutData.length === 0) {
            let movementOutQuery = supabase
                .from('branch_stock_movements')
                .select('item_sku, quantity, created_at, notes')
                .eq('branch_id', branch_id)
                .in('movement_type', ['STOCK_OUT', 'USAGE', 'SALE', 'DISPATCH_OUT', 'CONSUMPTION'])
                .gte('created_at', startDate);

            if (item_sku) {
                movementOutQuery = movementOutQuery.eq('item_sku', item_sku);
            }

            const { data: movements } = await movementOutQuery;
            stockOut = (movements || []).map(m => ({
                ...m,
                reason: m.notes || 'Consumption'
            }));
        } else {
            stockOut = stockOutData;
        }

        console.log(`✅ [Stock Analytics] Found ${stockIn?.length || 0} IN and ${stockOut?.length || 0} OUT movements`);

        // Combine and sort by date
        const movements = [
            ...(stockIn || []).map(s => ({
                type: 'in' as const,
                item_sku: s.item_sku,
                quantity: Number(s.quantity || 0),
                date: s.created_at,
                details: s.source || 'Receipt'
            })),
            ...(stockOut || []).map(s => ({
                type: 'out' as const,
                item_sku: s.item_sku,
                quantity: Number(s.quantity || 0),
                date: s.created_at,
                details: s.reason || 'Consumption'
            }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Calculate running balance if single item
        if (item_sku) {
            let balance = 0;
            // Get current stock
            const { data: currentStock } = await supabase
                .from('branch_stock')
                .select('quantity')
                .eq('branch_id', branch_id)
                .eq('item_sku', item_sku)
                .single();

            balance = Number(currentStock?.quantity || 0);

            // Calculate backwards
            movements.forEach(m => {
                if (m.type === 'in') {
                    balance -= m.quantity;
                } else {
                    balance += m.quantity;
                }
                (m as any).balance = balance;
            });
        }

        res.status(200).json({
            success: true,
            data: {
                movements,
                summary: {
                    total_in: (stockIn || []).reduce((sum, s) => sum + Number(s.quantity || 0), 0),
                    total_out: (stockOut || []).reduce((sum, s) => sum + Number(s.quantity || 0), 0),
                    net_change: (stockIn || []).reduce((sum, s) => sum + Number(s.quantity || 0), 0) - 
                               (stockOut || []).reduce((sum, s) => sum + Number(s.quantity || 0), 0)
                }
            }
        });
    } catch (error) {
        console.error('❌ [Stock Analytics] Error:', error);
        logger.error('Error fetching stock movement:', error);
        next(error);
    }
};

/**
 * @desc    Get wastage analytics
 * @route   GET /api/store/wastage-analytics
 * @access  Private
 */
export const getWastageAnalytics = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { branch_id, days = '30' } = req.query;

        console.log('🔍 [Stock Analytics] Fetching wastage analytics:', { branch_id, days });

        if (!branch_id || branch_id === '0') {
            res.status(400).json({
                success: false,
                error: 'Branch ID is required'
            });
            return;
        }

        const period = parsePeriodDays(days);
        const startDate = new Date(Date.now() - period * 24 * 60 * 60 * 1000).toISOString();

        const { data: wastage, error } = await supabase
            .from('wastage_records')
            .select('*')
            .eq('branch_id', branch_id)
            .gte('logged_at', startDate)
            .order('logged_at', { ascending: false });

        if (error) throw error;

        console.log(`✅ [Stock Analytics] Found ${wastage?.length || 0} wastage records`);

        // Get unique item names to fetch categories from simple_items
        const uniqueItemNames = [...new Set((wastage || []).map(w => w.item_name).filter(Boolean))];
        
        // Try to match items by name to get categories
        const { data: items } = await supabase
            .from('simple_items')
            .select('item_name, category')
            .in('item_name', uniqueItemNames);

        const itemCategoryMap = new Map((items || []).map(item => [item.item_name, item.category]));

        // Group by category and reason
        const byCategory: Record<string, number> = {};
        const byReason: Record<string, number> = {};
        let totalValue = 0;
        let totalQuantity = 0;

        (wastage || []).forEach(w => {
            // Try to get category from item lookup, fallback to item_type, then 'Uncategorized'
            const category = itemCategoryMap.get(w.item_name) || w.item_type || 'Uncategorized';
            const reason = w.reason || 'other';
            const value = Number(w.cost_impact || 0);
            const quantity = Number(w.quantity || 0);

            byCategory[category] = (byCategory[category] || 0) + value;
            byReason[reason] = (byReason[reason] || 0) + value;
            totalValue += value;
            totalQuantity += quantity;
        });

        res.status(200).json({
            success: true,
            data: {
                wastage,
                summary: {
                    total_incidents: wastage?.length || 0,
                    total_value: totalValue,
                    total_quantity: totalQuantity,
                    by_category: byCategory,
                    by_reason: byReason,
                    average_value_per_incident: wastage?.length ? totalValue / wastage.length : 0,
                    average_quantity_per_incident: wastage?.length ? totalQuantity / wastage.length : 0
                }
            }
        });
    } catch (error) {
        console.error('❌ [Stock Analytics] Error:', error);
        logger.error('Error fetching wastage analytics:', error);
        next(error);
    }
};
