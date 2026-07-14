import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';
import notificationService from '../services/notification.service';
import { applyBranchFilter, isGlobalRole } from '../utils/branchIsolation';
import axios from 'axios';
import { PYTHON_SERVICE_URL } from '../config/pythonService';

const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

const getBranchName = async (branchId: number | null): Promise<string> => {
  if (!branchId) return 'Central';
  try {
    const { data , error } = await supabase.from('branches').select('name').eq('id', branchId).single();
    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    return data?.name || 'Unknown Branch';
  } catch (e) {
    return 'Unknown Branch';
  }
};

type BookingInvoiceSourceType = 'room' | 'conference' | 'outside_catering';

const money = (value: any): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const text = (...values: any[]): string => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized && normalized.toLowerCase() !== 'null') return normalized;
  }
  return '';
};

const dateOnly = (value?: string | null): string => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const addDays = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const resolveBranchId = (req: Request): number | null => {
  const requested = req.query.branch_id ?? req.query.branchId;
  const raw = isGlobalRole(req.user?.role) ? requested ?? req.user?.branch_id : req.user?.branch_id;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const sourceReference = (sourceType: string, sourceId: string): string =>
  `${sourceType}:${sourceId}`;

const normalizeInvoiceItem = (description: string, total: number, quantity = 1) => ({
  description: description || 'Service charge',
  quantity,
  unit_price: quantity > 0 ? total / quantity : total,
  total,
});

const normalizeSourceRow = (
  sourceType: BookingInvoiceSourceType,
  row: any,
  invoice?: any
) => {
  if (sourceType === 'room') {
    const guest = row.guest || {};
    const room = row.room || {};
    const nights =
      row.check_in_date && row.check_out_date
        ? Math.max(
            1,
            Math.ceil(
              (new Date(row.check_out_date).getTime() -
                new Date(row.check_in_date).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          )
        : 1;
    const total = money(row.total_amount ?? row.total ?? row.room_charges);
    const paid = money(row.deposit_amount ?? row.amount_paid ?? row.paid_amount);
    const customerName = text(
      row.guest_name,
      [guest.first_name, guest.last_name].filter(Boolean).join(' '),
      guest.name,
      row.customer_name
    );
    return {
      id: row.id,
      source_type: sourceType,
      source_label: 'Room Booking',
      reference: text(row.confirmation_number, row.booking_number, row.short_code, row.id),
      customer_name: customerName || 'Guest',
      customer_email: text(guest.email, row.email),
      customer_phone: text(guest.phone, row.phone),
      service_date: dateOnly(row.check_in_date),
      end_date: dateOnly(row.check_out_date),
      description: `Room ${text(room.room_number, row.room_number)} (${nights} night${nights === 1 ? '' : 's'})`,
      total_amount: total,
      amount_paid: paid,
      balance: Math.max(total - paid, 0),
      status: row.status || 'pending',
      payment_status: row.payment_status || (paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'pending'),
      invoice_id: invoice?.id ?? row.invoice_id ?? null,
      invoice_number: invoice?.invoice_number ?? row.invoice_number ?? null,
      invoice_status: invoice?.status ?? null,
      can_generate_invoice: !invoice?.id,
    };
  }

  if (sourceType === 'conference') {
    const hall = row.hall || {};
    const total = money(row.total_amount);
    const paid = money(row.amount_paid ?? row.paid_amount);
    const customerName = text(row.company_name, row.customer_name, row.contact_person);
    return {
      id: row.id,
      source_type: sourceType,
      source_label: 'Conference Booking',
      reference: text(row.invoice_number, row.booking_number, row.id),
      customer_name: customerName || 'Conference Customer',
      customer_email: text(row.customer_email),
      customer_phone: text(row.customer_phone),
      service_date: dateOnly(row.start_date),
      end_date: dateOnly(row.end_date),
      description: `Conference hall${text(hall.name) ? ': ' + text(hall.name) : ''}`,
      total_amount: total,
      amount_paid: paid,
      balance: Math.max(total - paid, 0),
      status: row.booking_status || 'confirmed',
      payment_status: row.payment_status || (paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'pending'),
      invoice_id: invoice?.id ?? row.invoice_id ?? null,
      invoice_number: invoice?.invoice_number ?? null,
      invoice_status: invoice?.status ?? null,
      can_generate_invoice: !invoice?.id,
    };
  }

  const total = money(row.total_amount ?? row.expected_revenue ?? row.actual_revenue);
  const paid = money(row.amount_paid ?? row.paid_amount);
  return {
    id: row.id,
    source_type: sourceType,
    source_label: 'Outside Catering',
    reference: text(row.booking_number, row.event_number, row.id),
    customer_name: text(row.customer_name, row.client_name, row.contact_person) || 'Catering Customer',
    customer_email: text(row.customer_email, row.email),
    customer_phone: text(row.customer_phone, row.phone),
    service_date: dateOnly(row.event_date ?? row.date),
    end_date: dateOnly(row.event_date ?? row.date),
    description: text(row.event_name, row.name, row.event_type, 'Outside catering event'),
    total_amount: total,
    amount_paid: paid,
    balance: Math.max(total - paid, 0),
    status: row.booking_status || row.status || 'pending',
    payment_status: row.payment_status || (paid >= total && total > 0 ? 'paid' : paid > 0 ? 'partial' : 'pending'),
    invoice_id: invoice?.id ?? row.invoice_id ?? null,
    invoice_number: invoice?.invoice_number ?? null,
    invoice_status: invoice?.status ?? null,
    can_generate_invoice: !invoice?.id,
  };
};

const getOrCreateAccountingCustomer = async (
  source: ReturnType<typeof normalizeSourceRow>,
  branchId: number | null
): Promise<string | null> => {
  const customerName = source.customer_name || 'Customer';
  const email = source.customer_email || null;

  let lookup = supabase
    .from('accounting_customers')
    .select('id')
    .ilike('customer_name', customerName)
    .limit(1);
  if (branchId) lookup = lookup.eq('branch_id', branchId);

  const { data: existing } = await lookup.maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from('accounting_customers')
    .insert([{
      customer_code: `CUST-${Date.now()}`,
      customer_name: customerName,
      email,
      phone: source.customer_phone || null,
      is_active: true,
      branch_id: branchId,
    }])
    .select('id')
    .single();

  if (error) {
    logger.error('Unable to create accounting customer for invoice source:', error);
    return null;
  }
  return created?.id ?? null;
};

const findInvoiceByReference = async (reference: string, branchId: number | null) => {
  let query = supabase
    .from('accounting_ar_invoices')
    .select('*, customer:accounting_customers!customer_id(id, customer_name, email, phone)')
    .eq('reference', reference)
    .limit(1);
  if (branchId) query = query.eq('branch_id', branchId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
};

const bestEffortLinkInvoiceToSource = async (
  sourceType: BookingInvoiceSourceType,
  sourceId: string,
  invoiceId: string
) => {
  const table =
    sourceType === 'room'
      ? 'reservations'
      : sourceType === 'conference'
        ? 'conference_hall_bookings'
        : 'catering_bookings';
  try {
    await supabase.from(table).update({ invoice_id: invoiceId }).eq('id', sourceId);
  } catch (error) {
    logger.warn(`Invoice link skipped for ${table}.${sourceId}: ${(error as any)?.message || error}`);
  }
};

// ============ CHART OF ACCOUNTS ============

export const getChartOfAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { account_type, is_active } = req.query;

    let query = supabase
      .from('accounting_chart_of_accounts')
      .select('*')
      .order('account_code');

    query = applyBranchFilter(query, req);

    if (account_type) query = query.eq('account_type', account_type);
    if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

export const createAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data, error } = await supabase
      .from('accounting_chart_of_accounts')
      .insert([req.body])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, data });
    logger.info(`Account created: ${data.account_code}`);
  } catch (error) {
    next(error);
  }
};

