import { Router } from 'express';
import { protect, authorize, UserRole } from '../middleware/auth';
import * as lina from '../controllers/lina.controller';

const router = Router();
router.use(protect);

// Lina Core OS is available to leadership, audit, finance, HR, operations, and
// cashier roles; each tool/action still enforces branch and risk policy in the
// controller.
const LINA_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.DIRECTOR,
  UserRole.GENERAL_MANAGER,
  UserRole.AUDITOR,
  UserRole.BRANCH_ACCOUNTANT,
  UserRole.ACCOUNTANT,
  UserRole.FINANCE_MANAGER,
  UserRole.HR_MANAGER,
  UserRole.BRANCH_MANAGER,
  UserRole.BRANCH_OPERATIONS_MANAGER,
  UserRole.CENTRAL_OPERATIONS_MANAGER,
];
router.use(authorize(LINA_ROLES));

// Core intelligence
router.get('/context', lina.getSystemContext);
router.get('/monitoring', lina.getLiveMonitoring);
router.get('/model-router', lina.getModelRouterStatus);
router.get('/tools', lina.getLinaTools);
router.post('/tools/read-table', lina.readLinaTableTool);
router.post('/tools/read-only-sql', lina.runReadOnlySqlTool);
router.get('/executive-summary', lina.getExecutiveSummary);
router.get('/anomaly-report', lina.getAnomalyReport);
router.get('/incident-timeline', lina.getIncidentTimeline);

// Chat (SSE streaming)
router.post('/chat', lina.chat);

// Intelligence modules
router.get('/employee-intelligence', lina.getEmployeeIntelligence);
router.get('/financial-intelligence', lina.getFinancialIntelligence);
router.get('/recommendations', lina.getRecommendations);

// Analytics engine (deterministic — always available)
router.get('/branch-benchmark', lina.getBranchBenchmark);
router.get('/forecast', lina.getForecast);

// Remediation workflow
router.post('/remediate', lina.proposeRemediation);
router.get('/remediations/pending', lina.getPendingRemediations);
router.get('/remediations/history', lina.getRemediationHistory);
router.get('/remediations/:id/history', lina.getRemediationDetails);
router.get('/agent-logs', lina.getAgentLogs);
router.post('/remediations/:id/approve', lina.approveRemediation);
router.post('/remediations/:id/reject', lina.rejectRemediation);
router.post('/remediations/:id/execute', lina.executeRemediation);
router.post('/remediations/:id/verify', lina.verifyRemediation);

export default router;
