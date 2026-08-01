import { Request, Response } from 'express';
import db from '../db';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';
import { billCache } from '../utils/bill-cache';
import { AppError } from '../middleware/errorHandler';
import { recordHotelCashierPayment } from '../services/receptionCashierPayment.service';
import {
  buildStaySnapshot,
  isInHouseStay,
  loadStaySnapshots,
  todayInNairobi,
} from '../services/receptionStayState.service';

const IN_HOUSE_ROOM_CHARGE_STATUSES = ['checked_in', 'checked-in', 'in-house', 'active'] as const;

const isFeatureEnabled = async (branchId: number, featureKey: string): Promise<boolean> => {
  const res = await db.query(
    'SELECT is_enabled FROM branch_features WHERE branch_id = $1 AND (feature_key = $2 OR feature_name = $2)',
    [branchId, featureKey]
  );
  if (res.rows.length === 0) return false;
  return Boolean(res.rows[0].is_enabled);
};

function normalizeGuestName(row: any): string {
  const guest = Array.isArray(row?.guest) ? row.guest[0] : row?.guest;
  const first = String(guest?.first_name || '').trim();
  const last = String(guest?.last_name || '').trim();
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || String(row?.guest_name || 'Guest').trim() || 'Guest';
}

function relationRecord<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return (value ?? null) as T | null;
}

