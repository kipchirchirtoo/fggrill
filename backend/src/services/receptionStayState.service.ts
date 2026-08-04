import { PoolClient } from 'pg';
import db from '../db';
import { supabase } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { RoomStatus } from '../models/Room';
import { automationService } from './automation.service';

const BREAKFAST_ELIGIBLE_MEAL_PLANS = new Set([
  'bb',
  'hb',
  'fb',
  'bed_breakfast',
  'half_board',
  'full_board',
  'bed & breakfast',
  'half board',
  'full board',
  'breakfast',
  'breakfast_included',
]);

const ROOM_ONLY_MEAL_PLANS = new Set([
  'room_only',
  'bed_only',
  'ro',
  'bo',
  'none',
  'no_meals',
]);

const CHECKED_IN_STATUSES = new Set([
  'checked_in',
  'checked-in',
  'in-house',
  'active',
  'arrived',
]);

const CONFIRMED_STATUSES = new Set(['confirmed', 'pending']);
const MAINTENANCE_ROOM_STATUSES = new Set(['maintenance', 'out_of_order']);
const CLEANING_HK_STATUSES = new Set([
  'checkout',
  'vacant_dirty',
  'cleaning_in_progress',
]);

type ReservationStayRow = Record<string, any>;
type RoomLike = Record<string, any>;

export interface StaySnapshot {
  reservation_id: string;
  id: string;
  booking_key: string;
  confirmation_number: string;
  guest_id: string | null;
  guest_name: string;
  room_id: string | null;
  room_number: string;
  room_type_name: string;
  room_type_code: string;
  status: string;
  check_in_date: string | null;
  check_out_date: string | null;
  effective_checkout_date: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  adults: number;
  children: number;
  pax: number;
  meal_plan: string;
  rate_plan_meal_plan: string | null;
  breakfast_eligible: boolean;
  breakfast_inclusion_reason: string;
  in_house: boolean;
  overstay: boolean;
  rate_plan_id: string | null;
  total_amount: number;
  amount_paid: number;
  deposit_amount: number;
  branch_id: number;
  raw: ReservationStayRow;
}

export interface BreakfastPaxSnapshot {
  breakfastDate: string;
  calculatedPax: number;
  checkedInReservations: number;
  eligibleReservations: number;
  includedBookings: StaySnapshot[];
  excludedBookings: StaySnapshot[];
  allBookings: StaySnapshot[];
}

function relationRecord<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return (value[0] ?? null) as T | null;
  return (value ?? null) as T | null;
}

export function todayInNairobi(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
}

export function nairobiDateOf(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' });
}

