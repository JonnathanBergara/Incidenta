CREATE OR REPLACE FUNCTION actualizar_fecha_incidente()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incidentes_updated_at ON incidentes;
CREATE TRIGGER trg_incidentes_updated_at
  BEFORE UPDATE ON incidentes
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_fecha_incidente();
