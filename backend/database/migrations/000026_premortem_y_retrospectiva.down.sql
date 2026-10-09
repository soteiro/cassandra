ALTER TABLE documentos_proyecto DROP CONSTRAINT IF EXISTS check_documentos_proyecto_tipo;
UPDATE documentos_proyecto SET tipo = 'general' WHERE tipo = 'retrospectiva';
ALTER TABLE documentos_proyecto ADD CONSTRAINT check_documentos_proyecto_tipo
    CHECK (tipo IN ('arquitectura', 'investigacion', 'decision', 'guia', 'idea', 'pajas mentales', 'general'));

DROP TRIGGER IF EXISTS eventos_proyectos ON proyectos;
CREATE TRIGGER eventos_proyectos AFTER INSERT OR UPDATE ON proyectos
    FOR EACH ROW EXECUTE FUNCTION registrar_evento('proyecto', 'descripcion,comentario,por_que,para_que,criterio_finalizacion');
ALTER TABLE proyectos DROP COLUMN IF EXISTS premortem;
