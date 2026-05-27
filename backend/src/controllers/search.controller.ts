import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

type SearchRecord = Record<string, any>;

type SearchConfig = {
  module: string;
  table: string;
  keys: string[];
  label: (row: SearchRecord) => string;
  subtitle: (row: SearchRecord) => string;
};

const valueText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const pickFirst = (row: SearchRecord, keys: string[]): string => {
  for (const key of keys) {
    const value = valueText(row[key]).trim();
    if (value) return value;
  }
  return '';
};

const nameFrom = (row: SearchRecord): string => {
  const fullName = pickFirst(row, ['name', 'full_name', 'guest_name', 'customer_name']);
  if (fullName) return fullName;
  return `${valueText(row.first_name)} ${valueText(row.last_name)}`.trim();
};

const configs: SearchConfig[] = [
  {
    module: 'staff',
    table: 'staff_profiles',
    keys: ['first_name', 'last_name', 'name', 'employee_id', 'staff_id', 'email', 'phone', 'phone_number', 'department', 'position'],
    label: (row) => nameFrom(row) || pickFirst(row, ['employee_id', 'staff_id']) || 'Staff Profile',
    subtitle: (row) => [pickFirst(row, ['employee_id', 'staff_id']), pickFirst(row, ['department', 'position'])].filter(Boolean).join(' - ')
  },
  {
    module: 'user',
    table: 'users',
    keys: ['first_name', 'last_name', 'name', 'email', 'role', 'phone_number'],
    label: (row) => nameFrom(row) || row.email || 'System User',
    subtitle: (row) => [row.email, row.role].filter(Boolean).join(' - ')
  },
  {
    module: 'branch',
    table: 'branches',
    keys: ['name', 'code', 'location', 'address', 'email', 'phone'],
    label: (row) => row.name || 'Branch',
    subtitle: (row) => [row.code, row.location, row.status].filter(Boolean).join(' - ')
  },
  {
    module: 'department',
    table: 'departments',
    keys: ['name', 'code', 'status'],
    label: (row) => row.name || 'Department',
    subtitle: (row) => [row.code, row.status].filter(Boolean).join(' - ')
  },
  {
    module: 'booking',
    table: 'bookings',
    keys: ['confirmation_number', 'booking_number', 'short_code', 'guest_name', 'status', 'phone', 'guest_phone'],
    label: (row) => `Booking ${pickFirst(row, ['confirmation_number', 'booking_number', 'short_code']) || row.id}`,
    subtitle: (row) => [row.guest_name, row.status, row.total_amount ? `KES ${row.total_amount}` : ''].filter(Boolean).join(' - ')
  },
  {
    module: 'restaurant_order',
    table: 'restaurant_orders',
    keys: ['order_number', 'short_code', 'table_number', 'waiter_name', 'customer_name', 'status', 'payment_status'],
    label: (row) => `Restaurant Order ${pickFirst(row, ['order_number', 'short_code']) || row.id}`,
    subtitle: (row) => [row.waiter_name, row.status, row.total_amount ? `KES ${row.total_amount}` : ''].filter(Boolean).join(' - ')
  },
  {
    module: 'bar_order',
    table: 'bar_orders',
    keys: ['order_number', 'short_code', 'bartender_name', 'customer_name', 'status', 'payment_status'],
    label: (row) => `Bar Order ${pickFirst(row, ['order_number', 'short_code']) || row.id}`,
    subtitle: (row) => [row.bartender_name, row.status, row.total_amount ? `KES ${row.total_amount}` : ''].filter(Boolean).join(' - ')
  },
  {
    module: 'pos_outlet',
    table: 'pos_outlets',
    keys: ['name', 'code', 'outlet_type', 'status'],
    label: (row) => row.name || row.code || 'POS Outlet',
    subtitle: (row) => [row.code, row.outlet_type, row.status].filter(Boolean).join(' - ')
  },
  {
    module: 'stock_item',
    table: 'store_items',
    keys: ['name', 'item_name', 'sku', 'category', 'store_type'],
    label: (row) => pickFirst(row, ['name', 'item_name']) || row.sku || 'Stock Item',
    subtitle: (row) => [row.sku, row.category, row.store_type].filter(Boolean).join(' - ')
  },
  {
    module: 'payment',
    table: 'payments',
    keys: ['payment_id', 'reference', 'transaction_id', 'method', 'status'],
    label: (row) => `Payment ${pickFirst(row, ['payment_id', 'reference', 'transaction_id']) || row.id}`,
    subtitle: (row) => [row.method, row.status, row.amount ? `KES ${row.amount}` : ''].filter(Boolean).join(' - ')
  },
  {
    module: 'audit',
    table: 'audit_logs',
    keys: ['action', 'entity', 'entity_id', 'user_email', 'description', 'details'],
    label: (row) => pickFirst(row, ['action', 'entity']) || 'Audit Log',
    subtitle: (row) => [row.entity, row.user_email, row.created_at].filter(Boolean).join(' - ')
  }
];

const rowMatches = (row: SearchRecord, keys: string[], query: string): boolean => {
  return keys.some((key) => valueText(row[key]).toLowerCase().includes(query));
};

/**
 * Global search across SuperAdmin-owned records. It intentionally tolerates
 * missing legacy tables/columns so one older module cannot break global search.
 */
export const globalSearch = async (req: Request, res: Response) => {
  try {
    const { q, modules } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const searchQuery = q.trim().toLowerCase();

    if (searchQuery.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const moduleFilter = modules
      ? new Set(
          (typeof modules === 'string' ? modules.split(',') : Array.isArray(modules) ? modules : [modules])
            .map((module) => String(module).trim())
            .filter(Boolean)
        )
      : null;

    const selectedConfigs = moduleFilter
      ? configs.filter((config) => moduleFilter.has(config.module))
      : configs;

    const settled = await Promise.allSettled(
      selectedConfigs.map(async (config) => {
        const { data, error } = await supabase
          .from(config.table)
          .select('*')
          .limit(100);

        if (error || !data) return [];

        return data
          .filter((row) => rowMatches(row, config.keys, searchQuery))
          .slice(0, 12)
          .map((row) => ({
            type: config.module,
            id: row.id,
            display_name: config.label(row),
            subtitle: config.subtitle(row),
            metadata: row
          }));
      })
    );

    const results = settled.flatMap((entry) =>
      entry.status === 'fulfilled' ? entry.value : []
    );

    return res.status(200).json({
      success: true,
      data: results,
      count: results.length,
      query: searchQuery
    });
  } catch (error) {
    console.error('Global search error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to perform search',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
