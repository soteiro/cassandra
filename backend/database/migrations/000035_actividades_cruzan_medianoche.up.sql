-- Una actividad puede terminar al día siguiente (dormir de 22:30 a 07:00): un fin
-- anterior al inicio significa que cruza la medianoche. Solo se prohíbe que sean iguales.
ALTER TABLE calendario_actividades DROP CONSTRAINT calendario_actividades_check;
ALTER TABLE calendario_actividades ADD CONSTRAINT calendario_actividades_horas_check
    CHECK (hora_fin <> hora_inicio);
