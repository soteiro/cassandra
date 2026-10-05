-- Falla si ya hay bancos 'prepago'; hay que cambiarlos antes de bajar.
ALTER TABLE banco DROP CONSTRAINT IF EXISTS banco_tipo_check;
ALTER TABLE banco ADD CONSTRAINT banco_tipo_check CHECK (tipo IN ('debito', 'credito', 'efectivo'));