// ============ JOURNAL ENTRIES ============

export const createJournalEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { entry_date, description, reference, lines } = req.body;

    // Calculate totals
    const total_debit = lines.reduce((sum: number, line: any) => sum + (line.debit_amount || 0), 0);
    const total_credit = lines.reduce((sum: number, line: any) => sum + (line.credit_amount || 0), 0);

    if (Math.abs(total_debit - total_credit) > 0.01) {
      res.status(400).json({ success: false, message: 'Journal entry not balanced' });
      return;
    }

    // Generate journal number
    const journal_number = `JE-${Date.now()}`;

    // Create journal entry
    const { data: journal, error: journalError } = await supabase
      .from('accounting_journal_entries')
      .insert([{
        entry_number: journal_number,
        entry_date,
        description,
        reference,
        total_debit,
        total_credit,
        status: 'draft',
        posted_by: req.user?.id,
        branch_id: req.user?.branch_id
      }])
      .select()
      .single();

    if (journalError) throw journalError;

    // Create journal lines
    const linesWithJournal = lines.map((line: any) => ({
      ...line,
      journal_entry_id: journal.id
    }));

    const { error: linesError } = await supabase
      .from('accounting_journal_lines')
      .insert(linesWithJournal);

    if (linesError) throw linesError;

    res.status(201).json({ success: true, data: journal });
    logger.info(`Journal entry created: ${journal_number}`);
  } catch (error) {
    next(error);
  }
};

export const postJournalEntry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('accounting_journal_entries')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
        posted_by: req.user?.id
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data });
    logger.info(`Journal entry posted: ${data.journal_number}`);
  } catch (error) {
    next(error);
  }
};

export const getJournalEntries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { start_date, end_date, status } = req.query;

    let query = supabase
      .from('accounting_journal_entries')
      .select(`
        *,
        lines:accounting_journal_lines(
          *,
          account:accounting_chart_of_accounts(*)
        )
      `)
      .order('entry_date', { ascending: false });

    query = applyBranchFilter(query, req);

    if (start_date) query = query.gte('entry_date', start_date);
    if (end_date) query = query.lte('entry_date', end_date);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ ACCOUNTS RECEIVABLE ============

