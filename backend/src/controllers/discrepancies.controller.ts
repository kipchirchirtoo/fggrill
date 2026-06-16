import { Request, Response } from "express";
import { supabase } from "../config/database";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// ── Branding tokens ───────────────────────────────────────────────────────────
const D_PRIMARY = "#1e293b";
const D_SECONDARY = "#64748b";
const D_HEADER_BG = "#1e293b";
const D_ROW_BG = "#f1f5f9";
const D_BORDER = "#e2e8f0";
const D_GOLD = "#c8a84b";
const D_SUCCESS = "#15803d";
const D_DANGER = "#dc2626";
const D_WARN = "#d97706";
const COMPANY_NAME = "FamousGate Hotels";
const COMPANY_ADDRESS =
  "Bomet, Kenya  |  famousgateshotelsbmt@gmail.com  |  0706 782 828";

function getLogoPath() {
  return path.join(process.cwd(), "../frontend/public/fglogo.png");
}

const SEV_COLORS: Record<string, string> = {
  CRITICAL: D_DANGER,
  HIGH: "#ea580c",
  MEDIUM: D_WARN,
  LOW: "#2563eb",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: D_DANGER,
  UNDER_REVIEW: D_WARN,
  RESOLVED: D_SUCCESS,
  ESCALATED: D_DANGER,
};
// ─────────────────────────────────────────────────────────────────────────────

const isOptionalDiscrepancyTableError = (error: any): boolean => {
  const message = String(error?.message || "");
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    error?.code === "PGRST116" ||
    error?.code === "PGRST200" ||
    error?.code === "PGRST205" ||
    message.includes("discrepancy_flags") ||
    message.includes("auditor_id") ||
    message.includes("accountant_id") ||
    message.toLowerCase().includes("schema cache")
  );
};

export class DiscrepancyController {
  /**
   * Get all flags with optional filters
   */
  static async getFlags(req: Request, res: Response) {
    try {
      const { status, branch_id, severity } = req.query;
      const currentUser = (req as any).user;
      const currentRole = String(currentUser?.role || "").toLowerCase();
      const isBranchScopedRole =
        currentRole === "branch_accountant" || currentRole === "accountant";
      const userBranchId = currentUser?.branch_id || currentUser?.branchId;

      if (isBranchScopedRole && !userBranchId) {
        return res.status(403).json({
          success: false,
          message: "Branch information is required to view discrepancy flags",
          data: [],
        });
      }

      if (
        isBranchScopedRole &&
        branch_id &&
        String(branch_id) !== String(userBranchId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only view discrepancy flags for your assigned branch",
          data: [],
        });
      }

      let query = supabase
        .from("discrepancy_flags")
        .select("*")
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);
      if (isBranchScopedRole) {
        query = query.eq("branch_id", userBranchId);
      } else if (branch_id) {
        query = query.eq("branch_id", branch_id);
      }
      if (severity) query = query.eq("severity", severity);

      const { data, error } = await query;

      if (error && isOptionalDiscrepancyTableError(error)) {
        return res.status(200).json({
          success: true,
          data: [],
          message: "Discrepancy flags table not found. Please run migrations.",
        });
      }

      if (error) {
        if (isOptionalDiscrepancyTableError(error)) {
          return res.status(200).json({
            success: false,
            message: "Discrepancy flag storage is not configured yet",
            data: null,
          });
        }
        throw error;
      }

