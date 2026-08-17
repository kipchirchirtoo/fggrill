import { Request, Response, NextFunction } from 'express';
import { supabase } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import * as BranchInventoryService from '../../services/branch-inventory.service';
import notificationService from '../../services/notification.service';

const SIMPLE_ITEM_SELECT = 'sku, item_name, description, quantity, store_type, is_active, cost_price';

const normalizeSku = (sku: unknown): string => {
    if (sku === null || sku === undefined) return '';
    return String(sku).trim();
};

const fetchSimpleItemsBySku = async (skus: unknown[]): Promise<Map<string, any>> => {
    const uniqueSkus = [...new Set(skus.map(normalizeSku).filter(Boolean))];
    if (uniqueSkus.length === 0) return new Map();

    const { data, error } = await supabase
        .from('simple_items')
        .select(SIMPLE_ITEM_SELECT)
        .in('sku', uniqueSkus);

    if (error) throw error;

    return new Map((data || []).map((item: any) => [normalizeSku(item.sku), item]));
};

const attachCatalogItem = (row: any, itemMap: Map<string, any>): any => {
    const sku = normalizeSku(row.item_sku);
    const item = itemMap.get(sku);
    const itemName = item?.item_name || item?.description || sku || 'Unknown item';

    return {
        ...row,
        item: item ? {
            ...item,
            category: item.store_type || null,
            unit: 'Unit',
            unit_of_measure: 'Unit'
        } : {
            sku,
            item_name: itemName,
            description: null,
            category: null,
            unit: 'Unit',
            unit_of_measure: 'Unit',
            quantity: null
        },
        item_name: itemName,
        unit: 'Unit',
        unit_of_measure: 'Unit',
        cost_price: item?.cost_price ?? 0
    };
};

// Stamp requested/approved quantities from the originating stock request
// onto dispatch items — dispatch_items only stores what was actually packed,
// so without this the dispatch views can't show requested vs approved vs
// dispatched. approved_quantity already stored on the dispatch line wins.
const attachRequestQuantities = async (
    dispatches: Array<{ id: any; stock_request_id?: any }>,
    items: any[]
): Promise<void> => {
    const requestIds = [...new Set(dispatches.map(d => d.stock_request_id).filter(Boolean))];
    if (!requestIds.length || !items.length) return;

    const CHUNK_SIZE = 15;
    const requestLines: any[] = [];
    for (let i = 0; i < requestIds.length; i += CHUNK_SIZE) {
        const chunk = requestIds.slice(i, i + CHUNK_SIZE);
        const { data: chunkLines } = await supabase
            .from('stock_request_items')
            .select('request_id, item_sku, requested_quantity, approved_quantity')
            .in('request_id', chunk);
        if (chunkLines && chunkLines.length > 0) {
            requestLines.push(...chunkLines);
        }
    }
    if (!requestLines.length) return;

    const requestIdByDispatchId = new Map(
        dispatches.map(d => [String(d.id), String(d.stock_request_id || '')])
    );
    const normalizeKey = (requestId: any, sku: any) =>
        `${requestId}|${String(sku || '').trim().toUpperCase()}`;
    const lineByKey = new Map(
        requestLines.map((l: any) => [normalizeKey(l.request_id, l.item_sku), l])
    );

    for (const item of items) {
        const requestId = requestIdByDispatchId.get(String(item.dispatch_id));
        if (!requestId) continue;
        const line = lineByKey.get(normalizeKey(requestId, item.item_sku));
        if (!line) continue;
        item.requested_quantity = line.requested_quantity;
        if (item.approved_quantity === null || item.approved_quantity === undefined) {
            item.approved_quantity = line.approved_quantity;
        }
    }
};

const fetchDispatchItemsWithCatalog = async (
    dispatchId: string,
    stockRequestId?: string | null
): Promise<any[]> => {
    const { data: items, error } = await supabase
        .from('dispatch_items')
        .select('*')
        .eq('dispatch_id', dispatchId);

    if (error) throw error;

    if (stockRequestId) {
        await attachRequestQuantities(
            [{ id: dispatchId, stock_request_id: stockRequestId }],
            items || []
        );
    }

    const itemMap = await fetchSimpleItemsBySku((items || []).map((item: any) => item.item_sku));
    return (items || []).map((item: any) => attachCatalogItem(item, itemMap));
};

