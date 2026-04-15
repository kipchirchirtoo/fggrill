import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { logger } from '../../utils/logger';
import { UserRole } from '../../models/User';
import * as XLSX from 'xlsx';

// Helper to check edit lock
const checkEditLock = async (isManager: boolean): Promise<void> => {
  const { data: config , error } = await supabase.from('simple_app_config').select('edit_lock').eq('id', 1).single();
  if (error) {
    console.error('Database error:', error);
    throw error;
  }
  if (config?.edit_lock && !isManager) {
    throw { status: 403, message: "Transfers are disabled as the warehouse is being maintained. Please try again later." };
  }
};

// @desc    Get app config
// @route   GET /api/store/app-config
// @access  Private
export const getAppConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('simple_app_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is no rows found
       throw error;
    }

    const config = data || {
        records_per_page: 25,
        allow_upload_deletions: false,
        edit_lock: false
    };

    res.status(200).json({
        records_per_page: config.records_per_page,
        allow_upload_deletions: config.allow_upload_deletions,
        // Add other config values if needed by frontend
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Set edit lock status
// @route   POST /api/store/set-edit-lock-status
// @access  Private (Manager)
export const setEditLockStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const isManager = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER].includes(req.user.role);
    if (!isManager) {
        res.status(403).json({ detail: "Permission denied." });
        return;
    }

    const { edit_lock_status } = req.body;
    
    // Upsert config
    const { data, error } = await supabase
        .from('simple_app_config')
        .upsert({
            id: 1,
            edit_lock: edit_lock_status
        })
        .select()
        .single();

    if (error) throw error;

    res.status(200).json({ edit_lock: data.edit_lock });
  } catch (error) {
    next(error);
  }
};

// @desc    Get edit lock status
// @route   GET /api/store/get-edit-lock-status
// @access  Public/Private
export const getEditLockStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data } = await supabase
      .from('simple_app_config')
      .select('edit_lock')
      .eq('id', 1)
      .single();

    res.status(200).json({ edit_lock: data?.edit_lock ?? false });
  } catch (error) {
    next(error);
  }
};

