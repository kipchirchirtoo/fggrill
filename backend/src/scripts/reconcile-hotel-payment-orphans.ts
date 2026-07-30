import db from '../db';
import { findHotelPaymentOrphans } from '../services/receptionEventCashierPayment.service';

type PgClient = Awaited<ReturnType<typeof db.getClient>>;

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
  const method = normalizePaymentMethod(raw);
  if (method === 'mpesa') return 'mpesa';
  if (method === 'card') return 'card';
  if (method === 'credit_bill') return 'credit';
  return 'cash';
}

async function generateCashierTransactionNumber(client: PgClient): Promise<string> {
  try {
    const result = await client.query(
      'SELECT generate_cashier_transaction_number() AS transaction_number'
    );
    const transactionNumber = String(result.rows[0]?.transaction_number || '').trim();
    if (transactionNumber) return transactionNumber;
  } catch {}
  return `CT${Date.now()}`;
}

async function resolveShift(
  client: PgClient,
  cashierUserId: string,
  branchId: number | null,
  paymentDate: string | null
) {
  if (!paymentDate) return null;
  const result = await client.query(
    `
      SELECT id, branch_id, shift_start, shift_end, status
      FROM cashier_shift_logs
      WHERE cashier_id = $1
        AND ($2::int IS NULL OR branch_id = $2)
        AND shift_start <= $3::timestamptz
        AND COALESCE(shift_end, $3::timestamptz + INTERVAL '1 second') >= $3::timestamptz
      ORDER BY
        CASE WHEN status = 'open' THEN 0 ELSE 1 END,
        shift_start DESC
      LIMIT 2
    `,
    [cashierUserId, branchId, paymentDate]
  );

  if (result.rows.length !== 1) {
    return null;
  }
  return result.rows[0];
}

async function loadPaymentContext(client: PgClient, paymentId: string) {
  const result = await client.query(
    `
      SELECT
        p.id AS payment_id,
        p.branch_id,
        p.booking_id,
        p.reservation_id,
        p.amount,
        p.payment_method,
        COALESCE(p.reference, p.reference_number) AS payment_reference,
        COALESCE(p.payment_date, p.recorded_at, p.created_at) AS payment_date,
        p.cashier_id,
        p.recorded_by,
        r.id AS reservation_pk,
        r.confirmation_number,
        rm.room_number,
        TRIM(CONCAT(COALESCE(g.first_name, ''), ' ', COALESCE(g.last_name, ''))) AS guest_name
      FROM payments p
      LEFT JOIN reservations r
        ON r.id = COALESCE(p.reservation_id, p.booking_id)
      LEFT JOIN rooms rm
        ON rm.id = r.room_id
      LEFT JOIN guests g
        ON g.id = r.guest_id
      WHERE p.id = $1
      LIMIT 1
      FOR UPDATE
    `,
    [paymentId]
  );
  return result.rows[0] || null;
}

async function createCashierTransaction(
  client: PgClient,
  context: any,
  shiftId: string,
  cashierUserId: string
) {
  const transactionNumber = await generateCashierTransactionNumber(client);
  const insert = await client.query(
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
        payment_reference,
        confirmation_number,
        customer_name,
        status,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $3, $4, 'payment', 'ROOM_BOOKING', 'reservation', $5,
        'RECEPTION', 'ROOM_FOLIO', $6, $7, $8, $9, $10, $7, $11,
        'completed', NOW(), NOW()
      )
      RETURNING id, transaction_number
    `,
    [
      context.branch_id,
      cashierUserId,
      shiftId,
      transactionNumber,
      context.reservation_pk || context.reservation_id || context.booking_id,
      context.reservation_pk || context.reservation_id || context.booking_id,
      context.confirmation_number,
      normalizePaymentMethod(context.payment_method),
      money(context.amount),
      context.payment_reference,
      String(context.guest_name || '').trim() || 'Guest',
    ]
  );
  return insert.rows[0];
}

async function ensureShiftLink(
  client: PgClient,
  shiftId: string,
  cashierTransactionId: string,
  transactionNumber: string,
  branchId: number | null,
  paymentMethod: string,
  amount: number
) {
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
      VALUES ($1, $2, $3, $4, $5, NOW(), 'payments', $6, $7, 'Backfilled hotel cashier payment', 'RECEPTION')
      ON CONFLICT DO NOTHING
    `,
    [
      shiftId,
      cashierTransactionId,
      transactionNumber,
      normalizeShiftPaymentMethod(paymentMethod),
      amount,
      cashierTransactionId,
      branchId,
    ]
  );

  const shiftMethod = normalizeShiftPaymentMethod(paymentMethod);
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
    [shiftId, amount, shiftMethod]
  );
}