export const createInvoice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      customer_id, 
      customer_name, 
      customer_email, 
      invoice_date, 
      due_date, 
      subtotal, 
      tax_amount, 
      reference, 
      notes, 
      items,
      type,
      conference_hall_id,
      conference_start_date,
      conference_end_date,
      hotel_booking_id,
      restaurant_reservation_id
    } = req.body;

    const total_amount = subtotal + (tax_amount || 0);
    const invoice_number = `INV-${Date.now()}`;

    // Conference availability check
    if (type === 'CONFERENCE' && conference_hall_id && conference_start_date && conference_end_date) {
        // Check for existing bookings in that time range
        const { data: existing, error: checkError } = await supabase
            .from('conference_hall_bookings')
            .select('*')
            .eq('conference_hall_id', conference_hall_id)
            .eq('booking_status', 'confirmed');

        if (checkError) throw checkError;

        const reqStart = new Date(conference_start_date);
        const reqEnd = new Date(conference_end_date);

        const hasOverlap = existing && existing.some(b => {
            const bStart = new Date(b.start_date);
            const bEnd = new Date(b.end_date);
            return reqStart < bEnd && reqEnd > bStart;
        });

        if (hasOverlap) {
            res.status(400).json({ success: false, message: 'The hall is already booked for the selected time range' });
            return;
        }

        // Also check other invoices
        const { data: existingInvoices, error: invCheckError } = await supabase
            .from('accounting_ar_invoices')
            .select('*')
            .eq('conference_hall_id', conference_hall_id)
            .neq('status', 'voided');

        if (invCheckError) throw invCheckError;

        const hasInvOverlap = existingInvoices && existingInvoices.some(inv => {
            const iStart = new Date(inv.conference_start_date);
            const iEnd = new Date(inv.conference_end_date);
            return reqStart < iEnd && reqEnd > iStart;
        });

        if (hasInvOverlap) {
            res.status(400).json({ success: false, message: 'The hall is already reserved via another invoice for this time range' });
            return;
        }
    }

    // Customer mapping logic to handle string IDs
    let resolvedCustomerId = customer_id;

    // Handle ad-hoc customer (if name provided but no ID)
    if (!resolvedCustomerId && customer_name) {
      const { data: existingByName } = await supabase
        .from('accounting_customers')
        .select('id')
        .ilike('customer_name', customer_name)
        .maybeSingle();

      if (existingByName) {
        resolvedCustomerId = existingByName.id;
      } else {
        // Create new ad-hoc customer
        const { data: newCustomer, error: createError } = await supabase
          .from('accounting_customers')
          .insert([{
            customer_code: `CUST-${Date.now()}`,
            customer_name,
            email: customer_email,
            is_active: true,
            branch_id: req.user?.branch_id
          }])
          .select()
          .single();

        if (createError) {
          logger.error('Error creating ad-hoc customer:', createError);
        } else {
          resolvedCustomerId = newCustomer.id;
          logger.info(`Created ad-hoc customer for invoice: ${customer_name}`);
        }
      }
    }

    if (customer_id) {
      // 1. Check if already exists in accounting_customers by internal ID (if UUID)
      if (isUUID(customer_id)) {
        const { data: existing } = await supabase
          .from('accounting_customers')
          .select('id')
          .eq('id', customer_id)
          .maybeSingle();

        if (existing) {
          resolvedCustomerId = existing.id;
        } else {
          // 2. Check if it's a customer_code (external ID)
          const { data: mapped } = await supabase
            .from('accounting_customers')
            .select('id')
            .eq('customer_code', customer_id)
            .maybeSingle();

          if (mapped) {
            resolvedCustomerId = mapped.id;
          } else {
            // 3. Not mapped, try to find in source table
            const { data: source } = await supabase
              .from('customers')
              .select('*')
              .eq('id', customer_id)
              .maybeSingle();

            if (source) {
              const { data: created, error: cError } = await supabase
                .from('accounting_customers')
                .insert([{
                  customer_code: source.id,
                  customer_name: source.name || `${source.first_name} ${source.last_name}`,
                  contact_person: source.contact_person,
                  email: source.email,
                  phone: source.phone,
                  address: source.address,
                  is_active: true,
                  branch_id: req.user?.branch_id
                }])
                .select()
                .single();

              if (cError) {
                logger.error('Error auto-creating accounting_customer:', cError);
              } else if (created) {
                resolvedCustomerId = created.id;
                logger.info(`Mapped customer ${customer_id} to accounting_customer ${resolvedCustomerId}`);
              } else {
                logger.error('Failed to resolve customer mapping for UUID:', customer_id);
              }
            } else {
              logger.error('Customer not found in source table:', customer_id);
            }
          }
        }
      } else {
        // Non-UUID: Check if it's a customer_code
        const { data: mapped } = await supabase
          .from('accounting_customers')
          .select('id')
          .eq('customer_code', customer_id)
          .maybeSingle();

        if (mapped) {
          resolvedCustomerId = mapped.id;
        } else {
          // Look up by customer_code equivalent if applicable
          logger.warn(`Non-UUID customer_id provided but no mapping found: ${customer_id}`);
        }
      }
    }

    const { data, error } = await supabase
      .from('accounting_ar_invoices')
      .insert([{
        invoice_number,
        customer_id: resolvedCustomerId,
        invoice_date,
        due_date,
        subtotal,
        tax_amount,
        total_amount,
        balance: total_amount,
        status: 'unpaid',
        reference,
        notes,
        items, // Save items as JSONB
        type: type || 'GENERAL',
        conference_hall_id,
        conference_start_date,
        conference_end_date,
        hotel_booking_id,
        restaurant_reservation_id,
        created_by: req.user?.id,
        branch_id: req.user?.branch_id
      }])
      .select()
      .single();

    if (error) throw error;

    // If it's a conference invoice, also create a booking record for visibility in conference management
    if (type === 'CONFERENCE' && conference_hall_id) {
        const { error: conferenceError } = await supabase.from('conference_bookings').insert([{
            conference_hall_id,
            branch_id: req.user?.branch_id,
            customer_name: customer_name,
            customer_email: customer_email,
            start_date: conference_start_date,
            end_date: conference_end_date,
            invoice_id: data.id, // Linking back
            invoice_number: invoice_number,
            total_amount: total_amount,
            booking_status: 'confirmed',
            payment_status: 'pending',
            created_by: req.user?.id,
            notes: `Auto-generated from Invoice ${invoice_number}. ${notes || ''}`
        }]);
        
        if (conferenceError) {
          console.error('Database error:', conferenceError);
          throw conferenceError;
        }
    }

    // Link Hotel Booking if provided
    if (hotel_booking_id) {
        const { error: bookingError } = await supabase.from('bookings')
            .update({ invoice_id: data.id })
            .eq('id', hotel_booking_id);
        
        if (bookingError) {
          console.error('Database error:', bookingError);
          throw bookingError;
        }
    }

    // Link Restaurant Reservation if provided
    if (restaurant_reservation_id) {
        const { error: reservationError } = await supabase.from('restaurant_reservations')
            .update({ invoice_id: data.id })
            .eq('id', restaurant_reservation_id);
        
        if (reservationError) {
          console.error('Database error:', reservationError);
          throw reservationError;
        }
    }

    logger.info(`Invoice created: ${invoice_number}`);

    // Notify Auditor — scoped to the same branch as the invoice
    getBranchName(req.user?.branch_id).then(branchName => {
      notificationService.notifyRole(
        'auditor',
        'New Invoice Created',
        `New invoice ${invoice_number} created for ${branchName} branch (Total: ${total_amount}).`,
        {
          type: 'info',
          category: 'finance',
          priority: 'medium',
          branchId: req.user?.branch_id,
          actionUrl: '/dashboard/auditor/invoices',
          metadata: {
            invoice_id: data.id,
            branch_id: req.user?.branch_id,
            branch_name: branchName
          }
        }
      ).catch(e => logger.error('Failed to notify auditor of new invoice', e));
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getInvoices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { customer_id, status, overdue } = req.query;

    let resolvedCustomerId = customer_id as string;
    if (resolvedCustomerId) {
      // Try internal ID first
      const { data: exists } = await applyBranchFilter(supabase
        .from('accounting_customers'), req)
        .select('id')
        .eq('id', resolvedCustomerId)
        .maybeSingle();

      if (!exists) {
        // Try mapping code
        const { data: mapped } = await applyBranchFilter(supabase
          .from('accounting_customers'), req)
          .select('id')
          .eq('customer_code', resolvedCustomerId)
          .maybeSingle();
        if (mapped) resolvedCustomerId = mapped.id;
      }
    }

    let query = supabase
      .from('accounting_ar_invoices')
      .select(`
        *,
        customer:accounting_customers!customer_id(id, customer_name, email, phone)
      `)
      .order('invoice_date', { ascending: false });

    query = applyBranchFilter(query, req);

    if (resolvedCustomerId) query = query.eq('customer_id', resolvedCustomerId);
    if (status) {
      let statusVal = status as string;
      if (statusVal === 'pending') statusVal = 'unpaid';
      query = query.eq('status', statusVal);
    }
    if (overdue === 'true') {
      query = query.lt('due_date', new Date().toISOString().split('T')[0]).eq('status', 'unpaid');
    }

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

export const getBookingInvoiceQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const branchId = resolveBranchId(req);
    const sourceFilter = text(req.query.source_type, req.query.sourceType).toLowerCase();
    const statusFilter = text(req.query.status).toLowerCase();

    let invoiceQuery = supabase
      .from('accounting_ar_invoices')
      .select('*, customer:accounting_customers!customer_id(id, customer_name, email, phone)')
      .order('invoice_date', { ascending: false });
    if (branchId) invoiceQuery = invoiceQuery.eq('branch_id', branchId);
    const { data: invoices, error: invoiceError } = await invoiceQuery;
    if (invoiceError) throw invoiceError;

    const invoiceByReference = new Map<string, any>();
    for (const inv of invoices || []) {
      if (inv.reference) invoiceByReference.set(String(inv.reference), inv);
    }

    const sources: any[] = [];
    const warnings: string[] = [];

    const loadRooms = async () => {
      let select = '*, guest:guests!guest_id(*), room:rooms!room_id(id, room_number, room_type, branch_id, status)';
      let query = supabase
        .from('reservations')
        .select(select)
        .order('created_at', { ascending: false })
        .limit(200);
      if (branchId) query = query.eq('branch_id', branchId);
      const { data, error } = await query;
      if (error) throw error;
      for (const row of ((data || []) as any[])) {
        const ref = sourceReference('room', row.id);
        sources.push(normalizeSourceRow('room', row, invoiceByReference.get(ref)));
      }
    };

    const loadBookings = async () => {
      let select = '*, guest:guests!guest_id(*), room:rooms!room_id(id, room_number, room_type, branch_id, status)';
      let query = supabase
        .from('bookings')
        .select(select)
        .order('created_at', { ascending: false })
        .limit(200);
      if (branchId) query = query.eq('branch_id', branchId);
      const { data, error } = await query;
      if (error) throw error;
      for (const row of ((data || []) as any[])) {
        const ref = sourceReference('room', row.id);
        sources.push(normalizeSourceRow('room', {
          ...row,
          reservation_number: row.booking_number
        }, invoiceByReference.get(ref)));
      }
    };

    const loadConference = async () => {
      let query = supabase
        .from('conference_hall_bookings')
        .select('*, hall:conference_halls(*)')
        .order('start_date', { ascending: false })
        .limit(200);
      if (branchId) query = query.eq('branch_id', branchId);
      const { data, error } = await query;
      if (error) throw error;
      for (const row of ((data || []) as any[])) {
        const ref = sourceReference('conference', row.id);
        sources.push(normalizeSourceRow('conference', row, invoiceByReference.get(ref)));
      }
    };

    const loadConferenceBookings = async () => {
      let query = supabase
        .from('conference_bookings')
        .select('*, hall:conference_halls(*)')
        .order('event_date', { ascending: false })
        .limit(200);
      if (branchId) query = query.eq('branch_id', branchId);
      const { data, error } = await query;
      if (error) throw error;
      for (const row of ((data || []) as any[])) {
        const ref = sourceReference('conference', row.id);
        sources.push(normalizeSourceRow('conference', {
          ...row,
          booking_number: row.booking_number,
          client_name: row.customer_name,
          start_date: row.event_date,
          end_date: row.event_date,
          booking_status: row.status
        }, invoiceByReference.get(ref)));
      }
    };

    const loadCatering = async () => {
      let query = supabase
        .from('catering_bookings')
        .select('*')
        .order('event_date', { ascending: false })
        .limit(200);
      if (branchId) query = query.eq('branch_id', branchId);
      const { data, error } = await query;
      if (error) throw error;
      for (const row of ((data || []) as any[])) {
        const ref = sourceReference('outside_catering', row.id);
        sources.push(normalizeSourceRow('outside_catering', row, invoiceByReference.get(ref)));
      }
    };

    const loaders: Array<[string, () => Promise<void>]> = [
      ['room', async () => {
        await loadRooms();
        await loadBookings();
      }],
      ['conference', async () => {
        await loadConference();
        await loadConferenceBookings();
      }],
      ['outside_catering', loadCatering],
    ];
    for (const [key, loader] of loaders) {
      if (sourceFilter && sourceFilter !== 'all' && sourceFilter !== key) continue;
      try {
        await loader();
      } catch (error: any) {
        warnings.push(`${key}: ${error?.message || 'failed to load'}`);
        logger.warn(`Booking invoice queue source failed (${key})`, error);
      }
    }

    const invoiceRows = (invoices || []).map((invoice: any) => ({
      id: invoice.id,
      source_type: 'invoice',
      source_label: 'AR Invoice',
      reference: invoice.reference || invoice.invoice_number || invoice.id,
      customer_name: invoice.customer?.customer_name || invoice.customer_name || 'Customer',
      customer_email: invoice.customer?.email || invoice.customer_email || '',
      customer_phone: invoice.customer?.phone || invoice.customer_phone || '',
      service_date: invoice.invoice_date,
      end_date: invoice.due_date,
      description: invoice.notes || invoice.type || 'Customer invoice',
      total_amount: money(invoice.total_amount),
      amount_paid: money(invoice.paid_amount),
      balance: money(invoice.balance),
      status: invoice.status || 'unpaid',
      payment_status: invoice.status || 'unpaid',
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      invoice_status: invoice.status,
      can_generate_invoice: false,
    }));

    let rows = [...sources, ...invoiceRows];
    if (statusFilter && statusFilter !== 'all') {
      rows = rows.filter((row) =>
        String(row.invoice_status || row.payment_status || row.status || '')
          .toLowerCase()
          .includes(statusFilter)
      );
    }

    rows.sort((a, b) => {
      const bd = new Date(b.service_date || b.end_date || 0).getTime();
      const ad = new Date(a.service_date || a.end_date || 0).getTime();
      return bd - ad;
    });

    const summary = {
      total_sources: sources.length,
      uninvoiced: sources.filter((row) => !row.invoice_id).length,
      invoices: invoiceRows.length,
      outstanding_amount: rows.reduce((sum, row) => sum + money(row.balance), 0),
    };

    res.status(200).json({
      success: true,
      count: rows.length,
      summary,
      warnings,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

export const createInvoiceFromBookingSource = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sourceType = String(req.params.sourceType || req.body.source_type || '').toLowerCase() as BookingInvoiceSourceType;
    const sourceId = String(req.params.sourceId || req.body.source_id || '');
    const branchId = resolveBranchId(req);

    if (!['room', 'conference', 'outside_catering'].includes(sourceType) || !sourceId) {
      res.status(400).json({ success: false, message: 'Valid source type and source id are required' });
      return;
    }

    const reference = sourceReference(sourceType, sourceId);
    const existing = await findInvoiceByReference(reference, branchId);
    if (existing) {
      res.status(200).json({ success: true, data: existing, message: 'Invoice already exists for this booking' });
      return;
    }

    let row: any = null;
    if (sourceType === 'room') {
      const { data, error } = await supabase
        .from('reservations')
        .select('*, guest:guests!guest_id(*), room:rooms!room_id(id, room_number, room_type, branch_id, status)')
        .eq('id', sourceId)
        .maybeSingle();
      if (error) throw error;
      row = data;
    } else if (sourceType === 'conference') {
      const { data, error } = await supabase
        .from('conference_hall_bookings')
        .select('*, hall:conference_halls(*)')
        .eq('id', sourceId)
        .maybeSingle();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await supabase
        .from('catering_bookings')
        .select('*')
        .eq('id', sourceId)
        .maybeSingle();
      if (error) throw error;
      row = data;
    }

    if (!row) {
      res.status(404).json({ success: false, message: 'Booking source not found' });
      return;
    }

    const source = normalizeSourceRow(sourceType, row);
    if (branchId && Number(row.branch_id ?? row.room?.branch_id) !== branchId) {
      res.status(403).json({ success: false, message: 'Booking source is outside your branch' });
      return;
    }

    const total = money(source.total_amount);
    const paid = Math.min(money(source.amount_paid), total);
    const balance = Math.max(total - paid, 0);
    const customerId = await getOrCreateAccountingCustomer(source, branchId);
    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-5)}`;
    const items = [normalizeInvoiceItem(source.description, total)];

    const { data: invoice, error } = await supabase
      .from('accounting_ar_invoices')
      .insert([{
        invoice_number: invoiceNumber,
        customer_id: customerId,
        invoice_date: dateOnly(req.body.invoice_date),
        due_date: req.body.due_date ? dateOnly(req.body.due_date) : addDays(14),
        subtotal: total,
        tax_amount: 0,
        total_amount: total,
        paid_amount: paid,
        balance,
        status: balance <= 0 ? 'paid' : paid > 0 ? 'partially_paid' : 'unpaid',
        reference,
        notes: req.body.notes || `${source.source_label} ${source.reference}`,
        items,
        type: sourceType === 'room' ? 'ROOM_BOOKING' : sourceType === 'conference' ? 'CONFERENCE' : 'OUTSIDE_CATERING',
        created_by: req.user?.id,
        branch_id: branchId,
      }])
      .select('*, customer:accounting_customers!customer_id(id, customer_name, email, phone)')
      .single();

    if (error) throw error;

    await bestEffortLinkInvoiceToSource(sourceType, sourceId, invoice.id);

    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

export const downloadInvoicePdf = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    let query = supabase
      .from('accounting_ar_invoices')
      .select('*, customer:accounting_customers!customer_id(id, customer_name, email, phone), branch:branches(id, name, address, location, phone, email)')
      .eq('id', id);

    const branchId = resolveBranchId(req);
    if (branchId) query = query.eq('branch_id', branchId);

    const { data: invoice, error } = await query.maybeSingle();
    if (error) throw error;
    if (!invoice) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const payload = {
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      due_date: invoice.due_date,
      status: invoice.status || 'unpaid',
      customer_name: invoice.customer?.customer_name || invoice.customer_name || 'Customer',
      customer_address: invoice.branch?.name || 'FamousGate Hotels',
      customer_phone: invoice.customer?.phone || invoice.customer_phone || '',
      items: items.map((item: any, index: number) => ({
        description: item.description || item.name || `Item ${index + 1}`,
        quantity: money(item.quantity || item.qty || 1) || 1,
        unit_price: money(item.unit_price || item.unitPrice || item.price),
        total: money(item.total || item.total_amount),
      })),
      tax_rate: invoice.subtotal ? (money(invoice.tax_amount) / money(invoice.subtotal)) * 100 : 0,
      notes: invoice.notes || 'Thank you for your business.',
      terms: 'Payment due by invoice due date.',
      reference_code: invoice.reference || invoice.invoice_number,
    };

    const pythonResponse = await axios.post(
      `${PYTHON_SERVICE_URL}/api/reports/generate/branded-pdf`,
      {
        reportType: 'invoice',
        data: payload,
        filters: {
          branch_id: invoice.branch_id,
          branch_name: invoice.branch?.name,
          invoice_id: invoice.id,
        },
        useRealData: false,
      },
      { responseType: 'arraybuffer' }
    );

    const filename = `${invoice.invoice_number || 'Invoice'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.from(pythonResponse.data).length.toString());
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(Buffer.from(pythonResponse.data));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error('Failed to generate AR invoice PDF', error);
      res.status(502).json({ success: false, message: 'Unable to generate invoice PDF at this time' });
      return;
    }
    next(error);
  }
};

