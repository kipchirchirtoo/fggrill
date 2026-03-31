import { Router, Request, Response } from 'express';

const router = Router();

// Public ID verification route
router.post('/', (req: Request, res: Response) => {
    try {
        const branch = req.body.branch;
        let branchName = '';
        
        if (Array.isArray(branch) && branch.length > 0) {
            branchName = (branch[0] as { name: string }).name;
        } else if (branch && typeof branch.name === 'string') {
            branchName = branch.name;
        } else {
            return res.status(400).json({ error: 'Invalid branch data' });
        }
        
        res.json({ success: true, branchName });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;