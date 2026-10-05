-- El nombre de proyecto era único entre TODOS los usuarios: un usuario no podía usar un
-- nombre que otro ya tuviera (y el error revelaba que existía). Ahora es único por
-- usuario y solo entre proyectos no eliminados (se puede reutilizar el de uno borrado).
ALTER TABLE proyectos DROP CONSTRAINT IF EXISTS proyectos_nombre_key;
CREATE UNIQUE INDEX IF NOT EXISTS proyectos_user_nombre_activo_key
    ON proyectos (user_id, nombre) WHERE eliminado = false;

-- users.alias es UNIQUE y opcional: "sin alias" debe guardarse como NULL, no como ''
-- (con '' solo un usuario podía no tener alias).
UPDATE users SET alias = NULL WHERE alias = '';
