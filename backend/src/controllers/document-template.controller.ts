/**
 * Document Template Engine
 * -------------------------------------------------------------------------
 * Customer-facing documents (bills, receipts, credit bills, …) are described
 * as an ordered list of SECTIONS. Defaults live here in code; SuperAdmin edits
 * are stored as override rows in `document_templates` (global or per-branch).
 * The app fetches the RESOLVED template (override ?? default) and renders the
 * same sections, so the editor preview matches the printed output exactly.
 *
 * Till numbers are configured per POS outlet (branch default as fallback) and
 * exposed through the resolve endpoint so every printed bill/receipt carries
 * the correct outlet identity — never a global hardcoded value.
 */
import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/database';
import { logger } from '../utils/logger';

// ── Section + template types ────────────────────────────────────────────────
export interface TemplateSection {
  id: string;
  type:
    | 'logo' | 'header' | 'title' | 'code_box' | 'kv' | 'items'
    | 'totals' | 'text' | 'divider' | 'barcode' | 'footer' | 'notice' | 'staff_box';
  label?: string;
  content?: string;        // text / placeholders, for text-like sections
  visible?: boolean;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  size?: number;
}

interface TemplateDef {
  name: string;
  description: string;
  document_type: 'thermal_receipt' | 'pdf' | 'email' | 'xlsx' | 'barcode';
  sections: TemplateSection[];
}

// ── Placeholders available to the editor palette ────────────────────────────
export const TEMPLATE_PLACEHOLDERS = [
  { token: '{{company_name}}', label: 'Company name' },
  { token: '{{branch_name}}', label: 'Branch name' },
  { token: '{{company_address}}', label: 'Company address' },
  { token: '{{company_phone}}', label: 'Company phone' },
  { token: '{{company_email}}', label: 'Company email' },
  { token: '{{till_number}}', label: 'Till number (outlet)' },
  { token: '{{receipt_number}}', label: 'Receipt / order number' },
  { token: '{{public_code}}', label: 'Lookup / short code' },
  { token: '{{date}}', label: 'Date/time' },
  { token: '{{customer_name}}', label: 'Customer name' },
  { token: '{{table_number}}', label: 'Table number' },
  { token: '{{room_number}}', label: 'Room number' },
  { token: '{{staff_label}}', label: 'Staff label (Cashier/Waiter)' },
  { token: '{{staff_name}}', label: 'Staff name' },
  { token: '{{payment_method}}', label: 'Payment method' },
  { token: '{{total}}', label: 'Total amount' },
  { token: '{{paid}}', label: 'Amount paid' },
  { token: '{{amount_tendered}}', label: 'Cash tendered' },
  { token: '{{change_given}}', label: 'Change given' },
  { token: '{{drawer_cash}}', label: 'Drawer cash in' },
  { token: '{{station_name}}', label: 'Station / outlet name' },
  { token: '{{waiter_name}}', label: 'Waiter name' },
  { token: '{{void_reason}}', label: 'Void reason' },
  { token: '{{voided_at}}', label: 'Voided date/time' },
  { token: '{{printed_by}}', label: 'Printed by' },
];

const sid = (n: string) => n; // stable section ids

// ── Default templates (the "factory" definitions) ───────────────────────────
const headerSections = (titleText: string): TemplateSection[] => [
  { id: sid('logo'), type: 'logo', visible: true, align: 'center' },
  { id: sid('company'), type: 'header', content: '{{company_name}}', bold: true, size: 14, align: 'center', visible: true },
  { id: sid('branch'), type: 'text', content: '{{branch_name}}', size: 8, align: 'center', visible: true },
  { id: sid('phone'), type: 'text', content: 'Tel: {{company_phone}}', size: 8, align: 'center', visible: true },
  { id: sid('till'), type: 'text', content: 'Till No: {{till_number}}', size: 9, bold: true, align: 'center', visible: true },
  { id: sid('title'), type: 'title', content: titleText, bold: true, size: 12, align: 'center', visible: true },
];

