import { Request, Response, NextFunction } from "express";
import { supabase } from "../../config/database";
import { AppError } from "../../middleware/errorHandler";
import { logger } from "../../utils/logger";
import { emailService } from "../../services/email.service";
import {
  applyModuleBranchFilter,
  setModuleBranchOnCreate,
  SourceModule,
} from "../../middleware/moduleAccess";

const toNumber = (value: any): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve PO line identifiers against the inventory catalog, mutating each
 * line with item_sku / item_uuid / item_name / item_unit. Lines may carry
 * either the catalog sku (bulk-paste create flow) or the inventory_items
 * UUID — drafts reopened for editing send back store_po_items.item_id, so a
 * sku-only lookup 400'd every "Update Draft"/"Submit" from the edit screen.
 */
const resolvePoLineItems = async (items: any[]): Promise<void> => {
  if (!items.length) return;

  const identifiers = [...new Set(items.map((item: any) => String(item.item_id)))];
  const skus = identifiers.filter((v) => !UUID_RE.test(v));
  const uuids = identifiers.filter((v) => UUID_RE.test(v));

  const [bySkuRes, byIdRes] = await Promise.all([
    skus.length
      ? supabase.from("inventory_items").select("id, sku, item_name, unit").in("sku", skus)
      : Promise.resolve({ data: [] as any[], error: null }),
    uuids.length
      ? supabase.from("inventory_items").select("id, sku, item_name, unit").in("id", uuids)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const resolveError = bySkuRes.error || byIdRes.error;
  if (resolveError) {
    logger.error("PO item resolution error:", resolveError);
    throw new AppError(
      `Error resolving item identifiers: ${resolveError.message}`,
      500,
    );
  }

  const bySku = new Map(
    (bySkuRes.data || []).map((item: any) => [String(item.sku), item]),
  );
  const byId = new Map(
    (byIdRes.data || []).map((item: any) => [String(item.id), item]),
  );

  for (const item of items) {
    const key = String(item.item_id);
    const resolved = UUID_RE.test(key) ? byId.get(key) : bySku.get(key);
    if (!resolved) {
      throw new AppError(`Item not found with SKU: ${item.item_id}`, 400);
    }
    item.item_sku = resolved.sku || key;
    item.item_uuid = resolved.id;
    item.item_name = resolved.item_name;
    item.item_unit = resolved.unit;
  }
};

const activeInvoiceStatuses = new Set([
  "draft",
  "submitted",
  "approved",
  "partially_paid",
  "paid",
  "open",
]);

const computeFinanceStatus = (args: {
  grnCount: number;
  invoiceCount: number;
  amountPaid: number;
  balanceDue: number;
  invoices: any[];
}): string => {
  if (args.grnCount === 0) return "Awaiting Receipt";
  if (args.invoiceCount === 0) return "Pending Bill";
  if (args.invoiceCount > 0 && args.balanceDue <= 0.0001) return "Paid / Closed";
  if (args.amountPaid > 0) return "Partially Paid";
  if (
    args.invoices.some((invoice: any) =>
      ["approved", "submitted", "open"].includes(
        String(invoice.status || "").toLowerCase(),
      ),
    )
  ) {
    return "Approved for Payment";
  }
  return "Billed";
};

const enrichPurchaseOrdersWithFinance = async (orders: any[]): Promise<any[]> => {
  const orderIds = orders.map((order) => order.id).filter(Boolean);
  if (orderIds.length === 0) return orders;

  const { data: grns, error: grnError } = await supabase
    .from("store_grn")
    .select("id, purchase_order_id, grn_number, grn_date, total_value, status, delivery_note_number, invoice_number, created_at")
    .in("purchase_order_id", orderIds);
  if (grnError) throw grnError;

  const { data: invoices, error: invoiceError } = await supabase
    .from("store_supplier_invoices")
    .select("id, po_id, grn_id, invoice_number, invoice_date, due_date, status, total_amount, amount_paid, balance_due, supplier_id")
    .in("po_id", orderIds);
  if (invoiceError) throw invoiceError;

  const invoiceIds = (invoices || []).map((invoice: any) => invoice.id).filter(Boolean);
  let allocations: any[] = [];
  if (invoiceIds.length > 0) {
    const { data: allocationRows, error: allocationError } = await supabase
      .from("store_payment_invoice_allocations")
      .select(`
        id,
        invoice_id,
        payment_id,
        allocated_amount,
        payment:store_supplier_payments(id, payment_number, payment_date, payment_method, reference_number, status, payment_amount)
      `)
      .in("invoice_id", invoiceIds);
    if (allocationError) throw allocationError;
    allocations = allocationRows || [];
  }

  return orders.map((order) => {
    const orderGrns = (grns || []).filter((grn: any) => grn.purchase_order_id === order.id);
    const orderInvoices = (invoices || [])
      .filter((invoice: any) => invoice.po_id === order.id || orderGrns.some((grn: any) => grn.id === invoice.grn_id))
      .filter((invoice: any) => activeInvoiceStatuses.has(String(invoice.status || "").toLowerCase()));
    const orderInvoiceIds = new Set(orderInvoices.map((invoice: any) => invoice.id));
    const orderAllocations = allocations.filter((allocation: any) => orderInvoiceIds.has(allocation.invoice_id));
    const payments = orderAllocations
      .map((allocation: any) => ({
        ...allocation.payment,
        allocated_amount: toNumber(allocation.allocated_amount),
        invoice_id: allocation.invoice_id,
      }))
      .filter((payment: any) => payment && payment.id);

    const amountBilled = orderInvoices.reduce((sum: number, invoice: any) => sum + toNumber(invoice.total_amount), 0);
    const amountPaid = orderInvoices.reduce((sum: number, invoice: any) => {
      const directPaid = toNumber(invoice.amount_paid);
      if (directPaid > 0) return sum + directPaid;
      return sum + orderAllocations
        .filter((allocation: any) => allocation.invoice_id === invoice.id)
        .reduce((allocationSum: number, allocation: any) => allocationSum + toNumber(allocation.allocated_amount), 0);
    }, 0);
    const balanceDue = orderInvoices.reduce((sum: number, invoice: any) => {
      const explicitBalance = invoice.balance_due == null ? null : toNumber(invoice.balance_due);
      if (explicitBalance != null) return sum + explicitBalance;
      return sum + Math.max(0, toNumber(invoice.total_amount) - toNumber(invoice.amount_paid));
    }, 0);

    return {
      ...order,
      grns: orderGrns,
      supplier_invoices: orderInvoices,
      supplier_payments: payments,
      grn_count: orderGrns.length,
      invoice_count: orderInvoices.length,
      amount_billed: amountBilled,
      amount_paid: amountPaid,
      balance_due: balanceDue,
      finance_status: computeFinanceStatus({
        grnCount: orderGrns.length,
        invoiceCount: orderInvoices.length,
        amountPaid,
        balanceDue,
        invoices: orderInvoices,
      }),
    };
  });
};

// @desc    Get all purchase orders
// @route   GET /api/purchase-orders
// @access  Private
export const getPurchaseOrders = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { status, from_date, to_date, supplier_id, store_type } = req.query;
    const user = (req as any).user;
    const sourceModule = (req as any).sourceModule;
    const enforcedBranchId = (req as any).enforcedBranchId;

    let query = supabase
      .from("store_purchase_orders")
      .select(
        `
                *,
                supplier:store_suppliers(id, name, supplier_code, branch_id)
            `,
      )
      .order("created_at", { ascending: false });

    // CRITICAL: Apply module and branch filters at query level
    query = applyModuleBranchFilter(query, req);

    // Apply additional filters
    if (supplier_id) query = query.eq("supplier_id", supplier_id);
    if (status) query = query.eq("status", (status as string).toLowerCase());
    if (from_date) query = query.gte("po_date", from_date);
    if (to_date) query = query.lte("po_date", to_date);

    const { data: orders, error: ordersError } = await query;
    if (ordersError) throw ordersError;

    if (!orders || orders.length === 0) {
      res.status(200).json({ success: true, count: 0, data: [] });
      return;
    }

    // No post-fetch filtering needed - database query handles it
    let filteredOrders = orders;

    // 1. Get all items for these orders
    const orderIds = filteredOrders.map((o) => o.id);
    const { data: allItems, error: itemsError } = await supabase
      .from("store_po_items")
      .select("*")
      .in("purchase_order_id", orderIds);

    if (itemsError) throw itemsError;

    // 2. Get inventory_items details for these items
    const skus = [...new Set(allItems?.map((i) => i.sku).filter(Boolean) || [])];
    const { data: itemDetails, error: detailsError } = await supabase
      .from("inventory_items")
      .select("id, sku, item_name, unit")
      .in("sku", skus);

    if (detailsError) throw detailsError;

    // 3. Merge data
    let enrichedOrders = filteredOrders.map((order) => {
      const orderItems = (allItems || [])
        .filter((i) => i.purchase_order_id === order.id)
        .map((i) => {
          const detail = (itemDetails || []).find((d) => d.sku === i.sku);
          const resolvedName = i.item_name || detail?.item_name || i.sku;
          return {
            ...i,
            item: detail
              ? {
                  ...detail,
                  name: resolvedName,
                }
              : null,
            item_name: resolvedName,
            unit_of_measure: i.unit || detail?.unit || null,
          };
        });

      return {
        ...order,
        supplier_name: order.supplier?.name || "N/A",
        items: orderItems,
      };
    });

    // Filter by store_type if specified
    if (store_type) {
      enrichedOrders = enrichedOrders.filter((order) =>
        order.items.some((i: any) => i.item?.store_type === store_type),
      );
    }

    enrichedOrders = await enrichPurchaseOrdersWithFinance(enrichedOrders);

    res.status(200).json({
      success: true,
      count: enrichedOrders.length,
      data: enrichedOrders,
    });
  } catch (error) {
    logger.error("Error fetching purchase orders:", error);
    next(new AppError("Failed to fetch purchase orders", 500));
  }
};

