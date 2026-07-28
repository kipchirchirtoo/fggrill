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
      const resPaid = Math.max(
        Number(reservation.amount_paid || 0),
        Number(reservation.deposit_amount || 0)
      );
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
      referenceNumber: t.reference_number || t.bill_number || t.order_number || '',
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

    res.status(200).json({
      success: true,
      data: {
        folio,
        transactions
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
