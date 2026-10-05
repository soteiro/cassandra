DROP INDEX IF EXISTS proyectos_user_nombre_activo_key;
-- Falla si ya hay nombres repetidos entre usuarios; hay que renombrarlos antes de bajar.
ALTER TABLE proyectos ADD CONSTRAINT proyectos_nombre_key UNIQUE (nombre);
