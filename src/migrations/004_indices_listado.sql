CREATE INDEX IF NOT EXISTS idx_incidentes_created
  ON incidentes(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_incidentes_status_created
  ON incidentes(status, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_incidentes_priority_created
  ON incidentes(priority, created_at DESC, id DESC);