// @desc    Get single purchase order
// @route   GET /api/purchase-orders/:id
// @access  Private
export const getPurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: order, error: orderError } = await supabase
      .from("store_purchase_orders")
      .select("*, supplier:store_suppliers(*)")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      throw new AppError("Purchase order not found", 404);
    }

    // Fetch items separately
    const { data: items, error: itemsError } = await supabase
      .from("store_po_items")
      .select("*")
      .eq("purchase_order_id", id);

    if (itemsError) throw itemsError;

    // Fetch item details
    const skus = items?.map((i) => i.sku).filter(Boolean) || [];
    const { data: itemDetails } = await supabase
      .from("inventory_items")
      .select("id, sku, item_name, unit")
      .in("sku", skus);

    // Merge
    const enrichedItems = (items || []).map((item) => {
      const detail = itemDetails?.find((d) => d.sku === item.sku);
      const resolvedName = item.item_name || detail?.item_name || item.sku;
      return {
        ...item,
        item_name: resolvedName,
        item: detail
          ? {
              ...detail,
              name: resolvedName,
            }
          : null,
        unit_of_measure: item.unit || detail?.unit || null,
      };
    });

    const flattenedOrder = {
      ...order,
      supplier_name: (order as any).supplier?.name || "N/A",
      receiving_branch_name: "Central Stores",
      items: enrichedItems,
    };

    const [enrichedOrder] = await enrichPurchaseOrdersWithFinance([
      flattenedOrder,
    ]);

    res.status(200).json({
      success: true,
      data: enrichedOrder || flattenedOrder,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new purchase order
// @route   POST /api/purchase-orders
// @access  Private (Central Ops)
export const createPurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      supplier_id,
      po_date,
      expected_delivery_date,
      special_instructions,
      items,
      payment_terms,
      delivery_terms,
      auto_approve,
    } = req.body;

    const userId = req.user?.id;

    const debugProcurement = process.env.DEBUG_PROCUREMENT === "true";
    if (debugProcurement) {
      logger.debug("Creating purchase order", {
        userId,
        supplier_id,
        supplier_id_type: typeof supplier_id,
        items_count: items?.length,
        auto_approve,
      });
    }

    if (!supplier_id || !items || items.length === 0) {
      throw new AppError("Supplier and items are required", 400);
    }

    // Validate dates to avoid constraint violations
    const resolvedPoDate = po_date || new Date().toISOString().split("T")[0];
    if (expected_delivery_date && expected_delivery_date < resolvedPoDate) {
      throw new AppError(
        "Expected delivery date cannot be before the purchase order date",
        400,
      );
    }

    // Validate UUID format for supplier_id
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(supplier_id)) {
      throw new AppError("Invalid supplier ID format", 400);
    }

    // Resolve line identifiers (sku or inventory UUID) to catalog records.
    const resolvedItems = [...items];
    if (debugProcurement)
      logger.debug("Resolving purchase order items", {
        identifiers: resolvedItems.map((item: any) => item.item_id),
      });
    await resolvePoLineItems(resolvedItems);

    // Generate PO number using database function
    const { data: po_number, error: numberError } =
      await supabase.rpc("generate_po_number");

    if (numberError) {
      logger.error("Error generating PO number:", numberError);
      throw new AppError("Failed to generate PO number", 500);
    }

    if (debugProcurement)
      logger.debug("Generated purchase order number", { po_number });

    // Calculate totals WITHOUT VAT
    const subtotal = resolvedItems.reduce(
      (sum: number, item: any) =>
        sum + Number(item.quantity) * Number(item.unit_price),
      0,
    );

    const tax_amount = 0; // No VAT
    const total_amount = subtotal; // Total equals subtotal (no tax)

    if (debugProcurement)
      logger.debug("Calculated purchase order totals", {
        subtotal,
        tax_amount,
        total_amount,
      });

    // Prepare PO data - set status based on auto_approve flag
    // CRITICAL: Apply module and branch scoping
    const poData = setModuleBranchOnCreate(
      {
        po_number,
        supplier_id,
        po_date: po_date || new Date().toISOString().split("T")[0],
        expected_delivery_date: expected_delivery_date || null,
        special_instructions: special_instructions || null,
        subtotal,
        tax_amount,
        total_amount,
        status: auto_approve ? "approved" : "draft",
        payment_terms: payment_terms || "credit_30_days",
        delivery_terms: delivery_terms || null,
        // If auto-approving, set approval fields
        ...(auto_approve && {
          approved_by_id: userId,
          approved_at: new Date().toISOString(),
          sent_to_supplier: true,
          sent_at: new Date().toISOString(),
          sent_by_id: userId,
        }),
      },
      req,
    );

    // Override created_by_id with the correct field name
    poData.created_by_id = userId || null;
    delete (poData as any).created_by;

    if (debugProcurement)
      logger.debug("Purchase order payload prepared", { poData });

    try {
      // Create purchase order
      const { data: newPO, error: poError } = await supabase
        .from("store_purchase_orders")
        .insert(poData)
        .select()
        .single();

      if (poError) {
        logger.error("PO header insert error:", poError);
        throw new AppError(`Error creating PO header: ${poError.message}`, 500);
      }

      if (debugProcurement)
        logger.debug("Purchase order header created", { id: newPO.id });

      // Insert PO items WITHOUT VAT
      const poItems = resolvedItems.map((item: any) => {
        const lineSubtotal = Number(item.quantity) * Number(item.unit_price);

        return {
          purchase_order_id: newPO.id,
          item_id: item.item_uuid,
          sku: item.item_sku,
          item_name: item.item_name,
          unit: item.item_unit,
          quantity_ordered: item.quantity,
          quantity_pending: item.quantity,
          unit_price: item.unit_price,
          line_total: lineSubtotal,
        };
      });

      if (debugProcurement)
        logger.debug("Purchase order items prepared", {
          count: poItems.length,
        });

      const { error: itemsError } = await supabase
        .from("store_po_items")
        .insert(poItems);

      if (itemsError) {
        logger.error("PO items insert error:", itemsError);
        // Cleanup: Delete the PO header if items failed
        const { error } = await supabase
          .from("store_purchase_orders")
          .delete()
          .eq("id", newPO.id);
        if (error) {
          logger.error(
            "Failed to clean up purchase order header after item insert failure:",
            error,
          );
          throw error;
        }
        throw new AppError(
          `Error adding items to PO: ${itemsError.message}`,
          500,
        );
      }

      if (debugProcurement)
        logger.debug("Purchase order items inserted", { po_id: newPO.id });

      res.status(201).json({
        success: true,
        data: newPO,
        message: auto_approve
          ? "Purchase order created and approved automatically"
          : "Purchase order created successfully",
      });
    } catch (dbError: any) {
      logger.error("Purchase order database error:", dbError);
      if (dbError instanceof AppError) throw dbError;
      throw new AppError(dbError.message || "Database execution error", 500);
    }
  } catch (error) {
    logger.error("Error creating purchase order:", error);
    next(error);
  }
};

