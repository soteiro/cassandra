import { formatCLP } from './moneda.util';

describe('formatCLP', () => {
  it('should format CLP with thousands separator and no decimals', () => {
    expect(formatCLP(600)).toMatch(/^\$\s?600$/);
    expect(formatCLP(1500)).toMatch(/1\.500/);
    expect(formatCLP(1234567)).toMatch(/1\.234\.567/);
    expect(formatCLP(1500.6)).toMatch(/1\.501$/);
  });

  it('should treat empty values as 0', () => {
    expect(formatCLP(0)).toMatch(/0$/);
    expect(formatCLP(null as unknown as number)).toMatch(/0$/);
  });
});
