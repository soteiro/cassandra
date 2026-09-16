CREATE TABLE IF NOT EXISTS banco (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'efectivo' NOT NULL CHECK (tipo IN ('debito', 'credito', 'efectivo')),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    eliminado BOOL DEFAULT false
);

CREATE TABLE IF NOT EXISTS grupo_item_finanzas (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    eliminado BOOL DEFAULT false
);

CREATE TABLE IF NOT EXISTS movimiento_esperado_finanzas (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    eliminado BOOL DEFAULT false
);

CREATE TABLE IF NOT EXISTS finanzas_plantilla (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en proceso', 'completado')),
    mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    anio INT NOT NULL,
    eliminado BOOL DEFAULT false,
    nombre VARCHAR(100) NOT NULL,
    monto INT NOT NULL DEFAULT 0, -- monto en clp
    banco_id INT REFERENCES banco(id) ON DELETE SET NULL,
    grupo_item_id INT REFERENCES grupo_item_finanzas(id) ON DELETE SET NULL,
    movimiento_esperado_id INT REFERENCES movimiento_esperado_finanzas(id) ON DELETE SET NULL
);

-- Índices para búsquedas rápidas por período
CREATE INDEX IF NOT EXISTS idx_finanzas_plantilla_user_periodo ON finanzas_plantilla(user_id, anio, mes);