      return res.status(200).json({ success: true, data: data || [] });
    } catch (error: any) {
      console.error("Get Flags Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message,
        data: [],
      });
    }
  }

  /**
   * Create a manual flag (Auditors or Directors)
   */
  static async createFlag(req: Request, res: Response) {
    try {
      const {
        branch_id,
        record_date,
        flag_type,
        severity,
        description,
        metadata,
      } = req.body;
      const userId = (req as any).user.id;

      const { data, error } = await supabase
        .from("discrepancy_flags")
        .insert([
          {
            branch_id,
            record_date,
            flag_type,
            severity,
            description,
            metadata,
            auditor_id: userId, // Assuming auditor creates it
            status: "PENDING",
          },
        ])
        .select()
        .single();

      if (error) {
        if (isOptionalDiscrepancyTableError(error)) {
          return res.status(200).json({
            success: false,
            message: "Discrepancy flag storage is not configured yet",
            data: null,
          });
        }
        throw error;
      }

      return res.status(201).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Respond to a flag (Accountants)
   */
  static async respondToFlag(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { accountant_response } = req.body; // Changed from 'response' to 'accountant_response'
      const currentUser = (req as any).user;
      const userId = currentUser.id;
      const currentRole = String(currentUser?.role || "").toLowerCase();
      const isBranchScopedRole =
        currentRole === "branch_accountant" || currentRole === "accountant";
      const userBranchId = currentUser?.branch_id || currentUser?.branchId;

      if (isBranchScopedRole && !userBranchId) {
        return res.status(403).json({
          success: false,
          message:
            "Branch information is required to respond to discrepancy flags",
        });
      }

      let updateQuery = supabase
        .from("discrepancy_flags")
        .update({
          accountant_response,
          accountant_id: userId,
          status: "UNDER_REVIEW",
          updated_at: new Date(),
        })
        .eq("id", id);

      if (isBranchScopedRole) {
        updateQuery = updateQuery.eq("branch_id", userBranchId);
      }

      const { data, error } = await updateQuery.select().single();

      if (error) {
        if (isOptionalDiscrepancyTableError(error)) {
          return res.status(200).json({
            success: false,
            message: "Discrepancy flag storage is not configured yet",
            data: null,
          });
        }
        throw error;
      }

      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Final decision on a flag (Directors)
   */
  static async finalizeFlag(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { decision, status } = req.body; // status: 'RESOLVED' or 'ESCALATED'
      const userId = (req as any).user.id;

      const { data, error } = await supabase
        .from("discrepancy_flags")
        .update({
          director_final_decision: decision,
          director_id: userId,
          status,
          updated_at: new Date(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (isOptionalDiscrepancyTableError(error)) {
          return res.status(200).json({
            success: false,
            message: "Discrepancy flag storage is not configured yet",
            data: null,
          });
        }
        throw error;
      }

      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Auto-Detection (unchanged helper)
   */
  static async runAutoDetection(recordId: string) {
    const { data: record, error } = await supabase
      .from("daily_financial_records")
      .select("*")
      .eq("id", recordId)
      .single();

    if (error || !record) return;

    const flags: any[] = [];

    if (
      Math.abs(Number(record.total_payments) - Number(record.total_revenue)) > 1
    ) {
      flags.push({
        branch_id: record.branch_id,
        record_date: record.record_date,
        flag_type: "PAYMENT_MISMATCH",
        severity: "HIGH",
        description: `Total revenue (${record.total_revenue}) does not match total payments (${record.total_payments}).`,
        metadata: {
          revenue: record.total_revenue,
          payments: record.total_payments,
        },
      });
    }

    if (Math.abs(Number(record.unbanked_cash)) > 100) {
      flags.push({
        branch_id: record.branch_id,
        record_date: record.record_date,
        flag_type: "CASH_VARIANCE",
        severity: Number(record.unbanked_cash) > 5000 ? "CRITICAL" : "MEDIUM",
        description: `Unbanked cash variance detected: ${record.unbanked_cash}.`,
        metadata: { unbanked: record.unbanked_cash },
      });
    }

    if (flags.length > 0) {
      await supabase.from("discrepancy_flags").insert(flags);
    }
  }

  /**
   * Export discrepancy flags as a branded PDF audit report
   * @route GET /api/finance/discrepancies/export
   */
  static async exportAuditReport(req: Request, res: Response) {
    try {
      const { status, branch_id, severity } = req.query;

      let query = supabase
        .from("discrepancy_flags")
        .select("*")
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status as string);
      if (branch_id) query = query.eq("branch_id", branch_id as string);
      if (severity) query = query.eq("severity", severity as string);

      const { data: flags, error } = await query;
      if (error && !isOptionalDiscrepancyTableError(error)) throw error;

      const records = error ? [] : flags || [];
      const dateStr = new Date().toISOString().split("T")[0];

      // ── Tally stats ────────────────────────────────────────────────────────
      const total = records.length;
      const pending = records.filter((f: any) => f.status === "PENDING").length;
      const reviewing = records.filter(
        (f: any) => f.status === "UNDER_REVIEW",
      ).length;
      const resolved = records.filter(
        (f: any) => f.status === "RESOLVED",
      ).length;
      const critical = records.filter(
        (f: any) => f.severity === "CRITICAL",
      ).length;

      // ── Document ───────────────────────────────────────────────────────────
      const doc = new PDFDocument({
        margin: 40,
        size: "A4",
        bufferPages: true,
      });
      const PAGE_W = 595;
      const MARGIN = 40;
      const CONTENT_W = PAGE_W - MARGIN * 2;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="Discrepancy_Audit_Report_${dateStr}.pdf"`,
      );
      doc.pipe(res);

      // ── Header helper ──────────────────────────────────────────────────────
      const drawHeader = () => {
        const logo = getLogoPath();
        if (fs.existsSync(logo)) {
          doc.image(logo, MARGIN, 25, { height: 50 });
        } else {
          doc.circle(MARGIN + 25, 50, 25).fill(D_PRIMARY);
          doc
            .fillColor("white")
            .fontSize(12)
            .font("Helvetica-Bold")
            .text("FG", MARGIN + 12, 43);
        }
        doc
          .fillColor(D_PRIMARY)
          .fontSize(16)
          .font("Helvetica-Bold")
          .text(COMPANY_NAME, MARGIN + 65, 26, { width: CONTENT_W - 65 });
        doc
          .fillColor(D_SECONDARY)
          .fontSize(8)
          .font("Helvetica")
          .text(COMPANY_ADDRESS, MARGIN + 65, 46, { width: CONTENT_W - 65 });

        doc
          .fillColor(D_PRIMARY)
          .fontSize(11)
          .font("Helvetica-Bold")
          .text("DISCREPANCY AUDIT REPORT", MARGIN, 26, {
            width: CONTENT_W,
            align: "right",
          });
        doc
          .fillColor(D_SECONDARY)
          .fontSize(8)
          .font("Helvetica")
          .text(
            `Generated: ${new Date().toLocaleString("en-US")}`,
            MARGIN,
            42,
            { width: CONTENT_W, align: "right" },
          );
        const filterLabel =
          [
            status ? `Status: ${status}` : "",
            severity ? `Severity: ${severity}` : "",
            branch_id ? `Branch ID: ${branch_id}` : "",
          ]
            .filter(Boolean)
            .join("  ·  ") || "All Flags";
        doc
          .fillColor(D_SECONDARY)
          .fontSize(8)
          .text(`Filters: ${filterLabel}`, MARGIN, 54, {
            width: CONTENT_W,
            align: "right",
          });

        doc
          .strokeColor(D_BORDER)
          .lineWidth(1)
          .moveTo(MARGIN, 82)
          .lineTo(PAGE_W - MARGIN, 82)
          .stroke();
        doc.rect(MARGIN, 83, CONTENT_W, 3).fill(D_GOLD);
        return 104;
      };

      // ── KPI summary cards ──────────────────────────────────────────────────
      const drawSummaryCards = (y: number) => {
        const cards = [
          { label: "Total Flags", value: String(total), accent: D_PRIMARY },
          { label: "Pending", value: String(pending), accent: D_DANGER },
          { label: "Under Review", value: String(reviewing), accent: D_WARN },
          { label: "Resolved", value: String(resolved), accent: D_SUCCESS },
          {
            label: "Critical Flags",
            value: String(critical),
            accent: D_DANGER,
          },
        ];
        const cardW = (CONTENT_W - 4 * 8) / 5;
        cards.forEach((c, i) => {
          const cx = MARGIN + i * (cardW + 8);
          doc.rect(cx, y, cardW, 50).fillAndStroke("#ffffff", D_BORDER);
          doc.rect(cx, y, 4, 50).fill(c.accent);
          doc
            .fillColor(D_SECONDARY)
            .fontSize(7)
            .font("Helvetica")
            .text(c.label.toUpperCase(), cx + 8, y + 6, { width: cardW - 12 });
          doc
            .fillColor(D_PRIMARY)
            .fontSize(18)
            .font("Helvetica-Bold")
            .text(c.value, cx + 8, y + 18, { width: cardW - 12 });
        });
        return y + 62;
      };

      // ── Table header ───────────────────────────────────────────────────────
      const COLS = [
        { label: "#", x: MARGIN, w: 20 },
        { label: "Branch", x: MARGIN + 20, w: 85 },
        { label: "Date", x: MARGIN + 105, w: 65 },
        { label: "Type", x: MARGIN + 170, w: 100 },
        { label: "Severity", x: MARGIN + 270, w: 60 },
        { label: "Status", x: MARGIN + 330, w: 75 },
        { label: "Description", x: MARGIN + 405, w: 110 },
      ];

      const drawTableHeader = (y: number) => {
        doc.rect(MARGIN, y, CONTENT_W, 20).fill(D_HEADER_BG);
        doc.fillColor("white").fontSize(8).font("Helvetica-Bold");
        COLS.forEach((c) =>
          doc.text(c.label, c.x, y + 6, { width: c.w, align: "left" }),
        );
        return y + 20;
      };

      // ── Section title ──────────────────────────────────────────────────────
      const drawSection = (title: string, y: number) => {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor(D_PRIMARY)
          .text(title, MARGIN, y);
        doc
          .strokeColor(D_GOLD)
          .lineWidth(1.5)
          .moveTo(MARGIN, y + 14)
          .lineTo(MARGIN + 200, y + 14)
          .stroke();
        return y + 22;
      };

      // ── Footer ─────────────────────────────────────────────────────────────
      const drawFooter = () => {
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc
            .strokeColor(D_BORDER)
            .lineWidth(0.5)
            .moveTo(MARGIN, doc.page.height - 42)
            .lineTo(PAGE_W - MARGIN, doc.page.height - 42)
            .stroke();
          doc
            .fillColor(D_SECONDARY)
            .fontSize(7.5)
            .font("Helvetica")
            .text(
              `${COMPANY_NAME}  ·  Discrepancy Audit Report  ·  Confidential`,
              MARGIN,
              doc.page.height - 32,
              { width: CONTENT_W * 0.65 },
            );
          doc
            .fillColor(D_SECONDARY)
            .fontSize(7.5)
            .text(
              `Page ${i + 1} of ${range.count}`,
              MARGIN,
              doc.page.height - 32,
              { width: CONTENT_W, align: "right" },
            );
        }
      };

      // ── Build ──────────────────────────────────────────────────────────────
      let y = drawHeader();
      y = drawSummaryCards(y);
      y += 14;
      y = drawSection("Discrepancy Flag Register", y);
      y = drawTableHeader(y);

      records.forEach((flag: any, i: number) => {
        const rowH = 26;
        if (y + rowH > doc.page.height - 55) {
          doc.addPage();
          y = drawHeader();
          y = drawTableHeader(y);
        }

        if (i % 2 === 0) doc.rect(MARGIN, y, CONTENT_W, rowH).fill(D_ROW_BG);
        doc
          .strokeColor(D_BORDER)
          .lineWidth(0.3)
          .moveTo(MARGIN, y + rowH)
          .lineTo(PAGE_W - MARGIN, y + rowH)
          .stroke();

        doc
          .fillColor(D_SECONDARY)
          .fontSize(7.5)
          .font("Helvetica")
          .text(String(i + 1), COLS[0].x, y + 6, { width: COLS[0].w });

        doc
          .fillColor(D_PRIMARY)
          .fontSize(7.5)
          .font("Helvetica")
          .text(
            flag.branches?.name ||
              flag.branch_name ||
              (flag.branch_id ? `Branch ${flag.branch_id}` : "—"),
            COLS[1].x,
            y + 6,
            { width: COLS[1].w, ellipsis: true },
          );

        doc.text(
          flag.record_date ? flag.record_date.split("T")[0] : "—",
          COLS[2].x,
          y + 6,
          { width: COLS[2].w },
        );

        doc.text((flag.flag_type || "").replace(/_/g, " "), COLS[3].x, y + 6, {
          width: COLS[3].w,
          ellipsis: true,
        });

        // Severity badge
        const sevColor = SEV_COLORS[flag.severity] || D_SECONDARY;
        doc
          .fillColor(sevColor)
          .fontSize(7)
          .font("Helvetica-Bold")
          .text(flag.severity || "—", COLS[4].x, y + 6, { width: COLS[4].w });

        // Status badge
        const stColor = STATUS_COLORS[flag.status] || D_SECONDARY;
        doc
          .fillColor(stColor)
          .fontSize(7)
          .font("Helvetica-Bold")
          .text((flag.status || "").replace(/_/g, " "), COLS[5].x, y + 6, {
            width: COLS[5].w,
          });

        // Description (truncated)
        doc
          .fillColor(D_SECONDARY)
          .fontSize(7)
          .font("Helvetica")
          .text(flag.description || "—", COLS[6].x, y + 6, {
            width: COLS[6].w,
            ellipsis: true,
          });

        // Accountant response on second line if exists
        if (flag.accountant_response) {
          doc
            .fillColor("#1d4ed8")
            .fontSize(6.5)
            .font("Helvetica")
            .text(`↳ ${flag.accountant_response}`, COLS[1].x, y + 16, {
              width: CONTENT_W - 20,
              ellipsis: true,
            });
        }

        y += rowH;
      });

      if (records.length === 0) {
        doc
          .fillColor(D_SECONDARY)
          .fontSize(10)
          .font("Helvetica")
          .text(
            "No discrepancy flags found for the selected filters.",
            MARGIN,
            y + 20,
            { width: CONTENT_W, align: "center" },
          );
      }

      drawFooter();
      doc.end();
    } catch (error: any) {
      console.error("Discrepancy PDF Export Error:", error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
