-- Revisión semanal: cada revisión guarda una nota de cierre y un resumen con números,
-- para ver las revisiones a lo largo del tiempo.
CREATE TABLE IF NOT EXISTS revisiones (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nota TEXT NOT NULL DEFAULT '',
    -- Números de la revisión (terminadas, revisadas, decisiones…). Lo arma el cliente.
    resumen JSONB NOT NULL DEFAULT '{}',
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    eliminado BOOL NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_revisiones_user_fecha ON revisiones (user_id, fecha_creacion DESC);

CREATE TRIGGER eventos_revisiones AFTER INSERT OR UPDATE ON revisiones
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('revision', 'nota');

-- Preferencias del usuario (en su cuenta, para que también las conozca el agente).
-- dia_revision: 0 = domingo … 6 = sábado. limite_en_curso: tareas En Curso a la vez.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS dia_revision SMALLINT NOT NULL DEFAULT 0 CHECK (dia_revision BETWEEN 0 AND 6),
    ADD COLUMN IF NOT EXISTS limite_en_curso SMALLINT NOT NULL DEFAULT 5 CHECK (limite_en_curso BETWEEN 1 AND 50);
