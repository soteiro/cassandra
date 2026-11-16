-- Las actividades que cruzan la medianoche no caben en la restricción anterior.
DELETE FROM calendario_actividades WHERE hora_fin < hora_inicio;
ALTER TABLE calendario_actividades DROP CONSTRAINT calendario_actividades_horas_check;
ALTER TABLE calendario_actividades ADD CONSTRAINT calendario_actividades_check
    CHECK (hora_fin > hora_inicio);
