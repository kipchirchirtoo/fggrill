import { Request, Response } from 'express';
import db from '../db';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const IN_HOUSE_ROOM_CHARGE_STATUSES = ['checked_in', 'checked-in', 'in-house', 'active'] as const;

const isFeatureEnabled = async (branchId: number, featureKey: string): Promise<boolean> => {
  const res = await db.query(
    'SELECT is_enabled FROM branch_features WHERE branch_id = $1 AND (feature_key = $2 OR feature_name = $2)',
    [branchId, featureKey]
  );
  if (res.rows.length === 0) return false;
  return Boolean(res.rows[0].is_enabled);
};

function todayInNairobi(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
}

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

function isCurrentInHouseStay(row: any, today: string): boolean {
  const status = String(row?.status || '').trim().toLowerCase();
  if (!IN_HOUSE_ROOM_CHARGE_STATUSES.includes(status as any)) return false;
  const checkIn = String(row?.check_in_date || '').trim();
  const checkOut = String(row?.check_out_date || '').trim();
  if (!checkIn || !checkOut) return false;
  if (checkIn > today || checkOut <= today) return false;
  return stayNights(checkIn, checkOut) >= 1;
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
  const { data: reservations, error } = await supabase
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
      advance_payment,
      amount_paid,
      adults,
      children,
      meal_plan,
      checked_in_at,
      guest:guests!guest_id(first_name,last_name,phone,email),
      room:rooms!room_id!inner(id, room_number, branch_id, status)
    `)
    .eq('room.branch_id', branchId)
    .in('status', [...IN_HOUSE_ROOM_CHARGE_STATUSES])
    .lte('check_in_date', today)
    .gt('check_out_date', today)
    .order('check_in_date', { ascending: false })
    .limit(100);

  if (error) throw error;

  const inHouseReservations = (reservations || []).filter((row: any) =>
    isCurrentInHouseStay(row, today)
  );

  const reservationIds = inHouseReservations.map((row: any) => row.id);
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

  const normalizedQuery = queryStr.trim().toLowerCase();

  return inHouseReservations
    .map((row: any) => {
      const folio = folioMap.get(String(row.id));
      const guestName = normalizeGuestName(row);
      const guest = relationRecord<any>(row?.guest);
      const room = relationRecord<any>(row?.room);
      const phone = String(guest?.phone || '').trim();
      const roomNumber = String(room?.room_number || '').trim();
      const confirmationNumber = String(row?.confirmation_number || '').trim();
      const nights = stayNights(row?.check_in_date, row?.check_out_date);
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
      const reservationPaid = Math.max(
        Number(row?.advance_payment || 0),
        Number(row?.amount_paid || 0),
        Number(row?.deposit_amount || 0)
      );
      const folioPayments = Number(folio?.total_payments || 0);
      const totalPaid = reservationPaid + folioPayments;
      const folioBalance = Math.max(0, roomGross + folioPosCharges - totalPaid);

      return {
        booking_id: row.id,
        folio_id: folio?.id || row.id,
        room_number: roomNumber,
        guest_name: guestName,
        guest_phone: phone,
        confirmation_number: confirmationNumber || `RSV-${row.id}`,
        check_in_date: row.check_in_date,
        check_out_date: row.check_out_date,
        occupants: Number(row?.adults || 0) + Number(row?.children || 0),
        stay_nights: nights,
        folio_balance: folioBalance,
        folio_pos_charges: folioPosCharges,
        folio_payments: totalPaid,
        total_amount: roomGross,
        amount_paid: totalPaid,
        meal_plan: row?.meal_plan || 'Room Only',
        eligibility_status: 'In house',
      };
    })
    .filter((row) => {
      if (!normalizedQuery) return true;
      return [
        row.room_number,
        row.guest_name,
        row.confirmation_number,
        row.guest_phone,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => String(a.room_number).localeCompare(String(b.room_number)));
}

async function settleRoomChargeSourceBill(input: {
  source?: string;
  billId?: string;
  bookingId: string;
  roomNumber: string;
  guestName: string;
}) {
  const normalizedSource = String(input.source || '').trim().toLowerCase();
  const billId = String(input.billId || '').trim();
  if (!billId) return;

  const now = new Date().toISOString();

  if (['restaurant', 'restaurant_order'].includes(normalizedSource)) {
    const { data: order } = await supabase
      .from('restaurant_orders')
      .select('id,total_amount')
      .eq('id', billId)
      .maybeSingle();

    if (order) {
      const totalAmount = Number(order.total_amount || 0);
      await supabase
        .from('restaurant_orders')
        .update({
          payment_status: 'room_charge',
          payment_method: 'ROOM_CHARGE',
          amount_paid: totalAmount,
          balance_amount: 0,
          status: 'delivered',
          updated_at: now,
        })
        .eq('id', billId);
      return;
    }
  }

  if (['bar', 'bar_order'].includes(normalizedSource)) {
    const { data: order } = await supabase
      .from('bar_orders')
      .select('id,total')
      .eq('id', billId)
      .maybeSingle();

    if (order) {
      const totalAmount = Number(order.total || 0);
      await supabase
        .from('bar_orders')
        .update({
          payment_status: 'room_charge',
          payment_method: 'ROOM_CHARGE',
          amount_paid: totalAmount,
          balance_amount: 0,
          status: 'completed',
          updated_at: now,
        })
        .eq('id', billId);
      return;
    }
  }

  if (['pos', 'pos_shift_order', 'captain', 'captain_order'].includes(normalizedSource)) {
    const { data: order } = await supabase
      .from('pos_shift_orders')
      .select('id,total_amount')
      .eq('id', billId)
      .maybeSingle();

    if (order) {
      const totalAmount = Number(order.total_amount || 0);
      await supabase
        .from('pos_shift_orders')
        .update({
          payment_status: 'room_charge',
          amount_paid: totalAmount,
          balance_amount: 0,
          status: 'paid',
          updated_at: now,
        })
        .eq('id', billId);
      return;
    }
  }

  if (normalizedSource === 'unpaid_bill') {
    const { data: bill } = await supabase
      .from('unpaid_bills')
      .select('id,total_amount,remarks')
      .eq('id', billId)
      .maybeSingle();

    if (bill) {
      const totalAmount = Number(bill.total_amount || 0);
      const remarks = [bill.remarks, `Charged to room ${input.roomNumber} (${input.guestName})`]
        .filter(Boolean)
        .join(' • ');

      await supabase
        .from('unpaid_bills')
        .update({
          paid_amount: totalAmount,
          balance_amount: 0,
          status: 'paid',
          remarks,
          updated_at: now,
        })
        .eq('id', billId);
      return;
    }
  }

  await supabase
    .from('pos_orders')
    .update({
      payment_status: 'room_charge',
      status: 'completed',
      payment_method: 'Room Charge',
      room_number: input.roomNumber,
      guest_name: input.guestName,
      booking_id: input.bookingId,
      updated_at: now,
    })
    .eq('id', billId);
}

export const getEligibleGuests = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = Number(req.query.branch_id || (req as any).user?.branch_id || 1);
    const queryStr = String(req.query.query || '').trim().toLowerCase();

    const roomChargingEnabled = await isFeatureEnabled(branchId, 'GUEST_ROOM_CHARGING');
    if (!roomChargingEnabled) {
      res.status(403).json({
        success: false,
        message: 'Guest Room Charging is disabled for this branch.',
        code: 'FEATURE_DISABLED',
      });
      return;
    }

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
    const reference = String(req.body.reference || '').trim() || null;
    if (!reservationId) { res.status(400).json({ success: false, message: 'reservationId is required' }); return; }
    if (!(amount > 0)) { res.status(400).json({ success: false, message: 'A positive amount is required' }); return; }

    const { data: folio, error: folioErr } = await supabase
      .from('folios')
      .select('id, balance, total_payments, total_charges')
      .eq('reservation_id', reservationId)
      .maybeSingle();
    if (folioErr) throw folioErr;
    if (!folio) { res.status(404).json({ success: false, message: 'No room bill (folio) exists for this reservation yet.' }); return; }

    const { error: txErr } = await supabase.from('transactions').insert({
      folio_id: folio.id,
      type: 'payment',
      category: method,
      amount,
      description: `Room bill payment (${method}) at cashier`,
      reference_number: reference,
      performed_by: (req as any).user?.id || null,
    });
    if (txErr) throw txErr;

    // The folio balance trigger recalculates on transaction insert; read back.
    const { data: updated } = await supabase
      .from('folios')
      .select('id, balance, total_payments, total_charges, status')
      .eq('id', folio.id)
      .maybeSingle();

    const newPayments = Number(updated?.total_payments ?? (Number(folio.total_payments || 0) + amount));
    const newBalance = Number(updated?.balance ?? (Number(folio.total_charges || 0) - newPayments));
    res.json({
      success: true,
      data: {
        reservation_id: reservationId,
        folio_id: folio.id,
        amount,
        method,
        total_payments: newPayments,
        balance: newBalance,
        status: updated?.status || null,
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

    if (!isCurrentInHouseStay(reservation, today)) {
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

    // folio_transactions audit row — only real columns: folio_id, branch_id,
    // transaction_type (NOT NULL), category, description, amount, tax_amount,
    // total_amount, reference, posted_by, status (CHECK: posted|voided|reversed).
    // Outlet/waiter/pos detail is folded into the description + reference.
    const auditDescription = [
      descriptionText,
      outlet_name ? `@ ${outlet_name}` : null,
      waiter_name ? `by ${waiter_name}` : null,
    ].filter(Boolean).join(' ');
    const roomChargeAuditRes = await supabase
      .from('folio_transactions')
      .insert({
        folio_id: folio.id,
        branch_id: branchId,
        transaction_type: 'charge',
        category: chargeBucket.category,
        description: auditDescription,
        amount: grossAmount,
        tax_amount: taxAmt,
        total_amount: grossAmount,
        reference: bill_number || order_number || billRef,
        posted_by: userId,
        status: 'posted',
      });

    if (roomChargeAuditRes.error) {
      logger.warn(`Room charge audit insert skipped: ${roomChargeAuditRes.error.message}`);
    }

    await settleRoomChargeSourceBill({
      source,
      billId: bill_id,
      bookingId: String(booking_id),
      roomNumber,
      guestName,
    });

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
