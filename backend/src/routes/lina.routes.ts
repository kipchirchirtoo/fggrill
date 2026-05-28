import { Router } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import * as lina from '../controllers/lina.controller';

const router = Router();
router.use(protect);

// Lina is available to: SuperAdmin, Director, Auditor
const LINA_ROLES = [UserRole.SUPER_ADMIN, UserRole.DIRECTOR, UserRole.AUDITOR];
router.use(authorize(LINA_ROLES));

// Core intelligence
router.get('/context', lina.getSystemContext);
router.get('/monitoring', lina.getLiveMonitoring);
router.get('/executive-summary', lina.getExecutiveSummary);
router.get('/anomaly-report', lina.getAnomalyReport);
router.get('/incident-timeline', lina.getIncidentTimeline);

// Chat (SSE streaming)
router.post('/chat', lina.chat);

// Intelligence modules
router.get('/employee-intelligence', lina.getEmployeeIntelligence);
router.get('/financial-intelligence', lina.getFinancialIntelligence);
router.get('/recommendations', lina.getRecommendations);

// Remediation workflow
router.post('/remediate', lina.proposeRemediation);
router.get('/remediations/pending', lina.getPendingRemediations);
router.post('/remediations/:id/approve', lina.approveRemediation);
router.post('/remediations/:id/reject', lina.rejectRemediation);

export default router;
