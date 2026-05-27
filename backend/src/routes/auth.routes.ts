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
  posLogin,
  switchContext
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth';
import { supabase } from '../config/supabase';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
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

    const { data: roleRows, error } = await supabase
      .from('user_branch_roles')
      .select('role, branch_id, is_primary, branches(id, name, code)')
      .eq('user_id', requestedUserId)
      .order('is_primary', { ascending: false });

    if (error) throw error;

    let roles = (roleRows || []).map((row: any) => {
      const branch = Array.isArray(row.branches) ? row.branches[0] : row.branches;
      return {
        role: row.role,
        role_name: row.role,
        branch_id: row.branch_id,
        branch_name: branch?.name || null,
        branch_code: branch?.code || null,
        is_primary: row.is_primary === true
      };
    });

    if (!roles.length && req.user?.id === requestedUserId) {
      roles = [{
        role: req.user.role,
        role_name: req.user.role,
        branch_id: req.user.branch_id ?? null,
        branch_name: null,
        branch_code: null,
        is_primary: true
      }];
    }

    res.json({ success: true, roles, data: roles });
  } catch (error) {
    next(error);
  }
});
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.post('/forgotpassword', forgotPassword);
router.post('/switch-context', protect, switchContext);

export default router;
