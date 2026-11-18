-- Una key puede cubrir todos los proyectos y/o todos los calendarios del usuario, incluidos
-- los que se creen después (p. ej. un asistente PM). Con el flag activo la lista asociada
-- debe estar vacía: la autorización usa el flag, nunca una lista vacía como comodín.
ALTER TABLE api_keys ADD COLUMN todos_proyectos BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE api_keys ADD COLUMN todos_calendarios BOOLEAN NOT NULL DEFAULT false;
