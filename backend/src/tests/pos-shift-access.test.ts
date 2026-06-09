import {
  isCashierStationRole,
  stationTypesForCashierRole,
  canAccessPosOutlet,
  type PosOutlet,
} from '../utils/posStationAccess';
import { normalizeBarStation } from '../utils/posStationShift';

const mainBar: PosOutlet = { id: 'o-main', outlet_type: 'main_bar', branch_id: 2 };
const execBar: PosOutlet = { id: 'o-exec', outlet_type: 'executive_bar', branch_id: 2 };

describe('POS station / shift access rules', () => {
  describe('isCashierStationRole — only cashiers may open shifts', () => {
    it('accepts station cashier roles', () => {
      expect(isCashierStationRole('main_bar_cashier')).toBe(true);
      expect(isCashierStationRole('executive_bar_cashier')).toBe(true);
      expect(isCashierStationRole('cashier')).toBe(true);
    });
    it('rejects waiters and non-cashiers', () => {
      expect(isCashierStationRole('waiter')).toBe(false);
      expect(isCashierStationRole('head_waiter')).toBe(false);
      expect(isCashierStationRole('general_manager')).toBe(false);
    });
  });

  describe('per-station scoping', () => {
    it('main_bar cashier serves main bar but NOT executive bar', () => {
      const types = stationTypesForCashierRole('main_bar_cashier');
      expect(types).toContain('main_bar');
      expect(types).not.toContain('executive_bar');
      expect(canAccessPosOutlet('main_bar_cashier', mainBar, [])).toBe(true);
      expect(canAccessPosOutlet('main_bar_cashier', execBar, [])).toBe(false);
    });
    it('executive_bar cashier serves exec bar but NOT main bar', () => {
      expect(canAccessPosOutlet('executive_bar_cashier', execBar, [])).toBe(true);
      expect(canAccessPosOutlet('executive_bar_cashier', mainBar, [])).toBe(false);
    });
  });

  describe('normalizeBarStation', () => {
    it('maps free-form labels to canonical outlet types', () => {
      expect(normalizeBarStation('Executive Bar')).toBe('executive_bar');
      expect(normalizeBarStation('EXEC_BAR')).toBe('executive_bar');
      expect(normalizeBarStation('Main Bar')).toBe('main_bar');
      expect(normalizeBarStation('main_bar')).toBe('main_bar');
      expect(normalizeBarStation('')).toBeNull();
    });
  });
});
