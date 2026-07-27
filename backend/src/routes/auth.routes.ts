import express from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateDetails,
  updatePassword,
  forgotPassword,
  validateLicense,
  posLogin,
  switchContext
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth';
import { supabase } from '../config/supabase';
import { getUserInventoryContexts } from '../services/inventory-warehouse.service';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/license/validate', validateLicense);
router.post('/pos-login', posLogin);
router.post('/refresh-token', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.get('/user-roles/:userId', protect, async (req, res, next) => {
  try {
    const requestedUserId = req.params.userId;
    if (req.user?.id !== requestedUserId && req.user?.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot view roles for another user'
      });
    }

    const roles = await getUserInventoryContexts(requestedUserId, {
      role: req.user?.role,
      branch_id: req.user?.branch_id ?? null,
    });

    res.json({ success: true, roles, data: roles });
  } catch (error) {
    next(error);
  }
});
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.post('/forgotpassword', forgotPassword);
router.post('/switch-context', protect, switchContext);
router.put('/update-pin', protect, async (req, res, next) => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: 'Not authorized' });
      return;
    }
    const { currentPin, newPin } = req.body;
    
    if (!newPin || !/^[RMNCE]\d{4}$/.test(String(newPin))) {
      res.status(400).json({ success: false, message: 'New PIN must start with R, M, N, C, or E followed by exactly 4 digits' });
      return;
    }
    const normalizedNewPin = String(newPin).trim().toUpperCase();
    const normalizedCurrentPin = String(currentPin ?? '').trim().toUpperCase();

    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('pos_pin')
      .eq('id', req.user.id)
      .single();

    if (fetchErr || !user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const storedRaw = String(user.pos_pin ?? '').trim().toUpperCase();
    if (storedRaw && storedRaw !== normalizedCurrentPin) {
      res.status(400).json({ success: false, message: 'Current PIN is incorrect' });
      return;
    }

    // Check for duplicates
    const { data: pinConflict } = await supabase
      .from('users')
      .select('id')
      .eq('pos_pin', normalizedNewPin)
      .maybeSingle();

    if (pinConflict && pinConflict.id !== req.user.id) {
      res.status(409).json({ success: false, message: 'POS PIN is already assigned to another user' });
      return;
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ pos_pin: normalizedNewPin, updated_at: new Date().toISOString() })
      .eq('id', req.user.id);

    if (updateErr) throw updateErr;
    res.json({ success: true, message: 'PIN updated successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
