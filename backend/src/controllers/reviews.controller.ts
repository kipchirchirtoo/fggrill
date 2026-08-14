import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { isGlobalRole } from '../utils/branchIsolation';
import { analyzeReviewSentiment } from '../utils/review-sentiment';

const SERVICE_TYPES = new Set(['hotel', 'restaurant', 'general']);
const STAY_TYPES = new Set(['Business', 'Family', 'Couple', 'Solo', 'Vacation']);

const num1to5 = (value: unknown): number | null => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= 1 && rounded <= 5 ? rounded : null;
};

/**
 * Best-effort resolution of a free-text branch label (whatever the public
 * submitter picked, e.g. "Famous Gates Hotel — Kyogong") to a real
 * branches.id, so branch-manager scoping (applyBranchFilter's branch_id
 * column) works. Falls back to null — branch_label is stored regardless,
 * so the review is never lost, just unscoped to a specific branch until
 * someone corrects it.
 */
async function resolveBranchId(label: string): Promise<number | null> {
  const trimmed = (label || '').trim();
  if (!trimmed) return null;

  const { data: exact } = await supabase
    .from('branches')
    .select('id')
    .or(`name.ilike.${trimmed},code.ilike.${trimmed}`)
    .limit(1)
    .maybeSingle();
  if (exact?.id) return exact.id;

  // Loosen to a substring match either direction — the public label is
  // often a longer marketing name ("Famous Gates Hotel — Kyogong") than
  // the branch row's short name ("Kyogong").
  const { data: fuzzy } = await supabase
    .from('branches')
    .select('id, name')
    .limit(50);
  if (!Array.isArray(fuzzy)) return null;
  const lower = trimmed.toLowerCase();
  const match = fuzzy.find(
    (b: any) => lower.includes(String(b.name || '').toLowerCase()) || String(b.name || '').toLowerCase().includes(lower)
  );
  return match?.id ?? null;
}

/**
 * POST /api/reviews — public, unauthenticated (landing page "Write a
 * Review" form). No login system exists for guests, so anyone can submit;
 * reviews go live immediately (status='published') rather than sitting in
 * a moderation queue, matching the UX the landing page already had when
 * this was purely mock/local state.
 */
export const submitReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = req.body || {};
    const reviewerName = String(body.reviewer_name || body.name || '').trim();
    const content = String(body.content || '').trim();
    const branchLabel = String(body.branch_label || body.branch || '').trim();
    const rating = num1to5(body.rating);

    if (!reviewerName) throw new AppError('Your name is required', 400);
    if (!content) throw new AppError('Review text is required', 400);
    if (!branchLabel) throw new AppError('Branch is required', 400);
    if (!rating) throw new AppError('A rating from 1 to 5 is required', 400);

    const serviceType = SERVICE_TYPES.has(body.service_type) ? body.service_type : 'hotel';
    const stayType = STAY_TYPES.has(body.stay_type) ? body.stay_type : null;

    const branchId = await resolveBranchId(branchLabel);
    const { sentiment, confidence, issues } = analyzeReviewSentiment(rating, content);

    const row = {
      branch_id: branchId,
      branch_label: branchLabel,
      service_type: serviceType,
      stay_type: stayType,
      reviewer_name: reviewerName,
      reviewer_email: body.reviewer_email ? String(body.reviewer_email).trim() : null,
      reviewer_location: body.reviewer_location ? String(body.reviewer_location).trim() : null,
      rating,
      rating_cleanliness: num1to5(body.rating_cleanliness),
      rating_service: num1to5(body.rating_service),
      rating_comfort: num1to5(body.rating_comfort),
      rating_wifi: num1to5(body.rating_wifi),
      rating_location: num1to5(body.rating_location),
      rating_value: num1to5(body.rating_value),
      rating_food: num1to5(body.rating_food),
      content,
      stayed_on: body.stayed_on ? String(body.stayed_on).trim() : null,
      is_verified: false,
      status: 'published',
      sentiment,
      sentiment_confidence: confidence,
      issues_mentioned: issues,
      source: 'landing_page',
    };

    const { data, error } = await supabase.from('guest_reviews').insert(row).select('*').single();
    if (error) throw error;

    res.status(201).json({ success: true, data });
  } catch (error) {
    logger.error('submitReview failed:', error);
    next(error);
  }
};

