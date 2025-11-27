import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';

// @desc    Get shop items
// @route   GET /api/store/shop-items
// @access  Private
export const getShopItems = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { search, ordering } = req.query;
    const userId = req.user.id;

    let query = supabase
      .from('simple_shop_items')
      .select(`
        *,
        item:simple_items(*)
      `)
      .eq('shop_user_id', userId)
      .gt('quantity', 0); // exclude empty or null items roughly matches exclude(item=None) logic if we ensure items exist

    // Search filter
    if (search) {
        // This is tricky in Supabase with joined tables. 
        // We might need to filter on the joined table, which Supabase supports with !inner
        // But for simplicity, if search is provided, we can filter by item description or sku
        // Note: Supabase JS client syntax for foreign table filtering:
        // .ilike('item.description', `%${search}%`)
        // However, OR across tables is hard.
        // Let's try basic filtering on the item relation if possible, or fetch all and filter in memory (bad for perf but okay for small scale).
        // Better approach: Use !inner to filter rows where related item matches.
        // query = query.or(`description.ilike.%${search}%,sku.ilike.%${search}%`, { foreignTable: 'simple_items' });
        // Supabase postgrest-js 1.0+ syntax:
        // .select('*, item!inner(*)')
        // .or(`description.ilike.%${search}%,sku.ilike.%${search}%`, { foreignTable: 'item' });
        
        // Let's just stick to simple filtering or return all if search is complex. 
        // For now, let's assume the frontend filters or we do basic filtering.
    }

    if (ordering) {
      const orderStr = String(ordering);
      const isDesc = orderStr.startsWith('-');
      const field = isDesc ? orderStr.substring(1) : orderStr;
      
      if (field === 'sku') {
        // ordering by related column is tricky
      } else if (field === 'quantity') {
        query = query.order('quantity', { ascending: !isDesc });
      }
      // Default to some order
    }
    
    const { data, error } = await query;

    if (error) throw error;

    // Post-processing for search if needed, or improved query above.
    let result = data || [];
    
    if (search) {
        const searchLower = String(search).toLowerCase();
        result = result.filter((record: any) => 
            record.item?.description?.toLowerCase().includes(searchLower) || 
            record.item?.sku?.toLowerCase().includes(searchLower)
        );
    }

    // Post-processing for ordering by SKU
    if (ordering && (ordering === 'sku' || ordering === '-sku')) {
        const isDesc = ordering === '-sku';
        result.sort((a: any, b: any) => {
            const skuA = a.item?.sku || '';
            const skuB = b.item?.sku || '';
            return isDesc ? skuB.localeCompare(skuA) : skuA.localeCompare(skuB);
        });
    }

    // Pagination (In-Memory)
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const total = result.length;
    const from = (page - 1) * limit;
    const to = from + limit;
    
    const paginatedResult = result.slice(from, to);

    res.status(200).json({
      success: true,
      count: paginatedResult.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: paginatedResult
    });
  } catch (error) {
    next(error);
  }
};
