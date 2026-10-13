CREATE TABLE installations (
  installation_id TEXT PRIMARY KEY CHECK (
    length(installation_id) BETWEEN 1 AND 255
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE widget_configs (
  installation_id TEXT NOT NULL REFERENCES installations(installation_id) ON DELETE CASCADE,
  widget_instance_key TEXT NOT NULL CHECK (
    length(widget_instance_key) BETWEEN 1 AND 255
  ),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  jira_board_id TEXT NOT NULL CHECK (length(jira_board_id) BETWEEN 1 AND 128),
  enabled_providers JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (
    jsonb_typeof(enabled_providers) = 'array'
    AND enabled_providers <@ '["github_copilot", "openai", "anthropic"]'::jsonb
  ),
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(preferences) = 'object'
    AND preferences - ARRAY['showStoryPoints', 'estimateFieldId'] = '{}'::jsonb
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (installation_id, widget_instance_key)
);

CREATE INDEX widget_configs_installation_updated_idx
  ON widget_configs (installation_id, updated_at DESC);