// @desc    Get all dispatch notes
// @route   GET /api/dispatch-notes
// @access  Private
export const getDispatchNotes = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { from_branch_id, to_branch_id, status, from_date, to_date } = req.query;
        const user = req.user;
        const isCentral = ['admin', 'general_manager'].includes(user?.role || '');

        let query = supabase
            .from('dispatch_notes')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply filters
        if (from_branch_id) {
            query = query.eq('from_branch_id', from_branch_id);
        }

        // If not central, only show dispatches to the user's branch
        if (!isCentral && user?.branch_id) {
            query = query.eq('to_branch_id', user.branch_id);
        } else if (to_branch_id) {
            query = query.eq('to_branch_id', to_branch_id);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (from_date) {
            query = query.gte('created_at', from_date);
        }
        if (to_date) {
            query = query.lte('created_at', to_date);
        }

        const { data: dispatches, error } = await query;

        if (error) throw error;

        if (!dispatches || dispatches.length === 0) {
            res.status(200).json({
                success: true,
                count: 0,
                data: []
            });
            return;
        }

        // Get branch details
        const branchIds = [...new Set([...dispatches.map(d => d.from_branch_id), ...dispatches.map(d => d.to_branch_id)])];
        const { data: branches } = await supabase
            .from('branches')
            .select('id, name, code')
            .in('id', branchIds);

        // Get dispatch items
        const dispatchIds = dispatches.map(d => d.id);
        const { data: items } = await supabase
            .from('dispatch_items')
            .select('*')
            .in('dispatch_id', dispatchIds);

        // Show requested vs approved vs dispatched on every dispatch line.
        await attachRequestQuantities(dispatches, items || []);

        // Get item details
        const itemSkus = [...new Set(items?.map(i => i.item_sku) || [])];
        const { data: itemDetails } = await supabase
            .from('simple_items')
            .select(SIMPLE_ITEM_SELECT)
            .in('sku', itemSkus);

        // Get vehicle and driver details
        const vehicleIds = dispatches.map(d => d.vehicle_id).filter(Boolean);
        const driverIds = dispatches.map(d => d.driver_id).filter(Boolean);

        const { data: vehicles } = vehicleIds.length > 0 ? await supabase
            .from('vehicles')
            .select('id, registration_number, model')
            .in('id', vehicleIds) : { data: [] };

        const driversTableIds = driverIds.filter(id => !id.startsWith('staff-'));
        const staffIds = driverIds.filter(id => id.startsWith('staff-')).map(id => id.replace('staff-', ''));

        const { data: tableDrivers } = driversTableIds.length > 0 ? await supabase
            .from('drivers')
            .select('id, name, license_number, phone')
            .in('id', driversTableIds) : { data: [] };

        const { data: staffDrivers } = staffIds.length > 0 ? await supabase
            .from('staff_profiles')
            .select('id, first_name, last_name, phone')
            .in('id', staffIds) : { data: [] };

        const drivers = [
            ...(tableDrivers || []),
            ...(staffDrivers || []).map(s => ({
                id: `staff-${s.id}`,
                name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
                phone: s.phone,
                license_number: null
            }))
        ];

        // Map data
        const enrichedDispatches = dispatches.map(dispatch => {
            const vehicle = vehicles?.find(v => v.id === dispatch.vehicle_id);
            const driver = drivers?.find(d => d.id === dispatch.driver_id);
            const toBranch = branches?.find(b => b.id === dispatch.to_branch_id);

            return {
                ...dispatch,
                from_branch: branches?.find(b => b.id === dispatch.from_branch_id),
                to_branch: toBranch,
                to_branch_name: toBranch?.name || 'Unknown Branch',
                items: items?.filter(i => i.dispatch_id === dispatch.id).map(i => {
                    const details = itemDetails?.find(d => d.sku === i.item_sku);
                    return {
                        ...i,
                        item: details ? {
                            ...details,
                            category: details.store_type || null,
                            unit: 'Unit',
                            unit_of_measure: 'Unit'
                        } : null,
                        item_name: details?.item_name || details?.description || i.item_sku,
                        unit: 'Unit',
                        unit_of_measure: 'Unit'
                    };
                }) || [],
                vehicle,
                vehicle_registration: vehicle?.registration_number || dispatch.vehicle_number,
                driver,
                driver_name: driver?.name || dispatch.driver_name
            };
        });

        res.status(200).json({
            success: true,
            count: enrichedDispatches.length,
            data: enrichedDispatches
        });
    } catch (error) {
        logger.error('Error fetching dispatch notes:', error);
        // Return empty list instead of crashing
        res.status(200).json({
            success: true,
            count: 0,
            data: []
        });
    }
};