// @desc    Approve purchase order
// @route   PUT /api/purchase-orders/:id/approve
// @access  Private (Manager)
export const approvePurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { data: order, error } = await supabase
      .from("store_purchase_orders")
      .update({
        status: "approved",
        approved_by_id: userId,
        approved_at: new Date().toISOString(),
        sent_to_supplier: true,
        sent_at: new Date().toISOString(),
        sent_by_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: "Purchase order approved and sent",
      data: order,
    });
  } catch (error) {
    logger.error("Error approving purchase order:", error);
    next(error);
  }
};

// @desc    Receive purchase order (Legacy - replaced by GRN)
// @route   PUT /api/purchase-orders/:id/receive
// @access  Private
export const receivePurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Find PO
    const { data: po, error: fetchError } = await supabase
      .from("store_purchase_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !po) {
      throw new AppError("Purchase order not found", 404);
    }

    if (po.status === "fully_received") {
      throw new AppError("Purchase order is already received", 400);
    }

    const requestedModule =
      (req as any).sourceModule || req.query.source_module || po.source_module;
    if (
      requestedModule === SourceModule.BRANCH_STORE ||
      po.source_module === SourceModule.BRANCH_STORE
    ) {
      throw new AppError(
        "Branch purchase orders must be received through Receive Goods / GRN posting",
        400,
      );
    }

    // Get po items
    const { data: items, error: itemsError } = await supabase
      .from("store_po_items")
      .select("*")
      .eq("purchase_order_id", id);

    if (itemsError || !items) {
      throw new AppError("Could not fetch po items", 500);
    }

    // Determine destination branch.
    let targetBranchId = req.user?.branch_id;
    if (!targetBranchId) {
      const { data: central, error } = await supabase
        .from("branches")
        .select("id")
        .eq("is_central_warehouse", true)
        .single();
      if (error) {
        console.error("Database error:", error);
        throw error;
      }
      if (central) {
        targetBranchId = central.id;
      } else {
        throw new AppError(
          "User has no branch, and no central store is configured",
          400,
        );
      }
    }

    // Update items and branch stock
    for (const item of items) {
      const qty = item.quantity_ordered || item.quantity;
      if (!qty) continue;

      // Add to receiving branch stock
      const { data: existing } = await supabase
        .from("branch_stock")
        .select("quantity")
        .eq("branch_id", targetBranchId)
        .eq("item_sku", item.sku)
        .maybeSingle();

      const currentQty =
        existing && typeof existing.quantity === "number"
          ? existing.quantity
          : 0;
      const newQty = currentQty + qty;

      await supabase.from("branch_stock").upsert(
        {
          branch_id: targetBranchId,
          item_sku: item.sku,
          quantity: newQty,
          last_stock_in: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "branch_id,item_sku" },
      );

      // Log stock movement
      await supabase.from("branch_stock_movements").insert({
        branch_id: targetBranchId,
        item_sku: item.sku,
        movement_type: "PO_RECEIVE",
        quantity: qty,
        reference_type: "PURCHASE_ORDER",
        reference_id: id,
        reference_number: po.po_number,
        performed_by: userId,
        notes: `Directly received PO ${po.po_number}`,
      });
    }

    // Update PO status to the valid po_status enum value.
    const { data: updatedPO, error: updateError } = await supabase
      .from("store_purchase_orders")
      .update({
        status: "fully_received",
        received_by_id: userId,
        received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.status(200).json({
      success: true,
      message: "Purchase order received",
      data: updatedPO,
    });
  } catch (error) {
    logger.error("Error receiving purchase order:", error);
    next(error);
  }
};