const catalogSections = (titleText: string, body: string): TemplateSection[] => [
  { id: sid('logo'), type: 'logo', visible: true, align: 'center' },
  { id: sid('company'), type: 'header', content: '{{company_name}}', bold: true, size: 14, align: 'center', visible: true },
  { id: sid('branch'), type: 'text', content: '{{branch_name}}', size: 8, align: 'center', visible: true },
  { id: sid('title'), type: 'title', content: titleText, bold: true, size: 12, align: 'center', visible: true },
  { id: sid('div1'), type: 'divider', visible: true },
  { id: sid('body'), type: 'notice', content: body, visible: true },
  { id: sid('meta'), type: 'kv', visible: true },
  { id: sid('footer'), type: 'footer', content: 'System managed and made by Hirall', size: 7, align: 'center', visible: true },
];

const pythonPdf = (name: string, titleText: string, source: string): TemplateDef => ({
  name,
  description: `${source}. Catalogued from python-services; current generator is still hardcoded and must be routed through the template resolver before edits affect printed/generated PDFs.`,
  document_type: 'pdf',
  sections: catalogSections(titleText, 'PDF/report template catalog entry. Wiring status: pending Python/backend renderer integration.'),
});

const backendPdf = (name: string, titleText: string, source: string): TemplateDef => ({
  name,
  description: `${source}. Catalogued from backend PDFKit exports; current generator is still hardcoded and must be routed through the template resolver before edits affect generated PDFs.`,
  document_type: 'pdf',
  sections: catalogSections(titleText, 'Backend PDF export template catalog entry. Wiring status: pending renderer integration.'),
});

const emailTemplate = (name: string, titleText: string, source: string): TemplateDef => ({
  name,
  description: `${source}. Catalogued from Python/email templates; current email sender is still hardcoded/Jinja-based and must be routed through the template resolver before edits affect sent emails.`,
  document_type: 'email',
  sections: catalogSections(titleText, 'Email template catalog entry. Wiring status: pending email renderer integration.'),
});

const xlsxTemplate = (name: string, titleText: string, source: string): TemplateDef => ({
  name,
  description: `${source}. Catalogued from spreadsheet exports; workbook layout is still code-generated and must be routed through a workbook template adapter before edits affect XLSX exports.`,
  document_type: 'xlsx',
  sections: catalogSections(titleText, 'Spreadsheet template catalog entry. Wiring status: pending XLSX adapter integration.'),
});

