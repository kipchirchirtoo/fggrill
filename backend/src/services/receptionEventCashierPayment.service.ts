import db from '../db';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

type PgClient = Awaited<ReturnType<typeof db.getClient>>;

type EventSourceType = 'conference' | 'catering';

type EventCashierPaymentInput = {
  bookingId: string;
  amount: number;
  paymentMethod: string;
  reference?: string | null;
  cashierUserId: string;
  cashierName?: string | null;
  amountTendered?: number;
  changeGiven?: number;
};

type EventCashierPaymentResult = {
  paymentId: string;
  bookingId: string;
  branchId: number | null;
  customerName: string;
  documentNumber: string | null;
  cashierTransactionId: string;
  cashierTransactionNumber: string;
  cashierShiftLogId: string;
  amount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  paymentStatus: string;
  paymentReference: string;
};

type HotelPaymentOrphanRow = {
  payment_id: string;
  branch_id: number | null;
  reservation_id: string | null;
  booking_id: string | null;
  confirmation_number: string | null;
  room_number: string | null;
  guest_name: string | null;
  amount: number;
  payment_method: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  cashier_id: string | null;
  recorded_by: string | null;
  cashier_transaction_id: string | null;
  cashier_transaction_number: string | null;
  shift_transaction_id: string | null;
  orphan_type: 'missing_cashier_transaction' | 'missing_shift_link';
};

