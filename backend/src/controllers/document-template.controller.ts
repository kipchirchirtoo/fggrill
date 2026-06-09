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
  document_type: 'thermal_receipt' | 'pdf';
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
