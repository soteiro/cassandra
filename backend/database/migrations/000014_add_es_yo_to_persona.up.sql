-- Agregar columna es_yo para identificar al usuario dueño en la tabla persona
ALTER TABLE persona 
    ADD COLUMN IF NOT EXISTS es_yo BOOL DEFAULT false;