// @desc    Get single dispatch note
// @route   GET /api/dispatch-notes/:id
// @access  Private
export const getDispatchNote = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        const { data: dispatch, error } = await supabase
            .from('dispatch_notes')
            .select(`
        *,
        from_branch:branches!from_branch_id(id, name, code, contact_person),
        to_branch:branches!to_branch_id(id, name, code, contact_person),
        created_by_user:users!created_by(id, first_name, last_name, email),
        picker:users!picker_id(id, first_name, last_name),
        packer:users!packer_id(id, first_name, last_name),
        dispatcher:users!dispatcher_id(id, first_name, last_name),
        receiver:users!receiver_id(id, first_name, last_name)
      `)
            .eq('id', id)
            .maybeSingle();

        if (error) {
            logger.error(`Error fetching dispatch ${id}:`, error);
            throw new AppError(`Failed to fetch dispatch: ${error.message}`, 500);
        }

        if (!dispatch) {
            throw new AppError('Dispatch note not found', 404);
        }

        // Fetch stock request separately if it exists
        if (dispatch.stock_request_id) {
            const { data: stockRequest, error: requestError } = await supabase
                .from('stock_requests')
                .select('id, request_number, priority')
                .eq('id', dispatch.stock_request_id)
                .maybeSingle();

            if (!requestError && stockRequest) {
                dispatch.stock_request = stockRequest;
            }
        }

        // Fetch dispatch items separately with item details
        dispatch.items = await fetchDispatchItemsWithCatalog(id, dispatch.stock_request_id);

        res.status(200).json({
            success: true,
            data: dispatch
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new dispatch note
// @route   POST /api/dispatch-notes
// @access  Private (Central Ops)
// @desc    Create new dispatch note
// @route   POST /api/dispatch-notes
// @access  Private (Central Ops)
export const createDispatchNote = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const {
            stock_request_id,
            request_id,
            from_branch_id,
            to_branch_id,
            vehicle_number,
            driver_name,
            driver_phone,
            estimated_delivery,
            dispatch_notes,
            items
        } = req.body;

        const userId = req.user?.id;
        const finalRequestId = stock_request_id || request_id;

        logger.info('Creating dispatch note with data:', {
            finalRequestId,
            from_branch_id,
            to_branch_id,
            itemsCount: items?.length,
            userId
        });

        // Handle creation from request ID — always prefer this path when request_id is supplied
        if (finalRequestId) {
            // 1. Get Central Warehouse
            const central = await BranchInventoryService.getCentralWarehouse();
            if (!central) {
                logger.error('Central warehouse not configured');
                throw new AppError('Central warehouse not configured', 500);
            }

            // 2. Get Request Details (simple select — no embedded join on view)
            const { data: request, error: requestError } = await supabase
                .from('stock_requests')
                .select('*')
                .eq('id', finalRequestId)
                .maybeSingle();

            if (requestError) {
                logger.error('Error fetching stock request:', requestError);
                throw new AppError(`Stock request not found: ${requestError.message}`, 500);
            }

            if (!request) {
                throw new AppError('Stock request not found', 404);
            }

            // 3. Resolve requesting branch code separately
            const destBranchId = request.requesting_branch_id || request.branch_id;
            const { data: branchData } = await supabase
                .from('branches')
                .select('code')
                .eq('id', destBranchId)
                .maybeSingle();
            const branchCode = branchData?.code || `BR${destBranchId}`;

            // 4. Get Request Items from DB (ignore any client-provided items)
            const { data: requestItems, error: itemsError } = await supabase
                .from('stock_request_items')
                .select('*')
                .eq('request_id', finalRequestId);

            if (itemsError) {
                logger.error('Error fetching request items:', itemsError);
                throw new AppError(`Failed to fetch request items: ${itemsError.message}`, 500);
            }

            if (!requestItems || requestItems.length === 0) {
                throw new AppError('No items found in this request', 400);
            }

            // Use approved_quantity if available, otherwise use requested_quantity for approved requests
            const dispatchItems = requestItems.map((item: any) => ({
                item_sku: item.item_sku,
                dispatched_quantity: item.approved_quantity || item.requested_quantity,
                status: 'PENDING'
            }));

            // 5. Create Dispatch
            const dispatch = await BranchInventoryService.createDispatchFromRequest(
                finalRequestId,
                central.id,
                destBranchId,
                branchCode,
                userId,
                dispatchItems,
                vehicle_number,
                driver_name,
                driver_phone,
                estimated_delivery,
                dispatch_notes
            );

            res.status(201).json({
                success: true,
                data: dispatch
            });

            // Notify branch storekeeper that their stock is on the way
            notificationService.notifyRole(
                'branch_storekeeper',
                'Stock Dispatched — En Route',
                `Your approved request has been packed and dispatched from central store (${dispatch?.dispatch_number ?? ''}). Please prepare to receive the goods.`,
                {
                    type: 'success',
                    category: 'dispatch',
                    priority: 'high',
                    actionUrl: `/dashboard/branch-store/requests`,
                    branchId: request?.requesting_branch_id ?? null,
                    metadata: { request_id: finalRequestId, dispatch_id: dispatch?.id }
                }
            ).catch(e => logger.error('Failed to notify branch_storekeeper of dispatch', e));

            return;
        }

        if (!from_branch_id || !to_branch_id || !items || items.length === 0) {
            throw new AppError('From branch, to branch, and items are required', 400);
        }

        // Get destination branch code for dispatch number generation
        const { data: branch, error: branchError } = await supabase
            .from('branches')
            .select('code')
            .eq('id', to_branch_id)
            .maybeSingle();

        if (branchError) {
            logger.error('Error fetching branch:', branchError);
            throw new AppError(`Failed to fetch branch: ${branchError.message}`, 500);
        }

        if (!branch) {
            throw new AppError('Destination branch not found', 404);
        }

        // Generate dispatch number using database function
        const { data: dispatchNumberData, error: numberError } = await supabase
            .rpc('get_next_dispatch_number', { p_branch_code: branch.code });

        if (numberError) {
            logger.error('Error generating dispatch number:', numberError);
            // Fallback to manual generation if function doesn't exist
            const timestamp = Date.now().toString().slice(-6);
            const dispatch_number = `DN-${branch.code}-${timestamp}`;
            logger.info('Using fallback dispatch number:', dispatch_number);
            
            // Continue with fallback number
            const { data: newDispatch, error: dispatchError } = await supabase
                .from('dispatch_notes')
                .insert({
                    dispatch_number,
                    stock_request_id: stock_request_id || null,
                    from_branch_id,
                    to_branch_id,
                    created_by: userId,
                    vehicle_number: vehicle_number || null,
                    driver_name: driver_name || null,
                    driver_phone: driver_phone || null,
                    estimated_delivery: estimated_delivery || null,
                    dispatch_notes: dispatch_notes || null,
                    status: 'DRAFT'
                })
                .select();

            if (dispatchError) {
                logger.error('Error creating dispatch note:', dispatchError);
                throw new AppError(`Failed to create dispatch: ${dispatchError.message}`, 500);
            }

            if (!newDispatch || newDispatch.length === 0) {
                throw new AppError('Failed to create dispatch note', 500);
            }

            const createdDispatch = newDispatch[0];

            // Insert dispatch items
            const dispatchItems = items.map((item: any) => ({
                dispatch_id: createdDispatch.id,
                item_sku: item.item_sku,
                dispatched_quantity: item.dispatched_quantity || item.quantity,
                batch_number: item.batch_number || null,
                expiry_date: item.expiry_date || null,
                bin_location: item.bin_location || null,
                status: 'PENDING'
            }));

            const { error: itemsError } = await supabase
                .from('dispatch_items')
                .insert(dispatchItems);

            if (itemsError) {
                logger.error('Error inserting dispatch items:', itemsError);
                throw new AppError(`Failed to add items: ${itemsError.message}`, 500);
            }

            // Fetch complete dispatch with items
            const { data: completeDispatch } = await supabase
                .from('dispatch_notes')
                .select(`
                    *,
                    from_branch:branches!from_branch_id(id, name, code),
                    to_branch:branches!to_branch_id(id, name, code)
                `)
                .eq('id', createdDispatch.id)
                .maybeSingle();

            // Fetch dispatch items separately
            if (completeDispatch) {
                completeDispatch.items = await fetchDispatchItemsWithCatalog(
                    createdDispatch.id, completeDispatch.stock_request_id);
            }

            res.status(201).json({
                success: true,
                data: completeDispatch
            });

            // Notify branch storekeeper at destination branch
            notificationService.notifyRole(
                'branch_storekeeper',
                'Stock Dispatched — En Route',
                `Stock has been packed and dispatched from central store. Please prepare to receive the goods.`,
                {
                    type: 'success',
                    category: 'dispatch',
                    priority: 'high',
                    actionUrl: `/dashboard/branch-store/requests`,
                    branchId: to_branch_id ?? null,
                    metadata: { dispatch_id: createdDispatch.id }
                }
            ).catch(e => logger.error('Failed to notify branch_storekeeper of dispatch (fallback path)', e));

            return;
        }

        const dispatch_number = dispatchNumberData;

        // Create dispatch note
        const { data: newDispatch, error: dispatchError } = await supabase
            .from('dispatch_notes')
            .insert({
                dispatch_number,
                stock_request_id: stock_request_id || null,
                from_branch_id,
                to_branch_id,
                created_by: userId,
                vehicle_number: vehicle_number || null,
                driver_name: driver_name || null,
                driver_phone: driver_phone || null,
                estimated_delivery: estimated_delivery || null,
                dispatch_notes: dispatch_notes || null,
                status: 'DRAFT'
            })
            .select();

        if (dispatchError) {
            logger.error('Error creating dispatch note:', dispatchError);
            throw new AppError(`Failed to create dispatch: ${dispatchError.message}`, 500);
        }

        if (!newDispatch || newDispatch.length === 0) {
            throw new AppError('Failed to create dispatch note', 500);
        }

        const createdDispatch2 = newDispatch[0];

        // Insert dispatch items
        const dispatchItems = items.map((item: any) => ({
            dispatch_id: createdDispatch2.id,
            item_sku: item.item_sku,
            dispatched_quantity: item.dispatched_quantity || item.quantity,
            batch_number: item.batch_number || null,
            expiry_date: item.expiry_date || null,
            bin_location: item.bin_location || null,
            status: 'PENDING'
        }));

        const { error: itemsError } = await supabase
            .from('dispatch_items')
            .insert(dispatchItems);

        if (itemsError) {
            logger.error('Error inserting dispatch items:', itemsError);
            throw new AppError(`Failed to add items: ${itemsError.message}`, 500);
        }

        // Fetch complete dispatch with items
        const { data: completeDispatch } = await supabase
            .from('dispatch_notes')
            .select(`
                *,
                from_branch:branches!from_branch_id(id, name, code),
                to_branch:branches!to_branch_id(id, name, code)
            `)
            .eq('id', createdDispatch2.id)
            .maybeSingle();

        // Fetch dispatch items separately
        if (completeDispatch) {
            completeDispatch.items = await fetchDispatchItemsWithCatalog(
                createdDispatch2.id, completeDispatch.stock_request_id);
        }

        res.status(201).json({
            success: true,
            data: completeDispatch
        });

        // Notify branch storekeeper at destination branch
        notificationService.notifyRole(
            'branch_storekeeper',
            'Stock Dispatched — En Route',
            `Stock dispatch ${dispatch_number} has been created and is en route to your branch. Please prepare to receive the goods.`,
            {
                type: 'success',
                category: 'dispatch',
                priority: 'high',
                actionUrl: `/dashboard/branch-store/requests`,
                branchId: to_branch_id ?? null,
                metadata: { dispatch_id: createdDispatch2.id }
            }
        ).catch(e => logger.error('Failed to notify branch_storekeeper of dispatch (main path)', e));
    } catch (error: any) {
        logger.error('Error creating dispatch note:', {
            error: error.message,
            stack: error.stack,
            body: req.body
        });
        next(error);
    }
};