export const recordInvoicePayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount, payment_date, bank_account_id, payment_method, reference, notes } = req.body;

    // 1. Get the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('accounting_ar_invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (invoiceError || !invoice) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }

    // 2. Update invoice balance and status
    const paymentAmount = Number(amount);
    const newPaidAmount = (invoice.paid_amount || 0) + paymentAmount;
    const newBalance = invoice.total_amount - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partially_paid' : 'unpaid');

    const { error: updateError } = await supabase
      .from('accounting_ar_invoices')
      .update({
        paid_amount: newPaidAmount,
        balance: newBalance,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // 3. Record bank transaction if account provided
    if (bank_account_id) {
      const { error: bankTxnError } = await supabase.from('accounting_bank_transactions').insert({
        bank_account_id,
        transaction_date: payment_date || new Date().toISOString().split('T')[0],
        debit_amount: paymentAmount,
        credit_amount: 0,
        reference: reference || `PYMT-INV-${invoice.invoice_number}`,
        description: notes || `Payment received for invoice ${invoice.invoice_number}`,
        reconciled: false,
        branch_id: req.user?.branch_id
      });

      if (bankTxnError) {
        console.error('Database error:', bankTxnError);
        throw bankTxnError;
      }

      // Update bank balance
      const { data: bankAcc, error: bankAccError } = await supabase.from('accounting_bank_accounts').select('current_balance').eq('id', bank_account_id).single();
      if (bankAccError) {
        console.error('Database error:', bankAccError);
        throw bankAccError;
      }
      if (bankAcc) {
        const { error: bankUpdateError } = await supabase.from('accounting_bank_accounts').update({
          current_balance: (bankAcc.current_balance || 0) + paymentAmount,
          updated_at: new Date().toISOString()
        }).eq('id', bank_account_id);

        if (bankUpdateError) {
          console.error('Database error:', bankUpdateError);
          throw bankUpdateError;
        }
      }
    }

    logger.info(`Payment of ${amount} recorded for invoice ${invoice.invoice_number}`);

    // Notify Branch Accountant — scoped to the same branch as the invoice
    notificationService.notifyRole(
      'branch_accountant',  // Changed from 'accountant' to 'branch_accountant'
      'Payment Received',
      `Payment of ${amount} received for invoice ${invoice.invoice_number}.`,
      {
        type: 'success',
        category: 'finance',
        priority: 'medium',
        branchId: invoice.branch_id,
        actionUrl: '/dashboard/branch-accounting/invoices',
        metadata: { invoice_id: id }
      }
    ).catch(e => logger.error('Failed to notify branch accountant of payment', e));

    res.status(200).json({ success: true, message: 'Payment recorded successfully' });
  } catch (error) {
    next(error);
  }
};

