-- Director Review Tasks Table
-- Allows the Director to assign review tasks to Branch Accountants, Auditors, HR, etc.

CREATE TABLE IF NOT EXISTS director_review_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  director_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_to_role TEXT NOT NULL,
  assigned_to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  branch_id INT REFERENCES branches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','IN_PROGRESS','COMPLETED','DISMISSED')),
  related_record_date DATE,
  related_stream TEXT,
  director_notes TEXT,
  response_notes TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_director_tasks_role ON director_review_tasks(assigned_to_role);
CREATE INDEX IF NOT EXISTS idx_director_tasks_status ON director_review_tasks(status);
CREATE INDEX IF NOT EXISTS idx_director_tasks_branch ON director_review_tasks(branch_id);
CREATE INDEX IF NOT EXISTS idx_director_tasks_director ON director_review_tasks(director_id);

-- Enable Row Level Security
ALTER TABLE director_review_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Service role bypasses RLS (backend uses service key)
CREATE POLICY "Allow service role full access" ON director_review_tasks
  FOR ALL USING (true) WITH CHECK (true);