const DEFAULT_TEMPLATES: Record<string, TemplateDef> = {
  customer_bill: {
    name: 'Customer Bill',
    description: 'Proforma bill printed for the customer at the POS (order, not yet paid).',
    document_type: 'thermal_receipt',
    sections: [
      ...headerSections('CUSTOMER BILL'),
      { id: sid('code'), type: 'code_box', label: 'PAYMENT LOOKUP CODE', content: '{{public_code}}', visible: true },
      { id: sid('div1'), type: 'divider', visible: true },
      { id: sid('meta'), type: 'kv', visible: true },
      { id: sid('div2'), type: 'divider', visible: true },
      { id: sid('items'), type: 'items', visible: true },
      { id: sid('div3'), type: 'divider', visible: true },
      { id: sid('totals'), type: 'totals', visible: true },
      { id: sid('pay'), type: 'text', content: 'Payment: {{payment_method}}', size: 8, visible: true },
      { id: sid('div4'), type: 'divider', visible: true },
      { id: sid('thanks'), type: 'footer', content: 'THANK YOU!', bold: true, size: 10, align: 'center', visible: true },
      { id: sid('come'), type: 'text', content: 'Please come again', size: 7, align: 'center', visible: true },
      { id: sid('barcode'), type: 'barcode', visible: true },
      { id: sid('hirall'), type: 'footer', content: 'System managed and made by Hirall', size: 7, align: 'center', visible: true },
    ],
  },
  customer_receipt: {
    name: 'Customer Receipt',
    description: 'Receipt printed after a customer payment is recorded.',
    document_type: 'thermal_receipt',
    sections: [
      ...headerSections('CUSTOMER RECEIPT'),
      { id: sid('code'), type: 'code_box', label: 'PAYMENT LOOKUP CODE', content: '{{public_code}}', visible: true },
      { id: sid('div1'), type: 'divider', visible: true },
      { id: sid('meta'), type: 'kv', visible: true },
      { id: sid('div2'), type: 'divider', visible: true },
      { id: sid('items'), type: 'items', visible: true },
      { id: sid('div3'), type: 'divider', visible: true },
      { id: sid('totals'), type: 'totals', visible: true },
      { id: sid('pay'), type: 'text', content: 'Payment: {{payment_method}}', size: 8, visible: true },
      { id: sid('paid'), type: 'text', content: 'Paid: {{paid}}', size: 8, bold: true, visible: true },
      { id: sid('div4'), type: 'divider', visible: true },
      { id: sid('thanks'), type: 'footer', content: 'THANK YOU!', bold: true, size: 10, align: 'center', visible: true },
      { id: sid('barcode'), type: 'barcode', visible: true },
      { id: sid('hirall'), type: 'footer', content: 'System managed and made by Hirall', size: 7, align: 'center', visible: true },
    ],
  },
  credit_bill: {
    name: 'Staff Credit Bill',
    description: 'Unpaid staff credit bill — settled by the branch accountant or via payroll.',
    document_type: 'thermal_receipt',
    sections: [
      ...headerSections('STAFF CREDIT BILL'),
      { id: sid('code'), type: 'code_box', label: 'CREDIT BILL CODE', content: '{{public_code}}', visible: true },
      { id: sid('div1'), type: 'divider', visible: true },
      { id: sid('staff'), type: 'staff_box', visible: true },
      { id: sid('meta'), type: 'kv', visible: true },
      { id: sid('div2'), type: 'divider', visible: true },
      { id: sid('items'), type: 'items', visible: true },
      { id: sid('div3'), type: 'divider', visible: true },
      { id: sid('totals'), type: 'totals', visible: true },
      { id: sid('notice'), type: 'notice', content: '** UNPAID CREDIT - NOT A PAYMENT **\nSettle with the Branch Accountant (cash/M-Pesa) OR have it deducted from your payroll.', visible: true },
      { id: sid('barcode'), type: 'barcode', visible: true },
      { id: sid('hirall'), type: 'footer', content: 'System managed and made by Hirall', size: 7, align: 'center', visible: true },
    ],
  },
  void_order: {
    name: 'Voided Captain Order',
    description: 'Void slip printed for a POS captain order after approval.',
    document_type: 'thermal_receipt',
    sections: [
      ...headerSections('VOIDED CAPTAIN ORDER'),
      { id: sid('code'), type: 'code_box', label: 'ORDER CODE', content: '{{public_code}}', visible: true },
      { id: sid('div1'), type: 'divider', visible: true },
      { id: sid('meta'), type: 'kv', visible: true },
      { id: sid('div2'), type: 'divider', visible: true },
      { id: sid('items'), type: 'items', visible: true },
      { id: sid('div3'), type: 'divider', visible: true },
      { id: sid('void_total'), type: 'text', content: 'VOIDED VALUE: {{total}}', size: 11, bold: true, visible: true },
      { id: sid('notice'), type: 'notice', content: 'NOT PAYABLE - NOT AN UNPAID BILL\nReason: {{void_reason}}', visible: true },
      { id: sid('barcode'), type: 'barcode', visible: true },
      { id: sid('hirall'), type: 'footer', content: 'System managed and made by Hirall', size: 7, align: 'center', visible: true },
    ],
  },
  booking_invoice: pythonPdf('Booking Invoice', 'HOTEL BOOKING INVOICE', 'python-services/pdf_generator/invoice.py'),
  guest_checkout_bill: pythonPdf('Guest Checkout Bill', 'GUEST BILL / INVOICE', 'python-services/reports/branded_pdf_generator.py generate_checkout_bill'),
  conference_invoice: pythonPdf('Conference Invoice', 'CONFERENCE INVOICE', 'python-services/reports/branded_pdf_generator.py reportType=conference_invoice'),
  dispatch_note: pythonPdf('Dispatch Note', 'DISPATCH NOTE', 'python-services/reports/branded_pdf_generator.py reportType=dispatch_note'),
  sale_receipt_pdf: pythonPdf('PDF Sale Receipt', 'CASH RECEIPT', 'python-services/receipts/receipt_generator.py ReceiptGenerator'),
  invoice_pdf: pythonPdf('PDF Invoice', 'INVOICE', 'python-services/receipts/receipt_generator.py InvoiceGenerator'),
  inventory_receipt_pdf: pythonPdf('Inventory Receipt PDF', 'INVENTORY RECEIPT', 'python-services/receipts/receipt_generator.py InventoryReceiptGenerator'),
  staff_id_card: {
    ...pythonPdf('Staff ID Card', 'STAFF ID CARD', 'python-services/id_cards/generator.py'),
    document_type: 'barcode',
  },
  booking_card: {
    ...pythonPdf('Booking Barcode Card', 'BOOKING CARD', 'python-services/barcode_generator/app.py'),
    document_type: 'barcode',
  },
  daily_sales_report: pythonPdf('Daily Sales Report', 'DAILY SALES REPORT', 'python-services/reports/branded_pdf_generator.py reportType=daily_sales'),
  occupancy_report: pythonPdf('Occupancy Report', 'OCCUPANCY REPORT', 'python-services/reports/branded_pdf_generator.py reportType=occupancy'),
  financial_summary_report: pythonPdf('Financial Summary Report', 'FINANCIAL SUMMARY REPORT', 'python-services/reports/branded_pdf_generator.py reportType=financial_summary'),
  revenue_analysis_report: pythonPdf('Revenue Analysis Report', 'REVENUE ANALYSIS REPORT', 'python-services/reports/branded_pdf_generator.py reportType=revenue_analysis'),
  inventory_status_report: pythonPdf('Inventory Status Report', 'INVENTORY STATUS REPORT', 'python-services/reports/branded_pdf_generator.py reportType=inventory_status'),
  housekeeping_report: pythonPdf('Housekeeping Report', 'HOUSEKEEPING REPORT', 'python-services/reports/branded_pdf_generator.py reportType=housekeeping'),
  maintenance_report: pythonPdf('Maintenance Report', 'MAINTENANCE REPORT', 'python-services/reports/branded_pdf_generator.py reportType=maintenance'),
  payroll_summary_report: pythonPdf('Payroll Summary Report', 'PAYROLL SUMMARY REPORT', 'python-services/reports/branded_pdf_generator.py reportType=payroll_summary'),
  restaurant_sales_report: pythonPdf('Restaurant Sales Report', 'RESTAURANT SALES REPORT', 'python-services/reports/branded_pdf_generator.py reportType=restaurant_sales'),
  bar_sales_report: pythonPdf('Bar Sales Report', 'BAR SALES REPORT', 'python-services/reports/branded_pdf_generator.py reportType=bar_sales'),
  room_supplies_report: pythonPdf('Room Supplies Report', 'ROOM SUPPLIES REPORT', 'python-services/reports/branded_pdf_generator.py reportType=room_supplies'),
  payslip_pdf: pythonPdf('Payslip PDF', 'PAYSLIP', 'python-services/reports/branded_pdf_generator.py reportType=payslip and backend/src/utils/pdfGenerator.ts'),
  manager_duty_report: pythonPdf('Manager On Duty Report', 'MANAGER ON DUTY REPORT', 'python-services/reports/branded_pdf_generator.py reportType=manager_duty'),
  reservation_report: pythonPdf('Reservation Report', 'RESERVATION REPORT', 'python-services/reports/branded_pdf_generator.py reportType=reservation'),
  arrivals_departures_report: pythonPdf('Arrivals & Departures Report', 'ARRIVALS & DEPARTURES REPORT', 'python-services/reports/branded_pdf_generator.py reportType=arrivals_departures'),
  expense_report: pythonPdf('Expense Report', 'EXPENSE REPORT', 'python-services/reports/branded_pdf_generator.py reportType=expense'),
  stock_movement_report: pythonPdf('Stock Movement Report', 'STOCK MOVEMENT REPORT', 'python-services/reports/branded_pdf_generator.py reportType=stock_movement'),
  branch_performance_report: pythonPdf('Branch Performance Report', 'BRANCH PERFORMANCE REPORT', 'python-services/reports/branded_pdf_generator.py reportType=branch_performance'),
  sales_performance_report: pythonPdf('Sales Performance Report', 'SALES PERFORMANCE REPORT', 'python-services/reports/branded_pdf_generator.py reportType=sales_performance'),
  staff_overview_report: pythonPdf('Staff Overview Report', 'STAFF OVERVIEW REPORT', 'python-services/reports/branded_pdf_generator.py reportType=staff_overview'),
  staff_performance_report: pythonPdf('Staff Performance Report', 'STAFF PERFORMANCE REPORT', 'python-services/reports/branded_pdf_generator.py reportType=staff_performance'),
  compliance_report: pythonPdf('Compliance Report', 'COMPLIANCE REPORT', 'python-services/reports/branded_pdf_generator.py reportType=compliance'),
  branch_comparison_report: pythonPdf('Branch Comparison Report', 'BRANCH COMPARISON REPORT', 'python-services/reports/branded_pdf_generator.py reportType=branch_comparison'),
  kpi_dashboard_report: pythonPdf('KPI Dashboard Report', 'KPI DASHBOARD REPORT', 'python-services/reports/branded_pdf_generator.py reportType=kpi_dashboard'),
  employee_attendance_report: pythonPdf('Employee Attendance Report', 'EMPLOYEE ATTENDANCE REPORT', 'python-services/reports/branded_pdf_generator.py reportType=employee_attendance'),
  financial_variance_report: pythonPdf('Financial Variance Report', 'FINANCIAL VARIANCE REPORT', 'python-services/reports/branded_pdf_generator.py reportType=financial_variance'),
  inventory_discrepancy_report: pythonPdf('Inventory Discrepancy Report', 'INVENTORY DISCREPANCY REPORT', 'python-services/reports/branded_pdf_generator.py reportType=inventory_discrepancy'),
  procurement_analysis_report: pythonPdf('Procurement Analysis Report', 'PROCUREMENT ANALYSIS REPORT', 'python-services/reports/branded_pdf_generator.py reportType=procurement_analysis'),
  exception_logs_report: pythonPdf('Exception Logs Report', 'EXCEPTION LOGS REPORT', 'python-services/reports/branded_pdf_generator.py reportType=exception_logs'),
  reconciliation_audit_report: pythonPdf('Reconciliation Audit Report', 'RECONCILIATION AUDIT REPORT', 'python-services/reports/branded_pdf_generator.py reportType=reconciliation_audit'),
  stock_usage_report: pythonPdf('Stock Usage Report', 'STOCK USAGE REPORT', 'python-services/reports/branded_pdf_generator.py reportType=stock_usage'),
  employee_credit_report: pythonPdf('Employee Credit Report', 'EMPLOYEE CREDIT REPORT', 'python-services/reports/branded_pdf_generator.py reportType=employee_credit'),
  conference_summary_report: pythonPdf('Conference Summary Report', 'CONFERENCE SUMMARY REPORT', 'python-services/reports/branded_pdf_generator.py reportType=conference_summary'),
  kitchen_ledger_report: pythonPdf('Kitchen Ledger Report', 'KITCHEN LEDGER REPORT', 'python-services/reports/branded_pdf_generator.py reportType=kitchen_ledger'),
  kitchen_item_ledger_report: pythonPdf('Kitchen Item Ledger Report', 'KITCHEN ITEM LEDGER REPORT', 'python-services/reports/branded_pdf_generator.py reportType=kitchen_item_ledger'),
  vat_report: pythonPdf('VAT Report', 'VAT REPORT', 'python-services/reports/branded_pdf_generator.py reportType=vat_report'),
  procurement_intelligence_report: pythonPdf('Procurement Intelligence Report', 'PROCUREMENT INTELLIGENCE REPORT', 'python-services/reports/branded_pdf_generator.py reportType=procurement_intelligence'),
  supplier_statement_report: pythonPdf('Supplier Statement Report', 'SUPPLIER STATEMENT', 'python-services/reports/branded_pdf_generator.py reportType=supplier_statement'),
  revenue_reconciliation_report: pythonPdf('Revenue Reconciliation Report', 'REVENUE RECONCILIATION REPORT', 'python-services/reports/branded_pdf_generator.py reportType=revenue_reconciliation'),
  ai_analysis_report: pythonPdf('AI Analysis Report', 'AI ANALYSIS REPORT', 'python-services/reports/branded_pdf_generator.py reportType=ai_analysis'),
  customer_credit_outstanding_report: pythonPdf('Customer Credit Outstanding Report', 'CUSTOMER CREDIT OUTSTANDING', 'python-services/reports/branded_pdf_generator.py reportType=customer_credit_outstanding'),
  cashier_unpaid_bills_report: pythonPdf('Cashier Unpaid Bills Report', 'CASHIER UNPAID BILLS', 'python-services/reports/branded_pdf_generator.py reportType=cashier_unpaid_bills'),
  stock_requests_report: pythonPdf('Stock Requests Report', 'STOCK REQUESTS REPORT', 'python-services/reports/stock_requests_pdf.py'),
  stock_requests_history_report: pythonPdf('Stock Requests History Report', 'STOCK REQUESTS HISTORY REPORT', 'python-services/reports/stock_requests_pdf.py'),
  sales_audit_report: pythonPdf('Sales Audit Report', 'SALES AUDIT REPORT', 'python-services/reports/audit_report_templates.py'),
  financial_verification_audit_report: pythonPdf('Financial Verification Audit Report', 'FINANCIAL VERIFICATION AUDIT REPORT', 'python-services/reports/audit_report_templates.py'),
  stock_audit_report: pythonPdf('Stock Audit Report', 'STOCK AUDIT REPORT', 'python-services/reports/audit_report_templates.py'),
  branch_orders_audit_report: pythonPdf('Branch Orders Audit Report', 'BRANCH ORDERS REPORT', 'python-services/reports/audit_report_templates.py'),
  security_report: pythonPdf('Security Report', 'SECURITY REPORT', 'python-services/reports/security_report_generator.py'),
  trial_balance_pdf: pythonPdf('Trial Balance PDF', 'TRIAL BALANCE', 'python-services/accounting/document_generator.py'),
  profit_loss_pdf: pythonPdf('Profit & Loss PDF', 'PROFIT & LOSS STATEMENT', 'python-services/accounting/document_generator.py'),
  balance_sheet_pdf: pythonPdf('Balance Sheet PDF', 'BALANCE SHEET', 'python-services/accounting/document_generator.py'),
  supplier_statement_pdf: pythonPdf('Supplier Statement PDF', 'SUPPLIER STATEMENT', 'python-services/accounting/document_generator.py'),
  purchase_order_pdf: pythonPdf('Purchase Order PDF', 'PURCHASE ORDER', 'python-services/accounting/document_generator.py'),
  payroll_xlsx: xlsxTemplate('Payroll XLSX', 'PAYROLL SUMMARY', 'python-services/payroll/payroll_generator.py'),
  payroll_pdf: pythonPdf('Payroll PDF', 'PAYROLL SUMMARY', 'python-services/payroll/payroll_generator.py'),
  native_supplier_statement_pdf: backendPdf('Native Supplier Statement PDF', 'SUPPLIER STATEMENT', 'backend/src/services/native-pdf-reports.service.ts'),
  native_vat_report_pdf: backendPdf('Native VAT Report PDF', 'VAT REPORT', 'backend/src/services/native-pdf-reports.service.ts'),
  native_procurement_intelligence_pdf: backendPdf('Native Procurement Intelligence PDF', 'PROCUREMENT INTELLIGENCE REPORT', 'backend/src/services/native-pdf-reports.service.ts'),
  native_hr_performance_pdf: backendPdf('Native HR Performance PDF', 'HR PERFORMANCE REPORT', 'backend/src/services/native-pdf-reports.service.ts'),
  native_payroll_pdf: backendPdf('Native Payroll PDF', 'PAYROLL REPORT', 'backend/src/services/native-pdf-reports.service.ts'),
  native_documentation_pdf: backendPdf('System Documentation PDF', 'SYSTEM DOCUMENTATION', 'backend/src/services/native-pdf-reports.service.ts'),
  stock_take_worksheet_pdf: backendPdf('Stock Take Worksheet PDF', 'STOCK TAKE WORKSHEET', 'backend/src/services/native-pdf-reports.service.ts'),
  central_stock_take_pdf: backendPdf('Central Stock Take PDF', 'CENTRAL STOCK TAKE', 'backend/src/services/native-pdf-reports.service.ts'),
  branch_stock_take_worksheet_pdf: backendPdf('Branch Stock Take Worksheet PDF', 'BRANCH STOCK TAKE WORKSHEET', 'backend/src/services/native-pdf-reports.service.ts'),
  branded_payroll_summary_v2_pdf: backendPdf('Branded Payroll Summary V2 PDF', 'PAYROLL SUMMARY', 'backend/src/services/native-pdf-reports.service.ts'),
  leave_management_pdf: backendPdf('Leave Management PDF', 'LEAVE MANAGEMENT REPORT', 'backend/src/services/native-pdf-reports.service.ts'),
  discrepancy_flags_pdf: backendPdf('Discrepancy Flags PDF', 'DISCREPANCY FLAGS AUDIT REPORT', 'backend/src/controllers/discrepancies.controller.ts'),
  financial_workspace_pdf: backendPdf('Financial Workspace PDF', 'FINANCIAL WORKSPACE REPORT', 'backend/src/controllers/financial-workspace.controller.ts'),
  branch_analytics_pdf: backendPdf('Branch Analytics PDF', 'BRANCH ANALYTICS REPORT', 'backend/src/controllers/branch-analytics.controller.ts'),
  director_enhanced_pdf: backendPdf('Director Dashboard PDF', 'DIRECTOR DASHBOARD REPORT', 'backend/src/controllers/director-enhanced.controller.ts'),
  booking_confirmation_email: emailTemplate('Booking Confirmation Email', 'BOOKING CONFIRMATION', 'python-services/communication_hub/templates.py'),
  check_in_reminder_email: emailTemplate('Check-In Reminder Email', 'CHECK-IN REMINDER', 'python-services/communication_hub/templates.py'),
  invoice_email: emailTemplate('Invoice Email', 'INVOICE EMAIL', 'python-services/communication_hub/templates.py'),
  booking_modification_email: emailTemplate('Booking Modification Email', 'BOOKING MODIFICATION', 'python-services/email_automation/templates/booking_modification.html'),
  booking_cancellation_email: emailTemplate('Booking Cancellation Email', 'BOOKING CANCELLATION', 'python-services/email_automation/templates/booking_cancellation.html'),
};

