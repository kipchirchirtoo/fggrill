import { Router } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';

const router = Router();

// Apply authentication to all admin routes
router.use(protect);

// Role Migration Management
router.get('/role-migrations',
  authorize([UserRole.SUPER_ADMIN]),
  async (req, res) => {
    try {
      // Mock data for role migrations
      const migrations = [
        {
          id: 1,
          old_role: 'STAFF',
          new_role: 'RESTAURANT_STAFF',
          description: 'Consolidate general staff into restaurant-specific roles',
          status: 'pending',
          affected_users: 12,
          created_at: '2024-12-01T10:00:00Z',
          is_reversible: true
        },
        {
          id: 2,
          old_role: 'MANAGER',
          new_role: 'BRANCH_MANAGER',
          description: 'Update manager roles to branch-specific management',
          status: 'completed',
          affected_users: 5,
          created_at: '2024-11-28T14:30:00Z',
          is_reversible: false
        },
        {
          id: 3,
          old_role: 'ADMIN',
          new_role: 'SYSTEM_ADMIN',
          description: 'Separate system admin from general admin roles',
          status: 'in_progress',
          affected_users: 3,
          created_at: '2024-12-05T09:15:00Z',
          is_reversible: true
        }
      ];

      res.json({
        success: true,
        data: migrations
      });
    } catch (error) {
      console.error('Error fetching role migrations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch role migrations'
      });
    }
  }
);

// Execute Role Migration
router.post('/role-migrations/:id/execute',
  authorize([UserRole.SUPER_ADMIN]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Mock execution
      res.json({
        success: true,
        message: `Role migration ${id} executed successfully`,
        data: {
          id: parseInt(id),
          status: 'completed',
          executed_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error executing role migration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute role migration'
      });
    }
  }
);

// Revert Role Migration
router.post('/role-migrations/:id/revert',
  authorize([UserRole.SUPER_ADMIN]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Mock revert
      res.json({
        success: true,
        message: `Role migration ${id} reverted successfully`,
        data: {
          id: parseInt(id),
          status: 'reverted',
          reverted_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error reverting role migration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revert role migration'
      });
    }
  }
);

// Get affected users for a migration
router.get('/role-migrations/:id/users',
  authorize([UserRole.SUPER_ADMIN]),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Mock affected users data
      const users = [
        {
          id: 1,
          name: 'John Doe',
          email: 'john.doe@famousgate.co.ke',
          role: 'STAFF',
          branch_name: 'Main Branch'
        },
        {
          id: 2,
          name: 'Jane Smith',
          email: 'jane.smith@famousgate.co.ke',
          role: 'STAFF',
          branch_name: 'Downtown Branch'
        },
        {
          id: 3,
          name: 'Mike Johnson',
          email: 'mike.johnson@famousgate.co.ke',
          role: 'STAFF',
          branch_name: 'Airport Branch'
        }
      ];

      res.json({
        success: true,
        data: users
      });
    } catch (error) {
      console.error('Error fetching migration users:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch affected users'
      });
    }
  }
);

export default router;
