import { Request, Response, NextFunction } from 'express';
import { Folio } from '../models/Folio';
import { AppError } from '../middleware/errorHandler';
import { supabase } from '../config/database';

export const getFolio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId } = req.params;
    let folio = await Folio.findByReservationId(reservationId);

    // Lazy creation: if folio doesn't exist, create it
    if (!folio) {
      // Get reservation details to populate folio
      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (resError || !reservation) {
        throw new AppError('Reservation not found', 404);
      }

      folio = new Folio({
        reservationId: reservation.id,
        guestId: reservation.guest_id,
        folioNumber: reservation.confirmation_number,
        status: 'open',
        roomCharges: reservation.total_amount || 0
      });
      await folio.save();
      // console.log(`Lazy created folio for reservation: ${reservationId}`);
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
