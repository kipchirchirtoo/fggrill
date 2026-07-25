import { Request, Response } from 'express';
import db from '../db';
import { logger } from '../utils/logger';

/**
 * Helper: Check feature toggle status for a branch
 */
const isFeatureEnabled = async (branchId: number, featureKey: string): Promise<boolean> => {
  const res = await db.query(
    'SELECT is_enabled FROM branch_features WHERE branch_id = $1 AND (feature_key = $2 OR feature_name = $2)',
    [branchId, featureKey]
  );
  if (res.rows.length === 0) return false;
  return Boolean(res.rows[0].is_enabled);
};

/**
 * 1. Get Eligible Guests for Room Charging
 * Only returns checked-in, confirmed guests with assigned rooms & open folios in the same branch.
 */
export const getEligibleGuests = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = Number(req.query.branch_id || (req as any).user?.branch_id || 1);
    const queryStr = String(req.query.query || '').trim().toLowerCase();

    // Check parent feature toggle
    const roomChargingEnabled = await isFeatureEnabled(branchId, 'GUEST_ROOM_CHARGING');
    if (!roomChargingEnabled) {
      res.status(403).json({
        success: false,
        message: 'Guest Room Charging is disabled for this branch.',
        code: 'FEATURE_DISABLED',
      });
      return;
    }

    let sql = `
      SELECT 
        b.id as booking_id,
        b.confirmation_number,
        b.guest_name,
        b.guest_phone,
        b.guest_email,
        b.room_number,
        b.check_in_date,
        b.check_out_date,
        b.status as booking_status,
        b.num_guests as occupants,
        b.total_amount,
        b.amount_paid,
        (COALESCE(b.total_amount, 0) - COALESCE(b.amount_paid, 0)) as folio_balance,
        b.meal_plan,
        f.id as folio_id,
        f.status as folio_status
      FROM bookings b
      LEFT JOIN folios f ON f.reservation_id = b.id OR f.guest_id = b.guest_id
      WHERE b.branch_id = $1
        AND LOWER(b.status) IN ('checked_in', 'checked-in', 'in-house', 'active')
        AND b.room_number IS NOT NULL
        AND b.room_number != ''
    `;

    const params: any[] = [branchId];

    if (queryStr) {
      params.push(`%${queryStr}%`);
      sql += ` AND (
        LOWER(b.room_number) LIKE $2 OR
        LOWER(b.guest_name) LIKE $2 OR
        LOWER(COALESCE(b.confirmation_number, '')) LIKE $2 OR
        LOWER(COALESCE(b.guest_phone, '')) LIKE $2
      )`;
    }

    sql += ` ORDER BY b.room_number ASC LIMIT 50`;

    const result = await db.query(sql, params);

    const eligibleGuests = result.rows.map((row) => ({
      booking_id: row.booking_id,
      folio_id: row.folio_id || row.booking_id,
      room_number: row.room_number,
      guest_name: row.guest_name || 'Guest',
      guest_phone: row.guest_phone || '',
      confirmation_number: row.confirmation_number || `BK-${row.booking_id}`,
      check_in_date: row.check_in_date,
      check_out_date: row.check_out_date,
      occupants: row.occupants || 1,
      folio_balance: Number(row.folio_balance || 0),
      total_amount: Number(row.total_amount || 0),
      amount_paid: Number(row.amount_paid || 0),
      meal_plan: row.meal_plan || 'Room Only',
      eligibility_status: 'Eligible',
    }));

    res.json({
      success: true,
      count: eligibleGuests.length,
      guests: eligibleGuests,
    });
  } catch (error: any) {
    logger.error('Error searching eligible room charge guests:', error);
    res.status(500).json({ success: false, message: 'Failed to search eligible guests', error: error.message });
  }
};

/**
 * 2. Post Bill to Guest Room Folio (Atomic Transaction)
 */
