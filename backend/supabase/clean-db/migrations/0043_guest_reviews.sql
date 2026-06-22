-- Guest reviews submitted from the public landing page, surfaced to branch
-- managers (mobile_manager_reviews_screen.dart) for response. Reviewers are
-- public website visitors, not necessarily registered guests, so there is no
-- FK to guests - just freeform reviewer identity fields.

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id integer NOT NULL REFERENCES public.branches(id),

  reviewer_name text NOT NULL,
  reviewer_email text,
  reviewer_location text,
  is_verified boolean NOT NULL DEFAULT false,

  review_type text NOT NULL DEFAULT 'hotel' CHECK (review_type IN ('hotel', 'restaurant')),
  stay_type text CHECK (stay_type IN ('Business', 'Family', 'Couple', 'Solo', 'Vacation')),
  stayed_on text,

  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  rating_cleanliness integer CHECK (rating_cleanliness BETWEEN 1 AND 5),
  rating_service integer CHECK (rating_service BETWEEN 1 AND 5),
  rating_comfort integer CHECK (rating_comfort BETWEEN 1 AND 5),
  rating_wifi integer CHECK (rating_wifi BETWEEN 1 AND 5),
  rating_location integer CHECK (rating_location BETWEEN 1 AND 5),
  rating_value integer CHECK (rating_value BETWEEN 1 AND 5),
  rating_food integer CHECK (rating_food BETWEEN 1 AND 5),

  content text NOT NULL,

  helpful_count integer NOT NULL DEFAULT 0,
  likes_count integer NOT NULL DEFAULT 0,

  sentiment text CHECK (sentiment IN ('Positive', 'Neutral', 'Negative')),
  sentiment_confidence numeric(5,2),
  issues_mentioned text[] NOT NULL DEFAULT '{}',

  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'pending', 'rejected')),

  manager_response text,
  manager_response_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  manager_response_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_branch_id ON public.reviews(branch_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON public.reviews(created_at DESC);
