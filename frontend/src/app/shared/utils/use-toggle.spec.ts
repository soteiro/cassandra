import { useToggle } from './use-toggle';

describe('useToggle', () => {
  it('should default to closed', () => {
    expect(useToggle().isOpen()).toBe(false);
  });

  it('should honour the initial value', () => {
    expect(useToggle(true).isOpen()).toBe(true);
  });

  it('should open, close and toggle', () => {
    const t = useToggle();
    t.open();
    expect(t.isOpen()).toBe(true);
    t.close();
    expect(t.isOpen()).toBe(false);
    t.toggle();
    expect(t.isOpen()).toBe(true);
    t.toggle();
    expect(t.isOpen()).toBe(false);
  });

  it('should create independent instances', () => {
    const a = useToggle();
    const b = useToggle();
    a.open();
    expect(b.isOpen()).toBe(false);
  });
});