// @desc    Update dispatch status
// @route   PUT /api/dispatch-notes/:id/status
// @access  Private
export const updateDispatchStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;
        const userId = req.user?.id;

        const updateData: any = {
            status,
            updated_at: new Date().toISOString()
        };

        // Set timestamps based on status
        switch (status) {
            case 'PICKING':
                updateData.picker_id = userId;
                break;
            case 'PACKING':
                updateData.picked_at = new Date().toISOString();
                updateData.packer_id = userId;
                break;
            case 'READY':
                updateData.packed_at = new Date().toISOString();
                break;
            case 'IN_TRANSIT':
                updateData.dispatched_at = new Date().toISOString();
                updateData.dispatcher_id = userId;

                // Reserve stock in central warehouse
                const { data: dispatch, error: dispatchFetchError } = await supabase
                    .from('dispatch_notes')
                    .select('from_branch_id')
                    .eq('id', id)
                    .maybeSingle();

                if (dispatchFetchError) {
                    logger.error('Error fetching dispatch for stock update:', dispatchFetchError);
                    throw dispatchFetchError;
                }

                // Fetch dispatch items separately
                const { data: dispatchItems, error: itemsFetchError } = await supabase
                    .from('dispatch_items')
                    .select('item_sku, dispatched_quantity')
                    .eq('dispatch_id', id);

                if (itemsFetchError) {
                    logger.error('Error fetching dispatch items for stock update:', itemsFetchError);
                    throw itemsFetchError;
                }

                if (dispatch && dispatchItems) {
                    // Type assertion to add items property
                    const dispatchWithItems = dispatch as typeof dispatch & { items: typeof dispatchItems };
                    dispatchWithItems.items = dispatchItems;
                    for (const item of dispatchWithItems.items) {
                        // Deduct from central warehouse stock
                        const { error: stockError } = await supabase.rpc('update_branch_stock', {
                            p_branch_id: dispatch.from_branch_id,
                            p_item_sku: item.item_sku,
                            p_qty_delta: -item.dispatched_quantity
                        });

                        if (stockError) {
                          console.error('Database error:', stockError);
                          throw stockError;
                        }

                        // Add to in-transit stock
                        await supabase
                            .from('in_transit_stock')
                            .insert({
                                dispatch_id: id,
                                item_sku: item.item_sku,
                                quantity: item.dispatched_quantity
                            });
                    }
                }
                break;
            case 'DELIVERED':
                updateData.delivered_at = new Date().toISOString();
                break;
            case 'CONFIRMED':
                updateData.confirmed_at = new Date().toISOString();
                updateData.receiver_id = userId;
                break;
        }

        if (notes) {
            updateData.delivery_notes = notes;
        }

        const { data: dispatch, error } = await supabase
            .from('dispatch_notes')
            .update(updateData)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!dispatch || dispatch.length === 0) {
            throw new AppError('Dispatch note not found or could not be updated', 404);
        }

        res.status(200).json({
            success: true,
            message: `Dispatch status updated to ${status}`,
            data: dispatch[0]
        });
    } catch (error) {
        logger.error('Error updating dispatch status:', error);
        next(error);
    }
};

