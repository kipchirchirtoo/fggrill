// useAuth — auth actions and session access

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bridge } from '../bridge';
import { useAppState } from '../state/AppStateProvider';
import { toast } from 'sonner';

export function useAuth() {
  const { session, setSession } = useAppState();
  const navigate = useNavigate();

  const login = useCallback(async (email: string, password: string) => {
    const resp = await bridge.auth.login(email, password);
    if (resp.success && resp.data) {
      const { user, session: apiSession } = resp.data;
      setSession({
        user_id: user.id,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id ?? null,
        branch_name: user.branch_name ?? null,
        token: apiSession.access_token,
        expires_at: Date.now() / 1000 + 86400,
      });
      localStorage.setItem('fg_token', apiSession.access_token);
      if (user.branch_id) {
        localStorage.setItem('fg_branch_id', String(user.branch_id));
      }
      navigate('/dashboard');
    } else {
      throw new Error(resp.message ?? 'Login failed');
    }
  }, [setSession, navigate]);

  const posLogin = useCallback(async (pin: string, branchId?: number) => {
    const resp = await bridge.auth.posLogin(pin, branchId);
    if (resp.success && resp.data) {
      const { user, session: apiSession } = resp.data;
      setSession({
        user_id: user.id,
        email: user.email,
        role: user.role,
        branch_id: user.branch_id ?? null,
        branch_name: user.branch_name ?? null,
        token: apiSession.access_token,
        expires_at: Date.now() / 1000 + 43200,
      });
      localStorage.setItem('fg_token', apiSession.access_token);
    } else {
      throw new Error(resp.message ?? 'PIN login failed');
    }
  }, [setSession]);

  const logout = useCallback(async () => {
    await bridge.auth.logout();
    setSession(null);
    localStorage.removeItem('fg_token');
    localStorage.removeItem('fg_branch_id');
    navigate('/login');
    toast.info('Signed out');
  }, [setSession, navigate]);

  return { session, login, posLogin, logout };
}
