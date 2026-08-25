-- Crear registro personal en la tabla persona para todos los usuarios existentes que no lo tengan
INSERT INTO persona (user_id, nombre, alias, entorno, informacion, es_yo, eliminado)
SELECT 
    u.id,
    u.nombre,
    u.alias,
    'Personal',
    'Mi espacio de reflexiones y notas personales',
    true,
    false
FROM users u
WHERE NOT EXISTS (
    SELECT 1 
    FROM persona p 
    WHERE p.user_id = u.id AND p.es_yo = true
);