const defaultTemplate = (key: string): TemplateDef | null => DEFAULT_TEMPLATES[key] || null;

// ── Resolve: override (branch → global) ?? default ──────────────────────────
async function resolveTemplateRow(templateKey: string, branchId: number | null) {
  // branch-specific override first, then global override
  let override: any = null;
  if (branchId) {
    const { data } = await supabase
      .from('document_templates')
      .select('*')
      .eq('template_key', templateKey)
      .eq('branch_id', branchId)
      .maybeSingle();
    override = data || null;
  }
  if (!override) {
    const { data } = await supabase
      .from('document_templates')
      .select('*')
      .eq('template_key', templateKey)
      .is('branch_id', null)
      .maybeSingle();
    override = data || null;
  }
  return override;
}

async function resolveTillNumber(outletId: string | null, branchId: number | null): Promise<string | null> {
  if (outletId) {
    const { data: outlet } = await supabase
      .from('pos_outlets')
      .select('till_number, branch_id')
      .eq('id', outletId)
      .maybeSingle();
    if (outlet?.till_number) return String(outlet.till_number);
    if (!branchId && outlet?.branch_id) branchId = outlet.branch_id;
  }
  if (branchId) {
    const { data: branch } = await supabase
      .from('branches')
      .select('default_till_number')
      .eq('id', branchId)
      .maybeSingle();
    if (branch?.default_till_number) return String(branch.default_till_number);
  }
  return null;
}

