import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

type PgClient = Awaited<ReturnType<typeof db.getClient>>;

type ReservationFinancialContext = {
  reservationId: string;
  confirmationNumber: string | null;
  guestName: string;
  roomNumber: string | null;
  branchId: number | null;
  roomCharges: number;
  foodCharges: number;
  beverageCharges: number;
  otherCharges: number;
  folioPayments: number;
  reservationBasePaid: number;
  totalCharges: number;
  totalPaid: number;
  outstandingBalance: number;
  folioId: string;
  folioStatus: string | null;
};

type RecordHotelPaymentInput = {
  reservationId: string;
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  cashierUserId: string;
  cashierName?: string | null;
  amountTendered?: number;
  changeGiven?: number;
};

type RecordHotelPaymentResult = {
  paymentId: string;
  reservationId: string;
  confirmationNumber: string | null;
  folioId: string;
  cashierTransactionId: string;
  cashierTransactionNumber: string;
  cashierShiftLogId: string;
  branchId: number | null;
  roomNumber: string | null;
  guestName: string;
  method: string;
  amount: number;
  totalCharges: number;
  totalPaid: number;
  balance: number;
  paymentStatus: string;
  folioStatus: string | null;
};

function normalizeShiftPaymentMethod(raw: string): 'cash' | 'mpesa' | 'card' | 'credit' {
  const value = String(raw || '').trim().toLowerCase();
  if (value.includes('mpesa') || value.includes('m-pesa')) return 'mpesa';
  if (value.includes('card') || value.includes('swipe') || value.includes('visa')) return 'card';
  if (value.includes('credit')) return 'credit';
  return 'cash';
}

function normalizePaymentMethod(raw: string): string {
  const value = String(raw || '').trim().toLowerCase();
  if (value.includes('mpesa') || value.includes('m-pesa')) return 'mpesa';
  if (value.includes('card') || value.includes('swipe') || value.includes('visa')) return 'card';
  if (value.includes('credit')) return 'credit_bill';
  return 'cash';
}

function isImmediateCashierHotelMethod(raw: string): boolean {
  const method = normalizePaymentMethod(raw);
  return ['cash', 'mpesa', 'card', 'credit_bill'].includes(method);
}

