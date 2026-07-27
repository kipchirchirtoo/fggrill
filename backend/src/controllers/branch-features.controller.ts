import { Request, Response } from 'express';
import db from '../db';
import { logger } from '../utils/logger';

export const FEATURE_CATALOG = [
  {
    key: 'GUEST_ROOM_CHARGING',
    name: 'Guest Room Charging',
    category: 'Accommodation',
    description: 'Allow outlet bills to be settled by charging to checked-in guest room folios',
    isParent: true,
  },
  {
    key: 'RESTAURANT_ROOM_CHARGING',
    name: 'Restaurant Room Charging',
    category: 'Restaurant POS',
    description: 'Allow Restaurant POS bills to be charged to guest rooms',
    parentKey: 'GUEST_ROOM_CHARGING',
  },
  {
    key: 'EXECUTIVE_BAR_ROOM_CHARGING',
    name: 'Executive Bar Room Charging',
    category: 'Bar POS',
    description: 'Allow Executive Bar bills to be charged to guest rooms',
    parentKey: 'GUEST_ROOM_CHARGING',
  },
  {
    key: 'SPORTS_BAR_ROOM_CHARGING',
    name: 'Sports Bar Room Charging',
    category: 'Bar POS',
    description: 'Allow Sports Bar bills to be charged to guest rooms',
    parentKey: 'GUEST_ROOM_CHARGING',
  },
  {
    key: 'KITCHEN_CONTROL_STATION',
    name: 'Kitchen Control Station',
    category: 'Kitchen Control',
    description: 'Enable kitchen prep and yield tracking for food controls',
    isParent: false,
  },
  {
    key: 'BREAKFAST_PAX_TRACKING',
    name: 'Breakfast Pax Tracking',
    category: 'Accommodation',
    description: 'Enable daily breakfast guest pax tracking and headcount log',
    isParent: false,
  },
  {
    key: 'PETTY_CASH_APPROVALS',
    name: 'Petty Cash Approvals',
    category: 'Finance',
    description: 'Require manager approval for front desk petty cash requests',
    isParent: false,
  },
  {
    key: 'SHIFTS_OPENING_APPROVAL',
    name: 'Cashier Shift Opening Approval',
    category: 'Cashier',
    description: 'Require supervisor approval when opening cashier shifts',
    isParent: false,
  },
];

/**
 * Get feature toggles for all branches or a specific branch
 */
export const getBranchFeatures = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : null;

    let branchesResult;
    if (branchId) {
      branchesResult = await db.query('SELECT id, name, code, status FROM branches WHERE id = $1', [branchId]);
    } else {
      branchesResult = await db.query('SELECT id, name, code, status FROM branches ORDER BY id ASC');
    }

    const branches = branchesResult.rows;

    const featuresResult = await db.query(
      `SELECT id, branch_id, feature_name, feature_key, category, is_enabled, config, updated_at, updated_by
       FROM branch_features
       ORDER BY branch_id ASC, id ASC`
    );

    const featuresByBranch: Record<number, Record<string, any>> = {};

    for (const row of featuresResult.rows) {
      const bId = row.branch_id;
      if (!featuresByBranch[bId]) {
        featuresByBranch[bId] = {};
      }
      const key = row.feature_key || row.feature_name;
      featuresByBranch[bId][key] = {
        id: row.id,
        feature_key: key,
        feature_name: row.feature_name,
        category: row.category,
        is_enabled: Boolean(row.is_enabled),
        config: row.config || {},
        updated_at: row.updated_at,
        updated_by: row.updated_by,
      };
    }

    const result = branches.map((b) => {
      const bFeatures = featuresByBranch[b.id] || {};
      const fullCatalog = FEATURE_CATALOG.map((item) => {
        const existing = bFeatures[item.key];
        return {
          feature_key: item.key,
          feature_name: item.name,
          category: item.category,
          description: item.description,
          parentKey: (item as any).parentKey || null,
          isParent: (item as any).isParent || false,
          is_enabled: existing ? existing.is_enabled : false,
          config: existing ? existing.config : {},
          updated_at: existing ? existing.updated_at : null,
        };
      });

      return {
        branch_id: b.id,
        branch_name: b.name,
        branch_code: b.code,
        status: b.status || 'Active',
        features: fullCatalog,
      };
    });

    res.json({
      success: true,
      catalog: FEATURE_CATALOG,
      branches: result,
    });
  } catch (error: any) {
    logger.error('Error fetching branch features:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch branch features', error: error.message });
  }
};