// ── Controllers ─────────────────────────────────────────────────────────────

/** List all templates (defaults + which keys have overrides). */
export const listTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;
    const { data: overrides } = await supabase
      .from('document_templates')
      .select('template_key, branch_id, updated_at, version');
    const overrideKeys = new Map<string, any>();
    (overrides || []).forEach((o: any) => {
      const k = `${o.template_key}|${o.branch_id ?? 'global'}`;
      overrideKeys.set(k, o);
    });

    const list = Object.entries(DEFAULT_TEMPLATES).map(([key, def]) => {
      const globalOv = overrideKeys.get(`${key}|global`);
      const branchOv = branchId ? overrideKeys.get(`${key}|${branchId}`) : null;
      return {
        template_key: key,
        name: def.name,
        description: def.description,
        document_type: def.document_type,
        section_count: def.sections.length,
        has_global_override: !!globalOv,
        has_branch_override: !!branchOv,
        updated_at: (branchOv || globalOv)?.updated_at || null,
      };
    });
    res.json({ success: true, data: list });
  } catch (e) { next(e); }
};

/** Get one resolved template (for the editor) — includes default for reset/preview. */
export const getTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { key } = req.params;
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;
    const def = defaultTemplate(key);
    if (!def) { res.status(404).json({ success: false, message: 'Unknown template' }); return; }
    const override = await resolveTemplateRow(key, branchId);
    res.json({
      success: true,
      data: {
        template_key: key,
        name: override?.name || def.name,
        description: def.description,
        document_type: def.document_type,
        sections: override?.sections?.length ? override.sections : def.sections,
        default_sections: def.sections,
        is_override: !!override,
        override_scope: override ? (override.branch_id ? 'branch' : 'global') : null,
        placeholders: TEMPLATE_PLACEHOLDERS,
      },
    });
  } catch (e) { next(e); }
};