function money(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function generateCashierTransactionNumber(client: PgClient): Promise<string> {
  try {
    await client.query('SAVEPOINT gen_tx_num');
    const result = await client.query(
      'SELECT generate_cashier_transaction_number() AS transaction_number'
    );
    await client.query('RELEASE SAVEPOINT gen_tx_num');
    const transactionNumber = String(result.rows[0]?.transaction_number || '').trim();
    if (transactionNumber) return transactionNumber;
  } catch (error: any) {
    await client.query('ROLLBACK TO SAVEPOINT gen_tx_num');
    logger.warn('generate_cashier_transaction_number failed, using timestamp fallback', {
      error: error?.message,
    });
  }

  return `CT${Date.now()}`;
}

async function requireActiveCashierShift(
  client: PgClient,
  cashierUserId: string,
  branchId?: number | null
) {
  const params: any[] = [cashierUserId];
  let sql = `
    SELECT id, branch_id, cashier_id, shift_number, shift_start, status
    FROM cashier_shift_logs
    WHERE cashier_id = $1
      AND status = 'open'
  `;

  if (branchId) {
    params.push(branchId);
    sql += ` AND branch_id = $${params.length}`;
  }

  sql += `
    ORDER BY shift_start DESC NULLS LAST, created_at DESC
    LIMIT 1
    FOR UPDATE
  `;

  const result = await client.query(sql, params);
  const shift = result.rows[0];
  if (!shift) {
    throw new AppError(
      'An active cashier shift is required before collecting hotel payments.',
      409
    );
  }
  return shift;
}

async function ensureFolio(
  client: PgClient,
  reservation: any
): Promise<{ id: string; status: string | null; room_charges: number; food_charges: number; beverage_charges: number; other_charges: number; total_charges: number; total_payments: number; balance: number; }> {
  const existing = await client.query(
    `
      SELECT
        id,
        status,
        room_charges,
        food_charges,
        beverage_charges,
        other_charges,
        total_charges,
        total_payments,
        balance
      FROM folios
      WHERE reservation_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `,
    [reservation.id]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const created = await client.query(
    `
      INSERT INTO folios (
        branch_id,
        reservation_id,
        guest_id,
        folio_number,
        status,
        room_charges,
        food_charges,
        beverage_charges,
        other_charges,
        total_charges,
        total_payments,
        balance,
        balance_due,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, 'open',
        $5, 0, 0, 0, $5, 0, $5, $5, NOW(), NOW()
      )
      RETURNING
        id,
        status,
        room_charges,
        food_charges,
        beverage_charges,
        other_charges,
        total_charges,
        total_payments,
        balance
    `,
    [
      reservation.branch_id,
      reservation.id,
      reservation.guest_id,
      reservation.confirmation_number || `FOL-${Date.now()}`,
      money(reservation.total_amount),
    ]
  );

  return created.rows[0];
}

async function loadReservationFinancialContextWithClient(
  client: PgClient,
  reservationId: string
): Promise<ReservationFinancialContext> {
  const reservationRes = await client.query(
    `
      SELECT
        r.id,
        r.branch_id,
        r.confirmation_number,
        r.guest_id,
        r.status,
        r.total_amount,
        r.amount_paid,
        r.deposit_amount,
        r.deposit_paid,
        rm.room_number,
        TRIM(CONCAT(COALESCE(g.first_name, ''), ' ', COALESCE(g.last_name, ''))) AS guest_name
      FROM reservations r
      LEFT JOIN rooms rm ON rm.id = r.room_id
      LEFT JOIN guests g ON g.id = r.guest_id
      WHERE r.id = $1
      LIMIT 1
      FOR UPDATE OF r
    `,
    [reservationId]
  );

  const reservation = reservationRes.rows[0];
  if (!reservation) {
    throw new AppError('Hotel reservation not found', 404);
  }

  const folio = await ensureFolio(client, reservation);

  const roomCharges = Math.max(money(reservation.total_amount), money(folio.room_charges));
  const foodCharges = money(folio.food_charges);
  const beverageCharges = money(folio.beverage_charges);
  const otherCharges = money(folio.other_charges);
  const folioPayments = money(folio.total_payments);
  const reservationBasePaid = reservation.deposit_paid 
    ? Math.max(money(reservation.amount_paid), money(reservation.deposit_amount))
    : money(reservation.amount_paid);
  const totalCharges = roomCharges + foodCharges + beverageCharges + otherCharges;
  const totalPaid = reservationBasePaid + folioPayments;
  const outstandingBalance = Math.max(0, totalCharges - totalPaid);

  return {
    reservationId: String(reservation.id),
    confirmationNumber: reservation.confirmation_number || null,
    guestName: String(reservation.guest_name || '').trim() || 'Guest',
    roomNumber: reservation.room_number || null,
    branchId: reservation.branch_id ?? null,
    roomCharges,
    foodCharges,
    beverageCharges,
    otherCharges,
    folioPayments,
    reservationBasePaid,
    totalCharges,
    totalPaid,
    outstandingBalance,
    folioId: String(folio.id),
    folioStatus: folio.status || null,
  };
}

export async function loadReservationFinancialContext(
  reservationId: string
): Promise<ReservationFinancialContext> {
  const client = await db.getClient();
  try {
    return await loadReservationFinancialContextWithClient(client, reservationId);
  } finally {
    client.release();
  }
}

export async function assertHotelCashierShiftAvailable(
  cashierUserId: string,
  branchId?: number | null
): Promise<void> {
  const client = await db.getClient();
  try {
    await requireActiveCashierShift(client, cashierUserId, branchId);
  } finally {
    client.release();
  }
}

export async function recordHotelCashierPayment(
  input: RecordHotelPaymentInput
): Promise<RecordHotelPaymentResult> {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const normalizedMethod = normalizePaymentMethod(input.paymentMethod);
    if (!isImmediateCashierHotelMethod(normalizedMethod)) {
      throw new AppError(
        'Unsupported hotel payment method. Use Cash, M-Pesa, Card, or Credit Bill.',
        400
      );
    }

    const amount = money(input.amount);
    if (!(amount > 0)) {
      throw new AppError('A positive payment amount is required', 400);
    }

    const context = await loadReservationFinancialContextWithClient(
      client,
      input.reservationId
    );
    const shift = await requireActiveCashierShift(
      client,
      input.cashierUserId,
      context.branchId
    );

    if (context.outstandingBalance <= 0.009) {
      throw new AppError('This room bill is already fully settled', 409);
    }

    if (amount > context.outstandingBalance + 0.01) {
      throw new AppError(
        `Payment amount (${amount.toFixed(2)}) exceeds room bill balance (${context.outstandingBalance.toFixed(2)})`,
        400
      );
    }

    const paymentReference = String(input.reference || '').trim() || `HOTEL-${Date.now()}`;
    const paymentStatus = 'completed';

    const paymentInsert = await client.query(
      `
        INSERT INTO payments (
          branch_id,
          booking_id,
          reservation_id,
          amount,
          payment_method,
          status,
          reference,
          reference_number,
          customer_name,
          recorded_by,
          cashier_id,
          recorded_at,
          payment_date,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $2, $3, $4, $5, $6, $6, $7, $8, $8, NOW(), NOW(), $9::jsonb, NOW(), NOW()
        )
        RETURNING id
      `,
      [
        context.branchId,
        context.reservationId,
        amount,
        normalizedMethod,
        paymentStatus,
        paymentReference,
        context.guestName,
        input.cashierUserId,
        JSON.stringify({
          processed_by: 'shared_hotel_cashier_payment_service',
          cashier_id: input.cashierUserId,
          cashier_name: input.cashierName || null,
          reservation_id: context.reservationId,
          confirmation_number: context.confirmationNumber,
          room_number: context.roomNumber,
        }),
      ]
    );

    const paymentId = String(paymentInsert.rows[0].id);

    await client.query(
      `
        INSERT INTO transactions (
          folio_id,
          type,
          category,
          amount,
          description,
          reference_number,
          performed_by,
          created_at
        )
        VALUES ($1, 'payment', $2, $3, $4, $5, $6, NOW())
      `,
      [
        context.folioId,
        normalizedMethod,
        amount,
        `Room bill payment (${normalizedMethod}) at cashier`,
        paymentReference,
        input.cashierUserId,
      ]
    );

    const nextFolioPayments = context.folioPayments + amount;
    const nextTotalPaid = context.reservationBasePaid + nextFolioPayments;
    const nextBalance = Math.max(0, context.totalCharges - nextTotalPaid);
    const nextReservationPaymentStatus =
      nextBalance <= 0.009 ? 'paid' : nextTotalPaid > 0 ? 'partial' : 'pending';

    await client.query(
      `
        UPDATE folios
        SET
          room_charges = $2,
          total_charges = $3,
          total_payments = $4,
          balance = $5,
          balance_due = $5,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        context.folioId,
        context.roomCharges,
        context.totalCharges,
        nextFolioPayments,
        nextBalance,
      ]
    );

    await client.query(
      `
        UPDATE reservations
        SET
          amount_paid = GREATEST(COALESCE(amount_paid, 0), $3),
          payment_status = $2,
          deposit_paid = CASE WHEN $3 > 0 THEN TRUE ELSE deposit_paid END,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        context.reservationId,
        nextReservationPaymentStatus,
        nextTotalPaid,
      ]
    );

    const cashierTransactionNumber = await generateCashierTransactionNumber(client);
    const cashierTransactionInsert = await client.query(
      `
        INSERT INTO cashier_transactions (
          branch_id,
          cashier_id,
          cashier_shift_log_id,
          shift_id,
          transaction_number,
          transaction_type,
          revenue_type,
          reference_type,
          reference_id,
          source_module,
          source_document_type,
          source_document_id,
          source_document_number,
          payment_method,
          amount,
          amount_tendered,
          change_given,
          payment_reference,
          confirmation_number,
          customer_name,
          status,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $3, $4, 'payment', 'ROOM_BOOKING', 'reservation', $5,
          'RECEPTION', 'ROOM_FOLIO', $6, $7, $8, $9, $10, $11, $12, $7, $13,
          'completed', NOW(), NOW()
        )
        RETURNING id
      `,
      [
        context.branchId,
        input.cashierUserId,
        shift.id,
        cashierTransactionNumber,
        context.reservationId,
        context.folioId,
        context.confirmationNumber,
        normalizedMethod,
        amount,
        money(input.amountTendered),
        money(input.changeGiven),
        paymentReference,
        context.guestName,
      ]
    );

    const cashierTransactionId = String(cashierTransactionInsert.rows[0].id);
    const shiftMethod = normalizeShiftPaymentMethod(normalizedMethod);

    await client.query(
      `
        INSERT INTO cashier_shift_transactions (
          shift_id,
          transaction_id,
          transaction_ref,
          payment_method,
          amount,
          transaction_time
        )
        VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [
        shift.id,
        cashierTransactionId,
        cashierTransactionNumber,
        shiftMethod,
        amount,
      ]
    );

    await client.query(
      `
        UPDATE cashier_shift_logs
        SET
          total_sales = COALESCE(total_sales, 0) + $2,
          transaction_count = COALESCE(transaction_count, 0) + 1,
          room_booking_revenue = COALESCE(room_booking_revenue, 0) + $2,
          total_cash_sales = COALESCE(total_cash_sales, 0) + CASE WHEN $3 = 'cash' THEN $2 ELSE 0 END,
          total_mpesa_sales = COALESCE(total_mpesa_sales, 0) + CASE WHEN $3 = 'mpesa' THEN $2 ELSE 0 END,
          total_card_sales = COALESCE(total_card_sales, 0) + CASE WHEN $3 = 'card' THEN $2 ELSE 0 END,
          credit_bills_taken = COALESCE(credit_bills_taken, 0) + CASE WHEN $3 = 'credit' THEN $2 ELSE 0 END,
          credit_bills_count = COALESCE(credit_bills_count, 0) + CASE WHEN $3 = 'credit' THEN 1 ELSE 0 END,
          updated_at = NOW()
        WHERE id = $1
      `,
      [shift.id, amount, shiftMethod]
    );

    await client.query(
      `
        INSERT INTO audit_logs (
          user_id,
          action,
          resource,
          metadata,
          branch_id,
          created_at
        )
        VALUES ($1, 'RECORD_HOTEL_CASHIER_PAYMENT', 'reservations', $2::jsonb, $3, NOW())
      `,
      [
        input.cashierUserId,
        JSON.stringify({
          reservation_id: context.reservationId,
          confirmation_number: context.confirmationNumber,
          folio_id: context.folioId,
          payment_id: paymentId,
          cashier_transaction_id: cashierTransactionId,
          cashier_shift_log_id: shift.id,
          method: normalizedMethod,
          amount,
          balance_after: nextBalance,
        }),
        context.branchId,
      ]
    );

    await client.query('COMMIT');

    return {
      paymentId,
      reservationId: context.reservationId,
      confirmationNumber: context.confirmationNumber,
      folioId: context.folioId,
      cashierTransactionId,
      cashierTransactionNumber,
      cashierShiftLogId: String(shift.id),
      branchId: context.branchId,
      roomNumber: context.roomNumber,
      guestName: context.guestName,
      method: normalizedMethod,
      amount,
      totalCharges: context.totalCharges,
      totalPaid: nextTotalPaid,
      balance: nextBalance,
      paymentStatus: nextReservationPaymentStatus,
      folioStatus: context.folioStatus,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