// @desc    Export Data (Excel)
// @route   GET /api/store/export_data
// @access  Private (Manager/Shop User)
export const exportDataExcel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isManager = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER].includes(req.user.role);

        // 1. Fetch Warehouse Stock (Items)
        // Original logic: Item.objects.filter(is_active=True)
        const { data: items } = await supabase
            .from('simple_items')
            .select('sku, description, retail_price, quantity')
            .eq('is_active', true);

        // 2. Fetch Shop Stock (ShopItems)
        // Original logic: ShopItem.objects.select_related...
        let shopQuery = supabase
            .from('simple_shop_items')
            .select(`
                quantity,
                item:simple_items(sku, description, retail_price),
                shop_user:users(email)
            `);

        if (!isManager) {
            shopQuery = shopQuery.eq('shop_user_id', req.user.id);
        }

        const { data: shopItems } = await shopQuery;

        // 3. Fetch Stock History (Managers only)
        let historyData: any[] = [];
        if (isManager) {
            const { data: history } = await supabase
                .from('stock_history')
                .select(`
                    *,
                    item:simple_items(sku, item_name),
                    user:users(email)
                `)
                .order('created_at', { ascending: false })
                .limit(1000); // Limit for performance
            historyData = history || [];
        }

        // Create Workbook
        const wb = XLSX.utils.book_new();

        // Warehouse Stock Sheet
        const wsItemsData = [['SKU', 'Barcode', 'Name', 'Description', 'Category', 'Cost Price', 'Retail Price', 'Quantity', 'Supplier']];
        if (items) {
            items.forEach((item: any) => {
                wsItemsData.push([
                    item.sku,
                    item.barcode || '',
                    item.item_name || '',
                    item.description,
                    item.category || '',
                    item.cost_price || 0,
                    item.retail_price,
                    item.quantity,
                    item.supplier || ''
                ]);
            });
        }
        const wsItems = XLSX.utils.aoa_to_sheet(wsItemsData);
        XLSX.utils.book_append_sheet(wb, wsItems, 'Warehouse Stock');

        // Shop Stock Sheet
        const wsShopData = [['Shop User', 'SKU', 'Description', 'Retail Price', 'Quantity']];
        if (shopItems) {
            shopItems.forEach((si: any) => {
                wsShopData.push([
                    si.shop_user?.email || 'Unknown',
                    si.item?.sku || 'Unknown',
                    si.item?.description || '',
                    si.item?.retail_price || 0,
                    si.quantity
                ]);
            });
        }
        const wsShop = XLSX.utils.aoa_to_sheet(wsShopData);
        XLSX.utils.book_append_sheet(wb, wsShop, 'Shop Stock');

        // Stock History Sheet
        if (isManager && historyData.length > 0) {
            const wsHistoryData = [['Date', 'SKU', 'Item Name', 'Type', 'Change', 'New Qty', 'Reason', 'User', 'Reference', 'Notes']];
            historyData.forEach((h: any) => {
                wsHistoryData.push([
                    new Date(h.created_at).toLocaleString(),
                    h.item_sku,
                    h.item?.item_name || '',
                    h.change_type,
                    h.quantity_change,
                    h.new_quantity,
                    h.reason,
                    h.user?.email || 'System',
                    h.reference || '',
                    h.notes || ''
                ]);
            });
            const wsHistory = XLSX.utils.aoa_to_sheet(wsHistoryData);
            XLSX.utils.book_append_sheet(wb, wsHistory, 'Stock History');
        }

        // Generate Buffer
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Send response
        res.setHeader('Content-Disposition', `attachment; filename="SSM_DATA_${new Date().getTime()}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);

    } catch (error) {
        next(error);
    }
};

// @desc    Import Data (Excel)
// @route   POST /api/store/import_data
// @access  Private (Manager)
export const importDataExcel = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isManager = [UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER].includes(req.user.role);
        if (!isManager) {
            res.status(403).json({ detail: "Permission denied." });
            return;
        }

        // Check config for allow_uploads
        const { data: config , error } = await supabase.from('simple_app_config').select('allow_uploads, allow_upload_deletions').eq('id', 1).single();
        if (error) {
          console.error('Database error:', error);
          throw error;
        }
        
        if (!config?.allow_uploads) {
             res.status(400).json({ detail: "Uploads are disabled in the app configuration." });
             return;
        }

        if (!req.file) {
            res.status(400).json({ detail: "No file uploaded." });
            return;
        }

        // Check config for allow_upload_deletions
        // const { data: config } = await supabase.from('simple_app_config').select('allow_upload_deletions').eq('id', 1).single();
        const allowDeletions = config?.allow_upload_deletions || false;

        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        
        const skippedSkus: string[] = [];

        // Process Warehouse Stock
        if (workbook.SheetNames.includes('Warehouse Stock')) {
            const ws = workbook.Sheets['Warehouse Stock'];
            const data: any[] = XLSX.utils.sheet_to_json(ws);
            
            const excelSkus = new Set<string>();

            for (const row of data) {
                const sku = (row as any)['SKU'];
                const description = (row as any)['Description'];
                const retail_price = (row as any)['Retail Price'];
                const quantity = (row as any)['Quantity'];

                if (!sku) continue;
                excelSkus.add(sku);

                // Sanitize price
                let price = parseFloat(retail_price);
                if (isNaN(price)) price = 0;

                // Upsert Item
                // We need to handle "is_active" logic. If created, active. If updated, make active.
                const { error } = await supabase
                    .from('simple_items')
                    .upsert({
                        sku,
                        description: description || '',
                        retail_price: price,
                        quantity: parseInt(quantity) || 0,
                        is_active: true,
                        last_updated: new Date().toISOString()
                    });
                
                if (error) logger.error(`Error importing item ${sku}:`, error);
            }

            // Handle Deletions
            if (allowDeletions) {
                // Deactivate items not in excel
                // Fetch all active skus
                const { data: allItems , error } = await supabase.from('simple_items').select('sku').eq('is_active', true);
                if (error) {
                  console.error('Database error:', error);
                  throw error;
                }
                if (allItems) {
                    const skusToDeactivate = allItems.filter(i => !excelSkus.has(i.sku)).map(i => i.sku);
                    if (skusToDeactivate.length > 0) {
                        const { error } = await supabase.from('simple_items').update({ is_active: false }).in('sku', skusToDeactivate);
                        if (error) {
                          console.error('Database error:', error);
                          throw error;
                        }
                    }
                }
            }
        }

        // Process Shop Stock
        if (workbook.SheetNames.includes('Shop Stock')) {
             const ws = workbook.Sheets['Shop Stock'];
             const data: any[] = XLSX.utils.sheet_to_json(ws);
             
             const excelShopKeys = new Set<string>(); // "email:sku"

             for (const row of data) {
                 const email = (row as any)['Shop User'];
                 const sku = (row as any)['SKU'];
                 const quantity = (row as any)['Quantity'];
                 
                 if (!email || !sku) continue;

                 // Find User ID
                 // Note: This assumes we can find user by email. 
                 // In Supabase Auth, users table usually mirrors auth.users
                 const { data: user , error: userError } = await supabase.from('users').select('id').eq('email', email).single();
                 if (userError) {
                   console.error('Database error:', userError);
                   throw userError;
                 }
                 
                 if (!user) {
                     logger.warn(`Shop user ${email} not found during import.`);
                     continue;
                 }
                 
                 // Ensure Item exists
                 // Original logic creates inactive item if missing.
                 // We will check if item exists first
                 const { data: item , error: itemError } = await supabase.from('simple_items').select('sku').eq('sku', sku).single();
                 if (itemError) {
                   console.error('Database error:', itemError);
                   throw itemError;
                 }
                 if (!item) {
                     // Create inactive item default
                     const rp = parseFloat((row as any)['Retail Price'] || '0');
                     const { error: createError } = await supabase.from('simple_items').insert({
                         sku,
                         description: (row as any)['Description'] || '',
                         retail_price: isNaN(rp) ? 0 : rp,
                         quantity: 0,
                         is_active: false
                     });

                     if (createError) {

                       console.error('Database error:', createError);

                       throw createError;

                     }
                     logger.warn(`Created inactive item ${sku} from shop stock import.`);
                 }

                 const key = `${email}:${sku}`;
                 excelShopKeys.add(key);

                 // Upsert Shop Item
                 // We need the ID to update properly if using UPSERT on (shop_user_id, item_sku) constraint
                 const { error: upsertError } = await supabase
                    .from('simple_shop_items')
                    .upsert({
                        shop_user_id: user.id,
                        item_sku: sku,
                        quantity: parseInt(quantity) || 0
                    }, { onConflict: 'shop_user_id,item_sku' });

                 if (upsertError) logger.error(`Error importing shop item ${key}:`, upsertError);
             }

             // Handle Deletions
             if (allowDeletions) {
                 // Need to fetch all shop items and verify
                 // This is complex to do efficiently with Supabase API for large datasets without a stored proc.
                 // We will skip this for now to avoid performance hit, or do a fetch all.
                 // Fetch all shop items
                 const { data: allShopItems } = await supabase
                    .from('simple_shop_items')
                    .select('id, item_sku, shop_user:users(email)');
                 
                 if (allShopItems) {
                     const idsToDelete: string[] = [];
                     allShopItems.forEach((si: any) => {
                         const key = `${si.shop_user?.email}:${si.item_sku}`;
                         if (!excelShopKeys.has(key)) {
                             idsToDelete.push(si.id);
                         }
                     });
                     
                     if (idsToDelete.length > 0) {
                         const { error } = await supabase.from('simple_shop_items').delete().in('id', idsToDelete);
                         if (error) {
                           console.error('Database error:', error);
                           throw error;
                         }
                     }
                 }
             }
        }

        res.status(200).json({ 
            detail: "Data has been processed.",
            skipped_skus: skippedSkus.length > 0 ? skippedSkus : undefined
        });

    } catch (error) {
        next(error);
    }
};
