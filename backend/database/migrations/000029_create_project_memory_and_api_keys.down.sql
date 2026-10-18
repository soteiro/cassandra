DROP TABLE IF EXISTS memoria_operaciones;
DROP TABLE IF EXISTS memoria_fichas;
DROP TABLE IF EXISTS memoria_proyectos;
DROP TABLE IF EXISTS api_key_proyectos;
DROP TABLE IF EXISTS api_keys;
ALTER TABLE documentos_proyecto DROP COLUMN IF EXISTS gestionado;