/**
 * GET /api/reviews — public. Powers the landing page's reviews list.
 * Only ever returns status='published' — pending/hidden reviews never
 * leak to the public feed.
 */
export const listPublicReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branch, type, verified, sort } = req.query;

    let query = supabase.from('guest_reviews').select('*').eq('status', 'published');

    if (branch && String(branch).toLowerCase() !== 'all') {
      query = query.ilike('branch_label', `%${branch}%`);
    }
    if (type === 'hotel' || type === 'restaurant') {
      query = query.eq('service_type', type);
    }
    if (verified === 'true') {
      query = query.eq('is_verified', true);
    }

    switch (sort) {
      case 'highest':
        query = query.order('rating', { ascending: false });
        break;
      case 'lowest':
        query = query.order('rating', { ascending: true });
        break;
      case 'helpful':
        query = query.order('helpful_count', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query.limit(200);
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/reviews/:id/helpful — public. Anonymous "was this helpful"
 * counter. No guest login exists on the landing page, so this can't track
 * per-visitor toggle state server-side (unlike the old mock, which faked
 * that in local React state) — it's a plain increment.
 */
export const markReviewHelpful = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const { data: current, error: fetchError } = await supabase
      .from('guest_reviews')
      .select('helpful_count')
      .eq('id', id)
      .eq('status', 'published')
      .single();
    if (fetchError || !current) throw new AppError('Review not found', 404);

    const { data, error } = await supabase
      .from('guest_reviews')
      .update({ helpful_count: Number(current.helpful_count || 0) + 1 })
      .eq('id', id)
      .select('id, helpful_count')
      .single();
    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/reviews/manager/list — branch_manager/general_manager/director/
 * super_admin. Branch-scoped via applyBranchFilter's convention (manual
 * here since guest_reviews.branch_id can be null for unresolved branch
 * labels — global roles see everything, branch-restricted roles see only
 * their own branch_id, never the unresolved rows).
 */
export const listBranchReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const role = (req.user as any)?.role;
    const userBranchId = (req.user as any)?.branch_id ?? (req.user as any)?.branchId;

    let query = supabase.from('guest_reviews').select('*').order('created_at', { ascending: false });

    if (!isGlobalRole(role)) {
      const branchId = userBranchId !== undefined && userBranchId !== null ? Number(userBranchId) : null;
      query = query.eq('branch_id', branchId !== null && Number.isFinite(branchId) ? branchId : -1);
    }

    const { responded, rating, search } = req.query;
    if (responded === 'true') query = query.eq('responded', true);
    if (responded === 'false') query = query.eq('responded', false);
    if (rating) {
      const r = num1to5(rating);
      if (r) query = query.eq('rating', r);
    }
    if (search && String(search).trim()) {
      const term = String(search).trim();
      query = query.or(
        `content.ilike.%${term}%,reviewer_name.ilike.%${term}%,branch_label.ilike.%${term}%`
      );
    }

    const { data, error } = await query.limit(500);
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/reviews/manager/:id/respond — branch_manager/general_manager/
 * director/super_admin. Publishes (or clears) the public management reply
 * shown alongside the review. Branch-restricted roles may only respond to
 * reviews attributed to their own branch.
 */
export const respondToReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const responseText = String(req.body?.response_text ?? '').trim();
    const user = req.user as any;

    const { data: review, error: fetchError } = await supabase
      .from('guest_reviews')
      .select('id, branch_id')
      .eq('id', id)
      .single();
    if (fetchError || !review) throw new AppError('Review not found', 404);

    if (!isGlobalRole(user?.role)) {
      const userBranchId = user?.branch_id ?? user?.branchId;
      if (review.branch_id == null || Number(userBranchId) !== Number(review.branch_id)) {
        throw new AppError('Forbidden: this review belongs to another branch', 403);
      }
    }

    let responderLabel = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Branch Manager';
    if (user?.branch_id) {
      const { data: branchRow } = await supabase.from('branches').select('name').eq('id', user.branch_id).maybeSingle();
      if (branchRow?.name) responderLabel = `${responderLabel}, FamousGate ${branchRow.name}`;
    }

    const update = {
      responded: responseText.length > 0,
      response_text: responseText || null,
      response_by: responseText ? responderLabel : null,
      responded_at: responseText ? new Date().toISOString() : null,
      responded_by_user_id: responseText ? user?.id : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('guest_reviews').update(update).eq('id', id).select('*').single();
    if (error) throw error;

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};