/** Resolve template + till context for the app to render a document. */
export const resolveDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const key = String(req.query.key || '');
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;
    const outletId = req.query.outlet_id ? String(req.query.outlet_id) : null;
    const def = defaultTemplate(key);
    if (!def) { res.status(404).json({ success: false, message: 'Unknown template' }); return; }
    const override = await resolveTemplateRow(key, branchId);
    const tillNumber = await resolveTillNumber(outletId, branchId);
    res.json({
      success: true,
      data: {
        template_key: key,
        document_type: def.document_type,
        sections: override?.sections?.length ? override.sections : def.sections,
        till_number: tillNumber,
      },
    });
  } catch (e) { next(e); }
};

/** Save (upsert) a template override (global if no branch_id). */
export const saveTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { key } = req.params;
    const { sections, name, branch_id } = req.body;
    if (!defaultTemplate(key)) { res.status(404).json({ success: false, message: 'Unknown template' }); return; }
    if (!Array.isArray(sections)) { res.status(400).json({ success: false, message: 'sections must be an array' }); return; }
    const branchId = branch_id ? parseInt(`${branch_id}`) : null;

    const existing = await resolveTemplateRow(key, branchId);
    const payload: any = {
      template_key: key,
      branch_id: branchId,
      name: name || defaultTemplate(key)!.name,
      sections,
      updated_by: req.user?.id || null,
      updated_at: new Date().toISOString(),
      version: (existing?.version || 0) + 1,
    };

    let row;
    // Only treat as the same row if scope matches (branch vs global).
    const sameScope = existing && ((existing.branch_id || null) === branchId);
    if (sameScope) {
      const { data, error } = await supabase
        .from('document_templates').update(payload).eq('id', existing.id).select().single();
      if (error) throw error;
      row = data;
    } else {
      const { data, error } = await supabase
        .from('document_templates').insert(payload).select().single();
      if (error) throw error;
      row = data;
    }
    res.json({ success: true, message: 'Template saved', data: row });
  } catch (e) { next(e); }
};