function money(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePaymentMethod(raw: string): string {
  const value = String(raw || '').trim().toLowerCase();
  if (value.includes('mpesa') || value.includes('m-pesa')) return 'mpesa';
  if (value.includes('card') || value.includes('swipe') || value.includes('visa')) return 'card';
  if (value.includes('credit')) return 'credit_bill';
  return 'cash';
}

function normalizeShiftPaymentMethod(raw: string): 'cash' | 'mpesa' | 'card' | 'credit' {
  const value = normalizePaymentMethod(raw);
  if (value === 'mpesa') return 'mpesa';
  if (value === 'card') return 'card';
  if (value === 'credit_bill') return 'credit';
  return 'cash';
}

function isImmediateMethod(raw: string): boolean {
  return ['cash', 'mpesa', 'card', 'credit_bill'].includes(normalizePaymentMethod(raw));
}

async function generateCashierTransactionNumber(client: PgClient): Promise<string> {
  try {
    const result = await client.query(
      'SELECT generate_cashier_transaction_number() AS transaction_number'
    );
    const transactionNumber = String(result.rows[0]?.transaction_number || '').trim();
    if (transactionNumber) return transactionNumber;
  } catch (error: any) {
    logger.warn('generate_cashier_transaction_number failed for reception event payment', {
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
    SELECT id, branch_id, cashier_id, shift_number, shift_start, shift_end, status
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
      'An active cashier shift is required before collecting event payments.',
      409
    );
  }
  return shift;
}

async function loadConferenceBooking(client: PgClient, bookingId: string) {
  const result = await client.query(
    `
      SELECT
        id,
        branch_id,
        invoice_number,
        COALESCE(client_name, 'Conference Client') AS customer_name,
        total_amount,
        GREATEST(COALESCE(amount_paid, 0), COALESCE(deposit_amount, 0)) AS paid_amount,
        COALESCE(
          balance_amount,
          GREATEST(COALESCE(total_amount, 0) - GREATEST(COALESCE(amount_paid, 0), COALESCE(deposit_amount, 0)), 0)
        ) AS balance_amount,
        payment_status
      FROM conference_hall_bookings
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [bookingId]
  );

  const booking = result.rows[0];
  if (!booking) {
    throw new AppError('Conference booking not found', 404);
  }
  return booking;
}

async function loadCateringBooking(client: PgClient, bookingId: string) {
  const result = await client.query(
    `
      SELECT
        id,
        branch_id,
        booking_number,
        COALESCE(client_name, customer_name, 'Catering Client') AS customer_name,
        total_amount,
        GREATEST(COALESCE(amount_paid, 0), COALESCE(deposit_amount, 0)) AS paid_amount,
        COALESCE(
          balance_amount,
          GREATEST(
            COALESCE(total_amount, 0) - GREATEST(COALESCE(amount_paid, 0), COALESCE(deposit_amount, 0)),
            0
          )
        ) AS balance_amount,
        payment_status
      FROM catering_bookings
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [bookingId]
  );

  const booking = result.rows[0];
  if (!booking) {
    throw new AppError('Catering booking not found', 404);
  }
  return booking;
}

async function recordEventCashierPayment(
  source: EventSourceType,
  input: EventCashierPaymentInput
): Promise<EventCashierPaymentResult> {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    if (!isImmediateMethod(input.paymentMethod)) {
      throw new AppError(
        'Unsupported event payment method. Use Cash, M-Pesa, Card, or Credit Bill.',
        400
      );
    }

    const normalizedMethod = normalizePaymentMethod(input.paymentMethod);
    const shiftMethod = normalizeShiftPaymentMethod(normalizedMethod);
    const amount = money(input.amount);
    if (!(amount > 0)) {
      throw new AppError('A positive payment amount is required', 400);
    }

    const booking =
      source === 'conference'
        ? await loadConferenceBooking(client, input.bookingId)
        : await loadCateringBooking(client, input.bookingId);

    const totalAmount = money(booking.total_amount);
    const paidBefore = money(booking.paid_amount);
    const balanceBefore = Math.max(
      0,
      Math.max(money(booking.balance_amount), totalAmount - paidBefore)
    );

    if (balanceBefore <= 0.009) {
      throw new AppError(
        source === 'conference'
          ? 'This conference booking is already fully settled'
          : 'This catering booking is already fully settled',
        409
      );
    }

    if (amount > balanceBefore + 0.01) {
      throw new AppError(
        `Payment amount (${amount.toFixed(2)}) exceeds booking balance (${balanceBefore.toFixed(2)})`,
        400
      );
    }

    const shift = await requireActiveCashierShift(client, input.cashierUserId, booking.branch_id);
    const paymentReference = String(input.reference || '').trim() || `${source.toUpperCase()}-${Date.now()}`;
    const paymentStatus = amount >= balanceBefore - 0.009 ? 'paid' : 'partial';
    const paidAfter = paidBefore + amount;
    const balanceAfter = Math.max(0, totalAmount - paidAfter);
    const documentNumber =
      source === 'conference'
        ? String(booking.invoice_number || '').trim() || null
        : String(booking.booking_number || '').trim() || null;
    const revenueType = source === 'conference' ? 'CONFERENCE' : 'CATERING';
    const referenceType = source === 'conference' ? 'conference_booking' : 'catering_booking';
    const sourceDocumentType = source === 'conference' ? 'CONFERENCE_BOOKING' : 'CATERING_BOOKING';
    const sourceTable = source === 'conference' ? 'conference_hall_bookings' : 'catering_bookings';

    const paymentInsert = await client.query(
      `
        INSERT INTO payments (
          branch_id,
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
          $1, $2, $3, 'completed', $4, $4, $5, $6, $6, NOW(), NOW(), $7::jsonb, NOW(), NOW()
        )
        RETURNING id
      `,
      [
        booking.branch_id,
        amount,
        normalizedMethod,
        paymentReference,
        booking.customer_name,
        input.cashierUserId,
        JSON.stringify({
          processed_by: 'reception_event_cashier_payment_service',
          cashier_id: input.cashierUserId,
          cashier_name: input.cashierName || null,
          source_module: 'RECEPTION',
          source_document_type: sourceDocumentType,
          source_document_id: booking.id,
          source_document_number: documentNumber,
          revenue_type: revenueType,
        }),
      ]
    );

    const paymentId = String(paymentInsert.rows[0].id);

    if (source === 'conference') {
      await client.query(
        `
          UPDATE conference_hall_bookings
          SET
            deposit_amount = $2,
            amount_paid = $2,
            balance_amount = $3,
            payment_status = $4,
            updated_at = NOW()
          WHERE id = $1
        `,
        [booking.id, paidAfter, balanceAfter, paymentStatus]
      );
    } else {
      await client.query(
        `
          UPDATE catering_bookings
          SET
            amount_paid = $2,
            deposit_amount = $2,
            balance_amount = $3,
            payment_status = $4,
            updated_at = NOW()
          WHERE id = $1
        `,
        [booking.id, paidAfter, balanceAfter, paymentStatus]
      );
    }

    const cashierTransactionNumber = await generateCashierTransactionNumber(client);
    const cashierTransactionInsert = await client.query(
      `
        INSERT INTO cashier_transactions (
          branch_id,
          cashier_id,
          cashier_name,
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
          customer_name,
          status,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $4, $5, 'payment', $6, $7, $8,
          'RECEPTION', $9, $8, $10, $11, $12, $13, $14, $15, $16,
          'completed', NOW(), NOW()
        )
        RETURNING id
      `,
      [
        booking.branch_id,
        input.cashierUserId,
        input.cashierName || null,
        shift.id,
        cashierTransactionNumber,
        revenueType,
        referenceType,
        booking.id,
        sourceDocumentType,
        documentNumber,
        normalizedMethod,
        amount,
        money(input.amountTendered),
        money(input.changeGiven),
        paymentReference,
        booking.customer_name,
      ]
    );

    const cashierTransactionId = String(cashierTransactionInsert.rows[0].id);

    await client.query(
      `
        INSERT INTO cashier_shift_transactions (
          shift_id,
          transaction_id,
          transaction_ref,
          payment_method,
          amount,
          transaction_time,
          source_table,
          source_id,
          branch_id,
          notes,
          source
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, 'RECEPTION')
      `,
      [
        shift.id,
        cashierTransactionId,
        cashierTransactionNumber,
        shiftMethod,
        amount,
        sourceTable,
        booking.id,
        booking.branch_id,
        `${revenueType} payment`,
      ]
    );

    const revenueColumn = source === 'conference' ? 'conference_revenue' : 'other_revenue';
    await client.query(
      `
        UPDATE cashier_shift_logs
        SET
          total_sales = COALESCE(total_sales, 0) + $2,
          transaction_count = COALESCE(transaction_count, 0) + 1,
          ${revenueColumn} = COALESCE(${revenueColumn}, 0) + $2,
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
        VALUES ($1, $2, $3, $4::jsonb, $5, NOW())
      `,
      [
        input.cashierUserId,
        source === 'conference'
          ? 'RECORD_CONFERENCE_CASHIER_PAYMENT'
          : 'RECORD_CATERING_CASHIER_PAYMENT',
        sourceTable,
        JSON.stringify({
          payment_id: paymentId,
          booking_id: booking.id,
          cashier_transaction_id: cashierTransactionId,
          cashier_shift_log_id: shift.id,
          amount,
          payment_method: normalizedMethod,
          payment_reference: paymentReference,
          balance_after: balanceAfter,
        }),
        booking.branch_id,
      ]
    );

    await client.query('COMMIT');

    return {
      paymentId,
      bookingId: String(booking.id),
      branchId: booking.branch_id ?? null,
      customerName: String(booking.customer_name || '').trim() || 'Customer',
      documentNumber,
      cashierTransactionId,
      cashierTransactionNumber,
      cashierShiftLogId: String(shift.id),
      amount,
      totalAmount,
      paidAmount: paidAfter,
      balance: balanceAfter,
      paymentStatus,
      paymentReference,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function recordConferenceCashierPayment(
  input: EventCashierPaymentInput
): Promise<EventCashierPaymentResult> {
  return recordEventCashierPayment('conference', input);
}

export async function recordCateringCashierPayment(
  input: EventCashierPaymentInput
): Promise<EventCashierPaymentResult> {
  return recordEventCashierPayment('catering', input);
}

export async function findHotelPaymentOrphans(params?: {
  branchId?: number | null;
  limit?: number;
  offset?: number;
}): Promise<{ total: number; rows: HotelPaymentOrphanRow[] }> {
  const branchId = params?.branchId ?? null;
  const limit = Math.max(1, Math.min(500, Number(params?.limit || 100)));
  const offset = Math.max(0, Number(params?.offset || 0));
  const client = await db.getClient();
  try {
    const sql = `
      WITH hotel_payments AS (
        SELECT
          p.id AS payment_id,
          p.branch_id,
          p.reservation_id,
          p.booking_id,
          COALESCE(p.reference, p.reference_number) AS payment_reference,
          p.amount,
          p.payment_method,
          p.cashier_id,
          p.recorded_by,
          COALESCE(p.payment_date, p.recorded_at, p.created_at) AS payment_date
        FROM payments p
        WHERE LOWER(COALESCE(p.status, '')) = 'completed'
          AND (p.reservation_id IS NOT NULL OR p.booking_id IS NOT NULL)
          AND ($1::int IS NULL OR p.branch_id = $1)
      ),
      annotated AS (
        SELECT
          hp.payment_id,
          hp.branch_id,
          hp.reservation_id,
          hp.booking_id,
          r.confirmation_number,
          rm.room_number,
          TRIM(CONCAT(COALESCE(g.first_name, ''), ' ', COALESCE(g.last_name, ''))) AS guest_name,
          hp.amount::numeric AS amount,
          hp.payment_method,
          hp.payment_reference,
          hp.payment_date,
          hp.cashier_id,
          hp.recorded_by,
          ct.id AS cashier_transaction_id,
          ct.transaction_number AS cashier_transaction_number,
          cst.id AS shift_transaction_id,
          CASE
            WHEN ct.id IS NULL THEN 'missing_cashier_transaction'
            ELSE 'missing_shift_link'
          END AS orphan_type
        FROM hotel_payments hp
        LEFT JOIN reservations r
          ON r.id = COALESCE(hp.reservation_id, hp.booking_id)
        LEFT JOIN rooms rm
          ON rm.id = r.room_id
        LEFT JOIN guests g
          ON g.id = r.guest_id
        LEFT JOIN LATERAL (
          SELECT ct.*
          FROM cashier_transactions ct
          WHERE (
            COALESCE(hp.payment_reference, '') <> ''
            AND (
              ct.payment_reference = hp.payment_reference
              OR ct.reference_number = hp.payment_reference
            )
          )
          OR (
            ct.reference_id = COALESCE(hp.reservation_id, hp.booking_id)
            AND LOWER(COALESCE(ct.reference_type, '')) IN ('reservation', 'booking')
          )
          ORDER BY ct.created_at DESC
          LIMIT 1
        ) ct ON TRUE
        LEFT JOIN LATERAL (
          SELECT cst.*
          FROM cashier_shift_transactions cst
          WHERE (
            ct.id IS NOT NULL
            AND (
              cst.transaction_id = ct.id
              OR cst.transaction_ref = ct.transaction_number
            )
          )
          ORDER BY cst.created_at DESC NULLS LAST, cst.transaction_time DESC NULLS LAST
          LIMIT 1
        ) cst ON TRUE
      )
      SELECT *
      FROM annotated
      WHERE cashier_transaction_id IS NULL OR shift_transaction_id IS NULL
      ORDER BY payment_date DESC NULLS LAST, payment_id DESC
      LIMIT $2 OFFSET $3
    `;

    const countSql = `
      WITH hotel_payments AS (
        SELECT
          p.id AS payment_id,
          p.branch_id,
          p.reservation_id,
          p.booking_id,
          COALESCE(p.reference, p.reference_number) AS payment_reference
        FROM payments p
        WHERE LOWER(COALESCE(p.status, '')) = 'completed'
          AND (p.reservation_id IS NOT NULL OR p.booking_id IS NOT NULL)
          AND ($1::int IS NULL OR p.branch_id = $1)
      )
      SELECT COUNT(*)::int AS total
      FROM hotel_payments hp
      LEFT JOIN LATERAL (
        SELECT ct.id, ct.transaction_number
        FROM cashier_transactions ct
        WHERE (
          COALESCE(hp.payment_reference, '') <> ''
          AND (
            ct.payment_reference = hp.payment_reference
            OR ct.reference_number = hp.payment_reference
          )
        )
        OR (
          ct.reference_id = COALESCE(hp.reservation_id, hp.booking_id)
          AND LOWER(COALESCE(ct.reference_type, '')) IN ('reservation', 'booking')
        )
        ORDER BY ct.created_at DESC
        LIMIT 1
      ) ct ON TRUE
      LEFT JOIN LATERAL (
        SELECT cst.id
        FROM cashier_shift_transactions cst
        WHERE (
          ct.id IS NOT NULL
          AND (
            cst.transaction_id = ct.id
            OR cst.transaction_ref = ct.transaction_number
          )
        )
        ORDER BY cst.created_at DESC NULLS LAST, cst.transaction_time DESC NULLS LAST
        LIMIT 1
      ) cst ON TRUE
      WHERE ct.id IS NULL OR cst.id IS NULL
    `;

    const [rowsResult, countResult] = await Promise.all([
      client.query(sql, [branchId, limit, offset]),
      client.query(countSql, [branchId]),
    ]);

    return {
      total: Number(countResult.rows[0]?.total || 0),
      rows: rowsResult.rows.map((row) => ({
        ...row,
        amount: money(row.amount),
      })),
    };
  } finally {
    client.release();
  }
}
