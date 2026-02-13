import express from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

const router = express.Router();

// Public endpoint to verify staff ID from QR code
router.get('/verify/:id', async (req, res) => {
    try {
        const { id } = req.params;

        logger.info(`ID Verification request for: ${id}`);

        // Query staff_profiles for the ID number
        const { data: staff, error } = await supabase
            .from('staff_profiles')
            .select(`
                id,
                first_name,
                last_name,
                id_number,
                position,
                department,
                status,
                branch:branches(name)
            `)
            .eq('id_number', id)
            .maybeSingle();

        if (error) {
            logger.error('Error verifying ID:', error);
            return res.status(500).json({
                success: false,
                valid: false,
                message: 'Verification system error'
            });
        }

        if (!staff) {
            logger.warn(`Invalid ID verification attempt: ${id}`);
            return res.status(200).json({
                success: true,
                valid: false,
                message: 'ID not found in system'
            });
        }

        // Check if staff is active
        const isActive = staff.status === 'active';

        logger.info(`ID verified: ${id} - ${staff.first_name} ${staff.last_name} (${isActive ? 'Active' : 'Inactive'})`);

        res.status(200).json({
            success: true,
            valid: true,
            active: isActive,
            data: {
                id_number: staff.id_number,
                name: `${staff.first_name} ${staff.last_name}`,
                position: staff.position,
                department: staff.department,
                branch: (staff.branch as any)?.name || 'N/A',
                status: staff.status
            }
        });

    } catch (error) {
        logger.error('Unexpected error in ID verification:', error);
        res.status(500).json({
            success: false,
            valid: false,
            message: 'Internal server error'
        });
    }
});

export default router;