async function backfillOrphan(paymentId: string) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const context = await loadPaymentContext(client, paymentId);
    if (!context) {
      await client.query('ROLLBACK');
      return { status: 'missing_payment', paymentId };
    }

    const cashierUserId = context.cashier_id || context.recorded_by;
    if (!cashierUserId) {
      await client.query('ROLLBACK');
      return { status: 'missing_cashier', paymentId };
    }

    const shift = await resolveShift(client, cashierUserId, context.branch_id, context.payment_date);
    if (!shift) {
      await client.query('ROLLBACK');
      return { status: 'ambiguous_shift', paymentId };
    }

    const existingTransaction = await client.query(
      `
        SELECT id, transaction_number
        FROM cashier_transactions
        WHERE (
          COALESCE($2, '') <> ''
          AND (payment_reference = $2 OR reference_number = $2)
        )
        OR (
          reference_id = COALESCE($3::uuid, $4::uuid)
          AND LOWER(COALESCE(reference_type, '')) IN ('reservation', 'booking')
        )
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [
        paymentId,
        context.payment_reference,
        context.reservation_id,
        context.booking_id,
      ]
    );

    let cashierTransactionId = existingTransaction.rows[0]?.id as string | undefined;
    let transactionNumber = existingTransaction.rows[0]?.transaction_number as string | undefined;
    let createdTransaction = false;

    if (!cashierTransactionId || !transactionNumber) {
      const created = await createCashierTransaction(client, context, shift.id, cashierUserId);
      cashierTransactionId = created.id;
      transactionNumber = created.transaction_number;
      createdTransaction = true;
    }

    if (!cashierTransactionId || !transactionNumber) {
      await client.query('ROLLBACK');
      return { status: 'missing_cashier_transaction_identity', paymentId };
    }

    const existingShiftLink = await client.query(
      `
        SELECT id
        FROM cashier_shift_transactions
        WHERE transaction_id = $1 OR transaction_ref = $2
        LIMIT 1
      `,
      [cashierTransactionId, transactionNumber]
    );

    if (!existingShiftLink.rows[0]) {
      await ensureShiftLink(
        client,
        shift.id,
        cashierTransactionId,
        transactionNumber,
        context.branch_id,
        context.payment_method,
        money(context.amount)
      );
    }

    await client.query('COMMIT');
    return {
      status: createdTransaction ? 'backfilled_transaction_and_shift' : 'backfilled_shift_only',
      paymentId,
      shiftId: shift.id,
      cashierTransactionId,
    };
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    return {
      status: 'failed',
      paymentId,
      error: error?.message || String(error),
    };
  } finally {
    client.release();
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : 100;

  const report = await findHotelPaymentOrphans({ limit });
  console.log(
    JSON.stringify(
      {
        apply,
        total: report.total,
        scanned: report.rows.length,
        sample: report.rows.slice(0, 10),
      },
      null,
      2
    )
  );

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to backfill repairable hotel payment orphans.');
    return;
  }

  const results = [];
  for (const row of report.rows) {
    results.push(await backfillOrphan(row.payment_id));
  }

  console.log(JSON.stringify({ apply, results }, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
