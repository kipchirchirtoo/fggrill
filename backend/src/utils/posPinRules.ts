import { CASHIER_STATION_ROLES } from './posStationAccess';

const PIN_ONLY_STAFF_ROLES = new Set([
  'waiter',
  'waitress',
  'head_waiter',
  'bartender',
  'barmaid',
  'barman',
  ...CASHIER_STATION_ROLES,
]);

export const normalizeUserRole = (role: unknown): string =>
  String(role || '').trim().toLowerCase();

export const requiresPosPinForLogin = (role: unknown): boolean =>
  PIN_ONLY_STAFF_ROLES.has(normalizeUserRole(role));