function stayNights(checkIn: string | null | undefined, checkOut: string | null | undefined): number {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00Z`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

function resolveChargeBucket(outletName?: string, outletType?: string): {
  category: string;
  folioField: 'food_charges' | 'beverage_charges' | 'other_charges';
} {
  const token = `${outletName || ''} ${outletType || ''}`.toLowerCase();
  if (
    token.includes('bar') ||
    token.includes('cocktail') ||
    token.includes('beverage') ||
    token.includes('drink')
  ) {
    return { category: 'Beverage', folioField: 'beverage_charges' };
  }
  if (
    token.includes('restaurant') ||
    token.includes('buffet') ||
    token.includes('breakfast') ||
    token.includes('lunch') ||
    token.includes('dinner') ||
    token.includes('food') ||
    token.includes('kitchen') ||
    token.includes('grill')
  ) {
    return { category: 'Food', folioField: 'food_charges' };
  }
  return { category: 'Other', folioField: 'other_charges' };
}

async function loadEligibleInHouseGuests(branchId: number, queryStr: string) {
  const today = todayInNairobi();
  const inHouseReservations = await loadStaySnapshots(branchId, {
    asOfDate: today,
    includeConfirmed: false,
    search: queryStr,
    limit: 150,
  });

  const reservationIds = inHouseReservations.map((row: any) => row.reservation_id);
  const folioMap = new Map<string, any>();

  if (reservationIds.length > 0) {
    const { data: folios, error: folioError } = await supabase
      .from('folios')
      .select(`
        id,
        reservation_id,
        status,
        total_charges,
        total_payments,
        balance,
        room_charges,
        food_charges,
        beverage_charges,
        other_charges,
        updated_at
      `)
      .in('reservation_id', reservationIds)
      .order('updated_at', { ascending: false });

    if (folioError) throw folioError;

    for (const folio of folios || []) {
      const key = String(folio.reservation_id || '');
      if (!key || folioMap.has(key)) continue;
      folioMap.set(key, folio);
    }
  }

  return inHouseReservations
    .map((row: any) => {
      const folio = folioMap.get(String(row.reservation_id));
      const guest = relationRecord<any>(row?.raw?.guest);
      const phone = String(guest?.phone || '').trim();
      const roomNumber = String(row?.room_number || '').trim();
      const confirmationNumber = String(row?.confirmation_number || '').trim();
      const nights = stayNights(row?.check_in_date, row?.effective_checkout_date || row?.check_out_date);
      const roomGross = Number(row?.total_amount || 0);
      // Charge-to-Room always posts to the food/beverage/other buckets (never
      // room_charges), so those buckets ARE the POS charges — no double count
      // with the room booking.
      const folioPosCharges =
        Number(folio?.food_charges || 0) +
        Number(folio?.beverage_charges || 0) +
        Number(folio?.other_charges || 0);
      // All payments: the reservation's paid figure (deposit + any cashier
      // payments, tracked cumulatively in advance_payment/amount_paid) PLUS folio
      // settle payments. So a partial payment made at the cashier reduces the
      // balance and the remainder stays outstanding on the room bill.
      const reservationPaid = Number(row?.amount_paid || 0);
      const folioPayments = Number(folio?.total_payments || 0);
      const totalPaid = Math.max(reservationPaid, folioPayments);
      const folioBalance = Math.max(0, roomGross + folioPosCharges - totalPaid);

      return {
        booking_id: row.reservation_id,
        folio_id: folio?.id || row.reservation_id,
        room_number: roomNumber,
        guest_name: row.guest_name,
        guest_phone: phone,
        confirmation_number: confirmationNumber || `RSV-${row.reservation_id}`,
        check_in_date: row.check_in_date,
        check_out_date: row.effective_checkout_date || row.check_out_date,
        occupants: Number(row?.pax || 0),
        stay_nights: nights,
        folio_balance: folioBalance,
        folio_pos_charges: folioPosCharges,
        folio_payments: totalPaid,
        total_amount: roomGross,
        amount_paid: totalPaid,
        meal_plan: row?.meal_plan || 'Room Only',
        eligibility_status: row?.overstay ? 'In house (overstay)' : 'In house',
        overstay: Boolean(row?.overstay),
      };
    })
    .filter((row) => {
      const folio = folioMap.get(String(row.booking_id));
      // Exclude closed or settled folios
      if (folio && (folio.status === 'closed' || folio.settled === true || (folio.balance_due <= 0 && folio.status === 'closed'))) {
        return false;
      }
      if (row.folio_balance <= 0 && !row.overstay) {
        return false;
      }
      return true;
    })
    .sort((a, b) => String(a.room_number).localeCompare(String(b.room_number)));
}

async function settleRoomChargeSourceBill(input: {
  source?: string;
  billId?: string;
  billNumber?: string;
  orderNumber?: string;
  shortCode?: string;
  bookingId: string;
  roomNumber: string;
  guestName: string;
}) {
  const searchTokens = Array.from(
    new Set(
      [input.billId, input.billNumber, input.orderNumber, input.shortCode]
        .map((t) => String(t || '').trim())
        .filter(Boolean)
    )
  );
  if (searchTokens.length === 0) return;

  for (const token of searchTokens) {
    billCache.invalidatePattern(token);
  }

  const now = new Date().toISOString();

  // 1. pos_shift_orders (Kyogong POS Shift Orders)
  for (const token of searchTokens) {
    let posOrder: any = null;
    if (/^[0-9a-f-]{36}$/i.test(token)) {
      const { data } = await supabase
        .from('pos_shift_orders')
        .select('id, total_amount, master_bill_id, short_code, order_number')
        .eq('id', token)
        .maybeSingle();
      posOrder = data;
    }
    if (!posOrder) {
      const { data } = await supabase
        .from('pos_shift_orders')
        .select('id, total_amount, master_bill_id, short_code, order_number')
        .or(`order_number.eq.${token},short_code.eq.${token}`)
        .maybeSingle();
      posOrder = data;
    }

    if (posOrder) {
      const totalAmount = Number(posOrder.total_amount || 0);
      await supabase
        .from('pos_shift_orders')
        .update({
          payment_status: 'paid',
          payment_method: 'ROOM_CHARGE',
          amount_paid: totalAmount,
          balance_amount: 0,
          status: 'paid',
          sub_bill_status: 'settled',
          updated_at: now,
        })
        .eq('id', posOrder.id);

      if (posOrder.short_code) billCache.invalidatePattern(posOrder.short_code);
      if (posOrder.order_number) billCache.invalidatePattern(posOrder.order_number);

      if (posOrder.master_bill_id) {
        await supabase
          .from('pos_master_bills')
          .update({
            status: 'closed',
            payment_method: 'ROOM_CHARGE',
            amount_paid: totalAmount,
            paid_at: now,
            closed_at: now,
            updated_at: now,
          })
          .eq('id', posOrder.master_bill_id);
      }
      break;
    }
  }

  // 2. unpaid_bills (Cashier Station Unpaid Bills)
  for (const token of searchTokens) {
    let unpaidBill: any = null;
    if (/^[0-9a-f-]{36}$/i.test(token)) {
      const { data } = await supabase
        .from('unpaid_bills')
        .select('id, total_amount, remarks')
        .eq('id', token)
        .maybeSingle();
      unpaidBill = data;
    }
    if (!unpaidBill) {
      const { data } = await supabase
        .from('unpaid_bills')
        .select('id, total_amount, remarks')
        .eq('bill_number', token)
        .maybeSingle();
      unpaidBill = data;
    }

    if (unpaidBill) {
      const totalAmount = Number(unpaidBill.total_amount || 0);
      const remarks = [unpaidBill.remarks, `Charged to room ${input.roomNumber} (${input.guestName})`]
        .filter(Boolean)
        .join(' • ');

      await supabase
        .from('unpaid_bills')
        .update({
          amount_paid: totalAmount,
          balance_due: 0,
          balance_amount: 0,
          status: 'paid',
          remarks,
          updated_at: now,
        })
        .eq('id', unpaidBill.id);
      break;
    }
  }

  // 3. shift_transactions (Kyogong POS shift transactions)
  for (const token of searchTokens) {
    let shiftTx: any = null;
    if (/^[0-9a-f-]{36}$/i.test(token)) {
      const { data } = await supabase
        .from('shift_transactions')
        .select('id')
        .eq('id', token)
        .maybeSingle();
      shiftTx = data;
    }
    if (!shiftTx) {
      const { data } = await supabase
        .from('shift_transactions')
        .select('id')
        .eq('transaction_number', token)
        .maybeSingle();
      shiftTx = data;
    }

    if (shiftTx) {
      await supabase
        .from('shift_transactions')
        .update({
          payment_method: 'ROOM_CHARGE',
          status: 'paid',
          updated_at: now,
        })
        .eq('id', shiftTx.id);
      break;
    }
  }

  // 4. pos_master_bills (Master Bills across outlets)
  for (const token of searchTokens) {
    let masterBill: any = null;
    if (/^[0-9a-f-]{36}$/i.test(token)) {
      const { data } = await supabase
        .from('pos_master_bills')
        .select('id, total_amount')
        .eq('id', token)
        .maybeSingle();
      masterBill = data;
    }
    if (!masterBill) {
      const { data } = await supabase
        .from('pos_master_bills')
        .select('id, total_amount')
        .eq('master_bill_number', token)
        .maybeSingle();
      masterBill = data;
    }

    if (masterBill) {
      const totalAmount = Number(masterBill.total_amount || 0);
      await supabase
        .from('pos_master_bills')
        .update({
          status: 'closed',
          payment_method: 'ROOM_CHARGE',
          amount_paid: totalAmount,
          paid_at: now,
          closed_at: now,
          updated_at: now,
        })
        .eq('id', masterBill.id);

      await supabase
        .from('pos_shift_orders')
        .update({
          payment_status: 'paid',
          payment_method: 'ROOM_CHARGE',
          balance_amount: 0,
          status: 'paid',
          sub_bill_status: 'settled',
          updated_at: now,
        })
        .eq('master_bill_id', masterBill.id);
      break;
    }
  }

  // 5. restaurant_orders
  for (const token of searchTokens) {
    let rOrder: any = null;
    if (/^[0-9a-f-]{36}$/i.test(token)) {
      const { data } = await supabase
        .from('restaurant_orders')
        .select('id, total_amount')
        .eq('id', token)
        .maybeSingle();
      rOrder = data;
    }
    if (!rOrder) {
      const { data } = await supabase
        .from('restaurant_orders')
        .select('id, total_amount')
        .or(`order_number.eq.${token},short_code.eq.${token}`)
        .maybeSingle();
      rOrder = data;
    }

    if (rOrder) {
      const totalAmount = Number(rOrder.total_amount || 0);
      await supabase
        .from('restaurant_orders')
        .update({
          payment_status: 'paid',
          payment_method: 'ROOM_CHARGE',
          amount_paid: totalAmount,
          balance_amount: 0,
          status: 'delivered',
          updated_at: now,
        })
        .eq('id', rOrder.id);
      break;
    }
  }

  // 6. bar_orders
  for (const token of searchTokens) {
    let bOrder: any = null;
    if (/^[0-9a-f-]{36}$/i.test(token)) {
      const { data } = await supabase
        .from('bar_orders')
        .select('id, total')
        .eq('id', token)
        .maybeSingle();
      bOrder = data;
    }
    if (!bOrder) {
      const { data } = await supabase
        .from('bar_orders')
        .select('id, total')
        .or(`order_number.eq.${token},short_code.eq.${token}`)
        .maybeSingle();
      bOrder = data;
    }

    if (bOrder) {
      const totalAmount = Number(bOrder.total || 0);
      await supabase
        .from('bar_orders')
        .update({
          payment_status: 'paid',
          payment_method: 'ROOM_CHARGE',
          amount_paid: totalAmount,
          balance_amount: 0,
          status: 'completed',
          updated_at: now,
        })
        .eq('id', bOrder.id);
      break;
    }
  }

  // 7. pos_orders (legacy fallback)
  for (const token of searchTokens) {
    await supabase
      .from('pos_orders')
      .update({
        payment_status: 'paid',
        status: 'completed',
        payment_method: 'Room Charge',
        room_number: input.roomNumber,
        guest_name: input.guestName,
        booking_id: input.bookingId,
        updated_at: now,
      })
      .or(`id.eq.${token},order_number.eq.${token}`);
  }
}

export const getEligibleGuests = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = Number(req.query.branch_id || (req as any).user?.branch_id || 1);
    const queryStr = String(req.query.query || '').trim().toLowerCase();

    const eligibleGuests = await loadEligibleInHouseGuests(branchId, queryStr);

    res.json({
      success: true,
      count: eligibleGuests.length,
      guests: eligibleGuests,
    });
  } catch (error: any) {
    logger.error('Error searching eligible room charge guests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search eligible guests',
      error: error.message,
    });
  }
};

// POST /room-charge/folio/:reservationId/settle
// The cashier clears a guest's room bill at the station: records a PAYMENT on
// the folio (a DB trigger recalculates total_payments/balance), so the room
// bill is settled without ever sitting in the general Unpaid Bills list.
// body: { amount, method?, reference? }
export const settleRoomBill = async (req: Request, res: Response): Promise<void> => {
  try {
    const reservationId = String(req.params.reservationId || '').trim();
    const amount = Number(req.body.amount);
    const method = String(req.body.method || req.body.payment_method || 'cash').trim().toLowerCase();
    const purpose = String(req.body.purpose || req.body.payment_purpose || '').trim();
    const reference = String(req.body.reference || '').trim() || null;
    const cashierUserId = String((req as any).user?.id || '').trim();
    const cashierName = String(
      (req as any).user?.name ||
      `${(req as any).user?.first_name || ''} ${(req as any).user?.last_name || ''}`.trim()
    ).trim();
    if (!reservationId) { res.status(400).json({ success: false, message: 'reservationId is required' }); return; }
    if (!(amount > 0)) { res.status(400).json({ success: false, message: 'A positive amount is required' }); return; }
    if (!cashierUserId) {
      throw new AppError('Authenticated cashier user is required', 403);
    }

    const settlement = await recordHotelCashierPayment({
      reservationId,
      amount,
      paymentMethod: method,
      paymentPurpose: purpose || null,
      reference,
      cashierUserId,
      cashierName,
      amountTendered: Number(req.body.amount_tendered || 0),
      changeGiven: Number(req.body.change_given || 0),
    });

    res.json({
      success: true,
      data: {
        reservation_id: reservationId,
        payment_id: settlement.paymentId,
        folio_id: settlement.folioId,
        cashier_transaction_id: settlement.cashierTransactionId,
        cashier_transaction_number: settlement.cashierTransactionNumber,
        cashier_shift_log_id: settlement.cashierShiftLogId,
        amount,
        method: settlement.method,
        total_payments: settlement.totalPaid,
        balance: settlement.balance,
        status: settlement.folioStatus,
        payment_status: settlement.paymentStatus,
        room_number: settlement.roomNumber,
        guest_name: settlement.guestName,
      },
    });
  } catch (error: any) {
    logger.error('settleRoomBill failed:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to settle room bill' });
  }
};

export const postRoomCharge = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      branch_id,
      source,
      outlet_name,
      outlet_type,
      bill_id,
      bill_number,
      order_number,
      booking_id,
      room_number,
      guest_name,
      total_amount,
      tax_amount,
      discount_amount,
      service_charge,
      items,
      waiter_name,
      notes,
    } = req.body;

    const userId = (req as any).user?.id || null;
    const userName = (req as any).user?.name || 'Cashier';
    const branchId = Number(branch_id || (req as any).user?.branch_id || 1);
    const today = todayInNairobi();

    const parentEnabled = await isFeatureEnabled(branchId, 'GUEST_ROOM_CHARGING');
    if (!parentEnabled) {
      res.status(403).json({ success: false, message: 'Guest Room Charging is disabled for this branch.' });
      return;
    }

    const outletNameStr = String(outlet_name || '').toUpperCase();
    let outletFeatureKey = 'RESTAURANT_ROOM_CHARGING';
    if (outletNameStr.includes('EXEC') || outletNameStr.includes('EXECUTIVE')) {
      outletFeatureKey = 'EXECUTIVE_BAR_ROOM_CHARGING';
    } else if (outletNameStr.includes('SPORT') || outletNameStr.includes('SPORTS')) {
      outletFeatureKey = 'SPORTS_BAR_ROOM_CHARGING';
    }

    const outletEnabled = await isFeatureEnabled(branchId, outletFeatureKey);
    if (!outletEnabled) {
      res.status(403).json({
        success: false,
        message: `Room charging is disabled for ${outlet_name || 'this outlet'} in this branch.`,
      });
      return;
    }

    if (!booking_id) {
      res.status(400).json({ success: false, message: 'booking_id is required.' });
      return;
    }

    const reservationRes = await supabase
      .from('reservations')
      .select(`
        id,
        confirmation_number,
        guest_id,
        room_id,
        status,
        check_in_date,
        check_out_date,
        total_amount,
        deposit_amount,
        meal_plan,
        guest:guests!guest_id(first_name,last_name,phone,email),
        room:rooms!room_id(id, room_number, branch_id, status)
      `)
      .eq('id', booking_id)
      .maybeSingle();

    if (reservationRes.error) {
      throw reservationRes.error;
    }

    const reservation = reservationRes.data;
    if (!reservation) {
      res.status(404).json({ success: false, message: 'Active guest stay not found.' });
      return;
    }

    const reservationRoom = relationRecord<any>(reservation.room);
    if (Number(reservationRoom?.branch_id || 0) !== branchId) {
      res.status(400).json({ success: false, message: 'Guest stay belongs to a different branch.' });
      return;
    }

    const reservationSnapshot = buildStaySnapshot(reservation, today);
    if (!isInHouseStay(reservationSnapshot.raw, today)) {
      res.status(400).json({
        success: false,
        message: 'Only current in-house overnight stays can be charged to room.',
      });
      return;
    }

    const grossAmount = Number(total_amount) || 0;
    if (grossAmount <= 0) {
      res.status(400).json({ success: false, message: 'A positive amount is required.' });
      return;
    }

    const taxAmt = Number(tax_amount) || 0;
    const discAmt = Number(discount_amount) || 0;
    const scAmt = Number(service_charge) || 0;
    const billRef = bill_number || order_number || `BILL-${Date.now()}`;
    const roomNumber = String(room_number || reservationRoom?.room_number || '').trim();
    const guestName = String(guest_name || normalizeGuestName(reservation)).trim();
    const chargeBucket = resolveChargeBucket(outlet_name, outlet_type);
    const descriptionText = `${outlet_name || 'Outlet'} - Bill ${billRef}`;

    const existingFolioRes = await supabase
      .from('folios')
      .select(`
        id,
        reservation_id,
        guest_id,
        branch_id,
        status,
        folio_number,
        room_charges,
        food_charges,
        beverage_charges,
        other_charges,
        total_charges,
        total_payments,
        balance
      `)
      .eq('reservation_id', booking_id)
      .eq('status', 'open')
      .maybeSingle();

    if (existingFolioRes.error) {
      throw existingFolioRes.error;
    }

    let folio = existingFolioRes.data;
    if (!folio) {
      const openingRoomCharges = Number(reservation.total_amount || 0);
      const createdFolioRes = await supabase
        .from('folios')
        .insert({
          reservation_id: booking_id,
          guest_id: reservation.guest_id,
          branch_id: branchId,
          status: 'open',
          folio_number: reservation.confirmation_number || `FOL-${Date.now()}`,
          room_charges: openingRoomCharges,
          food_charges: 0,
          beverage_charges: 0,
          other_charges: 0,
          total_charges: openingRoomCharges,
          total_payments: 0,
          updated_at: new Date().toISOString(),
        })
        .select(`
          id,
          reservation_id,
          guest_id,
          branch_id,
          status,
          folio_number,
          room_charges,
          food_charges,
          beverage_charges,
          other_charges,
          total_charges,
          total_payments,
          balance
        `)
        .single();

      if (createdFolioRes.error) {
        throw createdFolioRes.error;
      }
      folio = createdFolioRes.data;
    }

    // NOTE: the `transactions` (folio) table only has folio_id/type/category/
    // amount/description/reference_number/performed_by/created_at — do NOT add
    // quantity/unit_price/posted_by/transaction_date here (they don't exist and
    // cause PGRST204 "Could not find the column"). Item/quantity detail lives on
    // the folio_transactions audit row below instead.
    const transactionRes = await supabase
      .from('transactions')
      .insert({
        folio_id: folio.id,
        type: 'charge',
        category: chargeBucket.category,
        amount: grossAmount,
        description: descriptionText,
        reference_number: billRef,
        performed_by: userId,
      })
      .select('id')
      .single();

    if (transactionRes.error) {
      throw transactionRes.error;
    }

    const newBucketValue = Number((folio as any)[chargeBucket.folioField] || 0) + grossAmount;
    const roomCharges = Math.max(Number(folio.room_charges || 0), Number(reservation.total_amount || 0));
    const foodCharges = chargeBucket.folioField === 'food_charges' ? newBucketValue : Number(folio.food_charges || 0);
    const beverageCharges = chargeBucket.folioField === 'beverage_charges' ? newBucketValue : Number(folio.beverage_charges || 0);
    const otherCharges = chargeBucket.folioField === 'other_charges' ? newBucketValue : Number(folio.other_charges || 0);

    const calculatedTotalCharges = roomCharges + foodCharges + beverageCharges + otherCharges;
    const totalPayments = Number(folio.total_payments || 0);
    const calculatedBalance = Math.max(0, calculatedTotalCharges - totalPayments);

    const folioUpdatePayload: Record<string, any> = {
      room_charges: roomCharges,
      [chargeBucket.folioField]: newBucketValue,
      total_charges: calculatedTotalCharges,
      balance: calculatedBalance,
      updated_at: new Date().toISOString(),
    };

    const folioUpdateRes = await supabase
      .from('folios')
      .update(folioUpdatePayload)
      .eq('id', folio.id);

    if (folioUpdateRes.error) {
      throw folioUpdateRes.error;
    }

    // ── Itemised folio invoice ───────────────────────────────────────────────
    // Break the POS bill into ONE folio_transactions charge row PER ITEM so the
    // guest folio / checkout invoice lists the OUTLET + every item + amount, not
    // a single lump sum. Both invoice surfaces (the cashier hotel-bill lookup and
    // the folio sheet) render one line per folio_transactions charge row.
    // folio_transactions real cols: folio_id, branch_id, transaction_type
    // (NOT NULL), category, description, amount, tax_amount, total_amount,
    // reference, posted_by, status (CHECK posted|voided|reversed).
    const outletLabel = String(outlet_name || 'POS Outlet').trim();
    const billReference = bill_number || order_number || billRef;

    const normalizedItems = (Array.isArray(items) ? items : [])
      .map((raw: any) => {
        const name = String(
          raw?.name ?? raw?.item_name ?? raw?.description ?? raw?.drink_name ?? ''
        ).trim();
        const qtyRaw = Number(raw?.active_qty ?? raw?.quantity ?? raw?.qty ?? 1);
        const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
        const unitPriceRaw = Number(raw?.unit_price ?? raw?.price ?? 0) || 0;
        const lineTotal = Number(
          raw?.active_total ?? raw?.line_total ?? raw?.total ?? raw?.total_price ??
          (unitPriceRaw * qty)
        ) || 0;
        return {
          name,
          qty,
          unitPrice: unitPriceRaw || (qty > 0 ? lineTotal / qty : lineTotal),
          lineTotal,
        };
      })
      .filter((it) => it.name && it.lineTotal > 0);

    const itemsSum = normalizedItems.reduce((sum, it) => sum + it.lineTotal, 0);
    // Only itemise when the lines don't OVER-state the charged total; a small
    // shortfall (inclusive taxes / service charge) is topped up with a single
    // reconciling line so the itemised sum always equals grossAmount and never
    // inflates the folio balance.
    const canItemize = normalizedItems.length > 0 && itemsSum <= grossAmount + 0.5;

    let auditRows: Array<Record<string, any>>;
    let folioItemRows: Array<Record<string, any>> = [];
    if (canItemize) {
      auditRows = normalizedItems.map((it) => ({
        folio_id: folio.id,
        branch_id: branchId,
        transaction_type: 'charge',
        category: chargeBucket.category,
        description: `${outletLabel} · ${it.qty}x ${it.name}`,
        amount: it.lineTotal,
        tax_amount: 0,
        total_amount: it.lineTotal,
        reference: billReference,
        posted_by: userId,
        status: 'posted',
      }));
      const shortfall = Math.round((grossAmount - itemsSum) * 100) / 100;
      if (shortfall > 0.5) {
        auditRows.push({
          folio_id: folio.id,
          branch_id: branchId,
          transaction_type: 'charge',
          category: chargeBucket.category,
          description: `${outletLabel} · Taxes & service charge`,
          amount: shortfall,
          tax_amount: taxAmt,
          total_amount: shortfall,
          reference: billReference,
          posted_by: userId,
          status: 'posted',
        });
      }
      folioItemRows = normalizedItems.map((it) => ({
        folio_id: folio.id,
        description: `${outletLabel} · ${it.name}`,
        department: outletLabel,
        quantity: it.qty,
        unit_price: it.unitPrice,
        amount: it.lineTotal,
        charge_date: today,
        created_by: userId,
      }));
    } else {
      // No usable item breakdown — fall back to a single summary line.
      auditRows = [{
        folio_id: folio.id,
        branch_id: branchId,
        transaction_type: 'charge',
        category: chargeBucket.category,
        description: [
          descriptionText,
          outlet_name ? `@ ${outlet_name}` : null,
          waiter_name ? `by ${waiter_name}` : null,
        ].filter(Boolean).join(' '),
        amount: grossAmount,
        tax_amount: taxAmt,
        total_amount: grossAmount,
        reference: billReference,
        posted_by: userId,
        status: 'posted',
      }];
    }

    const roomChargeAuditRes = await supabase.from('folio_transactions').insert(auditRows);
    if (roomChargeAuditRes.error) {
      logger.warn(`Room charge audit insert skipped: ${roomChargeAuditRes.error.message}`);
    }

    if (folioItemRows.length > 0) {
      const folioItemsRes = await supabase.from('folio_items').insert(folioItemRows);
      if (folioItemsRes.error) {
        logger.warn(`Folio item insert skipped: ${folioItemsRes.error.message}`);
      }
    }

    await settleRoomChargeSourceBill({
      source,
      billId: bill_id,
      billNumber: bill_number,
      orderNumber: order_number,
      shortCode: req.body.short_code,
      bookingId: String(booking_id),
      roomNumber,
      guestName,
    });

    // Always purge any cached lookup for this bill so the cashier station
    // returns fresh data immediately after a room charge is posted.
    if (bill_id) {
      billCache.invalidatePattern(String(bill_id));
    }
    if (bill_number) {
      billCache.invalidatePattern(String(bill_number));
    }
    if (order_number) {
      billCache.invalidatePattern(String(order_number));
    }

    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource, metadata, branch_id, created_at)
       VALUES ($1, 'POST_ROOM_CHARGE', 'folios', $2, $3, NOW())`,
      [
        userId,
        JSON.stringify({
          folio_id: folio.id,
          folio_transaction_id: transactionRes.data.id,
          booking_id,
          guest_name: guestName,
          room_number: roomNumber,
          outlet_name,
          bill_number: billRef,
          amount: grossAmount,
          notes: notes || null,
        }),
        branchId,
      ]
    );

    res.json({
      success: true,
      message: `Bill ${billRef} posted successfully to Room ${roomNumber}`,
      folio_id: folio.id,
      folio_transaction_id: transactionRes.data.id,
      room_number: roomNumber,
      guest_name: guestName,
      amount: grossAmount,
      settlement_method: 'Room Charge',
    });
  } catch (error: any) {
    logger.error('Error posting room charge transaction:', error);
    res.status(500).json({ success: false, message: 'Failed to post room charge', error: error.message });
  }
};

