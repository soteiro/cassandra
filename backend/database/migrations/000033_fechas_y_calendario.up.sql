-- Calendario: fechas de inicio y límite en tareas, inicio en proyectos, y los
-- calendarios propios (turnos con ciclo y actividades).

-- Fechas para que tareas y proyectos se vean como barras en el calendario.
-- Mismo tipo que proyectos.fecha_limite: el cliente manda la medianoche UTC del día.
ALTER TABLE tareas_proyectos
    ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS fecha_limite TIMESTAMP WITH TIME ZONE;
ALTER TABLE tareas_proyectos ADD CONSTRAINT check_tareas_fechas
    CHECK (fecha_inicio IS NULL OR fecha_limite IS NULL OR fecha_inicio <= fecha_limite);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_limite ON tareas_proyectos (user_id, fecha_limite)
    WHERE fecha_limite IS NOT NULL AND eliminado = false;

ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_inicio TIMESTAMP WITH TIME ZONE;
ALTER TABLE proyectos ADD CONSTRAINT check_proyectos_fechas
    CHECK (fecha_inicio IS NULL OR fecha_limite IS NULL OR fecha_inicio <= fecha_limite);

-- La capa de deadlines no es un calendario propio: su visibilidad va en la cuenta.
ALTER TABLE users ADD COLUMN IF NOT EXISTS calendario_ocultar_deadlines BOOL NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS calendarios (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nombre VARCHAR(80) NOT NULL,
    color VARCHAR(7) NOT NULL DEFAULT '#58a6ff' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    -- turnos: días calculados por un ciclo; actividades: horarios propios.
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('turnos', 'actividades')),
    oculto BOOL NOT NULL DEFAULT false,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    eliminado BOOL NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_calendarios_user ON calendarios (user_id) WHERE eliminado = false;

-- Desde "desde" rige el patrón contado a partir de "ancla" (el primer día del ciclo).
-- Cambiar el ciclo agrega una fila: los días anteriores conservan el cálculo anterior.
CREATE TABLE IF NOT EXISTS calendario_ciclos (
    id SERIAL PRIMARY KEY,
    calendario_id INT NOT NULL REFERENCES calendarios(id) ON DELETE CASCADE,
    desde DATE NOT NULL,
    ancla DATE NOT NULL,
    patron VARCHAR(30) NOT NULL DEFAULT 'cuarto_turno' CHECK (patron IN ('cuarto_turno')),
    UNIQUE (calendario_id, desde)
);

-- Un día que se sale del ciclo: L largo, N noche, S saliente, F libre, V vacaciones, M licencia.
CREATE TABLE IF NOT EXISTS calendario_excepciones (
    calendario_id INT NOT NULL REFERENCES calendarios(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    codigo VARCHAR(1) NOT NULL CHECK (codigo IN ('L', 'N', 'S', 'F', 'V', 'M')),
    PRIMARY KEY (calendario_id, fecha)
);

-- Actividad de una vez (dias_semana vacío) o semanal (0 = lunes … 6 = domingo),
-- desde "fecha" hasta "hasta" (sin fin si es NULL).
CREATE TABLE IF NOT EXISTS calendario_actividades (
    id SERIAL PRIMARY KEY,
    calendario_id INT NOT NULL REFERENCES calendarios(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    dias_semana SMALLINT[] NOT NULL DEFAULT '{}',
    hasta DATE,
    fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    eliminado BOOL NOT NULL DEFAULT false,
    CHECK (hora_fin > hora_inicio),
    CHECK (hasta IS NULL OR hasta >= fecha),
    CHECK (dias_semana <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::SMALLINT[])
);
CREATE INDEX IF NOT EXISTS idx_calendario_actividades_cal ON calendario_actividades (calendario_id)
    WHERE eliminado = false;

-- Un día en que una actividad semanal no ocurre (feriado, terapia suspendida).
CREATE TABLE IF NOT EXISTS calendario_cancelaciones (
    actividad_id INT NOT NULL REFERENCES calendario_actividades(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    PRIMARY KEY (actividad_id, fecha)
);