// @desc    Dispatch items (set to IN_TRANSIT and deduct stock)
// @route   PUT /api/dispatch-notes/:id/dispatch
// @access  Private
export const dispatchItems = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?.id;

        // Get dispatch details
        const { data: dispatch, error: fetchError } = await supabase
            .from('dispatch_notes')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (fetchError) {
            logger.error(`Error fetching dispatch ${id}:`, fetchError);
            throw new AppError(`Failed to fetch dispatch: ${fetchError.message}`, 500);
        }

        if (!dispatch) {
            throw new AppError('Dispatch note not found', 404);
        }

        // Fetch dispatch items separately
        const { data: items, error: itemsError } = await supabase
            .from('dispatch_items')
            .select('*')
            .eq('dispatch_id', id);

        if (itemsError) {
            logger.error(`Error fetching dispatch items for ${id}:`, itemsError);
            throw new AppError(`Failed to fetch dispatch items: ${itemsError.message}`, 500);
        }

        dispatch.items = items || [];

        if (dispatch.status === 'IN_TRANSIT') {
            throw new AppError('Dispatch is already in transit', 400);
        }

        const { vehicle_id, driver_id, vehicle_number, driver_name, driver_phone, estimated_delivery, notes } = req.body;

        // Resolve vehicle and driver names from IDs if not provided as text
        let resolvedVehicleNumber = vehicle_number || '';
        let resolvedDriverName = driver_name || '';
        let resolvedDriverPhone = driver_phone || '';

        if (vehicle_id && !resolvedVehicleNumber) {
            const { data: vehicle, error: vehicleError } = await supabase.from('vehicles')
                .select('registration_number').eq('id', vehicle_id).maybeSingle();
            
            if (vehicleError) {
              // Vehicle lookup is optional - log warning and continue
              logger.warn(`Could not fetch vehicle ${vehicle_id}: ${vehicleError.message || 'Unknown error'}`);
            } else if (vehicle) {
              resolvedVehicleNumber = vehicle.registration_number;
            }
        }

        if (driver_id && !resolvedDriverName) {
            if (driver_id.startsWith('staff-')) {
                const staffId = driver_id.replace('staff-', '');
                const { data: staff, error: staffError } = await supabase.from('staff_profiles')
                    .select('first_name, last_name, phone').eq('id', staffId).maybeSingle();
                
                if (staffError) {
                  // Staff lookup is optional - log warning and continue
                  logger.warn(`Could not fetch staff ${staffId}: ${staffError.message || 'Unknown error'}`);
                } else if (staff) {
                    resolvedDriverName = `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
                    if (!resolvedDriverPhone) resolvedDriverPhone = staff.phone || '';
                }
            } else {
                const { data: driver, error: driverError } = await supabase.from('drivers')
                    .select('name, phone').eq('id', driver_id).maybeSingle();
                
                if (driverError) {
                  // Driver lookup is optional - log warning and continue
                  logger.warn(`Could not fetch driver ${driver_id}: ${driverError.message || 'Unknown error'}`);
                } else if (driver) {
                    resolvedDriverName = driver.name;
                    if (!resolvedDriverPhone) resolvedDriverPhone = driver.phone || '';
                }
            }
        }

        const updates: any = {};
        if (vehicle_id) updates.vehicle_id = vehicle_id;
        if (driver_id) updates.driver_id = driver_id;
        if (resolvedVehicleNumber) updates.vehicle_number = resolvedVehicleNumber;
        if (resolvedDriverName) updates.driver_name = resolvedDriverName;
        if (resolvedDriverPhone) updates.driver_phone = resolvedDriverPhone;
        if (estimated_delivery) updates.estimated_delivery = estimated_delivery;
        if (notes) updates.notes = notes;

        // Perform validation, status update, and stock deduction centrally
        const result = await BranchInventoryService.dispatchItems(
            id,
            userId,
            updates,
            req.idempotencyKey || null
        );

        res.status(200).json({
            success: true,
            message: 'Dispatch sent to transit successfully',
            data: result
        });
    } catch (error) {
        logger.error('Error dispatching items:', error);
        next(error);
    }
};

// @desc    Confirm delivery and update receiving branch stock
// @route   PUT /api/dispatch-notes/:id/confirm-delivery
// @access  Private
export const confirmDelivery = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;
        const { received_items, items_received, delivery_notes, discrepancy_notes, notes: bodyNotes } = req.body;
        const items = items_received || received_items || [];
        const notes = discrepancy_notes || delivery_notes || bodyNotes;

        if (!items || !Array.isArray(items)) {
            throw new AppError('items_received or received_items array is required', 400);
        }

        const result = await BranchInventoryService.confirmDelivery(
            id,
            req.user?.id,
            items,
            notes,
            req.idempotencyKey || null
        );

        res.status(200).json({
            success: true,
            message: `Delivery confirmed and stock updated`,
            data: result
        });
    } catch (error) {
        logger.error('Error confirming delivery:', error);
        next(error);
    }
};

// @desc    Delete dispatch note (only if DRAFT)
// @route   DELETE /api/dispatch-notes/:id
// @access  Private
export const deleteDispatchNote = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { id } = req.params;

        // Check if dispatch is in DRAFT status
        const { data: dispatch, error: fetchError } = await supabase
            .from('dispatch_notes')
            .select('status')
            .eq('id', id)
            .maybeSingle();

        if (fetchError) {
            logger.error(`Error fetching dispatch ${id}:`, fetchError);
            throw new AppError(`Failed to fetch dispatch: ${fetchError.message}`, 500);
        }

        if (!dispatch) {
            throw new AppError('Dispatch note not found', 404);
        }

        if (dispatch.status !== 'DRAFT') {
            throw new AppError('Only draft dispatches can be deleted', 400);
        }

        const { error } = await supabase
            .from('dispatch_notes')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Dispatch note deleted'
        });
    } catch (error) {
        logger.error('Error deleting dispatch note:', error);
        next(error);
    }
};
