-- Branch feature toggles: per-branch on/off switches for system capabilities
CREATE TABLE IF NOT EXISTS branch_features (
  id            SERIAL PRIMARY KEY,
  branch_id     INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  feature_name  TEXT    NOT NULL,
  feature_key   TEXT,
  category      TEXT,
  is_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  config        JSONB   NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_by    UUID,
  CONSTRAINT uq_branch_feature_name UNIQUE (branch_id, feature_name)
);

CREATE INDEX IF NOT EXISTS idx_branch_features_branch_id ON branch_features(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_features_key ON branch_features(feature_key);
