-- La app ofrece cuentas "prepago" y el backend las acepta, pero el CHECK original no las
-- incluía (crear una terminaba en error).
ALTER TABLE banco DROP CONSTRAINT IF EXISTS banco_tipo_check;
ALTER TABLE banco ADD CONSTRAINT banco_tipo_check CHECK (tipo IN ('debito', 'credito', 'prepago', 'efectivo'));
