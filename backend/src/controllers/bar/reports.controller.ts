import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';

export const getDailySales = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, date } = req.query;
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    let query = supabase
      .from('bar_orders')
      .select('total, created_at, payment_method')
      .eq('status', 'completed') // Only completed sales
      .gte('created_at', `${targetDate}T00:00:00`)
      .lte('created_at', `${targetDate}T23:59:59`);

    if (branch_id) query = query.eq('branch_id', branch_id);

    const { data, error } = await query;

    if (error) throw error;

    // Aggregate
    const totalSales = data?.reduce((sum, order) => sum + (order.total || 0), 0) || 0;
    const count = data?.length || 0;
    const byMethod = data?.reduce((acc: any, order) => {
        acc[order.payment_method] = (acc[order.payment_method] || 0) + order.total;
        return acc;
    }, {});

    res.status(200).json({ 
        success: true, 
        data: { 
            date: targetDate,
            totalSales, 
            transactionCount: count,
            byPaymentMethod: byMethod 
        } 
    });
  } catch (error) {
    next(error);
  }
};

export const getPopularDrinks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { days } = req.query;
    const daysNum = parseInt(days as string) || 7;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);

    // This requires a join and aggregation which is hard with simple Supabase client.
    // Use RPC `get_popular_bar_items` (Needs to be created)
    
    // For now, dummy response or client-side agg if volume low.
    // Let's try a simple select and aggregate in JS (not scalable but works for now).
    
    const { data, error } = await supabase
      .from('bar_order_items')
      .select('drink_name, quantity, total_price, created_at')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    const stats: Record<string, { quantity: number, revenue: number }> = {};
    
    data?.forEach(item => {
        if (!stats[item.drink_name]) {
            stats[item.drink_name] = { quantity: 0, revenue: 0 };
        }
        stats[item.drink_name].quantity += item.quantity;
        stats[item.drink_name].revenue += item.total_price;
    });

    const ranking = Object.entries(stats)
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

    res.status(200).json({ success: true, data: ranking });
  } catch (error) {
    next(error);
  }
};