// ============ ACCOUNTS PAYABLE ============

export const createBill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendor_id, bill_date, due_date, subtotal, tax_amount, reference, notes, items } = req.body;

    // Validate required fields
    if (!vendor_id) {
      res.status(400).json({
        success: false,
        message: 'vendor_id is required'
      });
      return;
    }

    const total_amount = subtotal + (tax_amount || 0);
    const bill_number = `BILL-${Date.now()}`;

    // Vendor mapping logic to handle IDs from 'suppliers' table
    let resolvedVendorId = vendor_id as string;

    if (vendor_id) {
      // 1. First check if it exists in accounting_vendors by internal ID (if UUID)
      if (isUUID(vendor_id)) {
        logger.info(`Checking if vendor exists in accounting_vendors by ID: ${vendor_id}`);
        const { data: existingVendor } = await applyBranchFilter(supabase
          .from('accounting_vendors'), req)
          .select('id')
          .eq('id', vendor_id)
          .maybeSingle();

        if (existingVendor) {
          resolvedVendorId = existingVendor.id;
        } else {
          // 2. Not an internal ID, check if it's a vendor_code (external ID)
          logger.info(`Not found by ID, checking vendor_code mapping: ${vendor_id}`);
          const { data: mappedByCode } = await applyBranchFilter(supabase
            .from('accounting_vendors'), req)
            .select('id')
            .eq('vendor_code', vendor_id)
            .maybeSingle();

          if (mappedByCode) {
            resolvedVendorId = mappedByCode.id;
          } else {
            // 3. Not mapped, try to resolve from suppliers table and create mapping
            logger.info(`Not mapped, checking suppliers table: ${vendor_id}`);
            const { data: supplier, error: supplierError } = await supabase
              .from('suppliers')
              .select('*')
              .eq('id', vendor_id)
              .maybeSingle();

            if (supplierError) {
              logger.error('Error fetching supplier:', supplierError);
            }

            if (supplier) {
              logger.info(`Found supplier: ${supplier.name}, creating accounting_vendor mapping`);
              const { data: newVendor, error: vError } = await supabase
                .from('accounting_vendors')
                .insert([{
                  vendor_code: supplier.id,
                  vendor_name: supplier.name,
                  contact_person: supplier.contact_person,
                  email: supplier.email,
                  phone: supplier.phone,
                  address: supplier.address,
                  is_active: true,
                  branch_id: req.user?.branch_id
                }])
                .select()
                .single();

              if (vError) {
                logger.error('Error auto-creating accounting_vendor:', vError);
                throw new Error(`Failed to create vendor mapping: ${vError.message}`);
              } else if (newVendor) {
                resolvedVendorId = newVendor.id;
                logger.info(`Mapped supplier ${vendor_id} to accounting_vendor ${resolvedVendorId}`);
              }
            } else {
              logger.error(`Vendor not found in either accounting_vendors or suppliers: ${vendor_id}`);
              throw new Error(`Vendor not found: ${vendor_id}. Please ensure the vendor exists in the system.`);
            }
          }
        }
      } else {
        // Non-UUID: Check if already mapped by vendor_code
        logger.info(`Non-UUID vendor_id provided, checking vendor_code mapping: ${vendor_id}`);
        const { data: mappedVendor } = await applyBranchFilter(supabase
          .from('accounting_vendors'), req)
          .select('id')
          .eq('vendor_code', vendor_id)
          .maybeSingle();

        if (mappedVendor) {
          resolvedVendorId = mappedVendor.id;
        } else {
          logger.warn(`Non-UUID vendor_id provided but no mapping found: ${vendor_id}`);
          // Possibly handle non-UUID lookups in suppliers if supported by schema
        }
      }
    }

    // Final validation before insert
    if (!resolvedVendorId) {
      throw new Error('Could not resolve vendor_id');
    }

    logger.info(`Creating bill with resolved vendor_id: ${resolvedVendorId}`);

    const { data, error } = await supabase
      .from('accounting_ap_bills')
      .insert([{
        bill_number,
        vendor_id: resolvedVendorId,
        bill_date,
        due_date,
        subtotal,
        tax_amount,
        total_amount,
        balance: total_amount,
        status: 'unpaid',
        reference,
        notes,
        items, // Save items as JSONB
        created_by: req.user?.id,
        branch_id: req.user?.branch_id
      }])
      .select()
      .single();

    if (error) throw error;

    logger.info(`Bill created: ${bill_number}`);

    // Notify Auditor — scoped to the same branch as the bill
    getBranchName(req.user?.branch_id).then(branchName => {
      notificationService.notifyRole(
        'auditor',
        'New Bill Created',
        `New bill ${bill_number} recorded for ${branchName} branch (Total: ${total_amount}).`,
        {
          type: 'info',
          category: 'finance',
          priority: 'medium',
          branchId: req.user?.branch_id,
          actionUrl: '/dashboard/auditor/branch-audit/credit-bills',
          metadata: {
            bill_id: data.id,
            branch_id: req.user?.branch_id,
            branch_name: branchName
          }
        }
      ).catch(e => logger.error('Failed to notify auditor of new bill', e));
    });

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getBills = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendor_id, status, overdue } = req.query;

    let resolvedVendorId = vendor_id as string;
    if (resolvedVendorId) {
      // Try internal ID first
      const { data: exists } = await supabase
        .from('accounting_vendors')
        .select('id')
        .eq('id', resolvedVendorId)
        .maybeSingle();

      if (!exists) {
        // Try mapping code
        const { data: mapped } = await supabase
          .from('accounting_vendors')
          .select('id')
          .eq('vendor_code', resolvedVendorId)
          .maybeSingle();
        if (mapped) resolvedVendorId = mapped.id;
      }
    }

    let query = supabase
      .from('accounting_ap_bills')
      .select(`
        *,
        vendor:accounting_vendors(*)
      `)
      .order('bill_date', { ascending: false });

    query = applyBranchFilter(query, req);

    if (resolvedVendorId) query = query.eq('vendor_id', resolvedVendorId);
    if (status) {
      let statusVal = status as string;
      if (statusVal === 'pending') statusVal = 'unpaid';
      query = query.eq('status', statusVal);
    }
    if (overdue === 'true') {
      query = query.lt('due_date', new Date().toISOString().split('T')[0]).eq('status', 'unpaid');
    }

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

