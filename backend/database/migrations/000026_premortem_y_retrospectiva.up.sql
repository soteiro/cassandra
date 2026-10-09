-- Pre-mortem: "imagina que este proyecto fracasó, ¿por qué fue?", escrito al crearlo.
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS premortem TEXT;

-- Es texto libre: el registro de eventos solo debe anotar que cambió, no copiarlo.
-- Los argumentos de un trigger se fijan al crearlo, así que se recrea con la lista nueva.
DROP TRIGGER IF EXISTS eventos_proyectos ON proyectos;
CREATE TRIGGER eventos_proyectos AFTER INSERT OR UPDATE ON proyectos
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('proyecto', 'descripcion,comentario,por_que,para_que,criterio_finalizacion,premortem');

-- Retrospectiva al cerrar un proyecto: un tipo de documento más.
ALTER TABLE documentos_proyecto DROP CONSTRAINT IF EXISTS check_documentos_proyecto_tipo;
ALTER TABLE documentos_proyecto ADD CONSTRAINT check_documentos_proyecto_tipo
    CHECK (tipo IN ('arquitectura', 'investigacion', 'decision', 'guia', 'idea', 'pajas mentales', 'general', 'retrospectiva'));