/** Reset a template to its code default (delete the override row). */
export const resetTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { key } = req.params;
    const branchId = req.query.branch_id ? parseInt(req.query.branch_id as string) : null;
    const def = defaultTemplate(key);
    if (!def) { res.status(404).json({ success: false, message: 'Unknown template' }); return; }
    let q = supabase.from('document_templates').delete().eq('template_key', key);
    q = branchId ? q.eq('branch_id', branchId) : q.is('branch_id', null);
    const { error } = await q;
    if (error) throw error;
    res.json({ success: true, message: 'Template reset to default', data: { sections: def.sections } });
  } catch (e) { next(e); }
};

// ── Till management ─────────────────────────────────────────────────────────

/** Branches → outlets with their till numbers (for the SuperAdmin till screen). */
export const listTills = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { data: branches } = await supabase
      .from('branches')
      .select('id, name, code, default_till_number')
      .order('name');
    const { data: outlets } = await supabase
      .from('pos_outlets')
      .select('id, name, outlet_type, branch_id, till_number')
      .order('name');
    const byBranch = (branches || []).map((b: any) => ({
      branch_id: b.id,
      branch_name: b.name,
      branch_code: b.code,
      default_till_number: b.default_till_number,
      outlets: (outlets || []).filter((o: any) => o.branch_id === b.id).map((o: any) => ({
        outlet_id: o.id,
        outlet_name: o.name,
        outlet_type: o.outlet_type,
        till_number: o.till_number,
      })),
    }));
    res.json({ success: true, data: byBranch });
  } catch (e) { next(e); }
};

export const updateOutletTill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { outletId } = req.params;
    const { till_number } = req.body;
    const { data, error } = await supabase
      .from('pos_outlets')
      .update({ till_number: till_number ? String(till_number).trim() : null })
      .eq('id', outletId)
      .select('id, name, till_number')
      .single();
    if (error) throw error;
    res.json({ success: true, message: 'Outlet till updated', data });
  } catch (e) { next(e); }
};

export const updateBranchTill = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branchId } = req.params;
    const { default_till_number } = req.body;
    const { data, error } = await supabase
      .from('branches')
      .update({ default_till_number: default_till_number ? String(default_till_number).trim() : null })
      .eq('id', branchId)
      .select('id, name, default_till_number')
      .single();
    if (error) throw error;
    res.json({ success: true, message: 'Branch default till updated', data });
  } catch (e) { next(e); }
};