function normalizeLower(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeMealPlanToken(value: unknown): string {
  return normalizeLower(value).replace(/\s+/g, '_');
}

function roomTypeImpliesBreakfast(roomTypeName?: unknown, roomTypeCode?: unknown): boolean {
  const token = `${normalizeLower(roomTypeName)} ${normalizeLower(roomTypeCode)}`.trim();
  if (!token) return false;
  return token.includes('executive') || token.includes('deluxe') || token.includes('vip');
}

export function mealPlanIncludesBreakfast(
  mealPlan: unknown,
  options?: {
    ratePlanMealPlan?: unknown;
    roomTypeName?: unknown;
    roomTypeCode?: unknown;
  }
): boolean {
  const directMealPlan = normalizeMealPlanToken(mealPlan);
  const ratePlanMealPlan = normalizeMealPlanToken(options?.ratePlanMealPlan);

  if (ROOM_ONLY_MEAL_PLANS.has(directMealPlan)) return false;
  if (BREAKFAST_ELIGIBLE_MEAL_PLANS.has(directMealPlan)) return true;

  if (ROOM_ONLY_MEAL_PLANS.has(ratePlanMealPlan)) return false;
  if (BREAKFAST_ELIGIBLE_MEAL_PLANS.has(ratePlanMealPlan)) return true;

  if (directMealPlan.includes('breakfast')) return true;
  if (ratePlanMealPlan.includes('breakfast')) return true;

  if (!directMealPlan && !ratePlanMealPlan) {
    return roomTypeImpliesBreakfast(options?.roomTypeName, options?.roomTypeCode);
  }

  return false;
}

export function isCheckedInLikeStatus(status: unknown): boolean {
  return CHECKED_IN_STATUSES.has(normalizeLower(status));
}

export function isConfirmedLikeStatus(status: unknown): boolean {
  return CONFIRMED_STATUSES.has(normalizeLower(status));
}

export function isInHouseStay(row: ReservationStayRow, asOfDate: string = todayInNairobi()): boolean {
  if (!isCheckedInLikeStatus(row?.status)) return false;
  if (row?.checked_out_at) return false;
  const checkInDate = nairobiDateOf(row?.check_in_date);
  if (!checkInDate) return false;
  return checkInDate <= asOfDate;
}

function breakfastInclusionReason(
  mealPlan: unknown,
  ratePlanMealPlan: unknown,
  roomTypeName: unknown,
  roomTypeCode: unknown
): string {
  const directMealPlan = normalizeMealPlanToken(mealPlan);
  const ratePlanToken = normalizeMealPlanToken(ratePlanMealPlan);

  if (BREAKFAST_ELIGIBLE_MEAL_PLANS.has(directMealPlan) || directMealPlan.includes('breakfast')) {
    return `Meal plan: ${String(mealPlan || '').trim() || 'Breakfast included'}`;
  }
  if (BREAKFAST_ELIGIBLE_MEAL_PLANS.has(ratePlanToken) || ratePlanToken.includes('breakfast')) {
    return `Rate plan: ${String(ratePlanMealPlan || '').trim() || 'Breakfast included'}`;
  }
  if (!directMealPlan && !ratePlanToken && roomTypeImpliesBreakfast(roomTypeName, roomTypeCode)) {
    return `Room category default: ${String(roomTypeName || roomTypeCode || 'Breakfast included').trim()}`;
  }
  return 'Room only / no breakfast entitlement';
}

export function buildStaySnapshot(row: ReservationStayRow, asOfDate: string = todayInNairobi()): StaySnapshot {
  const guest = relationRecord<any>(row?.guest);
  const room = relationRecord<any>(row?.room);
  const roomType = relationRecord<any>(room?.room_type ?? row?.room_type);
  const ratePlan = relationRecord<any>(row?.rate_plan);

  const guestName =
    `${guest?.first_name || ''} ${guest?.last_name || ''}`.trim() ||
    String(row?.guest_name || 'Guest').trim() ||
    'Guest';

  const roomNumber = String(room?.room_number || row?.room_number || '').trim() || 'N/A';
  const roomTypeName = String(roomType?.name || row?.room_type_name || room?.room_type || 'Room').trim();
  const roomTypeCode = String(roomType?.code || row?.room_type_code || '').trim();
  const directMealPlan = String(row?.meal_plan || '').trim();
  const ratePlanMealPlan = String(ratePlan?.meal_plan || '').trim() || null;
  const breakfastEligible = mealPlanIncludesBreakfast(directMealPlan, {
    ratePlanMealPlan,
    roomTypeName,
    roomTypeCode,
  });
  const inHouse = isInHouseStay(row, asOfDate);
  const effectiveCheckoutDate = nairobiDateOf(row?.check_out_date);

  return {
    reservation_id: String(row?.id || ''),
    id: String(row?.id || ''),
    booking_key: String(row?.id || row?.confirmation_number || ''),
    confirmation_number: String(row?.confirmation_number || row?.reservation_number || row?.id || '').trim(),
    guest_id: row?.guest_id ? String(row.guest_id) : null,
    guest_name: guestName,
    room_id: row?.room_id ? String(row.room_id) : null,
    room_number: roomNumber,
    room_type_name: roomTypeName,
    room_type_code: roomTypeCode,
    status: String(row?.status || '').trim(),
    check_in_date: nairobiDateOf(row?.check_in_date),
    check_out_date: nairobiDateOf(row?.check_out_date),
    effective_checkout_date: effectiveCheckoutDate,
    checked_in_at: row?.checked_in_at ? String(row.checked_in_at) : null,
    checked_out_at: row?.checked_out_at ? String(row.checked_out_at) : null,
    adults: Number(row?.adults || 0),
    children: Number(row?.children || 0),
    pax: Number(row?.adults || 0) + Number(row?.children || 0),
    meal_plan: directMealPlan || ratePlanMealPlan || 'room_only',
    rate_plan_meal_plan: ratePlanMealPlan,
    breakfast_eligible: breakfastEligible,
    breakfast_inclusion_reason: breakfastInclusionReason(
      directMealPlan,
      ratePlanMealPlan,
      roomTypeName,
      roomTypeCode
    ),
    in_house: inHouse,
    overstay: Boolean(effectiveCheckoutDate && effectiveCheckoutDate < asOfDate && inHouse),
    rate_plan_id: row?.rate_plan_id ? String(row.rate_plan_id) : null,
    total_amount: Number(row?.total_amount || 0),
    amount_paid: Number(row?.amount_paid || 0),
    deposit_amount: Number(row?.deposit_amount || 0),
    branch_id: Number(row?.branch_id || 0),
    raw: row,
  };
}

export async function loadStaySnapshots(
  branchId: number,
  options?: {
    asOfDate?: string;
    includeConfirmed?: boolean;
    search?: string;
    limit?: number;
  }
): Promise<StaySnapshot[]> {
  const asOfDate = options?.asOfDate || todayInNairobi();
  const includeConfirmed = Boolean(options?.includeConfirmed);
  const limit = options?.limit ?? 250;
  await automationService.syncOverdueInHouseStays({ branchId });
  const statuses = includeConfirmed
    ? Array.from(new Set([...CHECKED_IN_STATUSES, ...CONFIRMED_STATUSES]))
    : Array.from(CHECKED_IN_STATUSES);

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      id,
      branch_id,
      guest_id,
      room_id,
      status,
      confirmation_number,
      reservation_number,
      check_in_date,
      check_out_date,
      checked_in_at,
      checked_out_at,
      meal_plan,
      rate_plan_id,
      total_amount,
      amount_paid,
      deposit_amount,
      adults,
      children,
      guest:guests!guest_id(first_name,last_name,phone,email),
      room:rooms!room_id(
        id,
        room_number,
        branch_id,
        status,
        hk_status,
        housekeeping_status,
        room_type,
        room_type:room_types!room_type_id(id, name, code)
      ),
      rate_plan:rate_plans!rate_plan_id(id, name, meal_plan, metadata)
    `)
    .eq('branch_id', branchId)
    .in('status', statuses)
    .order('check_in_date', { ascending: false })
    .limit(limit);

  if (error) throw error;

  let stays = (data || []).map((row: any) => buildStaySnapshot(row, asOfDate));

  if (!includeConfirmed) {
    stays = stays.filter((row) => row.in_house);
  }

  const search = String(options?.search || '').trim().toLowerCase();
  if (search) {
    stays = stays.filter((row) =>
      [
        row.room_number,
        row.guest_name,
        row.confirmation_number,
        row.room_type_name,
      ].some((value) => String(value || '').toLowerCase().includes(search))
    );
  }

  return stays;
}

export async function buildBreakfastPaxSnapshot(branchId: number, date: string): Promise<BreakfastPaxSnapshot> {
  const stays = await loadStaySnapshots(branchId, {
    asOfDate: date,
    includeConfirmed: false,
    limit: 500,
  });

  const includedBookings = stays.filter((row) => row.breakfast_eligible);
  const excludedBookings = stays.filter((row) => !row.breakfast_eligible);
  const calculatedPax = includedBookings.reduce((sum, row) => sum + row.pax, 0);

  return {
    breakfastDate: date,
    calculatedPax,
    checkedInReservations: stays.length,
    eligibleReservations: includedBookings.length,
    includedBookings,
    excludedBookings,
    allBookings: stays,
  };
}

export function resolveEffectiveRoomState(
  room: RoomLike,
  stayByRoomId: Map<string, StaySnapshot>,
  reservedByRoomId: Map<string, StaySnapshot>,
  asOfDate: string = todayInNairobi()
) {
  const roomKey = String(room?.id || '');
  const activeStay = stayByRoomId.get(roomKey) || null;
  const reservedStay = reservedByRoomId.get(roomKey) || null;
  const physicalStatus = normalizeLower(room?.status);
  const hkStatus = normalizeLower(room?.hk_status || room?.housekeeping_status);

  let effectiveStatus = physicalStatus || String(RoomStatus.AVAILABLE);
  if (MAINTENANCE_ROOM_STATUSES.has(physicalStatus) || hkStatus === 'out_of_order') {
    effectiveStatus = physicalStatus === 'out_of_order' || hkStatus === 'out_of_order'
      ? 'out_of_order'
      : 'maintenance';
  } else if (activeStay?.in_house) {
    effectiveStatus = 'occupied';
  } else if (CLEANING_HK_STATUSES.has(hkStatus) || physicalStatus === 'cleaning' || hkStatus === 'late_checkout') {
    effectiveStatus = 'cleaning';
  } else if (
    reservedStay &&
    reservedStay.check_in_date &&
    reservedStay.check_in_date >= asOfDate
  ) {
    effectiveStatus = 'reserved';
  } else {
    effectiveStatus = 'available';
  }

  return {
    status: effectiveStatus,
    activeStay,
    reservedStay,
  };
}

function buildTaskNumber(roomNumber: string | null, reservationId: string): string {
  const suffix = reservationId.replace(/-/g, '').slice(-6).toUpperCase();
  const room = String(roomNumber || 'ROOM').trim().toUpperCase();
  return `HK-CO-${room}-${suffix}`;
}

export async function performReceptionCheckIn(input: {
  reservationId: string;
  userId?: string | null;
}) {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const bookingRes = await client.query(
      `
        SELECT
          id,
          branch_id,
          guest_id,
          room_id,
          status,
          confirmation_number,
          check_in_date,
          check_out_date,
          total_amount,
          amount_paid,
          deposit_amount,
          deposit_paid
        FROM reservations
        WHERE id = $1
        FOR UPDATE
      `,
      [input.reservationId]
    );

    const booking = bookingRes.rows[0];
    if (!booking) {
      throw new AppError('Booking not found', 404);
    }
    if (normalizeLower(booking.status) !== 'confirmed') {
      throw new AppError(
        `Cannot check in: Booking status is "${booking.status}". Only confirmed bookings can be checked in.`,
        400
      );
    }

    let previousRoomStatus: string | null = null;
    if (booking.room_id) {
      const roomRes = await client.query(
        `
          SELECT id, status, hk_status, current_guest
          FROM rooms
          WHERE id = $1
          FOR UPDATE
        `,
        [booking.room_id]
      );
      const room = roomRes.rows[0];
      if (!room) {
        throw new AppError('Assigned room not found', 404);
      }

      previousRoomStatus = String(room.status || '');
      const physicalStatus = normalizeLower(room.status);
      const hkStatus = normalizeLower(room.hk_status);
      if (MAINTENANCE_ROOM_STATUSES.has(physicalStatus) || hkStatus === 'out_of_order') {
        throw new AppError('Room is out of service and cannot be checked in', 409);
      }

      // Auto-clear / auto-checkout any prior unclosed stays for this room
      // so new guest arrivals (Check In button) are never blocked.
      await client.query(
        `
          UPDATE reservations
          SET status = 'checked_out',
              checked_out_at = COALESCE(checked_out_at, NOW()),
              updated_at = NOW()
          WHERE room_id = $1
            AND id <> $2
            AND checked_out_at IS NULL
            AND LOWER(TRIM(COALESCE(status, ''))) IN ('checked_in', 'checked-in', 'in-house', 'active', 'arrived')
        `,
        [booking.room_id, booking.id]
      );
    }

    const updatedBookingRes = await client.query(
      `
        UPDATE reservations
        SET
          status = 'checked_in',
          checked_in_at = NOW(),
          checked_in_by = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [input.reservationId, input.userId || null]
    );

    const updatedBooking = updatedBookingRes.rows[0];

    if (updatedBooking.room_id) {
      await client.query(
        `
          UPDATE rooms
          SET
            status = 'occupied',
            current_guest = $2,
            hk_status = CASE
              WHEN COALESCE(hk_status, '') IN ('checkout', 'vacant_dirty', 'cleaning_in_progress', '')
                THEN 'occupied_clean'
              ELSE hk_status
            END,
            expected_checkout = CASE
              WHEN $3::date IS NULL THEN expected_checkout
              ELSE ($3::date + INTERVAL '12 hours')
            END,
            updated_at = NOW()
          WHERE id = $1
        `,
        [updatedBooking.room_id, updatedBooking.guest_id, updatedBooking.check_out_date]
      );

      if (previousRoomStatus && normalizeLower(previousRoomStatus) !== 'occupied') {
        await client.query(
          `
            INSERT INTO room_status_history (
              room_id,
              old_status,
              new_status,
              changed_by,
              reason
            )
            VALUES ($1, $2, 'occupied', $3, $4)
          `,
          [
            updatedBooking.room_id,
            previousRoomStatus,
            input.userId || null,
            `Room occupied via Reception check-in for ${updatedBooking.confirmation_number || updatedBooking.id}`,
          ]
        ).catch(() => {});
      }
    }

    const reservationPaid = booking.deposit_paid
      ? Math.max(Number(booking.amount_paid || 0), Number(booking.deposit_amount || 0))
      : Number(booking.amount_paid || 0);

    await client.query(
      `
        INSERT INTO folios (
          branch_id,
          reservation_id,
          booking_id,
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
          settled,
          created_at,
          updated_at
        )
        SELECT
          $2,
          $1,
          NULL,
          $3,
          $4,
          'open',
          $5,
          0,
          0,
          0,
          $5,
          $6,
          $7,
          $7,
          false,
          NOW(),
          NOW()
        WHERE NOT EXISTS (
          SELECT 1 FROM folios WHERE reservation_id = $1
        )
      `,
        [
          updatedBooking.id,
          updatedBooking.branch_id,
          updatedBooking.guest_id,
          updatedBooking.confirmation_number || `FOL-${updatedBooking.id}`,
          Number(updatedBooking.total_amount || 0),
          reservationPaid,
          Math.max(0, Number(updatedBooking.total_amount || 0) - reservationPaid),
        ]
      );

    await client.query('COMMIT');
    return updatedBooking;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function handoffRoomToHousekeeping(input: {
  reservationId: string;
  branchId: number;
  roomId?: string | null;
  roomNumber?: string | null;
  requestedBy?: string | null;
}) {
  if (!input.roomId) return;

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `
        UPDATE rooms
        SET
          status = 'cleaning',
          hk_status = 'checkout',
          cleaning_priority = COALESCE(cleaning_priority, 'urgent'),
          current_guest = NULL,
          updated_at = NOW()
        WHERE id = $1
      `,
      [input.roomId]
    );

    const existingTask = await client.query(
      `
        SELECT id
        FROM housekeeping_tasks
        WHERE room_id = $1
          AND task_type IN ('checkout_clean', 'checkout')
          AND status IN ('pending', 'assigned', 'in_progress')
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [input.roomId]
    );

    if (existingTask.rows.length === 0) {
      await client.query(
        `
          INSERT INTO housekeeping_tasks (
            branch_id,
            room_id,
            task_number,
            task_type,
            status,
            priority,
            requested_by,
            notes,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            $3,
            'checkout_clean',
            'pending',
            'urgent',
            $4,
            $5,
            NOW(),
            NOW()
          )
        `,
        [
          input.branchId,
          input.roomId,
          buildTaskNumber(input.roomNumber || null, input.reservationId),
          input.requestedBy || null,
          `Guest checked out. Room ${input.roomNumber || input.roomId} requires housekeeping turnover.`,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