export const recordBillPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { amount, payment_date, bank_account_id, payment_method, reference, notes } = req.body;

    // 1. Get the bill
    const { data: bill, error: billError } = await supabase
      .from('accounting_ap_bills')
      .select('*')
      .eq('id', id)
      .single();

    if (billError || !bill) {
      res.status(404).json({ success: false, message: 'Bill not found' });
      return;
    }

    // 2. Update bill balance and status
    const paymentAmount = Number(amount);
    const newPaidAmount = (bill.paid_amount || 0) + paymentAmount;
    const newBalance = bill.total_amount - newPaidAmount;
    const newStatus = newBalance <= 0 ? 'paid' : (newPaidAmount > 0 ? 'partially_paid' : 'unpaid');

    const { error: updateError } = await supabase
      .from('accounting_ap_bills')
      .update({
        paid_amount: newPaidAmount,
        balance: newBalance,
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) throw updateError;

    // 3. Record bank transaction if account provided
    if (bank_account_id) {
      const { error: bankTxnError2 } = await supabase.from('accounting_bank_transactions').insert({
        bank_account_id,
        transaction_date: payment_date || new Date().toISOString().split('T')[0],
        debit_amount: 0,
        credit_amount: paymentAmount,
        reference: reference || `PYMT-BILL-${bill.bill_number}`,
        description: notes || `Payment made for bill ${bill.bill_number}`,
        reconciled: false,
        branch_id: req.user?.branch_id
      });

      if (bankTxnError2) {
        console.error('Database error:', bankTxnError2);
        throw bankTxnError2;
      }

      // Update bank balance
      const { data: bankAcc, error: bankAccError2 } = await supabase.from('accounting_bank_accounts').select('current_balance').eq('id', bank_account_id).single();
      if (bankAccError2) {
        console.error('Database error:', bankAccError2);
        throw bankAccError2;
      }
      if (bankAcc) {
        const { error: bankUpdateError2 } = await supabase.from('accounting_bank_accounts').update({
          current_balance: (bankAcc.current_balance || 0) - paymentAmount,
          updated_at: new Date().toISOString()
        }).eq('id', bank_account_id);

        if (bankUpdateError2) {
          console.error('Database error:', bankUpdateError2);
          throw bankUpdateError2;
        }
      }
    }

    logger.info(`Payment of ${amount} recorded for bill ${bill.bill_number}`);

    // Notify Auditor — scoped to the same branch as the bill payment
    notificationService.notifyRole(
      'auditor',
      'Bill Payment Recorded',
      `Payment of ${amount} recorded for bill ${bill.bill_number}.`,
      {
        type: 'info',
        category: 'finance',
        priority: 'medium',
        branchId: bill.branch_id,
        actionUrl: '/dashboard/auditor/expenses',
        metadata: { bill_id: id }
      }
    ).catch(e => logger.error('Failed to notify auditor of bill payment', e));

    res.status(200).json({ success: true, message: 'Payment recorded successfully' });
  } catch (error) {
    next(error);
  }
};

export const submitInvoiceForAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?.id;

    // 1. Get invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('accounting_ar_invoices')
      .select('*')
      .eq('id', id)
      .single();

    if (invoiceError || !invoice) {
      res.status(404).json({ success: false, message: 'Invoice not found' });
      return;
    }

    // 2. Update status
    const { error: updateError } = await supabase
      .from('accounting_ar_invoices')
      .update({ status: 'posted_to_audit', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    // 3. Create approval request
    const { error: approvalError } = await supabase.from('approval_requests').insert({
      request_type: 'invoice',
      status: 'pending',
      requested_by: userId,
      branch_id: invoice.branch_id,
      amount: invoice.total_amount,
      description: `Audit request for invoice ${invoice.invoice_number}`,
      notes,
      metadata: { invoice_id: id }
    });

    if (approvalError) throw approvalError;

    logger.info(`Invoice ${invoice.invoice_number} submitted for audit by ${userId}`);

    // Notify Auditor — scoped to the same branch as the invoice
    getBranchName(req.user?.branch_id).then(branchName => {
      notificationService.notifyRole(
        'auditor',
        'Audit Request: Invoice',
        `Invoice ${invoice.invoice_number} from ${branchName} submitted for audit.`,
        {
          type: 'warning',
          category: 'audit',
          priority: 'high',
          branchId: req.user?.branch_id,
          actionUrl: '/dashboard/auditor/invoices',
          metadata: {
            invoice_id: id,
            type: 'invoice',
            branch_id: req.user?.branch_id,
            branch_name: branchName
          }
        }
      ).catch(e => logger.error('Failed to notify auditor of invoice audit request', e));
    });

    res.status(200).json({ success: true, message: 'Invoice submitted for audit' });
  } catch (error) {
    next(error);
  }
};