export const postRoomCharge = async (req: Request, res: Response): Promise<void> => {
  const client = await db.getClient();
  try {
    const {
      branch_id,
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

    // Step 1: Validate Parent & Outlet Feature Toggles
    const parentEnabled = await isFeatureEnabled(branchId, 'GUEST_ROOM_CHARGING');
    if (!parentEnabled) {
      res.status(403).json({ success: false, message: 'Guest Room Charging is disabled for this branch.' });
      return;
    }

    const outletNameStr = (outlet_name || '').toUpperCase();
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

    await client.query('BEGIN');

    // Step 2: Lock & Validate Guest Booking
    const bookingRes = await client.query(
      `SELECT id, guest_id, guest_name, room_number, status, total_amount, amount_paid, branch_id
       FROM bookings
       WHERE id = $1 FOR UPDATE`,
      [booking_id]
    );

    if (bookingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Active guest booking not found.' });
      return;
    }

    const booking = bookingRes.rows[0];
    const bookingStatus = (booking.status || '').toLowerCase();
    if (!['checked_in', 'checked-in', 'in-house', 'active'].includes(bookingStatus)) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: 'Guest is no longer checked in or has checked out.' });
      return;
    }

    if (Number(booking.branch_id) !== branchId) {
      await client.query('ROLLBACK');
      res.status(400).json({ success: false, message: 'Guest booking belongs to a different branch.' });
      return;
    }

    // Step 3: Validate & Lock POS Bill
    if (bill_id) {
      const billCheck = await client.query(
        `SELECT id, payment_status, status FROM pos_orders WHERE id = $1 FOR UPDATE`,
        [bill_id]
      );

      if (billCheck.rows.length > 0) {
        const bStatus = billCheck.rows[0].payment_status || billCheck.rows[0].status;
        if (bStatus === 'paid' || bStatus === 'cleared' || bStatus === 'room_charge') {
          await client.query('ROLLBACK');
          res.status(400).json({ success: false, message: 'This POS bill has already been settled or cleared.' });
          return;
        }
      }
    }

    // Step 4: Resolve or Create Folio
    let folioRes = await client.query(`SELECT id FROM folios WHERE reservation_id = $1 AND status = 'open'`, [
      booking_id,
    ]);
    let folioId = folioRes.rows.length > 0 ? folioRes.rows[0].id : null;

    if (!folioId) {
      const newFolioRes = await client.query(
        `INSERT INTO folios (reservation_id, guest_id, branch_id, status, total_charges, total_payments, created_at, updated_at)
         VALUES ($1, $2, $3, 'open', 0, 0, NOW(), NOW())
         RETURNING id`,
        [booking_id, booking.guest_id, branchId]
      );
      folioId = newFolioRes.rows[0].id;
    }

    const grossAmount = Number(total_amount) || 0;
    const taxAmt = Number(tax_amount) || 0;
    const discAmt = Number(discount_amount) || 0;
    const scAmt = Number(service_charge) || 0;
    const billRef = bill_number || order_number || `BILL-${Date.now()}`;

    const categoryLabel = outlet_name || 'Restaurant';
    const descriptionText = `${categoryLabel} — Bill ${billRef}`;
    const itemsSnapshotJson = JSON.stringify(items || []);

    // Step 5: Insert Folio Charge Transaction
    const folioTransRes = await client.query(
      `INSERT INTO folio_transactions (
        folio_id, booking_id, guest_id, branch_id, room_number,
        type, category, outlet_name, outlet_type,
        pos_bill_number, pos_order_number, amount, tax, discount, service_charge,
        description, items_snapshot, posted_by, posted_by_name, waiter_name, status, created_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        'charge', $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, 'active', NOW()
      ) RETURNING id`,
      [
        folioId,
        booking_id,
        booking.guest_id,
        branchId,
        room_number || booking.room_number,
        categoryLabel,
        outlet_name || 'Outlet',
        outlet_type || 'POS',
        bill_number || billRef,
        order_number || billRef,
        grossAmount,
        taxAmt,
        discAmt,
        scAmt,
        descriptionText,
        itemsSnapshotJson,
        userId,
        userName,
        waiter_name || 'Staff',
      ]
    );

    const folioTransactionId = folioTransRes.rows[0].id;

    // Step 6: Update Folio & Booking Charges Balance
    await client.query(
      `UPDATE folios
       SET total_charges = COALESCE(total_charges, 0) + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [grossAmount, folioId]
    );

    await client.query(
      `UPDATE bookings
       SET total_amount = COALESCE(total_amount, 0) + $1,
           updated_at = NOW()
       WHERE id = $2`,
      [grossAmount, booking_id]
    );

    // Step 7: Update POS Bill Settlement
    if (bill_id) {
      await client.query(
        `UPDATE pos_orders
         SET payment_status = 'room_charge',
             status = 'completed',
             payment_method = 'Room Charge',
             room_number = $1,
             guest_name = $2,
             booking_id = $3,
             folio_transaction_id = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [room_number || booking.room_number, guest_name || booking.guest_name, booking_id, folioTransactionId, bill_id]
      );
    }

    // Step 8: Create Audit Record
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource, details, branch_id, created_at)
       VALUES ($1, 'POST_ROOM_CHARGE', 'folio_transactions', $2, $3, NOW())`,
      [
        userId,
        JSON.stringify({
          folio_transaction_id: folioTransactionId,
          booking_id,
          guest_name: guest_name || booking.guest_name,
          room_number: room_number || booking.room_number,
          outlet_name,
          bill_number: billRef,
          amount: grossAmount,
        }),
        branchId,
      ]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Bill ${billRef} posted successfully to Room ${room_number || booking.room_number}`,
      folio_transaction_id: folioTransactionId,
      room_number: room_number || booking.room_number,
      guest_name: guest_name || booking.guest_name,
      amount: grossAmount,
      settlement_method: 'Room Charge',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    logger.error('Error posting room charge transaction:', error);
    res.status(500).json({ success: false, message: 'Failed to post room charge', error: error.message });
  } finally {
    client.release();
  }
};

/**
 * 3. Reverse an Authorized Room Charge
 */
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

    // Mark transaction as reversed
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

    // Create Reversal Counter-Entry
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
        `REVERSAL: ${trans.description} — Reason: ${reason}`,
        userId,
        userName,
      ]
    );

    // Update Folio total charges
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
        `UPDATE bookings
         SET total_amount = GREATEST(0, COALESCE(total_amount, 0) - $1),
             updated_at = NOW()
         WHERE id = $2`,
        [amountToDeduct, trans.booking_id]
      );
    }

    // Re-open linked POS bill if applicable
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

    // Log Audit
    await client.query(
      `INSERT INTO audit_logs (user_id, action, resource, details, branch_id, created_at)
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

/**
 * 4. Get Room Charges Reports
 */
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
      .filter((r) => r.status === 'active')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

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
