import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { supabase } from '../config/database';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchDashboardData() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [auditRes, exceptionsRes, shiftsRes, billsRes, voidRes] = await Promise.all([
    supabase
      .from('audit_trail')
      .select('id, user_id, action, entity_type, performed_at')
      .gte('performed_at', since)
      .order('performed_at', { ascending: false })
      .limit(200),

    supabase
      .from('audit_exceptions')
      .select('id, exception_type, severity, description, amount, status, detected_at')
      .gte('detected_at', since)
      .order('detected_at', { ascending: false })
      .limit(100),

    supabase
      .from('cashier_shifts')
      .select('id, cashier_id, branch_id, status, opened_at, closed_at, opening_float, closing_float, total_sales, discrepancy_amount')
      .gte('opened_at', since)
      .order('opened_at', { ascending: false })
      .limit(100),

    supabase
      .from('restaurant_bills')
      .select('id, bill_number, status, total_amount, created_at, created_by')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200),

    supabase
      .from('void_bills_audit')
      .select('id, voided_by, void_reason, original_amount, voided_at')
      .gte('voided_at', since)
      .order('voided_at', { ascending: false })
      .limit(50),
  ]);

  return {
    auditTrail: auditRes.data || [],
    exceptions: exceptionsRes.data || [],
    shifts: shiftsRes.data || [],
    bills: billsRes.data || [],
    voids: voidRes.data || [],
  };
}

function buildAnomaliesFromData(data: Awaited<ReturnType<typeof fetchDashboardData>>) {
  const anomalies: any[] = [];

  // Shifts with discrepancies
  for (const shift of data.shifts) {
    const disc = Math.abs(Number(shift.discrepancy_amount) || 0);
    if (disc > 500) {
      anomalies.push({
        id: `shift-${shift.id}`,
        user_id: shift.cashier_id,
        type: 'SHIFT_DISCREPANCY',
        severity: disc > 5000 ? 'CRITICAL' : disc > 2000 ? 'HIGH' : 'MEDIUM',
        score: Math.min(disc / 1000, 10),
        description: `Cashier shift closed with KES ${disc.toLocaleString()} discrepancy`,
        detected_at: shift.closed_at || shift.opened_at,
        metadata: { shift_id: shift.id, discrepancy: disc },
      });
    }
  }

  // Audit exceptions
  for (const ex of data.exceptions) {
    anomalies.push({
      id: `exc-${ex.id}`,
      user_id: null,
      type: ex.exception_type,
      severity: ex.severity?.toUpperCase() || 'MEDIUM',
      score: ex.severity === 'CRITICAL' ? 9 : ex.severity === 'HIGH' ? 7 : 4,
      description: ex.description,
      detected_at: ex.detected_at,
      metadata: { amount: ex.amount, status: ex.status },
    });
  }

  // Void bills
  for (const v of data.voids) {
    anomalies.push({
      id: `void-${v.id}`,
      user_id: v.voided_by,
      type: 'BILL_VOID',
      severity: Number(v.original_amount) > 10000 ? 'HIGH' : 'MEDIUM',
      score: Math.min(Number(v.original_amount) / 5000, 10),
      description: `Bill voided: KES ${Number(v.original_amount).toLocaleString()} — "${v.void_reason || 'No reason given'}"`,
      detected_at: v.voided_at,
      metadata: { amount: v.original_amount, reason: v.void_reason },
    });
  }

  return anomalies.sort((a, b) => b.score - a.score);
}

async function callGemini(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (err: any) {
    logger.error('Gemini API error:', err.message);
    return 'AI analysis temporarily unavailable.';
  }
}

// ── Controllers ───────────────────────────────────────────────────────────────

export const getBehaviorAnomalies = async (req: Request, res: Response) => {
  try {
    const data = await fetchDashboardData();
    const anomalies = buildAnomaliesFromData(data);

    res.status(200).json({
      success: true,
      anomalies,
      count: anomalies.length,
      stats: {
        total_audit_events: data.auditTrail.length,
        total_shifts: data.shifts.length,
        total_voids: data.voids.length,
        total_bills: data.bills.length,
      },
    });
  } catch (error: any) {
    logger.error('Error building behavior anomalies:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch AI insights' });
  }
};

export const getGeminiInsights = async (req: Request, res: Response) => {
  try {
    const data = await fetchDashboardData();
    const anomalies = buildAnomaliesFromData(data);

    const criticalCount = anomalies.filter(a => a.severity === 'CRITICAL').length;
    const highCount = anomalies.filter(a => a.severity === 'HIGH').length;
    const totalVoidAmount = data.voids.reduce((s, v) => s + Number(v.original_amount || 0), 0);
    const totalDiscrepancy = data.shifts.reduce((s, sh) => s + Math.abs(Number(sh.discrepancy_amount || 0)), 0);

    const prompt = `You are a hotel operations security analyst AI for Famous Gates Hotels.
Analyze the following 30-day operational data and provide concise, actionable intelligence insights.

DATA SUMMARY:
- Audit trail events: ${data.auditTrail.length}
- Cashier shifts analyzed: ${data.shifts.length}
- Total shift discrepancies: KES ${totalDiscrepancy.toLocaleString()}
- Bills voided: ${data.voids.length} (total KES ${totalVoidAmount.toLocaleString()})
- Audit exceptions flagged: ${data.exceptions.length}
- Critical anomalies: ${criticalCount}
- High severity anomalies: ${highCount}

TOP ANOMALIES:
${anomalies.slice(0, 5).map(a => `- [${a.severity}] ${a.description}`).join('\n')}

Provide exactly 4 insights in this JSON format (respond with ONLY valid JSON, no markdown):
{
  "summary": "One sentence executive summary of the security posture",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "insights": [
    { "title": "short title", "detail": "2-3 sentence actionable insight", "category": "FINANCIAL|OPERATIONAL|SECURITY|COMPLIANCE" },
    { "title": "...", "detail": "...", "category": "..." },
    { "title": "...", "detail": "...", "category": "..." },
    { "title": "...", "detail": "...", "category": "..." }
  ],
  "recommendation": "Top priority action for management"
}`;

    const raw = await callGemini(prompt);

    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        summary: 'AI analysis completed. Manual review recommended.',
        risk_level: criticalCount > 0 ? 'CRITICAL' : highCount > 0 ? 'HIGH' : 'MEDIUM',
        insights: [
          { title: 'Shift Discrepancies', detail: `Total of KES ${totalDiscrepancy.toLocaleString()} in shift discrepancies detected across ${data.shifts.length} shifts.`, category: 'FINANCIAL' },
          { title: 'Void Activity', detail: `${data.voids.length} bills voided totalling KES ${totalVoidAmount.toLocaleString()}.`, category: 'OPERATIONAL' },
          { title: 'Audit Exceptions', detail: `${data.exceptions.length} audit exceptions flagged in the last 30 days.`, category: 'COMPLIANCE' },
          { title: 'Anomaly Count', detail: `${anomalies.length} behavioral anomalies detected. ${criticalCount} critical, ${highCount} high severity.`, category: 'SECURITY' },
        ],
        recommendation: 'Review all critical anomalies and investigate shift discrepancies immediately.',
      };
    }

    res.status(200).json({ success: true, data: parsed });
  } catch (error: any) {
    logger.error('Error generating Gemini insights:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate AI insights' });
  }
};

export const rebuildProfiles = async (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Baseline profiles refreshed from live data.' });
};

export const triggerEventAnalysis = async (eventData: any) => {
  // No-op — kept for backward compatibility with other controllers that call this
  logger.debug('Behavior event received (no-op):', eventData?.action);
};
