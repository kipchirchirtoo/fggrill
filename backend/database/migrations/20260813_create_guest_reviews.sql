-- Guest reviews: customer-submitted feedback for hotel/restaurant/general
-- services. Submitted publicly from the landing page (POST /api/reviews),
-- displayed publicly there too (GET /api/reviews), and managed per-branch
-- by branch managers (GET/PATCH /api/branch-manager/reviews...) — see
-- famous_gates_app's MobileManagerReviewsScreen and landing-page's
-- src/pages/reviews.tsx, both of which previously only rendered hardcoded
-- mock data with nothing behind them.

CREATE TABLE IF NOT EXISTS guest_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Branch attribution. branch_id is resolved server-side (best-effort,
  -- name/code match) from whatever branch label the public submitter
  -- picked, so branch managers can filter via the same applyBranchFilter
  -- convention every other branch-scoped endpoint uses. branch_label is
  -- always populated for display even when resolution fails.
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  branch_label VARCHAR(150) NOT NULL,

  service_type VARCHAR(20) NOT NULL DEFAULT 'hotel'
    CHECK (service_type IN ('hotel', 'restaurant', 'general')),
  stay_type VARCHAR(20)
    CHECK (stay_type IS NULL OR stay_type IN ('Business', 'Family', 'Couple', 'Solo', 'Vacation')),

  reviewer_name VARCHAR(150) NOT NULL,
  reviewer_email VARCHAR(255),
  reviewer_location VARCHAR(150),

  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  rating_cleanliness SMALLINT CHECK (rating_cleanliness BETWEEN 1 AND 5),
  rating_service SMALLINT CHECK (rating_service BETWEEN 1 AND 5),
  rating_comfort SMALLINT CHECK (rating_comfort BETWEEN 1 AND 5),
  rating_wifi SMALLINT CHECK (rating_wifi BETWEEN 1 AND 5),
  rating_location SMALLINT CHECK (rating_location BETWEEN 1 AND 5),
  rating_value SMALLINT CHECK (rating_value BETWEEN 1 AND 5),
  rating_food SMALLINT CHECK (rating_food BETWEEN 1 AND 5),

  content TEXT NOT NULL,
  stayed_on VARCHAR(50),

  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'pending', 'hidden')),

  -- Computed server-side at submission time (backend/src/utils/review-sentiment.ts)
  -- so the landing page and branch-manager screen never disagree on it.
  sentiment VARCHAR(20) CHECK (sentiment IS NULL OR sentiment IN ('Positive', 'Neutral', 'Negative')),
  sentiment_confidence NUMERIC(5,2),
  issues_mentioned JSONB NOT NULL DEFAULT '[]'::jsonb,

  helpful_count INTEGER NOT NULL DEFAULT 0,
  likes_count INTEGER NOT NULL DEFAULT 0,

  responded BOOLEAN NOT NULL DEFAULT FALSE,
  response_text TEXT,
  response_by VARCHAR(150),
  responded_at TIMESTAMPTZ,
  responded_by_user_id UUID REFERENCES users(id),

  source VARCHAR(20) NOT NULL DEFAULT 'landing_page'
    CHECK (source IN ('landing_page', 'manual', 'import')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guest_reviews_branch_id ON guest_reviews(branch_id);
CREATE INDEX IF NOT EXISTS idx_guest_reviews_status ON guest_reviews(status);
CREATE INDEX IF NOT EXISTS idx_guest_reviews_created_at ON guest_reviews(created_at DESC);

-- All reads/writes in this feature go through the Node backend's
-- service-role Supabase client (bypasses RLS, same as every other
-- controller in this codebase). RLS is still enabled with a narrow public
-- policy as a floor, in case a future direct-Supabase read path (the
-- pattern this app already uses for Realtime/KDS) is added for the public
-- review feed.
ALTER TABLE guest_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guest_reviews_public_read_published ON guest_reviews;
CREATE POLICY guest_reviews_public_read_published ON guest_reviews
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

NOTIFY pgrst, 'reload schema';
