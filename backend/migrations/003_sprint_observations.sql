CREATE TABLE sprint_observations (
  installation_id TEXT NOT NULL REFERENCES installations(installation_id) ON DELETE CASCADE,
  widget_instance_key TEXT NOT NULL,
  viewer_id TEXT NOT NULL,
  board_id TEXT NOT NULL,
  sprint_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  remaining_issue_count INTEGER NOT NULL CHECK (remaining_issue_count >= 0),
  PRIMARY KEY (installation_id, widget_instance_key, viewer_id, board_id, sprint_id, observed_at)
);
CREATE INDEX sprint_observations_expiry_idx ON sprint_observations(observed_at);
