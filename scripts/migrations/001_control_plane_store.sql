CREATE SCHEMA IF NOT EXISTS public;

CREATE TABLE IF NOT EXISTS public.control_plane_store (
  id TEXT PRIMARY KEY,
  doc JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.control_plane_store (id, doc)
VALUES (
  'main',
  '{"instances":[],"assetReports":[],"assets":[],"assetBindings":[],"audits":[]}'::jsonb
)
ON CONFLICT (id) DO NOTHING;
