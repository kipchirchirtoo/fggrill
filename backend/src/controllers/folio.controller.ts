import { Request, Response, NextFunction } from 'express';
import { Folio } from '../models/Folio';
import { AppError } from '../middleware/errorHandler';
import { supabase } from '../config/database';

export const getFolio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId } = req.params;
    let folio = await Folio.findByReservationId(reservationId);

    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    // Lazy creation: if folio doesn't exist, create it
    if (!folio) {
      if (resError || !reservation) {
        throw new AppError('Reservation not found', 404);
      }

      const resRoomCharge = Number(reservation.total_amount || 0);

      folio = new Folio({
        reservationId: reservation.id,
        guestId: reservation.guest_id,
        branchId: reservation.branch_id,
        folioNumber: reservation.confirmation_number,
        status: 'open',
        roomCharges: resRoomCharge,
        foodCharges: 0,
        beverageCharges: 0,
        otherCharges: 0,
        totalCharges: resRoomCharge,
        totalPayments: 0,
        balance: resRoomCharge
      });
      await folio.save();
    } else if (reservation) {
      // Sync room_charges, POS charges from folio_transactions, and recalculate totalCharges & balance
      const resRoomCharge = Number(reservation.total_amount || 0);

      // Query folio_transactions for all charges posted to this folio from POS
      const { data: ftx } = await supabase
        .from('folio_transactions')
        .select('*')
        .eq('folio_id', folio.id);

      let ftFood = 0;
      let ftBev = 0;
      let ftOther = 0;
      let ftPayments = 0;

      for (const t of (ftx || [])) {
        const type = (t.type || t.transaction_type || '').toLowerCase();
        const cat = (t.category || '').toLowerCase();
        const amt = Number(t.amount || t.total_amount || 0);

        if (type.includes('payment')) {
          ftPayments += amt;
        } else {
          if (cat.includes('food') || cat.includes('restaurant') || cat.includes('kitchen')) {
            ftFood += amt;
          } else if (cat.includes('bev') || cat.includes('bar') || cat.includes('drink')) {
            ftBev += amt;
          } else {
            ftOther += amt;
          }
        }
      }

      const foodCharges = Math.max(Number(folio.foodCharges || 0), ftFood);
      const beverageCharges = Math.max(Number(folio.beverageCharges || 0), ftBev);
      const otherCharges = Math.max(Number(folio.otherCharges || 0), ftOther);
      const currentRoomCharges = Math.max(Number(folio.roomCharges || 0), resRoomCharge);
      const calculatedTotalCharges = currentRoomCharges + foodCharges + beverageCharges + otherCharges;
      const resPaid = reservation.deposit_paid
        ? Math.max(Number(reservation.amount_paid || 0), Number(reservation.deposit_amount || 0))
        : Number(reservation.amount_paid || 0);
      const totalPayments = Math.max(Number(folio.totalPayments || 0), resPaid, ftPayments);
      const calculatedBalance = Math.max(0, calculatedTotalCharges - totalPayments);

      if (folio.roomCharges !== currentRoomCharges ||
          folio.foodCharges !== foodCharges ||
          folio.beverageCharges !== beverageCharges ||
          folio.otherCharges !== otherCharges ||
          folio.totalCharges !== calculatedTotalCharges ||
          folio.balance !== calculatedBalance) {
        folio.roomCharges = currentRoomCharges;
        folio.foodCharges = foodCharges;
        folio.beverageCharges = beverageCharges;
        folio.otherCharges = otherCharges;
        folio.totalCharges = calculatedTotalCharges;
        folio.totalPayments = totalPayments;
        folio.balance = calculatedBalance;

        await supabase
          .from('folios')
          .update({
            room_charges: currentRoomCharges,
            food_charges: foodCharges,
            beverage_charges: beverageCharges,
            other_charges: otherCharges,
            total_charges: calculatedTotalCharges,
            total_payments: totalPayments,
            balance: calculatedBalance,
            updated_at: new Date()
          })
          .eq('id', folio.id);
      }
    }

    // Fetch transactions from both transactions table and folio_transactions table
    const tx1 = await folio.getTransactions();

    const { data: ftxData } = await supabase
      .from('folio_transactions')
      .select('*')
      .eq('folio_id', folio.id);

    const tx2 = (ftxData || []).map(t => ({
      id: t.id,
      folioId: t.folio_id || folio.id,
      type: (t.type || t.transaction_type || 'charge').toLowerCase().includes('payment') ? 'payment' : 'charge',
      category: t.category || t.outlet_name || 'POS Charge',
      amount: Number(t.amount || t.total_amount || 0),
      description: t.description || t.notes || `${t.outlet_name || 'POS'} Bill`,
      referenceNumber: t.reference || t.reference_number || t.bill_number || t.order_number || '',
      reference: t.reference || t.reference_number || t.bill_number || t.order_number || '',
      performedBy: t.performed_by || t.created_by,
      createdAt: t.created_at || new Date().toISOString()
    }));

    const allTxnsMap = new Map();
    for (const t of [...tx1, ...tx2]) {
      allTxnsMap.set(t.id, t);
    }
    const transactions = Array.from(allTxnsMap.values()).sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Itemised Charge-to-Room lines (outlet + item + amount) for a detailed
    // guest invoice. This is the clean, non-double-counted breakdown (one row
    // per POS item), unlike the transactions ledger which also carries the
    // per-bill lump row. Populated by postRoomCharge on every charge-to-room.
    const { data: folioItemsData } = await supabase
      .from('folio_items')
      .select('id, description, department, quantity, unit_price, amount, charge_date, voided, created_at')
      .eq('folio_id', folio.id)
      .order('created_at', { ascending: true });
    const items = (folioItemsData || [])
      .filter((r: any) => r.voided !== true)
      .map((r: any) => ({
        id: r.id,
        description: r.description,
        department: r.department,
        quantity: Number(r.quantity || 1),
        unit_price: Number(r.unit_price || 0),
        amount: Number(r.amount || 0),
      }));

    // Per-bill charge lines from the folio audit trail (outlet + bill/item +
    // amount). Used for the detailed invoice when folio_items (the richest,
    // per-item breakdown, only captured on newer Charge-to-Room posts) is empty
    // for a folio. Comes ONLY from folio_transactions (not the `transactions`
    // ledger) so the lines are never double-counted.
    const chargeLines = (ftxData || [])
      .filter((t: any) => {
        const type = String(t.transaction_type || t.type || 'charge').toLowerCase();
        const status = String(t.status || 'posted').toLowerCase();
        return type.includes('charge') && status !== 'reversed' && status !== 'voided';
      })
      .map((t: any) => ({
        description: t.description || `${t.category || 'POS'} charge`,
        category: t.category || null,
        amount: Number(t.amount || t.total_amount || 0),
        reference: t.reference || t.reference_number || null,
      }))
      .filter((r: any) => r.amount > 0);

    // Build the richest per-item breakdown available for the invoice:
    //   1) folio_items (exact per-item, captured on newer charge-to-room posts),
    //      OR — when that's empty (older charges) —
    //   2) EXPAND each charge line into its SOURCE POS order's actual line items
    //      (resolved by the bill reference), reconstructing the exact items the
    //      guest had. Any bill whose reference can't be resolved (e.g. legacy
    //      posts that stored a generic reference) keeps its per-bill line so the
    //      totals still reconcile.
    let invoiceItems: any[] = items;
    if (invoiceItems.length === 0 && chargeLines.length > 0) {
      const refs = Array.from(new Set(
        chargeLines
          .map((c: any) => String(c.reference || '').trim())
          .filter((r: string) => r && r.toUpperCase() !== 'BILL')
      ));

      const orderByRef = new Map<string, any>();
      if (refs.length > 0) {
        const [byShort, byOrder] = await Promise.all([
          supabase.from('pos_shift_orders')
            .select('short_code, order_number, total_amount, items').in('short_code', refs),
          supabase.from('pos_shift_orders')
            .select('short_code, order_number, total_amount, items').in('order_number', refs),
        ]);
        for (const o of ([...(byShort.data || []), ...(byOrder.data || [])] as any[])) {
          if (o.short_code) orderByRef.set(String(o.short_code).toUpperCase(), o);
          if (o.order_number) orderByRef.set(String(o.order_number).toUpperCase(), o);
        }
      }

      const expanded: any[] = [];
      for (const cl of chargeLines) {
        const ref = String(cl.reference || '').trim().toUpperCase();
        const order = ref && ref !== 'BILL' ? orderByRef.get(ref) : null;
        const orderItems = order && Array.isArray(order.items) ? order.items : [];
        // Outlet label = the charge description text before " - Bill".
        const outlet = String(cl.description || '').split(/\s-\sbill/i)[0].trim() || 'POS';

        if (orderItems.length > 0) {
          let sum = 0;
          for (const it of orderItems) {
            const name = String(
              it.name || it.item_name || it.description || it.drink_name || 'Item'
            ).trim();
            const qtyRaw = Number(it.active_qty ?? it.quantity ?? it.qty ?? 1);
            const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
            const unit = Number(it.unit_price ?? it.price ?? 0) || 0;
            const line = Number(
              it.active_total ?? it.line_total ?? it.total ?? it.total_price ?? (unit * qty)
            ) || 0;
            if (line <= 0) continue;
            sum += line;
            const itemOutlet = String(it.outlet_name || '').trim() || outlet;
            expanded.push({
              description: `${itemOutlet} · ${qty}x ${name}`,
              department: itemOutlet,
              quantity: qty,
              unit_price: unit || (qty > 0 ? line / qty : line),
              amount: line,
            });
          }
          // Reconcile the item sum to the charged amount (inclusive taxes/levies).
          const diff = Math.round((Number(cl.amount || 0) - sum) * 100) / 100;
          if (diff > 0.5) {
            expanded.push({
              description: `${outlet} · Taxes & service charge`,
              department: outlet,
              quantity: 1,
              unit_price: diff,
              amount: diff,
            });
          }
        } else {
          // Unresolvable bill — keep the per-bill line.
          expanded.push({
            description: cl.description,
            department: null,
            quantity: 1,
            unit_price: Number(cl.amount || 0),
            amount: Number(cl.amount || 0),
          });
        }
      }
      if (expanded.length > 0) invoiceItems = expanded;
    }

    res.status(200).json({
      success: true,
      data: {
        folio,
        transactions,
        items: invoiceItems,
        charge_lines: chargeLines
      }
    });
  } catch (error) {
    next(error);
  }
};

export const addTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId } = req.params;
    const folio = await Folio.findByReservationId(reservationId);
    if (!folio) throw new AppError('Folio not found', 404);

    const transaction = await folio.addTransaction({
      ...req.body,
      performedBy: req.user?.id
    });

    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (error) {
    next(error);
  }
};