export const submitBillForAudit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const userId = req.user?.id;

    // 1. Get bill
    const { data: bill, error: billError } = await supabase
      .from('accounting_ap_bills')
      .select('*')
      .eq('id', id)
      .single();

    if (billError || !bill) {
      res.status(404).json({ success: false, message: 'Bill not found' });
      return;
    }

    // 2. Update status
    const { error: updateError } = await supabase
      .from('accounting_ap_bills')
      .update({ status: 'posted_to_audit', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    // 3. Create approval request
    const { error: approvalError } = await supabase.from('approval_requests').insert({
      request_type: 'bill',
      status: 'pending',
      requested_by: userId,
      branch_id: bill.branch_id,
      amount: bill.total_amount,
      description: `Audit request for bill ${bill.bill_number}`,
      notes,
      metadata: { bill_id: id }
    });

    if (approvalError) throw approvalError;

    logger.info(`Bill ${bill.bill_number} submitted for audit by ${userId}`);

    // Notify Auditor — scoped to the same branch as the bill
    getBranchName(req.user?.branch_id).then(branchName => {
      notificationService.notifyRole(
        'auditor',
        'Audit Request: Bill',
        `Bill ${bill.bill_number} from ${branchName} submitted for audit.`,
        {
          type: 'warning',
          category: 'audit',
          priority: 'high',
          branchId: req.user?.branch_id,
          actionUrl: '/dashboard/auditor/branch-audit/credit-bills',
          metadata: {
            bill_id: id,
            type: 'bill',
            branch_id: req.user?.branch_id,
            branch_name: branchName
          }
        }
      ).catch(e => logger.error('Failed to notify auditor of bill audit request', e));
    });

    res.status(200).json({ success: true, message: 'Bill submitted for audit' });
  } catch (error) {
    next(error);
  }
};

// ============ BANK RECONCILIATION ============

export const createBankTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { bank_account_id, transaction_date, amount, transaction_type, reference, description } = req.body;

    const { data, error } = await supabase
      .from('accounting_bank_transactions')
      .insert([{
        bank_account_id,
        transaction_date,
        debit_amount: transaction_type === 'debit' ? amount : 0,
        credit_amount: transaction_type === 'credit' ? amount : 0,
        reference,
        description,
        reconciled: false,
        branch_id: req.user?.branch_id
      }])
      .select()
      .single();

    if (error) throw error;

    // Update bank account balance
    const { data: account } = await supabase
      .from('accounting_bank_accounts')
      .select('current_balance')
      .eq('id', bank_account_id)
      .single();

    if (account) {
      const newBalance = transaction_type === 'credit'
        ? (account.current_balance || 0) + amount
        : (account.current_balance || 0) - amount;

      await supabase
        .from('accounting_bank_accounts')
        .update({ current_balance: newBalance })
        .eq('id', bank_account_id);
    }

    res.status(201).json({ success: true, data });
    logger.info(`Bank transaction created: ${reference}`);
  } catch (error) {
    next(error);
  }
};

export const getBankTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { bank_account_id, start_date, end_date, reconciled } = req.query;

    let query = supabase
      .from('accounting_bank_transactions')
      .select(`
        *,
        bank_account:accounting_bank_accounts(*)
      `)
      .order('transaction_date', { ascending: false });

    query = applyBranchFilter(query, req);

    if (bank_account_id) query = query.eq('bank_account_id', bank_account_id);
    if (start_date) query = query.gte('transaction_date', start_date);
    if (end_date) query = query.lte('transaction_date', end_date);
    if (reconciled !== undefined) query = query.eq('reconciled', reconciled === 'true');

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ BUDGETS ============

export const getBudgets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { fiscal_year, department, status } = req.query;

    let query = supabase
      .from('accounting_budgets')
      .select(`
        *,
        account:accounting_chart_of_accounts(*)
      `)
      .order('budget_name');

    query = applyBranchFilter(query, req);

    if (fiscal_year) query = query.eq('fiscal_year', fiscal_year);
    if (department) query = query.eq('department', department);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

// ============ DASHBOARD ============

export const getAccountingDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get AR summary
    const { data: invoices } = await applyBranchFilter(supabase
      .from('accounting_ar_invoices'), req)
      .select('total_amount, paid_amount, balance, status, due_date');

    // Get AP summary
    const { data: bills } = await applyBranchFilter(supabase
      .from('accounting_ap_bills'), req)
      .select('total_amount, paid_amount, balance, status, due_date');

    // Get bank balances
    const { data: bankAccounts } = await applyBranchFilter(supabase
      .from('accounting_bank_accounts'), req)
      .select('current_balance, currency');

    const today = new Date().toISOString().split('T')[0];

    const dashboard = {
      receivables: {
        total: invoices?.reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0) || 0,
        overdue: invoices?.filter((inv: any) => inv.status === 'unpaid' && inv.due_date < today)
          .reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0) || 0,
        current: invoices?.filter((inv: any) => inv.status === 'unpaid' && inv.due_date >= today)
          .reduce((sum: number, inv: any) => sum + (inv.balance || 0), 0) || 0
      },
      payables: {
        total: bills?.reduce((sum: number, bill: any) => sum + (bill.balance || 0), 0) || 0,
        overdue: bills?.filter((bill: any) => bill.status === 'unpaid' && bill.due_date < today)
          .reduce((sum: number, bill: any) => sum + (bill.balance || 0), 0) || 0,
        current: bills?.filter((bill: any) => bill.status === 'unpaid' && bill.due_date >= today)
          .reduce((sum: number, bill: any) => sum + (bill.balance || 0), 0) || 0
      },
      cash: {
        total: bankAccounts?.reduce((sum: number, acc: any) => sum + (acc.current_balance || 0), 0) || 0,
        accounts: bankAccounts?.length || 0
      }
    };

    res.status(200).json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
};

// ============ BANK DEPOSITS ============

export const getBankDeposits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, start_date, end_date } = req.query;

    let query = supabase
      .from('accounting_bank_transactions')
      .select(`
        *,
        bank_account:accounting_bank_accounts!inner(*)
      `)
      .order('transaction_date', { ascending: false });

    query = applyBranchFilter(query, req, 'bank_account');

    // Filter by type if there's a way to distinguish deposits from other transactions
    // For now, we'll assume transactions with credit_amount > 0 and no specific type are deposits
    // or just return all and let frontend filter if needed.
    // However, the frontend specifically asks for deposits.

    if (branch_id) {
      query = query.eq('bank_account.branch_id', branch_id);
    }

    if (start_date) query = query.gte('transaction_date', start_date);
    if (end_date) query = query.lte('transaction_date', end_date);

    const { data, error } = await query;
    if (error) throw error;

    // Filter for deposits (credit > 0)
    const deposits = data?.filter((txn: any) => txn.credit_amount > 0) || [];

    res.status(200).json({ success: true, count: deposits.length, data: deposits });
  } catch (error) {
    next(error);
  }
};

export const getBankAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id } = req.query;

    let query = supabase
      .from('accounting_bank_accounts')
      .select('*')
      .order('bank_name');

    query = applyBranchFilter(query, req);

    if (branch_id) {
      query = query.eq('branch_id', branch_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.status(200).json({ success: true, count: data?.length || 0, data });
  } catch (error) {
    next(error);
  }
};