// @desc    Cancel purchase order
// @route   PUT /api/purchase-orders/:id/cancel
// @access  Private
export const cancelPurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const { data: order, error } = await supabase
      .from("store_purchase_orders")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: "Purchase order cancelled",
      data: order,
    });
  } catch (error) {
    logger.error("Error cancelling purchase order:", error);
    next(error);
  }
};

// @desc    Update purchase order
// @route   PUT /api/purchase-orders/:id
// @access  Private
export const updatePurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      supplier_id,
      po_date,
      expected_delivery_date,
      special_instructions,
      items,
      payment_terms,
      delivery_terms,
    } = req.body;

    // Check if PO exists and is in draft/pending status
    const { data: order, error: fetchError } = await supabase
      .from("store_purchase_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      throw new AppError("Purchase order not found", 404);
    }

    if (order.status !== "draft" && order.status !== "pending_approval") {
      throw new AppError(
        "Only draft or pending purchase orders can be updated",
        400,
      );
    }

    // Resolve line identifiers (sku or inventory UUID) to catalog records.
    const resolvedItems = [...items];
    await resolvePoLineItems(resolvedItems);

    // Calculate totals WITHOUT VAT
    const subtotal = resolvedItems.reduce(
      (sum: number, item: any) =>
        sum + Number(item.quantity) * Number(item.unit_price),
      0,
    );

    const tax_amount = 0; // No VAT
    const total_amount = subtotal; // Total equals subtotal (no tax)

    // Update PO
    const { data: updatedPO, error: updateError } = await supabase
      .from("store_purchase_orders")
      .update({
        supplier_id,
        po_date,
        expected_delivery_date,
        special_instructions,
        subtotal,
        tax_amount,
        total_amount,
        payment_terms,
        delivery_terms,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Delete old items
    await supabase.from("store_po_items").delete().eq("purchase_order_id", id);

    // Insert new items WITHOUT VAT
    const poItems = resolvedItems.map((item: any) => {
      const lineSubtotal = Number(item.quantity) * Number(item.unit_price);

      return {
        purchase_order_id: id,
        item_id: item.item_uuid,
        sku: item.item_sku,
        item_name: item.item_name,
        unit: item.item_unit,
        quantity_ordered: item.quantity,
        quantity_pending: item.quantity,
        unit_price: item.unit_price,
        line_total: lineSubtotal,
      };
    });

    const { error: itemsError } = await supabase
      .from("store_po_items")
      .insert(poItems);

    if (itemsError) throw itemsError;

    res.status(200).json({
      success: true,
      message: "Purchase order updated successfully",
      data: updatedPO,
    });
  } catch (error) {
    logger.error("Error updating purchase order:", error);
    next(error);
  }
};

