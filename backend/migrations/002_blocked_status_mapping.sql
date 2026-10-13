ALTER TABLE widget_configs
DROP CONSTRAINT IF EXISTS widget_configs_preferences_check;

ALTER TABLE widget_configs
ADD CONSTRAINT widget_configs_preferences_check CHECK (
  jsonb_typeof(preferences) = 'object'
  AND preferences - ARRAY[
    'showStoryPoints',
    'estimateFieldId',
    'blockedStatusNames'
  ] = '{}'::jsonb
);