export const createBankDeposit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id, bank_account_id, deposit_date, amount, reference, description, notes } = req.body;

    if (!bank_account_id || !amount) {
      res.status(400).json({ success: false, message: 'Bank account and amount are required' });
      return;
    }

    const effectiveBranchId = isGlobalRole((req as any).user?.role) 
      ? (branch_id || (req as any).user?.branch_id)
      : (req as any).user?.branch_id;

    // Record the bank transaction (a deposit is a CREDIT to the bank account in this schema)
    const { data, error } = await supabase
      .from('accounting_bank_transactions')
      .insert([{
        bank_account_id,
        branch_id: effectiveBranchId,
        transaction_date: deposit_date || new Date().toISOString().split('T')[0],
        debit_amount: 0,
        credit_amount: amount,
        reference,
        description: notes ? `${description || 'Bank Deposit'} - ${notes}` : (description || 'Bank Deposit'),
        reconciled: false
      }])
      .select()
      .single();

    if (error) throw error;

    // Update bank account balance
    const { data: account, error: accError } = await supabase
      .from('accounting_bank_accounts')
      .select('current_balance')
      .eq('id', bank_account_id)
      .single();

    if (!accError && account) {
      const newBalance = (account.current_balance || 0) + amount;
      await supabase
        .from('accounting_bank_accounts')
        .update({
          current_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', bank_account_id);
    }

    logger.info(`Bank deposit created: ${reference} for amount ${amount}`);

    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// ============ BANK RECONCILIATION ============

export const getReconciliationData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch_id } = req.query;

    if (!branch_id && !(req as any).user?.branch_id) {
      res.status(400).json({ success: false, message: 'Branch ID is required' });
      return;
    }

    const effectiveBranchId = isGlobalRole((req as any).user?.role) 
      ? (branch_id || (req as any).user?.branch_id)
      : (req as any).user?.branch_id;

    if (!effectiveBranchId) {
       res.status(403).json({ success: false, message: 'Access denied: Branch ID missing' });
       return;
    }

    // 1. Fetch unmatched system sales (Restaurant)
    const { data: restOrders, error: restError } = await supabase
      .from('restaurant_orders')
      .select('id, order_number, total_amount, created_at, payment_method')
      .eq('branch_id', effectiveBranchId)
      .eq('payment_status', 'paid')
      .eq('reconciled', false);

    if (restError) throw restError;

    // 2. Fetch unmatched system sales (Bar)
    const { data: barOrders, error: barError } = await supabase
      .from('bar_orders')
      .select('id, order_number, total, created_at, payment_method')
      .eq('branch_id', effectiveBranchId)
      .eq('payment_status', 'paid')
      .eq('reconciled', false);

    if (barError) throw barError;

    // 3. Fetch unmatched bank transactions (Deposits/Credits)
    const { data: bankTxns, error: bankError } = await supabase
      .from('accounting_bank_transactions')
      .select(`
        *,
        bank_account:accounting_bank_accounts!inner(*)
      `)
      .eq('bank_account.branch_id', effectiveBranchId)
      .eq('reconciled', false)
      .gt('credit_amount', 0);

    if (bankError) throw bankError;

    // 4. Calculate balances
    // For "book balance", we might need a total balance from chart of accounts, 
    // but for the demo UI, we'll sum up what we have or use bank account balances.

    const { data: bankAccounts } = await supabase
      .from('accounting_bank_accounts')
      .select('current_balance')
      .eq('branch_id', effectiveBranchId);

    const bankBalance = bankAccounts?.reduce((sum: number, acc: any) => sum + (acc.current_balance || 0), 0) || 0;

    // Unmatched sums
    const unmatchedSalesSum =
      (restOrders?.reduce((sum: number, o: any) => sum + Number(o.total_amount), 0) || 0) +
      (barOrders?.reduce((sum: number, o: any) => sum + Number(o.total), 0) || 0);

    const unmatchedDepositsSum = bankTxns?.reduce((sum: number, t: any) => sum + Number(t.credit_amount), 0) || 0;

    // Format transactions for frontend
    const transactions: any[] = [
      ...(restOrders?.map((o: any) => ({
        id: o.id,
        date: new Date(o.created_at).toISOString().split('T')[0],
        description: `Restaurant Order #${o.order_number} (${o.payment_method || 'Cash'})`,
        type: 'sale',
        amount: Number(o.total_amount),
        status: 'unmatched'
      })) || []),
      ...(barOrders?.map((o: any) => ({
        id: o.id,
        date: new Date(o.created_at).toISOString().split('T')[0],
        description: `Bar Order #${o.order_number} (${o.payment_method || 'Cash'})`,
        type: 'sale',
        amount: Number(o.total),
        status: 'unmatched'
      })) || []),
      ...(bankTxns?.map((t: any) => ({
        id: t.id,
        date: new Date(t.transaction_date).toISOString().split('T')[0],
        description: t.description || `Bank Deposit - Ref: ${t.reference}`,
        type: 'deposit',
        amount: Number(t.credit_amount),
        status: 'unmatched'
      })) || [])
    ];

    res.status(200).json({
      success: true,
      data: {
        balances: {
          book: bankBalance + unmatchedSalesSum - unmatchedDepositsSum, // Simplified logic: book should match bank + transit
          bank: bankBalance,
          unmatchedSales: unmatchedSalesSum,
          unmatchedDeposits: unmatchedDepositsSum
        },
        transactions
      }
    });

  } catch (error) {
    next(error);
  }
};

export const matchTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { transactionIds, matchType } = req.body;

    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length < 2) {
      res.status(400).json({ success: false, message: 'At least two transaction IDs (one sale, one deposit) are required' });
      return;
    }

    const saleId = transactionIds.find(id => {
      // We need a way to know which is which. 
      // In a real app, we might pass metadata or check tables.
      // For now, let's assume the frontend passes them in a specific order or we check.
      return true; // placeholder
    });

    // Strategy: Try to update all provided IDs in all potential tables. 
    // This is a bit brute force but effective for mixed IDs.

    const now = new Date().toISOString();

    // Identify which ID is a bank transaction and which is an order
    const { data: bankTxn, error: bankTxnError3 } = await supabase.from('accounting_bank_transactions').select('id').in('id', transactionIds).single();
    if (bankTxnError3) {
      console.error('Database error:', bankTxnError3);
      throw bankTxnError3;
    }

    if (!bankTxn) {
      res.status(404).json({ success: false, message: 'Bank transaction not found in matching set' });
      return;
    }

    const otherIds = transactionIds.filter(id => id !== bankTxn.id);

    // Update bank transaction
    const { error: reconcileError } = await supabase.from('accounting_bank_transactions').update({
      reconciled: true,
      updated_at: now
    }).eq('id', bankTxn.id);

    if (reconcileError) {
      console.error('Database error:', reconcileError);
      throw reconcileError;
    }

    // Update orders
    const { error: restOrderError } = await supabase.from('restaurant_orders').update({
      reconciled: true,
      reconciled_at: now,
      matched_transaction_id: bankTxn.id
    }).in('id', otherIds);

    if (restOrderError) {
      console.error('Database error:', restOrderError);
      throw restOrderError;
    }

    const { error: barOrderError } = await supabase.from('bar_orders').update({
      reconciled: true,
      reconciled_at: now,
      matched_transaction_id: bankTxn.id
    }).in('id', otherIds);

    if (barOrderError) {
      console.error('Database error:', barOrderError);
      throw barOrderError;
    }

    res.status(200).json({ success: true, message: 'Transactions matched and reconciled successfully' });

  } catch (error) {
    next(error);
  }
};
