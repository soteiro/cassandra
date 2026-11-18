-- Las keys globales pierden su alcance: se revocan para no dejarlas sin proyectos.
UPDATE api_keys SET revocada_en = COALESCE(revocada_en, CURRENT_TIMESTAMP) WHERE todos_proyectos;
ALTER TABLE api_keys DROP COLUMN todos_calendarios;
ALTER TABLE api_keys DROP COLUMN todos_proyectos;