// @desc    Delete purchase order
// @route   DELETE /api/purchase-orders/:id
// @access  Private
export const deletePurchaseOrder = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if PO exists and is in draft status
    const { data: order, error: fetchError } = await supabase
      .from("store_purchase_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      throw new AppError("Purchase order not found", 404);
    }

    if (order.status !== "draft") {
      throw new AppError("Only draft purchase orders can be deleted", 400);
    }

    // Delete items first
    await supabase.from("store_po_items").delete().eq("purchase_order_id", id);

    // Delete PO
    const { error: deleteError } = await supabase
      .from("store_purchase_orders")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    res.status(200).json({
      success: true,
      message: "Purchase order deleted successfully",
    });
  } catch (error) {
    logger.error("Error deleting purchase order:", error);
    next(error);
  }
};

// @desc    Send purchase order to supplier via email
// @route   POST /api/purchase-orders/:id/send
// @access  Private
export const sendPurchaseOrderToSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Fetch PO with items and supplier
    const { data: order, error: orderError } = await supabase
      .from("store_purchase_orders")
      .select("*, supplier:store_suppliers(*)")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      throw new AppError("Purchase order not found", 404);
    }

    if (!order.supplier?.email) {
      throw new AppError(
        "Supplier does not have an email address configured",
        400,
      );
    }

    // Fetch items
    const { data: items, error: itemsError } = await supabase
      .from("store_po_items")
      .select("*")
      .eq("purchase_order_id", id);

    if (itemsError) throw itemsError;

    // Fetch item names/descriptions
    const skus = items?.map((i) => i.sku).filter(Boolean) || [];
    const { data: itemDetails } = await supabase
      .from("inventory_items")
      .select("id, sku, item_name, unit")
      .in("sku", skus);

    const enrichedItems = (items || []).map((item) => {
      const detail = itemDetails?.find((d) => d.sku === item.sku);
      return {
        ...item,
        item_name: item.item_name || detail?.item_name || item.sku,
      };
    });

    const fullOrderDetails = {
      ...order,
      items: enrichedItems,
    };

    // Send email
    await emailService.sendPurchaseOrderEmail(
      order.supplier.email,
      fullOrderDetails,
    );

    // Update PO status
    await supabase
      .from("store_purchase_orders")
      .update({
        sent_to_supplier: true,
        sent_at: new Date().toISOString(),
        sent_by_id: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    res.status(200).json({
      success: true,
      message: `Purchase order sent to ${order.supplier.email}`,
    });
  } catch (error) {
    logger.error("Error sending purchase order:", error);
    next(error);
  }
};
