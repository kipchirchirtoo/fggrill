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
      // Sync room_charges and recalculate totalCharges & balance
      const resRoomCharge = Number(reservation.total_amount || 0);
      const foodCharges = Number(folio.foodCharges || 0);
      const beverageCharges = Number(folio.beverageCharges || 0);
      const otherCharges = Number(folio.otherCharges || 0);
      const currentRoomCharges = Math.max(Number(folio.roomCharges || 0), resRoomCharge);

      const calculatedTotalCharges = currentRoomCharges + foodCharges + beverageCharges + otherCharges;
      const resPaid = Math.max(
        Number(reservation.amount_paid || 0),
        Number(reservation.deposit_amount || 0)
      );
      const totalPayments = Math.max(Number(folio.totalPayments || 0), resPaid);
      const calculatedBalance = Math.max(0, calculatedTotalCharges - totalPayments);

      if (folio.roomCharges !== currentRoomCharges || folio.totalCharges !== calculatedTotalCharges || folio.balance !== calculatedBalance) {
        folio.roomCharges = currentRoomCharges;
        folio.totalCharges = calculatedTotalCharges;
        folio.totalPayments = totalPayments;
        folio.balance = calculatedBalance;

        await supabase
          .from('folios')
          .update({
            room_charges: currentRoomCharges,
            total_charges: calculatedTotalCharges,
            total_payments: totalPayments,
            balance: calculatedBalance,
            updated_at: new Date()
          })
          .eq('id', folio.id);
      }
    }

    const transactions = await folio.getTransactions();

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
