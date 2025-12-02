import { Request, Response, NextFunction } from 'express';
import { Folio } from '../models/Folio';
import { AppError } from '../middleware/errorHandler';
import { supabase } from '../config/database';

export const getFolio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const folio = await Folio.findByReservationId(req.params.reservationId);
    if (!folio) throw new AppError('Folio not found', 404);
    
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