/**
 * Update or toggle a feature setting for a branch
 */
export const toggleBranchFeature = async (req: Request, res: Response): Promise<void> => {
  try {
    const { branch_id, feature_key, is_enabled, config } = req.body;
    const userId = (req as any).user?.id || null;

    if (!branch_id || !feature_key) {
      res.status(400).json({ success: false, message: 'branch_id and feature_key are required' });
      return;
    }

    const catalogItem = FEATURE_CATALOG.find((c) => c.key === feature_key);
    const category = catalogItem ? catalogItem.category : 'General';

    const existingRes = await db.query(
      'SELECT id, is_enabled FROM branch_features WHERE branch_id = $1 AND (feature_key = $2 OR feature_name = $2)',
      [branch_id, feature_key]
    );

    const previousValue = existingRes.rows.length > 0 ? existingRes.rows[0].is_enabled : false;

    const query = `
      INSERT INTO branch_features (branch_id, feature_name, feature_key, category, is_enabled, config, updated_by, updated_at)
      VALUES ($1, $2, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (branch_id, feature_name)
      DO UPDATE SET
        feature_key = EXCLUDED.feature_key,
        category = EXCLUDED.category,
        is_enabled = EXCLUDED.is_enabled,
        config = COALESCE(EXCLUDED.config, branch_features.config),
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *;
    `;

    const result = await db.query(query, [
      branch_id,
      feature_key,
      category,
      Boolean(is_enabled),
      JSON.stringify(config || {}),
      userId,
    ]);

    // Log to audit log
    await db.query(
      `INSERT INTO audit_logs (user_id, action, resource, metadata, branch_id, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        userId,
        'TOGGLE_FEATURE',
        'branch_features',
        JSON.stringify({
          feature_key,
          previous_value: previousValue,
          new_value: Boolean(is_enabled),
          config: config || {},
        }),
        branch_id,
      ]
    );

    res.json({
      success: true,
      message: `Feature ${feature_key} updated for branch ${branch_id}`,
      feature: result.rows[0],
    });
  } catch (error: any) {
    logger.error('Error toggling branch feature:', error);
    res.status(500).json({ success: false, message: 'Failed to update feature setting', error: error.message });
  }
};

/**
 * Check if a feature is enabled for a specific branch
 */
export const checkFeatureEnabled = async (req: Request, res: Response): Promise<void> => {
  try {
    const branchId = Number(req.query.branch_id || req.params.branchId);
    const featureKey = String(req.query.feature_key || req.params.featureKey);

    if (!branchId || !featureKey) {
      res.status(400).json({ success: false, message: 'branch_id and feature_key required' });
      return;
    }

    const query = `
      SELECT is_enabled, config
      FROM branch_features
      WHERE branch_id = $1 AND (feature_key = $2 OR feature_name = $2)
    `;
    const result = await db.query(query, [branchId, featureKey]);

    const isEnabled = result.rows.length > 0 ? Boolean(result.rows[0].is_enabled) : false;
    const config = result.rows.length > 0 ? result.rows[0].config : {};

    res.json({
      success: true,
      branch_id: branchId,
      feature_key: featureKey,
      is_enabled: isEnabled,
      config,
    });
  } catch (error: any) {
    logger.error('Error checking feature enabled:', error);
    res.status(500).json({ success: false, message: 'Error checking feature', error: error.message });
  }
};