export const reverseRoomCharge = async (req: Request, res: Response): Promise<void> => {
  const client = await db.getClient();
  try {
    const { transaction_id, reason } = req.body;
    const userId = (req as any).user?.id || null;
    const userName = (req as any).user?.name || 'Manager';

    if (!transaction_id || !reason) {
      res.status(400).json({ success: false, message: 'transaction_id and reason are required' });
      return;
    }

    await client.query('BEGIN');

    const transRes = await client.query(
      `SELECT * FROM folio_transactions WHERE id = $1 FOR UPDATE`,
      [transaction_id]
    );

    if (transRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Room charge transaction not found' });
      return;
    }

    const trans = transRes.rows[0];
    if (trans.status === 'reversed') {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: 'This room charge has already been reversed' });
      return;
    }

    const amountToDeduct = Number(trans.amount) || 0;

    await client.query(
      `UPDATE folio_transactions
       SET status = 'reversed',
           reversal_status = 'reversed',
           reversed_at = NOW(),
           reversed_by = $1,
           reversal_reason = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [userId, reason, transaction_id]
    );

    await client.query(
      `INSERT INTO folio_transactions (
        folio_id, booking_id, guest_id, branch_id, room_number,
        type, category, outlet_name, outlet_type,
        pos_bill_number, pos_order_number, amount,
        description, posted_by, posted_by_name, status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        'reversal', $6, $7, $8,
        $9, $10, $11,
        $12, $13, $14, 'reversed', NOW()
      )`,
      [
        trans.folio_id,
        trans.booking_id,
        trans.guest_id,
        trans.branch_id,
        trans.room_number,
        trans.category,
        trans.outlet_name,
        trans.outlet_type,
        trans.pos_bill_number,
        trans.pos_order_number,
        -amountToDeduct,
        `REVERSAL: ${trans.description} - Reason: ${reason}`,
        userId,
        userName,
      ]
    );

    if (trans.folio_id) {
      await client.query(
        `UPDATE folios
         SET total_charges = GREATEST(0, COALESCE(total_charges, 0) - $1),
             updated_at = NOW()
         WHERE id = $2`,
        [amountToDeduct, trans.folio_id]
      );
    }

    if (trans.booking_id) {
      await client.query(
        `UPDATE reservations
         SET updated_at = NOW()
         WHERE id = $1`,
        [trans.booking_id]
      );
    }

    if (trans.pos_bill_number) {
      await client.query(
        `UPDATE pos_orders
         SET payment_status = 'unpaid',
             status = 'pending',
             payment_method = NULL,
             updated_at = NOW()
         WHERE folio_transaction_id = $1 OR bill_number = $2`,
        [transaction_id, trans.pos_bill_number]
      );
    }

    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource, metadata, branch_id, created_at)
       VALUES ($1, 'REVERSE_ROOM_CHARGE', 'folio_transactions', $2, $3, NOW())`,
      [
        userId,
        JSON.stringify({
          transaction_id,
          booking_id: trans.booking_id,
          room_number: trans.room_number,
          amount: amountToDeduct,
          reason,
        }),
        trans.branch_id,
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Room charge transaction ${transaction_id} reversed successfully`,
      reversed_amount: amountToDeduct,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Error reversing room charge:', error);
    res.status(500).json({ success: false, message: 'Failed to reverse room charge', error: error.message });
  } finally {
    client.release();
  }
};

export const getRoomChargeReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;
    const outletName = req.query.outlet_name ? String(req.query.outlet_name) : null;
    const roomNumber = req.query.room_number ? String(req.query.room_number) : null;
    const status = req.query.status ? String(req.query.status) : 'active';

    let sql = `
      SELECT
        ft.*,
        b.name as branch_name
      FROM folio_transactions ft
      LEFT JOIN branches b ON b.id = ft.branch_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let idx = 1;

    if (branchId) {
      sql += ` AND ft.branch_id = $${idx++}`;
      params.push(branchId);
    }
    if (outletName) {
      sql += ` AND LOWER(ft.outlet_name) LIKE $${idx++}`;
      params.push(`%${outletName.toLowerCase()}%`);
    }
    if (roomNumber) {
      sql += ` AND ft.room_number = $${idx++}`;
      params.push(roomNumber);
    }
    if (status !== 'all') {
      sql += ` AND ft.status = $${idx++}`;
      params.push(status);
    }

    sql += ` ORDER BY ft.created_at DESC LIMIT 100`;

    const result = await db.query(sql, params);

    const totalPosted = result.rows
      .filter((row) => row.status === 'active')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    res.json({
      success: true,
      count: result.rows.length,
      total_posted_amount: totalPosted,
      transactions: result.rows,
    });
  } catch (error: any) {
    logger.error('Error fetching room charge reports:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch room charge reports', error: error.message });
  }
};
